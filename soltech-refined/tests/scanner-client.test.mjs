import test from 'node:test';
import assert from 'node:assert/strict';
import {createScannerClient,initialScannerState} from '../dist/scanner-client.js';

const next=()=>new Promise(resolve=>setImmediate(resolve));
const snapshot=(revision,status='paused')=>({...initialScannerState(),revision,status});
function harness(t,fetchImpl){
 const sources=[],calls=[],timers=new Map();let id=0;
 const client=createScannerClient({fetchImpl:async(url,options)=>{calls.push([url,options]);return fetchImpl(url,options);},setTimer:fn=>{timers.set(++id,fn);return id;},clearTimer:id=>timers.delete(id),eventSourceFactory:url=>{
  const stream=new EventTarget();stream.url=url;stream.closed=false;stream.close=()=>{stream.closed=true;};
  stream.send=value=>{const event=new Event('snapshot');event.data=JSON.stringify(value);stream.dispatchEvent(event);};sources.push(stream);return stream;
 }});
 t.after(()=>client.dispose());return {client,sources,calls,timers};
}
const response=value=>({ok:true,json:async()=>value});

test('stream updates cannot be overwritten by an older in-flight refresh',async t=>{
 let finish;const f=harness(t,()=>new Promise(resolve=>finish=resolve)),updates=[];
 const unsubscribe=f.client.subscribe(value=>updates.push(value));
 f.sources[0].send(snapshot(9,'running'));finish(response(snapshot(8)));await next();
 assert.equal(f.client.state.revision,9);assert.equal(f.client.state.status,'running');
 unsubscribe();assert.equal(f.sources[0].closed,true);assert.equal(f.calls.length,1);
});

test('navigating away closes the UI stream without pausing the server',async t=>{
 const f=harness(t,()=>response(snapshot(2,'running')));
 const leave=f.client.subscribe(()=>{});await next();leave();
 f.client.subscribe(()=>{});await next();
 assert.equal(f.sources.length,2);assert.ok(f.calls.every(([url,options])=>url==='/api/scanner'&&options.method==='GET'));
 assert.equal(f.client.state.status,'running');
});

test('Start sends actual saved filters and Pause waits for the service response',async t=>{
 const f=harness(t,url=>response(snapshot(url.endsWith('/pause')?4:3,url.endsWith('/pause')?'paused':'running')));
 const config={resultFilters:{capMax:'250000'}};
 await f.client.start(config);assert.equal(f.client.state.status,'running');
 assert.deepEqual(JSON.parse(f.calls[0][1].body),{config});assert.equal(f.calls[0][1].headers['Content-Type'],'application/json');
 await f.client.pause();assert.equal(f.client.state.status,'paused');
});

test('lost service connection retains results but marks them offline',async t=>{
 const f=harness(t,()=>response({...snapshot(2,'running'),groups:[{id:'keep',coins:[]}]}));
 f.client.subscribe(()=>{});await next();f.sources[0].dispatchEvent(new Event('error'));
 assert.equal(f.client.state.connection.status,'offline');assert.equal(f.client.state.groups[0].id,'keep');assert.equal(f.sources[0].closed,true);
});

test('a restarted service can publish a new lower revision without leaving the old scan active',async t=>{
 const f=harness(t,()=>response({...snapshot(9,'running'),instanceId:'first-service'}));
 f.client.subscribe(()=>{});await next();
 f.sources[0].send({...snapshot(1,'paused'),instanceId:'restarted-service'});
 assert.equal(f.client.state.status,'paused');assert.equal(f.client.state.revision,1);
 f.sources[0].send({...snapshot(0,'running'),instanceId:'restarted-service'});
 assert.equal(f.client.state.status,'paused');
});

test('a delayed refresh from an earlier service cannot replace the restarted stream',async t=>{
 let finish;const f=harness(t,()=>new Promise(resolve=>finish=resolve));f.client.subscribe(()=>{});
 f.sources[0].send({...snapshot(1,'paused'),instanceId:'new-service'});
 finish(response({...snapshot(99,'running'),instanceId:'old-service'}));await next();
 assert.equal(f.client.state.instanceId,'new-service');assert.equal(f.client.state.status,'paused');
});

test('malformed snapshots do not replace a valid Feed and failed commands remain errors',async t=>{
 const f=harness(t,()=>response(snapshot(2)));f.client.subscribe(()=>{});await next();
 f.sources[0].send({version:1,revision:3,status:'running'});
 assert.equal(f.client.state.revision,2);assert.equal(f.client.state.connection.status,'offline');
 const bad=harness(t,()=>({ok:false,json:async()=>({message:'Unable to save scanner state.'})}));
 await assert.rejects(bad.client.start({}),/Unable to save scanner state/);
 assert.equal(bad.client.state.status,'paused');
});
