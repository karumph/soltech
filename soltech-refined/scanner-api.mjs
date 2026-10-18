import {fileURLToPath} from 'node:url';
import {localWalletRequestAllowed} from './wallet-api.mjs';
import {createScannerRuntime} from './scanner-runtime.mjs';
import {createScannerProviders} from './scanner-providers.mjs';

const paths=new Set(['/api/scanner','/api/scanner/start','/api/scanner/pause','/api/scanner/events']);
function send(res,status,body,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(body));}
const errorBody=message=>({status:'error',error:message,message});
async function readBody(req,maxBytes){
 const chunks=[];let size=0;
 for await(const chunk of req.iterator?.({destroyOnReturn:false})||req){size+=Buffer.byteLength(chunk);if(size>maxBytes){req.resume?.();throw Object.assign(Error('Scanner settings are too large.'),{statusCode:413});}chunks.push(Buffer.from(chunk));}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(Error('Send valid scanner settings as JSON.'),{statusCode:400});}
}

// No authenticated account or cloud service is implied: this API belongs to one
// loopback-only preview. Provider keys remain server-side and never enter state.
export function createScannerHandler({port,runtime,storagePath=fileURLToPath(new URL('./.runtime/scanner-'+(Number.isInteger(port)?port:'local')+'.json',import.meta.url)),fetchImpl=fetch,providers=createScannerProviders({fetchImpl}),heartbeatMs=15000,maxClients=12,...options}={}){
 const ready=runtime?Promise.resolve(runtime):createScannerRuntime({storagePath,fetchImpl,providers,...options});const clients=new Set();let disposed=false;
 const handler=async(req,res,url)=>{
  const path=typeof url==='string'?url.split('?')[0]:url?.pathname;
  if(!paths.has(path))return false;
  if(!localWalletRequestAllowed(req,port)){send(res,403,errorBody('Open the scanner from the local Solventir preview.'));return true;}
  const method=path==='/api/scanner'||path==='/api/scanner/events'?'GET':'POST';
  if(req.method!==method){send(res,405,errorBody('Use '+method+' for this scanner action.'),{Allow:method});return true;}
  if(disposed){send(res,503,errorBody('The scanner is closing.'));return true;}
  try{
   let body;
   if(method==='POST'){
    if(String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json'){send(res,415,errorBody('Send scanner settings as JSON.'));return true;}
    if(Number(req.headers['content-length'])>16384){req.resume?.();send(res,413,errorBody('Scanner settings are too large.'));return true;}
    body=await readBody(req,16384);if(!body||typeof body!=='object'||Array.isArray(body)){send(res,400,errorBody('Send scanner settings as a JSON object.'));return true;}
   }
   const service=await ready;
   if(path==='/api/scanner'){send(res,200,service.getSnapshot());return true;}
   if(path==='/api/scanner/start'){
    if(!body.config||typeof body.config!=='object'){send(res,400,errorBody('Choose scanner settings before starting.'));return true;}
    send(res,200,await service.start(body.config));return true;
   }
   if(path==='/api/scanner/pause'){send(res,200,await service.pause());return true;}
   if(clients.size>=maxClients){send(res,429,errorBody('Too many live scanner views are open. Close one and try again.'));return true;}
   res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','Connection':'keep-alive','X-Content-Type-Options':'nosniff','X-Accel-Buffering':'no'});res.flushHeaders?.();
   let ended=false,timer,unsubscribe=()=>{},blocked=false,pendingSnapshot=null;
   const close=()=>{if(ended)return;ended=true;clearInterval(timer);unsubscribe();clients.delete(close);res.end();};
   const write=snapshot=>{if(ended)return;if(blocked){pendingSnapshot=snapshot;return;}try{blocked=res.write('id: '+snapshot.revision+'\nevent: snapshot\ndata: '+JSON.stringify(snapshot)+'\n\n')===false;if(res.writableLength>3000000)close();}catch{close();}};
   res.on?.('drain',()=>{blocked=false;if(pendingSnapshot){const snapshot=pendingSnapshot;pendingSnapshot=null;write(snapshot);}});
   clients.add(close);unsubscribe=service.subscribe(write);write(service.getSnapshot());
   timer=setInterval(()=>{if(!ended&&!blocked&&!res.writableNeedDrain){try{blocked=res.write(': heartbeat\n\n')===false;}catch{close();}}},heartbeatMs);timer.unref?.();
   res.on?.('close',close);res.on?.('error',close);return true;
  }catch(error){send(res,error.statusCode===400?400:error.statusCode===413?413:503,errorBody(error.statusCode===400||error.statusCode===413?error.message:'The scanner could not complete this action. Check its saved-data status and try again.'));return true;}
 };
 handler.runtime=ready;handler.dispose=async()=>{disposed=true;for(const close of clients)close();await (await ready).dispose();};return handler;
}
