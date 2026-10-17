import {localWalletRequestAllowed} from './wallet-api.mjs';

const SIGNALS_ENDPOINT='https://soltech.d3ilz6ab0hx4y4.amplifyapp.com/api/finds';
const failure=(statusCode,error)=>({statusCode,body:{status:'error',error}});
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);

async function readScan(response,maxBytes,signal){
 if(Number(response.headers.get('content-length'))>maxBytes){response.body?.cancel().catch(()=>{});throw Error('response size');}
 if(!response.body)throw Error('missing response');
 const reader=response.body.getReader(),chunks=[];let bytes=0;
 const cancel=()=>{reader.cancel().catch(()=>{});};
 signal.addEventListener('abort',cancel,{once:true});
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   bytes+=value.byteLength;if(bytes>maxBytes)throw Error('response size');
   chunks.push(Buffer.from(value));
  }
 }catch(error){reader.cancel().catch(()=>{});throw error;}
 finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
 const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 // Preserve the shared scan and its coverage metadata. The page validates individual coins.
 if(!record(body)||!Array.isArray(body.coins)||body.coins.length>150||!body.coins.every(record)
  ||typeof body.updatedAt!=='string'||!Number.isFinite(Date.parse(body.updatedAt))||!record(body.run)
  ||Object.hasOwn(body,'error')||body.unchanged===true)throw Error('invalid scan');
 return body;
}

// One public, read-only shared scan. Cache only in memory, never user preferences or addresses.
export function createSignalsAPI({fetcher=fetch,timeoutMs=15000,maxResponseBytes=1000000,cacheMs=60000,errorCacheMs=5000,now=Date.now}={}){
 let cached=null,expiresAt=0,pending=null;
 return async()=>{
  if(pending)return pending;
  if(cached&&expiresAt>now())return cached;
  const controller=new AbortController();let timer,timedOut=false;
  const request=(async()=>{
   const response=await fetcher(SIGNALS_ENDPOINT,{method:'GET',headers:{Accept:'application/json'},signal:controller.signal,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store'});
   if(controller.signal.aborted)throw Error('cancelled');
   if(!response.ok){
    response.body?.cancel().catch(()=>{});
    if(response.status===429)return failure(429,'The shared Signals service is busy. Try again shortly.');
    if(response.status===401||response.status===403||response.status===503)return failure(503,'The shared Signals service is unavailable right now. Try again later.');
    if(response.status===408||response.status===504)return failure(504,'The Signals check timed out. Try again.');
    return failure(502,'The shared Signals service could not return a scan. Try again later.');
   }
   return {statusCode:200,body:await readScan(response,maxResponseBytes,controller.signal)};
  })();
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true;controller.abort();reject(Error('timeout'));},timeoutMs);});
  pending=Promise.race([request,deadline]).catch(()=>{
   controller.abort();return failure(timedOut?504:502,timedOut?'The Signals check timed out. Try again.':'The shared Signals service returned an unreadable scan or could not be reached. Try again later.');
  }).then(result=>{
   cached=result;expiresAt=now()+(result.statusCode===200?cacheMs:errorCacheMs);return result;
  }).finally(()=>{clearTimeout(timer);pending=null;});
  return pending;
 };
}

function send(res,result,headers={}){
 res.writeHead(result.statusCode,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
 res.end(JSON.stringify(result.body));
}

export function createSignalsHandler({port,...options}={}){
 const lookup=createSignalsAPI(options);
 return async(req,res,pathname)=>{
  if(pathname!=='/api/signals')return false;
  if(!localWalletRequestAllowed(req,port)){send(res,failure(403,'Open Signals from the local Solventir preview.'));return true;}
  if(req.method!=='GET'){send(res,failure(405,'Use GET to read Signals.'),{Allow:'GET'});return true;}
  send(res,await lookup());return true;
 };
}
