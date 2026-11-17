// Execution log: every order relayed to SoDEX is stored together with the
// FinPulse signal that was on screen when it was placed, so the path
// signal -> risk check -> signed order -> exchange result is auditable.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data'), 'executions.json');

function read() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { entries: [] }; }
}

export function recordExecution(entry) {
  const db = read();
  db.entries.push({ ts: Date.now(), ...entry });
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(db, null, 2));
  fs.renameSync(`${FILE}.tmp`, FILE);
}

export function listExecutions(address) {
  const entries = read().entries.filter(e => !address || e.address?.toLowerCase() === address.toLowerCase());
  return entries.slice(-50).reverse();
}
