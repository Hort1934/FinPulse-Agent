export function getMockDataForEndpoint(endpoint) {
  const path = endpoint.split('?')[0];

  if (path.includes('/market-snapshot') && path.includes('/currencies/')) {
    return {
      price: 50000 + Math.random() * 20000,
      change_pct_24h: (Math.random() - 0.5) * 0.1,
      marketcap: 1e12 + Math.random() * 5e11,
      turnover_24h: 3e10 + Math.random() * 1e10,
    };
  }

  if (path.includes('/sector-spotlight')) {
    return [
      { name: 'Layer 1', change_pct_24h: 0.05 },
      { name: 'DeFi', change_pct_24h: -0.02 },
      { name: 'NFT', change_pct_24h: 0.1 },
      { name: 'GameFi', change_pct_24h: 0.08 },
      { name: 'Meme', change_pct_24h: -0.05 },
      { name: 'AI', change_pct_24h: 0.15 },
      { name: 'Storage', change_pct_24h: 0.01 },
      { name: 'Web3', change_pct_24h: 0.03 }
    ];
  }

  if (path === '/etfs') {
    return [
      { ticker: 'IBIT', name: 'iShares Bitcoin Trust', price: 35.4, change_pct: 2.1 },
      { ticker: 'FBTC', name: 'Fidelity Wise Origin Bitcoin', price: 54.2, change_pct: 1.8 },
      { ticker: 'ARKB', name: 'ARK 21Shares Bitcoin ETF', price: 60.1, change_pct: 2.5 },
      { ticker: 'BITB', name: 'Bitwise Bitcoin ETF', price: 38.5, change_pct: 1.5 }
    ];
  }

  if (path.includes('/etfs/') && path.includes('/market-snapshot')) {
    return {
      price: 40 + Math.random() * 20,
      change_pct_24h: (Math.random() - 0.5) * 0.05,
      net_inflow: 50000000 + Math.random() * 100000000,
      total_nav: 1e9 + Math.random() * 1e9,
    };
  }

  if (path.includes('/indices/') && path.includes('/market-snapshot')) {
    return {
      price: 1000 + Math.random() * 500,
      change_pct_24h: (Math.random() - 0.5) * 0.05,
      marketcap: 5e11,
    };
  }

  if (path.includes('/indices/') && path.includes('/constituents')) {
    return [
      { symbol: 'BTC', weight: 0.6 },
      { symbol: 'ETH', weight: 0.3 },
      { symbol: 'SOL', weight: 0.1 }
    ];
  }

  if (path.includes('/indices/') && path.includes('/klines')) {
    const data = [];
    let price = 1000;
    for (let i = 0; i < 30; i++) {
      price = price * (1 + (Math.random() - 0.5) * 0.02);
      data.push({
        timestamp: Date.now() - (30 - i) * 86400000,
        open: price,
        close: price * 1.01,
        high: price * 1.02,
        low: price * 0.98,
        volume: 1000000
      });
    }
    return data;
  }

  if (path === '/macro/events') {
    return [
      { event_name: 'FOMC Meeting', date: Date.now() + 86400000, impact: 'High', actual: '', forecast: '5.25%', previous: '5.50%' },
      { event_name: 'CPI Release', date: Date.now() + 86400000 * 3, impact: 'High', actual: '', forecast: '3.1%', previous: '3.2%' },
      { event_name: 'Nonfarm Payrolls', date: Date.now() + 86400000 * 5, impact: 'Medium', actual: '', forecast: '200K', previous: '215K' }
    ];
  }

  if (path.includes('/news')) {
    return {
      list: [
        {
          id: 1, title: 'Bitcoin Surges Past Resistance', content: 'Bitcoin broke past key resistance levels amidst institutional inflows.',
          category: 1, release_time: Date.now() - 3600000, author: 'CoinDesk', matched_currencies: [{name: 'BTC'}],
          tags: ['Market', 'Institutional'], like_count: 120, impression_count: 45000, original_link: '#'
        },
        {
          id: 2, title: 'Ethereum Foundation Announces Upgrade', content: 'The next big upgrade for Ethereum will lower fees further.',
          category: 7, release_time: Date.now() - 7200000, author: 'ETH Org', matched_currencies: [{name: 'ETH'}],
          tags: ['Tech', 'DeFi'], like_count: 340, impression_count: 89000, original_link: '#'
        },
        {
          id: 3, title: 'Macro Risks Persist as Markets Dump', content: 'A sudden crash in equity markets pulls down crypto prices.',
          category: 4, release_time: Date.now() - 14400000, author: 'Bloomberg', matched_currencies: [],
          tags: ['Macro', 'Risk'], like_count: 45, impression_count: 12000, original_link: '#'
        }
      ]
    };
  }

  if (path.includes('/fundraising/projects') && !path.match(/\/projects\/.+/)) {
    return [
      { project_id: '1', name: 'DeFi protocol X', sector: 'DeFi', total_raised: 15000000, round: 'Series A' },
      { project_id: '2', name: 'Web3 Game Y', sector: 'GameFi', total_raised: 5000000, round: 'Seed' },
      { project_id: '3', name: 'AI Network Z', sector: 'AI', total_raised: 25000000, round: 'Series B' }
    ];
  }

  if (path.match(/\/fundraising\/projects\/.+/)) {
    return {
      project_id: '1', name: 'DeFi protocol X', description: 'A revolutionary DeFi protocol.', investors: ['a16z', 'Paradigm'], links: { website: '#', twitter: '#' }
    };
  }

  if (path === '/btc-treasuries') {
    return [
      { ticker: 'MSTR', name: 'MicroStrategy', total_holdings: 190000, total_value: 9500000000, entry_value: 5000000000 },
      { ticker: 'TSLA', name: 'Tesla', total_holdings: 9720, total_value: 486000000, entry_value: 336000000 },
      { ticker: 'MARA', name: 'Marathon Digital', total_holdings: 13700, total_value: 685000000, entry_value: 400000000 }
    ];
  }

  if (path.includes('/btc-treasuries/') && path.includes('/purchase-history')) {
    return {
      data: [
        { date: '2023-01-01', btc_holding: 1000 + Math.random() * 10000, price: 30000 },
        { date: '2023-06-01', btc_holding: 500 + Math.random() * 5000, price: 40000 }
      ]
    };
  }

  if (path === '/currencies') {
    return [
      { id: '1673723677362319866', symbol: 'BTC', name: 'Bitcoin' },
      { id: '1673723677362319867', symbol: 'ETH', name: 'Ethereum' },
      { id: '1673723677362319875', symbol: 'SOL', name: 'Solana' }
    ];
  }

  return {};
}
