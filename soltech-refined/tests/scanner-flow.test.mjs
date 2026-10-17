import test from 'node:test';
import assert from 'node:assert/strict';
import {scannerFlowHTML,mountScannerFlow} from '../dist/scanner-flow.js';
import {initialScannerState} from '../dist/scanner-client.js';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(t){
 const originals=['window','ResizeObserver'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]);
 const media=new EventTarget();media.matches=false;
 Object.defineProperty(globalThis,'window',{configurable:true,value:{matchMedia:()=>media}});
 Object.defineProperty(globalThis,'ResizeObserver',{configurable:true,value:class{observe(){}disconnect(){}}});
 const node=()=>({dataset:{},attributes:{},setAttribute(key,value){this.attributes[key]=value;},textContent:''});
 const button=Object.assign(new EventTarget(),node()),note=node(),status=node(),count=node(),finds=node(),checkNote=node(),serviceNote=node();
 const captions=[node(),node()],steps=[node(),node(),node()],counts={matched:node(),checked:node()};
 const box=rect=>({...node(),getBoundingClientRect:()=>rect});
 const windows=[box({top:24,bottom:48,height:24}),box({top:24,bottom:48,height:24})];
 const left=box({left:0,right:120}),right=box({left:132,right:252});
 [left,right].forEach((source,index)=>{source.querySelector=selector=>selector==='.flow-scan-window'?windows[index]:captions[index];});
 const link={...node(),style:{},querySelector:()=>node()},sources=box({left:0,top:0});
 sources.querySelector=selector=>({'.flow-source-link':link,'.flow-source-x':left,'.flow-source-pairs':right})[selector];
 const engine={dataset:{},querySelector:selector=>({'[data-flow-pause]':button,'.engine-demo-note':note,'[data-flow-status]':status,'.flow-sources':sources,'.flow-find-count':count,'.flow-stage-finds':finds,'[data-flow-check-note]':checkNote,'.engine-service-note':serviceNote,'[data-flow-count="matched"]':counts.matched,'[data-flow-count="checked"]':counts.checked})[selector],querySelectorAll:()=>steps};
 let listener;const calls=[],config={resultFilters:{capMax:'50000'}},client={state:{...initialScannerState(),connection:{status:'connected'}},subscribe(fn){listener=fn;fn(this.state);return ()=>{listener=null;};},async start(value){calls.push(['start',value]);this.send({status:'running',sources:{posts:{status:'disconnected'},projects:{status:'running'}}});},async pause(){calls.push(['pause']);this.send({status:'paused'});},send(value){this.state={...this.state,...value};listener?.(this.state);}};
 const dispose=mountScannerFlow({querySelector:()=>engine},{client,getConfig:()=>config});
 t.after(()=>{dispose();for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
 return {button,note,status,engine,media,client,calls,config,captions,steps,count,counts,dispose};
}

test('Start uses saved settings and captions reflect actual connected sources',async t=>{
 const f=fixture(t);assert.match(f.button.innerHTML,/Start/);assert.equal(f.engine.dataset.paused,'true');
 f.button.dispatchEvent(new Event('click'));await tick();
 assert.deepEqual(f.calls,[['start',f.config]]);assert.equal(f.engine.dataset.paused,'false');
 assert.equal(f.captions[0].textContent,'Not connected');assert.equal(f.captions[1].textContent,'Scanning');
 f.button.dispatchEvent(new Event('click'));await tick();assert.equal(f.engine.dataset.paused,'true');assert.equal(f.captions[1].textContent,'Paused');
});

test('reduced motion does not stop a real scan or hide its pause control',async t=>{
 const f=fixture(t);await f.client.start(f.config);f.media.matches=true;f.media.dispatchEvent(new Event('change'));
 assert.equal(f.engine.dataset.reducedMotion,'true');assert.equal(f.engine.dataset.paused,'false');assert.equal(f.button.disabled,false);assert.match(f.button.innerHTML,/Pause/);
});

test('counters and green checks require reported data rather than elapsed animation',t=>{
 const f=fixture(t);assert.ok(f.steps.every(step=>step.dataset.checkState==='pending'));
 f.client.send({counts:{matched:1,checked:2,finds:3},groups:[{coins:[{checks:{checkedAt:'2026-10-12T12:00:00Z',items:[{status:'pass'},{status:'flag'},{status:'unknown'}]}}]}]});
 assert.equal(f.count.textContent,'3');assert.equal(f.counts.matched.textContent,'1');assert.deepEqual(f.steps.map(step=>step.dataset.checkState),['pass','flag','unknown']);
});

test('offline state does not imply an active scan is paused on the server',async t=>{
 const f=fixture(t);await f.client.start(f.config);f.client.send({connection:{status:'offline',message:'Connection lost.'}});
 assert.equal(f.status.textContent,'Offline');assert.equal(f.button.disabled,false);assert.equal(f.client.state.status,'running');assert.deepEqual(f.calls,[['start',f.config]]);
 f.button.dispatchEvent(new Event('click'));await tick();assert.equal(f.client.state.status,'paused');
});

test('unmount releases subscriptions without pausing and the initial HTML claims no running work',t=>{
 const f=fixture(t);f.dispose();f.client.send({status:'running'});assert.equal(f.status.textContent,'Inactive');assert.equal(f.calls.length,0);
 const html=scannerFlowHTML('<script>');assert.match(html,/X post/);assert.match(html,/New projects/);assert.match(html,/data-paused="true"/);assert.doesNotMatch(html,/<script>|Scanning posts|demo cycle/);
});
