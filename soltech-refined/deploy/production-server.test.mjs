import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
import {createProductionServer,createProductionFetch} from './production-server.mjs';
import {createScannerRuntime} from '../scanner-runtime.mjs';
import {defaultPersonalScanner} from '../dist/personal-scanner-store.js';

const origin='https://sjay.example.com',originSecret='o'.repeat(48),sessionSecret='s'.repeat(48);
const mint='So11111111111111111111111111111111111111112';
const providers=()=>({
 discover:async()=>({coins:[{chain:'solana',address:mint,name:'Example',symbol:'EX'}],message:'Test discovery'}),
 enrich:async()=>new Map(),postsStatus:()=>({status:'disconnected',message:'Not configured'}),
 posts:async()=>({status:'disconnected',posts:[],message:'Not configured',cursors:{}}),
});
async function fixture(options={}){
 const directory=options.dataDirectory||await mkdtemp(join(tmpdir(),'solventir-production-'));
 const runtimes=[];
 const app=await createProductionServer({originSecret,sessionSecret,allowedOrigins:[origin],dataDirectory:directory,
  runtimeOptions:{providers:providers(),inspect:async()=>({status:'unavailable',label:'Not available',items:[]})},
  runtimeFactory:async args=>{const runtime=await createScannerRuntime(args);runtimes.push(runtime);return runtime;},
  ...options,
 });
 const address=await app.listen(0,'127.0.0.1'),base='http://127.0.0.1:'+address.port;
 async function request(path='/scanner',{cookie,body,headers={},method}={}){
  const response=await fetch(base+'/sjay-api'+path,{method:method||(body===undefined?'GET':'POST'),headers:{
   'x-solventir-origin-secret':originSecret,Origin:origin,...(cookie?{Cookie:cookie}:{}),
   ...(body===undefined?{}:{'Content-Type':'application/json'}),...headers,
  },...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
  return response;
 }
 const bootstrap=async()=>{const response=await request();assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];};
 return {app,base,directory,runtimes,request,bootstrap,async close(remove=true){await app.close();if(remove)await rm(directory,{recursive:true,force:true});}};
}

test('production rejects missing edge secret, cross-origin access, unsupported routes and key setup',async()=>{
 const f=await fixture();
 try{
  assert.equal((await f.request('/scanner',{headers:{'x-solventir-origin-secret':''}})).status,403);
  assert.equal((await f.request('/scanner',{headers:{Origin:'https://unrelated.example'}})).status,403);
  assert.equal((await f.request('/scanner/start',{body:{config:defaultPersonalScanner()},headers:{Origin:''}})).status,403);
  for(const path of ['/bundlers/configure','/../setup/bundlers','/scanner/extra','/../../dist/index.html'])assert.equal((await f.request(path)).status,404);
  assert.equal((await f.request('/signals',{body:{}})).status,405);
  assert.equal((await f.request('/wallet',{body:'{}',headers:{'Content-Type':'text/plain'}})).status,415);
  assert.equal((await f.request('/wallet',{body:'{'})).status,400);
  assert.equal((await f.request('/wallet',{body:{address:'invalid'}})).status,400);
  assert.equal((await f.request('/wallet',{body:{address:'x'.repeat(2000)}})).status,413);
  assert.deepEqual(await readdir(f.directory),[]);
 }finally{await f.close();}
});

test('only scanner snapshot creates Secure signed cookies; sessions cannot read or pause each other',async()=>{
 const f=await fixture();
 try{
  const bundler=await f.request('/bundlers?chain=solana&address='+mint);
  assert.equal(bundler.status,200);assert.equal(bundler.headers.get('set-cookie'),null);
  assert.equal((await f.request('/scanner/events')).status,409);
  assert.equal((await f.request('/scanner/start',{body:{config:defaultPersonalScanner()}})).status,409);
  const response=await f.request(),cookieA=response.headers.get('set-cookie').split(';')[0];
  assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
  assert.match(response.headers.get('set-cookie'),/Path=\/sjay-api/);
  const cookieB=await f.bootstrap();assert.notEqual(cookieA,cookieB);
  assert.equal((await f.request('/scanner/start',{cookie:cookieA,body:{config:defaultPersonalScanner()}})).status,200);
  await f.runtimes[0].settled();
  const a=await(await f.request('/scanner',{cookie:cookieA})).json(),b=await(await f.request('/scanner',{cookie:cookieB})).json();
  assert.equal(a.status,'running');assert.equal(a.groups.length,1);assert.equal(b.status,'paused');assert.equal(b.groups.length,0);
  await f.request('/scanner/pause',{cookie:cookieB,body:{}});
  assert.equal((await(await f.request('/scanner',{cookie:cookieA})).json()).status,'running');
  const invalid=cookieA.slice(0,-1)+(cookieA.endsWith('a')?'b':'a');
  assert.equal((await f.request('/scanner/pause',{cookie:invalid,body:{}})).status,409);
  assert.equal((await f.request('/scanner/pause',{cookie:cookieA+'; '+cookieB,body:{}})).status,409);
 }finally{await f.close();}
});

test('saved findings survive server restart in their own session and resume paused',async()=>{
 let f=await fixture(),directory=f.directory,cookie;
 try{
  cookie=await f.bootstrap();await f.request('/scanner/start',{cookie,body:{config:defaultPersonalScanner()}});await f.runtimes[0].settled();
  await f.close(false);f=await fixture({dataDirectory:directory});
  const snapshot=await(await f.request('/scanner',{cookie})).json();
  assert.equal(snapshot.status,'paused');assert.equal(snapshot.groups[0].coins[0].address,mint);
 }finally{await f.close();}
});

test('active scanner and saved-session caps reject explicitly without altering existing sessions',async()=>{
 const f=await fixture({maxActiveScans:1,maxSessions:2});
 try{
  const first=await f.bootstrap(),second=await f.bootstrap();
  await f.request('/scanner/start',{cookie:first,body:{config:defaultPersonalScanner()}});
  const limited=await f.request('/scanner/start',{cookie:second,body:{config:defaultPersonalScanner()}});
  assert.equal(limited.status,429);assert.match((await limited.json()).message,/pilot is busy/);
  assert.equal((await f.request()).status,503);
  await f.request('/scanner/pause',{cookie:first,body:{}});
  assert.equal((await f.request('/scanner/start',{cookie:second,body:{config:defaultPersonalScanner()}})).status,200);
 }finally{await f.close();}
});

test('expired browser sessions pause and archive findings, freeing slots without deleting saved data',async()=>{
 let time=Date.now();const f=await fixture({maxActiveScans:1,maxSessions:1,now:()=>time});
 try{
  const oldCookie=await f.bootstrap();
  await f.request('/scanner/start',{cookie:oldCookie,body:{config:defaultPersonalScanner()}});await f.runtimes[0].settled();
  time+=31*86400000;
  const next=await f.bootstrap();assert.notEqual(oldCookie,next);
  const archived=await readdir(join(f.directory,'archive'));assert.equal(archived.length,1);
  const saved=JSON.parse(await readFile(join(f.directory,'archive',archived[0],'scanner.json'),'utf8'));
  assert.equal(saved.state.status,'paused');assert.equal(saved.state.groups[0].coins[0].address,mint);
  assert.equal((await f.request('/scanner/start',{cookie:oldCookie,body:{config:defaultPersonalScanner()}})).status,409);
  assert.equal((await f.request('/scanner/start',{cookie:next,body:{config:defaultPersonalScanner()}})).status,200);
 }finally{await f.close();}
});

test('health alias supports the exact Amplify prefix without creating a session',async()=>{
 const f=await fixture();try{
  const response=await f.request('/health');assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{status:'ok',service:'solventir-api'});
  assert.equal(response.headers.get('set-cookie'),null);assert.deepEqual(await readdir(f.directory),[]);
 }finally{await f.close();}
});

test('failed session initialization cannot leave state without expiry metadata or block restart',async()=>{
 let f=await fixture({runtimeFactory:async({storagePath})=>{
  assert.equal(JSON.parse(await readFile(storagePath.replace(/\.json$/,'.meta.json'),'utf8')).version,1);
  throw Error('Initialization failed');
 }});const directory=f.directory;
 try{
  assert.equal((await f.request()).status,503);
  const files=await readdir(directory);assert.equal(files.length,1);assert.match(files[0],/\.meta\.json$/);
  await f.close(false);f=await fixture({dataDirectory:directory});assert.equal((await f.request('/health')).status,200);
  await f.bootstrap();
 }finally{await f.close();}
});

test('parallel snapshots cannot release the pending Start control lock or capacity reservation',async()=>{
 const f=await fixture({maxActiveScans:1});let pending;
 try{
  const cookie=await f.bootstrap(),other=await f.bootstrap();
  pending=http.request(f.base+'/sjay-api/scanner/start',{method:'POST',headers:{Origin:origin,'x-solventir-origin-secret':originSecret,Cookie:cookie,'Content-Type':'application/json'}});
  pending.on('error',()=>{});pending.write('{');
  await new Promise(resolve=>setTimeout(resolve,40));
  assert.equal((await f.request('/scanner',{cookie})).status,200);
  assert.equal((await f.request('/scanner/pause',{cookie,body:{}})).status,409);
  assert.equal((await f.request('/scanner/start',{cookie:other,body:{config:defaultPersonalScanner()}})).status,429);
  const ended=new Promise(resolve=>pending.once('response',response=>{response.resume();response.once('end',resolve);}));pending.end('}');await ended;
  assert.equal((await f.request('/scanner/start',{cookie:other,body:{config:defaultPersonalScanner()}})).status,200);
 }finally{pending?.destroy();await f.close();}
});

test('SSE emits genuine isolated snapshots and has bounded client slots',async()=>{
 const f=await fixture({maxStreams:1,heartbeatMs:50});let reader;
 try{
  const cookie=await f.bootstrap();const stream=await f.request('/scanner/events',{cookie});
  assert.equal(stream.status,200);assert.match(stream.headers.get('content-type'),/text\/event-stream/);
  reader=stream.body.getReader();const first=new TextDecoder().decode((await reader.read()).value);
  assert.match(first,/event: snapshot/);assert.match(first,/"status":"paused"/);
  assert.equal((await f.request('/scanner/events',{cookie})).status,429);
  await reader.cancel();reader=null;
 }finally{await reader?.cancel();await f.close();}
});

test('provider concurrency stays occupied until a disconnected response completes',async()=>{
 let finish,started;const entered=new Promise(resolve=>{started=resolve;});
 const f=await fixture({maxConcurrent:1,signalsOptions:{fetcher:()=>{started();return new Promise(resolve=>{finish=()=>resolve(new Response('{}',{status:503}));});}}});
 try{
  const first=f.request('/signals');await entered;
  assert.equal((await f.request('/bundlers?chain=solana&address='+mint)).status,429);
  finish();await first;
  assert.equal((await f.request('/bundlers?chain=solana&address='+mint)).status,200);
 }finally{finish?.();await f.close();}
});

test('shared provider scheduler spaces callers, bounds queue, obeys cooldown and blocks paid X',async()=>{
 const calls=[];let finish;
 const send=createProductionFetch({spacingMs:25,maxQueued:2,fetchImpl:async url=>{calls.push({url,at:Date.now()});if(url.endsWith('/slow'))return new Promise(resolve=>{finish=()=>resolve(new Response('{}'));});return new Response('{}');}});
 const first=send('https://example.com/slow');
 while(!finish)await new Promise(resolve=>setTimeout(resolve,1));
 const second=send('https://example.com/second');assert.equal((await send('https://other.com/third')).status,429);
 finish();await Promise.all([first,second]);assert.ok(calls[1].at-calls[0].at>=20);
 assert.equal((await send('https://api.x.com/2/posts')).status,503);assert.equal(calls.length,2);
 let count=0;const limited=createProductionFetch({spacingMs:0,fetchImpl:async()=>{count++;return new Response('{}',{status:429,headers:{'Retry-After':'30'}});}});
 assert.equal((await limited('https://rpc.example.com/')).status,429);assert.equal((await limited('https://rpc.example.com/')).status,429);assert.equal(count,1);
});

test('unsafe production configuration fails closed',async()=>{
 await assert.rejects(createProductionServer({originSecret:'short'}),/distinct production secrets/);
 await assert.rejects(createProductionServer({originSecret,sessionSecret,dataDirectory:'.runtime',allowedOrigins:[origin]}),/absolute/);
});
