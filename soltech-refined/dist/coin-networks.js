export const NETWORKS=Object.freeze({
 solana:{name:'Solana',gecko:'solana',explorer:'https://solscan.io',kind:'solana'},
 ethereum:{name:'Ethereum',gecko:'eth',explorer:'https://etherscan.io',kind:'evm',securityId:'1'},
 base:{name:'Base',gecko:'base',explorer:'https://basescan.org',kind:'evm',securityId:'8453'},
 bsc:{name:'BNB Chain',gecko:'bsc',explorer:'https://bscscan.com',kind:'evm',securityId:'56'},
 polygon:{name:'Polygon',gecko:'polygon_pos',explorer:'https://polygonscan.com',kind:'evm',securityId:'137'},
 arbitrum:{name:'Arbitrum',gecko:'arbitrum',explorer:'https://arbiscan.io',kind:'evm',securityId:'42161'},
 avalanche:{name:'Avalanche',gecko:'avax',explorer:'https://snowtrace.io',kind:'evm',securityId:'43114'},
 optimism:{name:'Optimism',gecko:'optimism',explorer:'https://optimistic.etherscan.io',kind:'evm',securityId:'10'},
 // IDs verified against the providers' public network catalogs. Explorers are
 // intentionally absent until their exact supported account URLs are verified.
 robinhood:{name:'Robinhood',gecko:'robinhood',explorer:null,kind:'evm',securityId:'4663'},
 arc:{name:'Arc',gecko:'arc',explorer:null,kind:'evm',securityId:'5042'}
});
export const validEvmAddress=value=>typeof value==='string'&&/^0x[0-9a-fA-F]{40}$/.test(value);
const reserved=new Set(['__proto__','prototype','constructor',...Object.getOwnPropertyNames(Object.prototype)]);
const validChain=chain=>typeof chain==='string'&&chain.length>=2&&chain.length<=64&&/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(chain)&&!reserved.has(chain);
export function getNetwork(chain){
 if(!validChain(chain))return null;
 if(Object.hasOwn(NETWORKS,chain))return NETWORKS[chain];
 // A DEX match establishes market identity, not security/history coverage.
 // Construct this fallback every time so saved unknown chains survive reloads.
 return Object.freeze({name:chain.split('-').map(part=>part[0].toUpperCase()+part.slice(1)).join(' '),kind:'generic',gecko:null,securityId:null,explorer:null});
}
// Plausibility only: the provider must still return an exact chain/address match.
// Bounded structured IDs cover Sui/Aptos, TON, Near, Hedera and numeric assets.
// Slashes are allowed only inside explicit IBC/tokenfactory formats, never as
// arbitrary URL paths. Percent escapes, traversal and schemes remain invalid.
export function validLookupAddress(value){
 if(typeof value!=='string'||!value.length||value.length>256||reserved.has(value))return false;
 if(value.startsWith('ibc/'))return /^ibc\/[0-9a-fA-F]{64}$/.test(value);
 if(value.startsWith('factory/')){
  const [,creator,...parts]=value.split('/'),subdenom=parts.join('/');
  // Osmosis tokenfactory uses a bech32 creator and a namespaced subdenom.
  // Bounded nested subdenoms cover e.g. alloyed/allBTC without accepting ../.
  return /^[a-z][a-z0-9]{0,15}1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38,58}$/.test(creator||'')&&subdenom.length<=128&&/^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*(?:\/[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*){0,3}$/.test(subdenom);
 }
 if(value.startsWith('@'))return /^@(?:0|[1-9]\d{0,19})$/.test(value);
 if(/^0x/i.test(value))return /^0x(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/.test(value)||/^0x[0-9a-fA-F]{1,64}::[A-Za-z_][A-Za-z0-9_]{0,63}::[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(value);
 if(/^(?:0|-1):[0-9a-fA-F]{64}$/.test(value)||/^\d{1,24}$/.test(value)||/^\d{1,20}\.\d{1,20}\.\d{1,20}$/.test(value))return true;
 // NEAR's official account grammar includes short top-level contracts. A name
 // only becomes a coin match when DEX confirms it as the exact base address.
 if(value.length>=2&&value.length<=64&&/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value))return true;
 return value.length>=8&&/^[A-Za-z0-9][A-Za-z0-9_-]*(?:\.[A-Za-z0-9][A-Za-z0-9_-]*)*$/.test(value);
}
export function canonicalAddress(address,chain){
 if((chain!==undefined&&!getNetwork(chain))||!validLookupAddress(address))return null;
 return validEvmAddress(address)?address.toLowerCase():address;
}
export function sameAddress(a,b,chain){
 const left=canonicalAddress(a,chain),right=canonicalAddress(b,chain);
 return left!==null&&right!==null&&left===right;
}
