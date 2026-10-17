import test from 'node:test';
import assert from 'node:assert/strict';
import {createScannerClient,initialScannerState} from '../dist/scanner-client.js';

const next=()=>new Promise(resolve=>setImmediate(resolve));
const snapshot=(revision,status,instanceId='service')=>({...initialScannerState(),revision,status,instanceId});
const response=value=>({ok:true,json:async()=>value});
function harness(t,fetchImpl){
 const sources=[],timers=new Set();
 const client=createScannerClient({fetchImpl,setTimer:(fn,ms)=>{const timer={fn,ms};timers.add(timer);return timer;},clearTimer:timer=>timers.delete(timer),eventSourceFactory:()=>{
  const source=new EventTarget();source.closed=false;source.close=()=>{source.closed=true;};
  source.send=value=>{const event=new Event('snapshot');event.data=JSON.stringify(value);source.dispatchEvent(event);};sources.push(source);return source;
 }});
 t.after(()=>client.dispose());return {client,sources,timers};
}

test('a delayed Start response from the previous service cannot undo a restart shown by the stream',async t=>{
 let finishStart;
 const f=harness(t,url=>url.endsWith('/start')?new Promise(resolve=>finishStart=resolve):response(snapshot(8,'paused','old-service')));
 f.client.subscribe(()=>{});await next();
 const start=f.client.start({resultFilters:{capMax:'20000'}});
 f.sources[0].send(snapshot(1,'paused','new-service'));
 finishStart(response(snapshot(99,'running','old-service')));await start;
 assert.equal(f.client.state.instanceId,'new-service');assert.equal(f.client.state.revision,1);assert.equal(f.client.state.status,'paused');
});

test('out-of-order Pause and Start responses retain the server’s newest command revision',async t=>{
 let finishPause,finishStart;
 const f=harness(t,url=>url.endsWith('/pause')?new Promise(resolve=>finishPause=resolve):new Promise(resolve=>finishStart=resolve));
 const pause=f.client.pause(),start=f.client.start({});
 finishStart(response(snapshot(12,'running')));await start;
 finishPause(response(snapshot(11,'paused')));await pause;
 assert.equal(f.client.state.revision,12);assert.equal(f.client.state.status,'running');
});

test('queued events from a closed stream cannot overwrite or close the replacement stream',async t=>{
 const f=harness(t,()=>response(snapshot(3,'paused')));f.client.subscribe(()=>{});await next();
 const old=f.sources[0];old.dispatchEvent(new Event('error'));
 const retry=[...f.timers].find(timer=>timer.ms===5000);assert.ok(retry);retry.fn();await next();
 const current=f.sources[1];current.send(snapshot(1,'paused','new-service'));
 old.send(snapshot(99,'running','old-service'));old.dispatchEvent(new Event('error'));
 assert.equal(f.client.state.instanceId,'new-service');assert.equal(f.client.state.status,'paused');assert.equal(f.client.state.connection.status,'connected');assert.equal(current.closed,false);
});

test('disposing during an unresolved command prevents later response notifications',async t=>{
 let finish;const updates=[];
 const f=harness(t,url=>url.endsWith('/start')?new Promise(resolve=>finish=resolve):response(snapshot(1,'paused')));
 f.client.subscribe(value=>updates.push(value));await next();const pending=f.client.start({});
 f.client.dispose();const before=updates.length;finish(response(snapshot(2,'running')));await pending;
 assert.equal(updates.length,before);assert.equal(f.client.state.status,'paused');
});

test('an older failed refresh cannot mark a freshly connected paused stream offline',async t=>{
 let rejectRefresh;const f=harness(t,()=>new Promise((resolve,reject)=>{rejectRefresh=reject;}));
 f.client.subscribe(()=>{});f.sources[0].send(snapshot(1,'paused','restarted-service'));
 rejectRefresh(Error('The earlier request disconnected'));await next();
 assert.equal(f.client.state.instanceId,'restarted-service');assert.equal(f.client.state.status,'paused');assert.equal(f.client.state.connection.status,'connected');
});
