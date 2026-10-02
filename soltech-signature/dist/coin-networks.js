export const NETWORKS=Object.freeze({
 solana:{name:'Solana',gecko:'solana',explorer:'https://solscan.io',kind:'solana'},
 ethereum:{name:'Ethereum',gecko:'eth',explorer:'https://etherscan.io',kind:'evm',securityId:'1'},
 base:{name:'Base',gecko:'base',explorer:'https://basescan.org',kind:'evm',securityId:'8453'},
 bsc:{name:'BNB Chain',gecko:'bsc',explorer:'https://bscscan.com',kind:'evm',securityId:'56'},
 polygon:{name:'Polygon',gecko:'polygon_pos',explorer:'https://polygonscan.com',kind:'evm',securityId:'137'},
 arbitrum:{name:'Arbitrum',gecko:'arbitrum',explorer:'https://arbiscan.io',kind:'evm',securityId:'42161'},
 avalanche:{name:'Avalanche',gecko:'avax',explorer:'https://snowtrace.io',kind:'evm',securityId:'43114'},
 optimism:{name:'Optimism',gecko:'optimism',explorer:'https://optimistic.etherscan.io',kind:'evm',securityId:'10'}
});
export const validEvmAddress=value=>typeof value==='string'&&/^0x[0-9a-fA-F]{40}$/.test(value);
export const sameAddress=(a,b,chain)=>typeof a==='string'&&typeof b==='string'&&(NETWORKS[chain]?.kind==='evm'?a.toLowerCase()===b.toLowerCase():a===b);
