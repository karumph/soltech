import test from 'node:test';
import assert from 'node:assert/strict';

const pauseKey='soltech.scanner-demo-paused.v1';
let moduleId=0;
async function fixture(t,{paused=false,reduced=false}={}){
 const originals=['window','ResizeObserver'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]),disposers=[];
 const values=new Map(paused?[[pauseKey,'true']]:[]),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const media=new EventTarget();media.matches=reduced;
 const window=new EventTarget();window.localStorage=storage;window.matchMedia=()=>media;
 Object.defineProperty(globalThis,'window',{configurable:true,value:window});
 Object.defineProperty(globalThis,'ResizeObserver',{configurable:true,value:class{observe(){}disconnect(){}}});
 t.after(()=>{try{for(const dispose of disposers.reverse())dispose();}finally{for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 const flow=await import(`../dist/scanner-flow.js?scanner-flow-test=${++moduleId}`);
 const button=new EventTarget();button.attributes=new Map();button.setAttribute=(key,value)=>button.attributes.set(key,value);
 const note={},status={},captions=['Scanning posts','Scanning projects'].map(text=>({textContent:text,dataset:{runningCaption:text}}));
 const box=rect=>({getBoundingClientRect:()=>rect});
 const leftWindow=box({top:24,bottom:48,height:24}),rightWindow=box({top:24,bottom:48,height:24});
 const left=box({left:0,right:120}),right=box({left:132,right:252});
 left.querySelector=()=>leftWindow;right.querySelector=()=>rightWindow;
 const line={setAttribute(){}},link={style:{},setAttribute(){},querySelector:()=>line};
 const sources=box({left:0,top:0});sources.querySelector=selector=>({'.flow-source-link':link,'.flow-source-x':left,'.flow-source-pairs':right})[selector];
 const engine={dataset:{},querySelector:selector=>({'[data-flow-pause]':button,'.engine-demo-note':note,'[data-flow-status]':status,'.flow-sources':sources})[selector],querySelectorAll:()=>captions};
 const root={querySelector:()=>engine};
 const mount=()=>{const dispose=flow.mountScannerFlow(root);disposers.push(dispose);return dispose;};
 const storageEvent=(key,newValue,storageArea=storage)=>{const event=new Event('storage');Object.assign(event,{key,newValue,storageArea});window.dispatchEvent(event);};
 return {flow,mount,button,note,status,captions,engine,storage,values,storageEvent,media};
}

test('Pause persists through navigation and Resume restores running captions',async t=>{
 const f=await fixture(t);const dispose=f.mount();
 f.button.dispatchEvent(new Event('click'));
 assert.equal(f.engine.dataset.paused,'true');assert.equal(f.values.get(pauseKey),'true');assert.equal(f.captions[0].textContent,'Paused');
 dispose();assert.match(f.flow.scannerFlowHTML(),/data-paused="true"/);f.mount();
 f.button.dispatchEvent(new Event('click'));
 assert.equal(f.engine.dataset.paused,'false');assert.equal(f.values.get(pauseKey),'false');assert.equal(f.captions[1].textContent,'Scanning projects');
});

test('scanner reflects pause changes made while another screen is open',async t=>{
 const f=await fixture(t);const dispose=f.mount();dispose();
 f.values.set(pauseKey,'true');assert.match(f.flow.scannerFlowHTML(),/data-paused="true"/);
 f.values.clear();assert.match(f.flow.scannerFlowHTML(),/data-paused="false"/);
});

test('open scanner follows cross-tab pause and clear events without writing storage',async t=>{
 const f=await fixture(t);const dispose=f.mount();let writes=0;f.storage.setItem=()=>{writes++;};
 f.values.set(pauseKey,'true');f.storageEvent(pauseKey,'true');
 assert.equal(f.engine.dataset.paused,'true');assert.equal(f.status.textContent,'Inactive');
 f.storageEvent(pauseKey,'false',{});assert.equal(f.engine.dataset.paused,'true');
 f.values.clear();f.storageEvent(null,null);assert.equal(f.engine.dataset.paused,'false');
 assert.equal(writes,0);dispose();f.storageEvent(pauseKey,'true');assert.equal(f.engine.dataset.paused,'false');
});

test('failed storage writes retain the local pause choice through navigation',async t=>{
 const f=await fixture(t);f.storage.setItem=()=>{throw new Error('Storage full');};const dispose=f.mount();
 f.button.dispatchEvent(new Event('click'));dispose();
 assert.match(f.flow.scannerFlowHTML(),/data-paused="true"/);f.mount();assert.equal(f.engine.dataset.paused,'true');
});

test('reduced motion pauses the preview without overwriting the saved choice',async t=>{
 const f=await fixture(t);f.mount();f.media.matches=true;f.media.dispatchEvent(new Event('change'));
 assert.equal(f.engine.dataset.paused,'true');assert.equal(f.button.hidden,true);assert.match(f.note.textContent,/Static preview/);
 assert.equal(f.values.has(pauseKey),false);
 f.media.matches=false;f.media.dispatchEvent(new Event('change'));assert.equal(f.engine.dataset.paused,'false');assert.equal(f.button.hidden,false);
 f.button.dispatchEvent(new Event('click'));f.media.matches=true;f.media.dispatchEvent(new Event('change'));f.media.matches=false;f.media.dispatchEvent(new Event('change'));
 assert.equal(f.engine.dataset.paused,'true');assert.equal(f.values.get(pauseKey),'true');
});
