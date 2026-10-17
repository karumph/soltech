import {LookupError,safeImageUrl,validMint} from './coin-checker-data.js';

const ENDPOINT='https://api.rugcheck.xyz/v1/tokens/';
const MAX_BYTES=2000000;

async function readLogoReport(response,signal){
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
 if(signal.aborted)throw new LookupError('cancelled');
 try{return JSON.parse(text);}catch{throw new LookupError('format');}
}

// Optional logo only, from the existing Solana report provider. The caller owns
// concurrency, session caching and cancellation; no wallet address is sent.
export async function fetchWalletTokenLogo(address,{fetcher=fetch,signal,timeoutMs=6000}={}){
 if(!validMint(address))throw new LookupError('format');
 if(signal?.aborted)throw new LookupError('cancelled');
 const controller=new AbortController();let timer,abort;
 const stopped=new Promise((_,reject)=>{
  abort=()=>{reject(new LookupError('cancelled'));controller.abort();};
  signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>{reject(new LookupError('timeout'));controller.abort();},Number.isFinite(timeoutMs)&&timeoutMs>0?Math.min(timeoutMs,30000):6000);
 });
 const request=(async()=>{
  const response=await fetcher(ENDPOINT+address+'/report',{
   method:'GET',signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',headers:{Accept:'application/json'}
  });
  if(controller.signal.aborted){response.body?.cancel().catch(()=>{});throw new LookupError('cancelled');}
  if(!response.ok){response.body?.cancel().catch(()=>{});throw new LookupError(response.status===429?'rate':response.status===404?'missing':'service');}
  const report=await readLogoReport(response,controller.signal);
  if(!report||Array.isArray(report)||report.mint!==address)throw new LookupError('format');
  return safeImageUrl(report.fileMeta?.image);
 })();
 try{return await Promise.race([request,stopped]);}
 catch(error){throw error instanceof LookupError?error:new LookupError('network');}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.abort();}
}
