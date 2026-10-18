import {getNetwork,validEvmAddress,validLookupAddress} from './coin-networks.js';
import {LookupError,normalizeMarket,requestJSON,validTokenAddress} from './coin-checker-data.js';

function waitForRetry(milliseconds,{signal}={}){
 if(signal?.aborted)return Promise.reject(new LookupError('cancelled'));
 return new Promise((resolve,reject)=>{
  const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new LookupError('cancelled'));};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},milliseconds);
  signal?.addEventListener('abort',abort,{once:true});
 });
}

// Search discovers networks, but only exact chain/token market responses confirm them.
const coreChains=['ethereum','base','bsc','polygon','arbitrum','avalanche','optimism'];
const candidateLimit=16;
export async function discoverNetwork(mint,{signal,request=requestJSON,wait=waitForRetry,onRetry}={}){
 if(!validLookupAddress(mint))throw new LookupError('address');
 if(signal?.aborted)throw new LookupError('cancelled');
 const chains=validEvmAddress(mint)?coreChains:[];
 const query=async chain=>{
  const data=await request('https://api.dexscreener.com/token-pairs/v1/'+encodeURIComponent(chain)+'/'+encodeURIComponent(mint),{signal,timeout:10000});
  return normalizeMarket(data,mint,Date.now(),chain);
 };
 const search=async()=>{
  const data=await request('https://api.dexscreener.com/latest/dex/search?q='+encodeURIComponent(mint),{signal,timeout:10000});
  if(!Array.isArray(data?.pairs)||data.pairs.length>1000)throw new LookupError('format');
  const candidates=new Set();
  for(const pair of data.pairs){
   const chain=pair?.chainId;
   if(getNetwork(chain)&&validTokenAddress(mint,chain)&&normalizeMarket([pair],mint,Date.now(),chain))candidates.add(chain);
  }
  return [...candidates].sort();
 };
 const batch=async jobs=>{
  if(signal?.aborted)throw new LookupError('cancelled');
  const results=await Promise.allSettled(jobs.map(job=>job.run()));
  if(signal?.aborted)throw new LookupError('cancelled');
  const failed=jobs.map((job,index)=>index).filter(index=>results[index].status==='rejected');
  if(failed.length){
   onRetry?.({chainIds:failed.map(index=>jobs[index].chain).filter(Boolean)});
   await wait(400,{signal});
   if(signal?.aborted)throw new LookupError('cancelled');
   const retried=await Promise.allSettled(failed.map(index=>jobs[index].run()));
   if(signal?.aborted)throw new LookupError('cancelled');
   failed.forEach((index,retryIndex)=>{results[index]=retried[retryIndex];});
  }
  return results;
 };
 const results=await batch([...chains.map(chain=>({chain,run:()=>query(chain)})),{run:search}]);
 const searchResult=results.at(-1),candidates=searchResult.status==='fulfilled'?searchResult.value.filter(chain=>!chains.includes(chain)):[];
 const additional=candidates.slice(0,candidateLimit);
 const confirmed=await batch(additional.map(chain=>({chain,run:()=>query(chain)})));
 const chainIds=[...chains.filter((chain,index)=>results[index].status==='fulfilled'&&results[index].value),...additional.filter((chain,index)=>confirmed[index].status==='fulfilled'&&confirmed[index].value)];
 // Search absence is not proof that a coin does not exist. Failed or truncated
 // discovery stays incomplete rather than guessing from the first/highest pool.
 const incomplete=results.some(result=>result.status==='rejected')||confirmed.some(result=>result.status==='rejected')||candidates.length>candidateLimit;
 return {status:incomplete?'incomplete':chainIds.length===1?'resolved':chainIds.length>1?'ambiguous':'not-found',chainIds};
}
