import {LookupError,normalizeMarket,safeImageUrl,validMint} from './coin-checker-data.js';

const ENDPOINT='https://api.dexscreener.com/tokens/v1/solana/';
const MAX_MINTS=30,MAX_BYTES=2000000,MAX_PAIRS=1000;

async function readMetadata(response,signal){
 if(Number(response.headers?.get('content-length'))>MAX_BYTES){response.body?.cancel().catch(()=>{});throw new LookupError('format');}
 let text='';
 if(response.body?.getReader){
  const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0;
  const cancel=()=>{reader.cancel().catch(()=>{});};
  signal.addEventListener('abort',cancel,{once:true});
  try{
   while(true){
    const {done,value}=await reader.read();if(done)break;
    bytes+=value.byteLength;if(bytes>MAX_BYTES)throw new LookupError('format');
    text+=decoder.decode(value,{stream:true});
   }
   text+=decoder.decode();
  }catch(error){reader.cancel().catch(()=>{});throw error;}
  finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
 }else{
  text=await response.text();
  if(new TextEncoder().encode(text).byteLength>MAX_BYTES)throw new LookupError('format');
 }
 let data;try{data=JSON.parse(text);}catch{throw new LookupError('format');}
 if(!Array.isArray(data)||data.length>MAX_PAIRS)throw new LookupError('format');
 return data;
}

// Names and logos from the existing market-data provider. Caller owns session caching.
// The first 30 valid distinct mints form one bounded batch; no wallet is sent.
export async function fetchWalletTokenMetadata(mints,{fetcher=fetch,signal,timeoutMs=8000}={}){
 if(!Array.isArray(mints))throw new LookupError('format');
 if(signal?.aborted)throw new LookupError('cancelled');
 const addresses=[];
 for(const mint of mints){if(validMint(mint)&&!addresses.includes(mint))addresses.push(mint);if(addresses.length===MAX_MINTS)break;}
 if(!addresses.length)return [];
 const controller=new AbortController();let timer,abort;
 const stopped=new Promise((_,reject)=>{
  abort=()=>{reject(new LookupError('cancelled'));controller.abort();};
  signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>{reject(new LookupError('timeout'));controller.abort();},Number.isFinite(timeoutMs)&&timeoutMs>0?Math.min(timeoutMs,30000):8000);
 });
 const request=(async()=>{
  const response=await fetcher(ENDPOINT+addresses.join(','),{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',headers:{Accept:'application/json'}});
  if(controller.signal.aborted)throw new LookupError('cancelled');
  if(!response.ok){response.body?.cancel().catch(()=>{});throw new LookupError(response.status===429?'rate':response.status===404?'missing':'service');}
  const pairs=await readMetadata(response,controller.signal);
  if(controller.signal.aborted)throw new LookupError('cancelled');
  const logoPairs=pairs.filter(pair=>safeImageUrl(pair?.info?.imageUrl));
  return addresses.flatMap(address=>{
   const market=normalizeMarket(pairs,address,Date.now(),'solana');
   if(!market)return [];
   // Apply the same chain, base-mint and pool validation to alternate logos.
   // Names and symbols still come from the original most liquid matching pool.
   const logo=market.imageUrl??normalizeMarket(logoPairs,address,market.retrievedAt,'solana')?.imageUrl??null;
   return [{address,name:market.name.slice(0,120),symbol:market.symbol==='—'?'':market.symbol.slice(0,32),logo}];
  });
 })();
 try{return await Promise.race([request,stopped]);}
 catch(error){throw error instanceof LookupError?error:new LookupError('network');}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.abort();}
}
