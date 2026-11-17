// SoDEX signing in the browser.
//
// 1. Session key: the browser generates a trading key. The user's wallet (MetaMask)
//    signs ONE UserSignedAddAPIKeyAction registering it for 24h. The domain uses the
//    wallet's current chain, so no custom network has to be added to MetaMask.
// 2. Orders are signed locally with the session key (EIP-712 ExchangeAction over
//    keccak256 of the compact {"type":"batchNewOrder","params":...} JSON).
// The master wallet key never leaves the wallet; the server only relays signed requests.

import { keccak256, toBytes } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

export const SODEX_CHAIN_ID = 138565 // ValueChain testnet
const ZERO = '0x0000000000000000000000000000000000000000'
const SESSION_TTL_MS = 24 * 3600_000
const storeKey = addr => `finpulse_sodex_session_${addr.toLowerCase()}`

const SIDE = { buy: 1, sell: 2 }
const TYPE = { LIMIT: 1, MARKET: 2 }
const TIF = { GTC: 1, FOK: 2, IOC: 3, GTX: 4 }

// --- helpers ---

/** viem/MetaMask return v = 27/28; SoDEX expects 0/1, prefixed by the signature type byte. */
function wireSignature(sig, typeByte) {
  const v = parseInt(sig.slice(-2), 16)
  const norm = (v >= 27 ? v - 27 : v).toString(16).padStart(2, '0')
  return `0x0${typeByte}${sig.slice(2, -2)}${norm}`
}

async function json(res) {
  const body = await res.json().catch(() => ({}))
  if (!res.ok || (body.code !== undefined && body.code !== 0)) throw new Error(body.error || body.message || `HTTP ${res.status}`)
  return body
}

let lastNonce = 0
function nextNonce() {
  lastNonce = Math.max(Date.now(), lastNonce + 1)
  return lastNonce
}

// --- wallet ---

export function hasWallet() {
  return typeof window !== 'undefined' && !!window.ethereum
}

export async function connectWallet() {
  if (!hasWallet()) throw new Error('No browser wallet found. Install MetaMask to trade.')
  const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' })
  return address
}

// --- session key ---

export function loadSession(address) {
  try {
    const s = JSON.parse(localStorage.getItem(storeKey(address)) || 'null')
    if (s && s.expiresAt - Date.now() > 5 * 60_000) return s
  } catch { /* storage unavailable */ }
  return null
}

export function clearSession(address) {
  try { localStorage.removeItem(storeKey(address)) } catch { /* ignore */ }
}

/**
 * Register a 24h trading key for `address` on `accountID`.
 * Prompts the wallet once. Returns the stored session.
 */
export async function enableTrading(address, accountID) {
  const walletChainHex = await window.ethereum.request({ method: 'eth_chainId' })
  const walletChainId = parseInt(walletChainHex, 16)

  const privateKey = generatePrivateKey()
  const tradingKey = privateKeyToAccount(privateKey)
  const name = `finpulse-${Math.random().toString(36).slice(2, 10)}`
  const nonce = nextNonce()
  const expiresAt = nonce + SESSION_TTL_MS

  const typedData = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      UserSignedAddAPIKeyAction: [
        { name: 'chainID', type: 'uint64' },
        { name: 'nonce', type: 'uint64' },
        { name: 'accountID', type: 'uint64' },
        { name: 'name', type: 'string' },
        { name: 'keyType', type: 'uint8' },
        { name: 'publicKey', type: 'bytes' },
        { name: 'expiresAt', type: 'uint64' },
      ],
    },
    domain: { name: 'universal', version: '1', chainId: walletChainId, verifyingContract: ZERO },
    primaryType: 'UserSignedAddAPIKeyAction',
    message: {
      chainID: String(SODEX_CHAIN_ID),
      nonce: String(nonce),
      accountID: String(accountID),
      name,
      keyType: 1,
      publicKey: tradingKey.address.toLowerCase(),
      expiresAt: String(expiresAt),
    },
  }

  const raw = await window.ethereum.request({ method: 'eth_signTypedData_v4', params: [address, JSON.stringify(typedData)] })
  const envelope = {
    type: 'addAPIKey',
    params: { accountID, name, type: 1, publicKey: tradingKey.address, expiresAt },
    nonce, signature: wireSignature(raw, 2), signatureChainID: walletChainId,
  }

  // Registration must be accepted by both engines.
  const results = await Promise.allSettled(['spot', 'perps'].map(engine =>
    fetch(`/api/sodex/exchange/${engine}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(envelope) }).then(json)))
  const failed = results.map((r, i) => r.status === 'rejected' ? `${i ? 'perps' : 'spot'}: ${r.reason.message}` : null).filter(Boolean)
  if (failed.length) throw new Error(`SoDEX rejected the trading key — ${failed.join('; ')}`)

  const session = { address, accountID, name, privateKey, publicKey: tradingKey.address, expiresAt, createdAt: Date.now() }
  try { localStorage.setItem(storeKey(address), JSON.stringify(session)) } catch { /* session lives in memory only */ }
  return session
}

// --- orders ---

/** Canonical params in Go struct order; the server rebuilds the identical object. */
export function buildSpotOrder({ accountID, symbolID, side, price, quantity, type = 'LIMIT', timeInForce = 'IOC', clOrdID }) {
  const item = { symbolID, clOrdID, side: SIDE[side], type: TYPE[type], timeInForce: TIF[timeInForce] }
  if (price !== undefined) item.price = price
  item.quantity = quantity
  return { accountID, orders: [item] }
}

export async function signSpotOrder(session, params) {
  const account = privateKeyToAccount(session.privateKey)
  const nonce = nextNonce()
  const payloadHash = keccak256(toBytes(JSON.stringify({ type: 'batchNewOrder', params })))
  const sig = await account.signTypedData({
    domain: { name: 'spot', version: '1', chainId: SODEX_CHAIN_ID, verifyingContract: ZERO },
    types: { ExchangeAction: [{ name: 'payloadHash', type: 'bytes32' }, { name: 'nonce', type: 'uint64' }] },
    primaryType: 'ExchangeAction',
    message: { payloadHash, nonce: BigInt(nonce) },
  })
  return { key: session.name, sign: wireSignature(sig, 1), nonce, payloadHash }
}

export async function submitSpotOrder(session, params, context) {
  const auth = await signSpotOrder(session, params)
  const res = await fetch('/api/sodex/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ params, auth: { key: auth.key, sign: auth.sign, nonce: auth.nonce }, context }),
  })
  return { ...(await json(res)), payloadHash: auth.payloadHash, nonce: auth.nonce }
}

export async function fetchAccount(address) {
  return json(await fetch(`/api/sodex/account/${address}`))
}
