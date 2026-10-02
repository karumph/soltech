import {validMint,normalizeBundles} from './dist/coin-checker-data.js';

// Local preview only. Credentials stay in the server process, never the static site.
export function createBundlerAPI({getKey=()=>process.env.SOLANATRACKER_API_KEY,fetcher=fetch,now=Date.now,timeoutMs=8000,cacheMs=60000}={}){
 const cache=new Map(),pending=new Map();let lastRequest=-Infinity;
 return async mint=>{
  if(!validMint(mint))return {status:'error',message:'Enter a valid Solana token address.'};
  const key=getKey()?.trim();
  if(!key)return {status:'not-connected'};
  const previous=cache.get(mint);
  if(previous&&now()-previous.savedAt<cacheMs)return previous.result;
  if(pending.has(mint))return pending.get(mint);
  if(pending.size>=2||now()-lastRequest<1000)return {status:'error',message:'Bundler checks are busy. Try again shortly.'};
  lastRequest=now();
  const request=(async()=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
   try{
    const response=await fetcher('https://data.solanatracker.io/tokens/'+mint+'/bundlers',{headers:{'x-api-key':key,Accept:'application/json'},signal:controller.signal,redirect:'error'});
    if(!response.ok)return {status:'error',message:response.status===401||response.status===403?'Bundler access needs attention.':response.status===429?'Bundler checks are busy. Try again shortly.':response.status===404?'No bundler report is available for this coin.':'Bundler data is temporarily unavailable.'};
    const body=await response.text();if(body.length>1000000)throw new Error('response size');
    const normalized=normalizeBundles(JSON.parse(body),mint,now());
    // Only documented, validated values are exposed to the browser.
    const result={status:'ready',data:normalized};
    if(cache.size>=64)cache.delete(cache.keys().next().value);
    cache.set(mint,{savedAt:now(),result});return result;
   }catch{return {status:'error',message:controller.signal.aborted?'Bundler check timed out. Try again.':'Bundler data is unavailable. Try again later.'};}
   finally{clearTimeout(timer);}
  })();
  pending.set(mint,request);
  try{return await request;}finally{pending.delete(mint);}
 };
}

export function localBundlerRequestAllowed(req,port){
 const host=req.headers.host;
 if(!['127.0.0.1:'+port,'localhost:'+port].includes(host))return false;
 if(req.headers.origin&&req.headers.origin!=='http://'+host)return false;
 return !req.headers['sec-fetch-site']||['same-origin','none'].includes(req.headers['sec-fetch-site']);
}
