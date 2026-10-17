import http from 'node:http';
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdir,readdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isIP} from 'node:net';
import {createWalletHandler} from '../wallet-api.mjs';
import {createWalletTransactionsHandler} from '../wallet-transactions-api.mjs';
import {createSignalsHandler} from '../signals-api.mjs';
import {createBundlerAPI} from '../bundler-api.mjs';
import {createScannerHandler} from '../scanner-api.mjs';
import {createScannerRuntime} from '../scanner-runtime.mjs';
import {createScannerProviders,waitForScanner} from '../scanner-providers.mjs';

const COOKIE='__Secure-solventir_session';
const routes=new Map([
 ['/api/wallet','POST'],['/api/wallet/transactions','POST'],['/api/wallet/transaction','POST'],
 ['/api/signals','GET'],['/api/bundlers','GET'],['/api/scanner','GET'],
 ['/api/scanner/start','POST'],['/api/scanner/pause','POST'],['/api/scanner/events','GET'],
]);
const secureEqual=(left,right)=>{const a=Buffer.from(String(left||'')),b=Buffer.from(String(right||''));return a.length===b.length&&timingSafeEqual(a,b);};

// A single scheduler is shared by every session and wallet RPC request. It
// bounds queued work, spaces calls by provider, and respects HTTP cooldowns.
export function createProductionFetch({fetchImpl=fetch,spacingMs=1100,maxQueued=32,now=Date.now}={}){
 const hosts=new Map();let queued=0;
 return async(url,options={})=>{
  const host=new URL(url).hostname;
  if(['api.x.com','api.twitter.com'].includes(host))return new Response('{}',{status:503});
  if(options.signal?.aborted)throw Object.assign(Error('Cancelled'),{name:'AbortError'});
  if(queued>=maxQueued)return new Response('{}',{status:429,headers:{'Retry-After':'5'}});
  const state=hosts.get(host)||{tail:Promise.resolve(),next:0,cooldown:0};hosts.set(host,state);
  queued++;
  const task=state.tail.catch(()=>{}).then(async()=>{
   if(options.signal?.aborted)throw Object.assign(Error('Cancelled'),{name:'AbortError'});
   if(state.cooldown>now())return new Response('{}',{status:429,headers:{'Retry-After':String(Math.ceil((state.cooldown-now())/1000))}});
   await waitForScanner(Math.max(0,state.next-now()),options.signal);
   state.next=now()+spacingMs;
   const response=await fetchImpl(url,options);
   if(response.status===429){const raw=response.headers.get('retry-after'),seconds=/^\d+(?:\.\d+)?$/.test(raw||'')?Number(raw):NaN,date=Date.parse(raw||'');const wait=Number.isFinite(seconds)?seconds*1000:Number.isFinite(date)?date-now():60000;state.cooldown=now()+Math.max(1000,wait);}
   return response;
  });
  state.tail=task.then(()=>{},()=>{});
  try{return await task;}finally{queued--;}
 };
}
const fail=(res,status,message,headers={})=>{
 if(res.headersSent){res.destroy();return;}
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
 res.end(JSON.stringify({status:'error',error:message,message}));
};
function positive(value,fallback,max){const parsed=Number(value??fallback);if(!Number.isInteger(parsed)||parsed<1||parsed>max)throw Error('Invalid production resource limit.');return parsed;}
function normalizePath(path){return path.startsWith('/sjay-api/')?'/api/'+path.slice('/sjay-api/'.length):path==='/sjay-api'?'/api':path;}
function sign(id,expires,secret){return createHmac('sha256',secret).update(id+'.'+expires).digest('base64url');}
function readSessionCookie(header,secret,now){
 const values=String(header||'').split(';').map(part=>part.trim()).filter(part=>part.startsWith(COOKIE+'='));
 if(values.length!==1)return null;
 const [id,expiresText,signature,...extra]=values[0].slice(COOKIE.length+1).split('.');
 const expires=Number(expiresText);
 if(extra.length||!/^[a-f0-9]{32}$/.test(id)||!/^\d{10,13}$/.test(expiresText)||!Number.isSafeInteger(expires)||expires<=now()||!secureEqual(signature,sign(id,expiresText,secret)))return null;
 return {id,expires};
}
async function readBody(req,limit){
 if(Number(req.headers['content-length'])>limit){req.resume();throw Object.assign(Error('The request is too large.'),{status:413});}
 const chunks=[];let size=0;
 for await(const chunk of req.iterator({destroyOnReturn:false})){
  size+=chunk.length;if(size>limit){req.resume();throw Object.assign(Error('The request is too large.'),{status:413});}chunks.push(chunk);
 }
 const body=Buffer.concat(chunks);
 try{const value=JSON.parse(body.toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();}
 catch{throw Object.assign(Error('Send a JSON object.'),{status:400});}
 return body;
}

// This listener is deliberately separate from the local preview. Only its
// allowlisted API routes can reach the loopback bridge; no files or key setup
// routes are served. Existing preview guards remain unchanged.
export async function createProductionServer({
 originSecret=process.env.SOLVENTIR_ORIGIN_SECRET,
 sessionSecret=process.env.SOLVENTIR_SESSION_SECRET,
 allowedOrigins=(process.env.SOLVENTIR_ALLOWED_ORIGINS||'').split(',').filter(Boolean),
 dataDirectory=process.env.SOLVENTIR_DATA_DIR,
 cookiePath='/sjay-api',cookieDays=30,
 maxSessions=process.env.SOLVENTIR_MAX_SESSIONS??64,
 maxActiveScans=process.env.SOLVENTIR_MAX_ACTIVE_SCANS??4,
 maxStreams=process.env.SOLVENTIR_MAX_STREAMS??32,
 maxStreamsPerSession=4,
 maxConcurrent=process.env.SOLVENTIR_MAX_CONCURRENT??24,
 maxConcurrentPerClient=6,requestsPerMinute=120,newSessionsPerMinute=6,
 now=Date.now,runtimeFactory=createScannerRuntime,runtimeOptions={},
 walletOptions={},transactionOptions={},signalsOptions={},bundlerOptions={},
 heartbeatMs=15000,
}={}){
 if(typeof originSecret!=='string'||originSecret.length<32||typeof sessionSecret!=='string'||sessionSecret.length<32||originSecret===sessionSecret)throw Error('Configure two distinct production secrets of at least 32 characters.');
 if(!dataDirectory)throw Error('Configure an absolute durable scanner data directory.');
 const root=resolve(dataDirectory);if(root!==dataDirectory)throw Error('The scanner data directory must be absolute.');
 const origins=new Set(allowedOrigins.map(value=>{
  const url=new URL(value.trim());if(url.protocol!=='https:'||url.origin!==value.trim())throw Error('Allowed public origins must be exact HTTPS origins.');return url.origin;
 }));
 if(!origins.size)throw Error('Configure at least one allowed public origin.');
 if(!/^\/[a-z0-9/-]*$/i.test(cookiePath))throw Error('Invalid session cookie path.');
 maxSessions=positive(maxSessions,64,512);maxActiveScans=positive(maxActiveScans,4,16);
 maxStreams=positive(maxStreams,32,128);maxStreamsPerSession=positive(maxStreamsPerSession,4,8);
 maxConcurrent=positive(maxConcurrent,24,128);maxConcurrentPerClient=positive(maxConcurrentPerClient,6,16);
 requestsPerMinute=positive(requestsPerMinute,120,1000);newSessionsPerMinute=positive(newSessionsPerMinute,6,60);
 cookieDays=positive(cookieDays,30,365);
 await mkdir(root,{recursive:true,mode:0o700});
 const known=new Set((await readdir(root)).filter(name=>/^[a-f0-9]{32}\.json$/.test(name)).map(name=>name.slice(0,-5))),expirations=new Map();
 async function archiveFiles(id){
  // IDs come only from signed cookies or the validated directory inventory.
  // Archiving frees pilot slots without destroying saved findings.
  if(!/^[a-f0-9]{32}$/.test(id))throw Error('Invalid session archive identity.');
  const destination=join(root,'archive',id+'-'+now());await mkdir(destination,{recursive:true,mode:0o700});
  await rename(join(root,id+'.json'),join(destination,'scanner.json'));
  await rename(join(root,id+'.meta.json'),join(destination,'session.json'));
  known.delete(id);expirations.delete(id);
 }
 for(const id of known){
  let metadata;try{metadata=JSON.parse(await readFile(join(root,id+'.meta.json'),'utf8'));}catch{throw Error('A saved scanner session has unreadable metadata. Existing files were preserved.');}
  if(metadata.version!==1||!Number.isSafeInteger(metadata.expires)||metadata.expires<1)throw Error('A saved scanner session has invalid metadata. Existing files were preserved.');
  expirations.set(id,metadata.expires);
  if(metadata.expires<=now())await archiveFiles(id);
 }
 if(known.size>maxSessions)throw Error('Saved scanner sessions exceed the configured capacity; existing files were preserved.');
 const sessions=new Map(),sessionsLoading=new Map(),reserved=new Set(),rates=new Map(),busy=new Map(),starting=new Set(),controls=new Set();
 let closing=false,inflight=0,streams=0;
 const sharedFetch=createProductionFetch();
 const sharedProviders=createScannerProviders({fetchImpl:sharedFetch,xEnabled:false,xBearerToken:''});
 const bridgeSecret=randomBytes(32).toString('hex');let bridgePort,wallet,transactions,signals;
 const bundles=createBundlerAPI({fetcher:sharedFetch,...bundlerOptions});
 const bridge=http.createServer({maxHeaderSize:16384},async(req,res)=>{
  try{
   if(!secureEqual(req.headers['x-private-bridge'],bridgeSecret)){fail(res,403,'Access denied.');return;}
   const url=new URL(req.url,'http://localhost'),path=url.pathname;
   if(path.startsWith('/api/scanner')){
    const record=sessions.get(req.headers['x-scanner-session']);
    if(!record){fail(res,409,'Open the scanner before continuing.');return;}
    if(await record.handler(req,res,url))return;
   }
   if(await wallet(req,res,path)||await transactions(req,res,path)||await signals(req,res,path))return;
   if(path==='/api/bundlers'&&req.method==='GET'){
    const result=url.searchParams.get('chain')==='solana'?await bundles(url.searchParams.get('address')):{status:'unsupported'};
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(result));return;
   }
   fail(res,404,'Not found.');
  }catch{fail(res,503,'The requested service is temporarily unavailable.');}
 });
 await new Promise((done,reject)=>{bridge.once('error',reject);bridge.listen(0,'127.0.0.1',done);});
 bridgePort=bridge.address().port;
 wallet=createWalletHandler({port:bridgePort,fetcher:sharedFetch,...walletOptions});
 transactions=createWalletTransactionsHandler({port:bridgePort,fetcher:sharedFetch,...transactionOptions});
 signals=createSignalsHandler({port:bridgePort,fetcher:sharedFetch,...signalsOptions});

 async function session(id,{fresh=false}={}){
  if(sessions.has(id))return sessions.get(id);
  if(sessionsLoading.has(id))return sessionsLoading.get(id);
  if(!fresh&&!known.has(id))throw Object.assign(Error('This scanner session is no longer available. Reload the page.'),{status:409});
  if(fresh&&known.size+reserved.size>=maxSessions)throw Object.assign(Error('The scanner pilot has reached its saved-session capacity. Coin and wallet checks are still available.'),{status:503});
  if(fresh)reserved.add(id);
  const promise=(async()=>{
   let runtime;
   try{
    const expires=fresh?now()+cookieDays*86400000:null;
    // Create metadata first: a failed initialization may leave harmless metadata,
    // but must never leave a discoverable state file without its expiry record.
    if(fresh)await writeFile(join(root,id+'.meta.json'),JSON.stringify({version:1,expires}),{flag:'wx',mode:0o600});
    runtime=await runtimeFactory({fetchImpl:sharedFetch,providers:sharedProviders,...runtimeOptions,storagePath:join(root,id+'.json')});
    if(fresh){
     await runtime.pause();if(!runtime.getSnapshot().persistent)throw Error('Could not save scanner session.');
     known.add(id);expirations.set(id,expires);
    }
    const record={runtime,handler:createScannerHandler({port:bridgePort,runtime,heartbeatMs,maxClients:maxStreamsPerSession}),streams:0};
    sessions.set(id,record);return record;
   }catch(error){await runtime?.dispose().catch(()=>{});throw error;}
   finally{reserved.delete(id);sessionsLoading.delete(id);}
  })();
  sessionsLoading.set(id,promise);return promise;
 }
 function takeRate(key,limit){
  const at=now();let bucket=rates.get(key);
  if(!bucket||at-bucket.at>=60000){
   for(const [saved,value] of rates)if(at-value.at>=60000)rates.delete(saved);
   if(rates.size>=2048)return false;
   bucket={at,count:0};rates.set(key,bucket);
  }
  if(bucket.count>=limit)return false;bucket.count++;return true;
 }
 function setCookie(res,id){
  const expires=expirations.get(id);
  res.setHeader('Set-Cookie',`${COOKIE}=${id}.${expires}.${sign(id,expires,sessionSecret)}; Path=${cookiePath}; Max-Age=${cookieDays*86400}; HttpOnly; Secure; SameSite=Strict`);
 }
 let expiring;
 async function expireSessions(){
  if(expiring)return expiring;
  expiring=(async()=>{
   for(const [id,expires] of expirations){
    if(expires>now()||sessionsLoading.has(id))continue;
    const record=sessions.get(id);
    if(record){await record.handler.dispose();sessions.delete(id);}
    starting.delete(id);controls.delete(id);await archiveFiles(id);
   }
  })().finally(()=>{expiring=null;});
  return expiring;
 }
 const expiryTimer=setInterval(()=>{void expireSessions().catch(()=>console.error('Expired scanner session could not be archived; saved data was retained.'));},60000);expiryTimer.unref();
 const server=http.createServer({maxHeaderSize:16384},async(req,res)=>{
  try{
   if(closing){fail(res,503,'The service is restarting. Try again shortly.');return;}
   if(!secureEqual(req.headers['x-solventir-origin-secret'],originSecret)){fail(res,403,'Access denied.');return;}
   if(req.url.length>2048){fail(res,414,'The request URL is too long.');return;}
   const url=new URL(req.url,'http://localhost'),path=normalizePath(url.pathname);
   const origin=req.headers.origin;
   if(origin&&!origins.has(origin)){fail(res,403,'Open this request from the Solventir app.');return;}
   if(req.headers['sec-fetch-site']==='cross-site'){fail(res,403,'Cross-site requests are not allowed.');return;}
   if(['/health','/api/health'].includes(path)&&req.method==='GET'){
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({status:'ok',service:'solventir-api'}));return;
   }
   const method=routes.get(path);
   if(!method){fail(res,404,'Not found.');return;}
   if(req.method!==method){fail(res,405,'Use '+method+' for this action.',{Allow:method});return;}
   if(method==='POST'&&!origins.has(origin)){fail(res,403,'Open this action from the Solventir app.');return;}
   if(method==='POST'&&String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json'){fail(res,415,'Send this request as JSON.');return;}
   const forwarded=String(req.headers['x-forwarded-for']||'').split(',').map(value=>value.trim()).filter(isIP);
   const address=forwarded.at(-1)||req.socket.remoteAddress||'unknown';
   const cookie=readSessionCookie(req.headers.cookie,sessionSecret,now);
   // The edge secret makes forwarded identity trustworthy. A second session
   // bucket keeps tabs fair without collecting IPs in durable scanner data.
   if(!takeRate('ip:'+address,requestsPerMinute*2)||cookie&&!takeRate('session:'+cookie.id,requestsPerMinute)){fail(res,429,'Too many requests. Try again in a minute.',{'Retry-After':'60'});return;}
   const client=cookie?.id||address;
   const isStream=path==='/api/scanner/events';
   if(!isStream&&(inflight>=maxConcurrent||(busy.get(client)||0)>=maxConcurrentPerClient)){fail(res,429,'The service is busy. Try again shortly.',{'Retry-After':'5'});return;}
   let record,id=cookie?.id,ownsControl=false,ownsStarting=false;
   if(path.startsWith('/api/scanner')){
    await expireSessions();
    if(!id||!known.has(id)){
     if(path!=='/api/scanner'){fail(res,409,'Open the scanner to start a private browser session.');return;}
     if(!takeRate('new:'+address,newSessionsPerMinute)){fail(res,429,'Too many new scanner sessions. Try again in a minute.',{'Retry-After':'60'});return;}
     id=randomBytes(16).toString('hex');record=await session(id,{fresh:true});setCookie(res,id);
    }else record=await session(id);
    if(isStream&&(streams>=maxStreams||record.streams>=maxStreamsPerSession)){fail(res,429,'Too many live scanner views are open. Close one and try again.',{'Retry-After':'15'});return;}
    if(path==='/api/scanner/start'||path==='/api/scanner/pause'){
     if(controls.has(id)){fail(res,409,'A scanner action is already in progress. Try again shortly.');return;}
     if(path.endsWith('/start')&&record.runtime.getSnapshot().status!=='running'){
      const active=new Set([...sessions].filter(([,value])=>value.runtime.getSnapshot().status==='running').map(([key])=>key));
      for(const key of starting)active.add(key);
      if(active.size>=maxActiveScans){fail(res,429,'The scanner pilot is busy. Saved finds remain available; try Start later.',{'Retry-After':'30'});return;}
      starting.add(id);ownsStarting=true;
     }
     controls.add(id);ownsControl=true;
    }
   }
   let released=false;
   if(isStream){streams++;record.streams++;}else{inflight++;busy.set(client,(busy.get(client)||0)+1);}
   const release=()=>{
    if(released)return;released=true;if(ownsStarting)starting.delete(id);if(ownsControl)controls.delete(id);
    if(isStream){streams--;record.streams--;}else{inflight--;const count=(busy.get(client)||1)-1;if(count)busy.set(client,count);else busy.delete(client);}
   };
   let body;
   try{if(method==='POST')body=await readBody(req,path==='/api/wallet'?1024:16384);}
   catch(error){release();fail(res,error.status||400,error.status?error.message:'Unable to read the request.');return;}
   // Slow/disconnected clients do not free a provider request slot early. The
   // bridge completes or times out before the concurrency reservation is freed.
   const outgoing=http.request({hostname:'127.0.0.1',port:bridgePort,path:path+url.search,method,headers:{
    Host:'127.0.0.1:'+bridgePort,'x-private-bridge':bridgeSecret,
    ...(id?{'x-scanner-session':id}:{}),Accept:isStream?'text/event-stream':'application/json',
    ...(body?{'Content-Type':'application/json','Content-Length':body.length}:{}),
   }},incoming=>{
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Type':incoming.headers['content-type']||'application/json; charset=utf-8'};
    if(incoming.headers['retry-after'])headers['Retry-After']=incoming.headers['retry-after'];
    if(incoming.headers.allow)headers.Allow=incoming.headers.allow;
    if(isStream){headers['X-Accel-Buffering']='no';headers.Connection='keep-alive';}
    if(!res.destroyed){res.writeHead(incoming.statusCode,headers);res.flushHeaders();incoming.pipe(res);}else incoming.resume();
    incoming.on('end',release);incoming.on('error',()=>{release();res.destroy();});
    if(isStream)res.on('close',()=>{outgoing.destroy();incoming.destroy();release();});
   });
   outgoing.on('error',()=>{release();if(!res.destroyed)fail(res,503,'The service is temporarily unavailable. Try again.');});
   outgoing.setTimeout(isStream?Math.max(heartbeatMs*3,45000):45000,()=>outgoing.destroy());
   if(isStream)res.on('close',()=>{outgoing.destroy();release();});
   outgoing.end(body);
  }catch(error){if(!res.destroyed)fail(res,error.status||503,error.status?error.message:'The service is temporarily unavailable. Try again.');}
 });
 server.headersTimeout=15000;server.requestTimeout=20000;server.keepAliveTimeout=5000;
 server.maxConnections=maxConcurrent+maxStreams+32;
 const sockets=new Set();server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
 return {
  server,
  async listen(port=Number(process.env.PORT||8080),host='0.0.0.0'){
   await new Promise((done,reject)=>{server.once('error',reject);server.listen(port,host,done);});return server.address();
  },
  async close(){
   if(closing)return;closing=true;clearInterval(expiryTimer);await expiring;
   await Promise.allSettled([...sessionsLoading.values()]);
   await Promise.allSettled([...sessions.values()].map(record=>record.handler.dispose()));
   for(const socket of sockets)socket.destroy();
   await Promise.all([new Promise(done=>server.close(done)),new Promise(done=>{bridge.close(done);bridge.closeAllConnections();})]);
  },
 };
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const app=await createProductionServer();const address=await app.listen();
  console.log(`Solventir API listening on port ${address.port}.`);
  let stopping=false;const stop=()=>{if(stopping)return;stopping=true;void app.close().then(()=>process.exit(0));};
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
 }catch(error){console.error('Solventir API did not start: '+error.message);process.exitCode=1;}
}
