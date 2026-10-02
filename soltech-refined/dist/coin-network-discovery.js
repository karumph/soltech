import {NETWORKS,validEvmAddress} from './coin-networks.js';
import {LookupError,normalizeMarket,requestJSON} from './coin-checker-data.js';

// Check each supported network, rather than infer identity from a ranked search.
export async function discoverNetwork(mint,{signal,request=requestJSON}={}){
 if(!validEvmAddress(mint))throw new LookupError('address');
 if(signal?.aborted)throw new LookupError('cancelled');
 const chains=Object.keys(NETWORKS).filter(chain=>NETWORKS[chain].kind==='evm');
 const results=await Promise.allSettled(chains.map(async chain=>{
  const data=await request('https://api.dexscreener.com/token-pairs/v1/'+chain+'/'+mint,{signal,timeout:10000});
  return normalizeMarket(data,mint,Date.now(),chain);
 }));
 if(signal?.aborted)throw new LookupError('cancelled');
 const chainIds=chains.filter((chain,index)=>results[index].status==='fulfilled'&&results[index].value);
 // A failed network may contain another match, so a partial lookup cannot auto-select.
 const incomplete=results.some(result=>result.status==='rejected');
 return {status:incomplete?'incomplete':chainIds.length===1?'resolved':chainIds.length>1?'ambiguous':'not-found',chainIds};
}
