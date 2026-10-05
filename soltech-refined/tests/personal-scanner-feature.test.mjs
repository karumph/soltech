import test from 'node:test';
import assert from 'node:assert/strict';
import {createPersonalScannerFeature} from '../dist/personal-scanner.js';
import {createPersonalScannerStore,PERSONAL_SCANNER_KEY} from '../dist/personal-scanner-store.js';

function fixture(t){
 const originals=['document','window'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]),cleanup=[];
 const window=new EventTarget(),document={title:'',body:{classList:{toggle:()=>{}}}};
 Object.defineProperty(globalThis,'document',{configurable:true,value:document});Object.defineProperty(globalThis,'window',{configurable:true,value:window});
 t.after(()=>{try{for(const dispose of cleanup.reverse())dispose();}finally{for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 const root=new EventTarget();let renderedHTML='';root.renders=0;
 Object.defineProperty(root,'innerHTML',{get:()=>renderedHTML,set:html=>{renderedHTML=html;root.renders++;}});root.querySelector=()=>null;
 const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},store=createPersonalScannerStore(storage);
 store.begin();const config=store.state.draft.config;config.name='Earlier scanner';config.sources.projects.enabled=false;store.update(config);assert.equal(store.save().ok,true);
 const feature=createPersonalScannerFeature({store,getPrevious:()=>[],navigate:()=>{},toast:()=>{}});
 const mount=()=>cleanup.push(feature.mount(root,'finds'));
 const storageEvent=key=>{const event=new Event('storage');Object.defineProperty(event,'key',{value:key});window.dispatchEvent(event);};
 return {root,values,storage,store,mount,storageEvent};
}

test('clear-all storage events refresh Feed from the default scanner without writing data',t=>{
 const f=fixture(t);let writes=0;
 f.storage.setItem=()=>{writes++;throw new Error('Unexpected write');};
 f.mount();assert.equal(f.store.state.saved.name,'Earlier scanner');assert.equal(f.root.renders,1);
 f.values.clear();f.storageEvent(null);
 assert.equal(f.store.state.saved,null);assert.equal(f.store.state.draft,null);
 assert.equal(f.store.effective.name,'Soltech scanner');assert.equal(f.store.effective.sources.projects.enabled,true);assert.equal(f.root.renders,2);
 assert.equal(writes,0);assert.equal(f.storage.getItem(PERSONAL_SCANNER_KEY),null);
});

test('clear-all events preserve a recoverable local draft when storage already has an issue',t=>{
 const f=fixture(t);f.store.begin();
 f.storage.setItem=()=>{throw new Error('Storage full');};
 const config=f.store.state.draft.config;config.name='Keep local edits';config.resultFilters.capMax='123';f.store.update(config);
 assert.equal(f.store.issue,'write');const before=f.store.state;
 f.mount();f.values.clear();f.storageEvent(null);
 assert.equal(f.store.issue,'write');assert.deepEqual(f.store.state,before);
 assert.match(f.root.innerHTML,/Changes are in this tab but could not be saved/);
 assert.equal(f.storage.getItem(PERSONAL_SCANNER_KEY),null);
});
