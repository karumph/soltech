import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {createScannerHandler} from '../scanner-api.mjs';

const port=4185,origin='http://127.0.0.1:'+port;
function mockRuntime(){const listeners=new Set();return {starts:0,pauses:0,disposed:false,state:{version:1,instanceId:'test',revision:1,status:'paused',groups:[]},getSnapshot(){return this.state;},subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},async start(config){this.starts++;this.config=config;return this.state;},async pause(){this.pauses++;return this.state;},async dispose(){this.disposed=true;},emit(state){this.state=state;for(const listener of listeners)listener(state);},get listeners(){return listeners.size;}};}
async function invoke(handler,{path='/api/scanner',method='GET',body='',headers={},remoteAddress='127.0.0.1',res}={}){
 const req=Readable.from([body]);req.url=path;req.method=method;req.headers={host:'127.0.0.1:'+port,origin,'content-type':'application/json',...headers};req.socket={remoteAddress};
 res??=Object.assign(new EventEmitter(),{writes:[],ended:false,writeHead(status,headers){this.status=status;this.headers=headers;},write(chunk){this.writes.push(chunk);return true;},end(body){this.ended=true;this.body=body?JSON.parse(body):undefined;}});
 const handled=await handler(req,res,new URL(path,origin));return {handled,res};
}

test('scanner API applies loopback, host, origin and method guards before any state mutation',async()=>{
 const runtime=mockRuntime(),handler=createScannerHandler({port,runtime});
 for(const bad of [{headers:{origin:'https://evil.example'}},{headers:{host:'evil.example'}},{headers:{host:'127.0.0.1:9999'}},{headers:{origin:'null'}},{headers:{'sec-fetch-site':'cross-site'}},{remoteAddress:'192.168.0.1'}])assert.equal((await invoke(handler,{...bad,path:'/api/scanner/start',method:'POST',body:'{"config":{}}'})).res.status,403);
 const method=await invoke(handler,{method:'POST'});assert.equal(method.res.status,405);assert.equal(method.res.headers.Allow,'GET');assert.equal(runtime.starts,0);assert.equal(runtime.pauses,0);assert.equal((await invoke(handler,{path:'/other'})).handled,false);await handler.dispose();
});
test('bounded JSON bodies and explicit config are required; successful actions return the shared snapshot',async()=>{
 const runtime=mockRuntime(),handler=createScannerHandler({port,runtime});
 for(const input of [{headers:{'content-type':'text/plain'},body:'{}',code:415},{body:'{bad',code:400},{body:'[]',code:400},{body:'{}',code:400},{body:'x'.repeat(16385),code:413},{headers:{'content-length':'20000'},body:'',code:413}]){
  const result=await invoke(handler,{path:'/api/scanner/start',method:'POST',...input});assert.equal(result.res.status,input.code);assert.equal(typeof result.res.body.message,'string');
 }
 const start=await invoke(handler,{path:'/api/scanner/start',method:'POST',body:'{"config":{"name":"Test"}}'});assert.equal(start.res.status,200);assert.equal(runtime.starts,1);assert.equal(runtime.config.name,'Test');
 assert.equal((await invoke(handler,{path:'/api/scanner/pause',method:'POST',body:'{}'})).res.status,200);assert.equal(runtime.pauses,1);
 const snapshot=await invoke(handler);assert.equal(snapshot.res.headers['Cache-Control'],'no-store');assert.equal(snapshot.res.headers['X-Content-Type-Options'],'nosniff');assert.deepEqual(snapshot.res.body,runtime.state);await handler.dispose();
});
test('SSE sends initial/full snapshots and coalesces backpressure without disconnecting a large valid feed',async()=>{
 const runtime=mockRuntime(),handler=createScannerHandler({port,runtime});let writes=0;
 const res=Object.assign(new EventEmitter(),{chunks:[],ended:false,writeHead(status,headers){this.status=status;this.headers=headers;},write(chunk){this.chunks.push(chunk);writes++;return writes!==1;},end(){this.ended=true;}});
 await invoke(handler,{path:'/api/scanner/events',res});assert.equal(res.status,200);assert.equal(res.ended,false);assert.equal(runtime.listeners,1);
 runtime.emit({...runtime.state,revision:2,groups:[{text:'x'.repeat(30000)}]});runtime.emit({...runtime.state,revision:3,groups:[{text:'latest'}]});assert.equal(res.chunks.length,1);assert.equal(res.ended,false);
 res.emit('drain');assert.equal(res.chunks.length,2);assert.match(res.chunks[1],/id: 3\nevent: snapshot/);assert.match(res.chunks[1],/latest/);assert.doesNotMatch(res.chunks[1],/id: 2/);
 res.emit('close');assert.equal(runtime.listeners,0);assert.equal(res.ended,true);await handler.dispose();
});
test('SSE connection cap and handler shutdown release listeners',async()=>{
 const runtime=mockRuntime(),handler=createScannerHandler({port,runtime,maxClients:1});const first=await invoke(handler,{path:'/api/scanner/events'});assert.equal(first.res.status,200);assert.equal((await invoke(handler,{path:'/api/scanner/events'})).res.status,429);
 await handler.dispose();assert.equal(first.res.ended,true);assert.equal(runtime.listeners,0);assert.equal(runtime.disposed,true);assert.equal((await invoke(handler)).res.status,503);
});
