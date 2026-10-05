import test from 'node:test';
import assert from 'node:assert/strict';
import {mountScannerCustomize} from '../dist/scanner-customize.js';
import {createPersonalScannerStore,PERSONAL_SCANNER_KEY} from '../dist/personal-scanner-store.js';

const attributes=tag=>new Map([...tag.matchAll(/\s([\w-]+)(?:="([^"]*)")?/g)].map(([,name,value])=>[name,value??'']));
function installDOM(t){
 const originals=['document','window'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]);
 const bodyClasses=new Set(),document={activeElement:null,title:'',body:{classList:{add:value=>bodyClasses.add(value),remove:value=>bodyClasses.delete(value)}}};
 const window=new EventTarget();window.matchMedia=()=>({matches:true});
 Object.defineProperty(globalThis,'document',{configurable:true,value:document});Object.defineProperty(globalThis,'window',{configurable:true,value:window});
 const cleanupTasks=[];
 t.after(()=>{try{for(const cleanup of cleanupTasks.reverse())cleanup();}finally{for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 class Root extends EventTarget{
  constructor(){super();this.nodes=new Map();this.errors=[];this.scrolls=[];this.renders=0;this.feedback={innerHTML:''};this.apply={textContent:'',disabled:false};this.footer={textContent:''};this.banner={hidden:true};this.clear={dataset:{customizeAction:'clear'},closest:selector=>selector==='[data-customize-action]'?this.clear:null,focus:()=>{document.activeElement=this.clear;}};}
  set innerHTML(html){
   if([...this.nodes.values()].includes(document.activeElement))document.activeElement=null;
   this.html=html;this.renders++;this.nodes=new Map();this.errors=[];this.details=[];this.repairButtons=[];
   const parents=[];
   for(const match of html.matchAll(/<\/?details\b[^>]*>|<(?:input|textarea|select|button)\b[^>]*>/g)){
    if(match[0].startsWith('</details')){parents.pop();continue;}
    if(match[0].startsWith('<details')){
     const attrs=attributes(match[0]),node={id:attrs.get('id'),tagName:'DETAILS',open:/\sopen(?:\s|>)/.test(match[0]),parentElement:parents.at(-1)||null};
     this.details.push(node);parents.push(node);if(node.id)this.nodes.set(node.id,node);continue;
    }
    const attrs=attributes(match[0]),id=attrs.get('id');if(!id&&!attrs.has('data-repair-action'))continue;
    const dataset=Object.fromEntries([...attrs].filter(([name])=>name.startsWith('data-')).map(([name,value])=>[name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase()),value]));
    const node={id,dataset,value:attrs.get('value')||'',selectionStart:0,selectionEnd:0,parentElement:parents.at(-1)||null,
     matches:()=>true,hasAttribute:name=>attrs.has(name),getAttribute:name=>attrs.get(name)??null,setAttribute:(name,value)=>attrs.set(name,value),removeAttribute:name=>attrs.delete(name),
     closest:selector=>selector===`[data-repair-action="${dataset.repairAction}"]`?node:null,
     focus:()=>{for(let parent=node.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS'&&!parent.open)return;document.activeElement=node;},scrollIntoView:options=>this.scrolls.push({id,options})};
    if(attrs.has('data-repair-action'))this.repairButtons.push(node);
    this.nodes.set(id||`repair-button-${this.repairButtons.length}`,node);
   }
   for(const match of html.matchAll(/<span class="(customize-field-error|field-error)" id="([^"]+)">([^<]*)<\/span>/g)){
    const node={className:match[1],id:match[2],textContent:match[3]};this.nodes.set(node.id,node);this.errors.push(node);
   }
   this.apply.disabled=/class="customize-apply"[^>]*disabled/.test(html);
   this.footer.textContent=html.match(/<footer[\s\S]*?<p>([^<]*)<\/p>/)?.[1]||'';
  }
  get innerHTML(){return this.html;}
  querySelector(selector){
   if(selector.startsWith('#'))return this.nodes.get(selector.slice(1))||null;
   if(selector==='.customize-apply')return this.apply;
   if(selector==='.customize-footer p')return this.footer;
   if(selector==='.customize-errors')return this.banner;
   if(selector==='.customize-clear')return this.clear;
   if(selector==='[data-customize-storage-status]')return this.html.includes('data-customize-storage-status')?this.feedback:null;
   const repair=selector.match(/^\[data-repair-action="([^"]+)"\](?:\[data-value="([^"]*)"\])?$/);
   if(repair)return this.repairButtons.find(node=>node.dataset.repairAction===repair[1]&&(repair[2]===undefined||node.dataset.value===repair[2]))||null;
   const match=selector.match(/^\[data-(setting|result-filter)="([^"]+)"\]$/);
   if(match)return [...this.nodes.values()].find(node=>node.dataset?.[match[1]==='setting'?'setting':'resultFilter']===match[2])||null;
   return null;
  }
  querySelectorAll(selector){
   if(selector==='details[open]')return this.details.filter(node=>node.open);
   if(selector==='[aria-invalid]')return [...this.nodes.values()].filter(node=>node.getAttribute?.('aria-invalid'));
   const classes=selector.split(',').map(value=>value.trim().slice(1));return this.errors.filter(node=>classes.includes(node.className));
  }
 }
 return {root:new Root(),document,window,cleanup:task=>cleanupTasks.push(task)};
}
function disk(){const values=new Map();return {values,getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};}
function emit(root,type,target){const event=new Event(type,{cancelable:true});Object.defineProperty(event,'target',{value:target});root.dispatchEvent(event);}

test('storage failures and conflicts keep the active input and caret while retaining edits',async t=>{
 for(const issue of ['write','conflict','read'])await t.test(issue,t=>{
  const {root,document,window,cleanup}=installDOM(t),storage=disk(),store=createPersonalScannerStore(storage);
  const dispose=mountScannerCustomize(root,{store,navigate:()=>{},toast:()=>{}});cleanup(dispose);
  const input=root.querySelector('#result-capMax');input.focus();
  if(issue==='write')storage.setItem=()=>{throw new Error('Storage full');};
  else{
   if(issue==='conflict'){const remote=JSON.parse(storage.getItem(PERSONAL_SCANNER_KEY));remote.revision++;storage.values.set(PERSONAL_SCANNER_KEY,JSON.stringify(remote));}
   else storage.getItem=()=>{throw new Error('Read denied');};
   const event=new Event('storage');Object.defineProperty(event,'key',{value:PERSONAL_SCANNER_KEY});window.dispatchEvent(event);
   assert.equal(document.activeElement,input);
  }
  for(const value of ['1','12','123']){input.value=value;input.selectionStart=input.selectionEnd=value.length;emit(root,'input',input);
   assert.equal(document.activeElement,input);assert.equal(root.querySelector('#result-capMax'),input);assert.equal(input.selectionStart,value.length);
  }
  assert.equal(store.issue,issue);assert.equal(store.state.draft.config.resultFilters.capMax,'123');assert.equal(root.renders,1);
  assert.match(root.feedback.innerHTML,issue==='write'?/could not be saved/:issue==='conflict'?/changed in another tab/:/could not be opened/);
  assert.equal(root.footer.textContent,'Edits kept in this tab');assert.equal(root.apply.disabled,issue!=='write');
 });
});

test('validation focuses the invalid field without forcing motion',t=>{
 const {root,cleanup}=installDOM(t),store=createPersonalScannerStore(disk());
 const dispose=mountScannerCustomize(root,{store,navigate:()=>{},toast:()=>{}});cleanup(dispose);
 const input=root.querySelector('#result-capMax');input.value='bad';emit(root,'input',input);
 emit(root,'submit',{id:'scanner-customize-form'});
 assert.deepEqual(root.scrolls.at(-1),{id:'result-capMax',options:{block:'center',behavior:'auto'}});
});

test('correcting an earlier source setting clears its error and does not revive it on rerender',t=>{
 const {root,cleanup}=installDOM(t),store=createPersonalScannerStore(disk());store.begin();
 const config=store.state.draft.config;config.sources.public.settings.capMax='bad';store.update(config);
 const dispose=mountScannerCustomize(root,{store,navigate:()=>{},toast:()=>{}});cleanup(dispose);
 emit(root,'submit',{id:'scanner-customize-form'});
 const input=root.querySelector('[data-setting="capMax"]'),error=root.querySelector('#setting-capMax-error');
 assert.equal(input.getAttribute('aria-invalid'),'true');assert.ok(error.textContent);
 input.value='123';emit(root,'input',input);
 assert.equal(error.textContent,'');assert.equal(input.getAttribute('aria-invalid'),null);
 emit(root,'click',root.clear);
 assert.equal(root.querySelector('#setting-capMax-error').textContent,'');assert.equal(root.querySelector('[data-setting="capMax"]').getAttribute('aria-invalid'),null);
 assert.equal(store.state.draft.config.sources.public.settings.capMax,'123');
});

test('changing an earlier source dropdown preserves focus and expanded settings',t=>{
 const {root,document,cleanup}=installDOM(t),store=createPersonalScannerStore(disk());store.begin();
 const config=store.state.draft.config;config.sources.public.settings.capMax='bad';store.update(config);
 cleanup(mountScannerCustomize(root,{store,navigate:()=>{},toast:()=>{}}));
 emit(root,'submit',{id:'scanner-customize-form'});
 const select=root.querySelector('#setting-valuation');select.parentElement.open=true;select.focus();select.value='fdv';
 emit(root,'change',select);
 const next=root.querySelector('#setting-valuation');
 assert.notEqual(next,select);assert.equal(document.activeElement,next);
 assert.equal(root.querySelector('#market-settings').open,true);assert.equal(root.querySelector('#venue-settings').open,true);
 assert.equal(store.state.draft.config.sources.public.settings.valuation,'fdv');
});

test('an invalid earlier scanner name has an associated error on its focused input',t=>{
 const {root,document,cleanup}=installDOM(t),store=createPersonalScannerStore(disk());store.begin();
 const config=store.state.draft.config;config.name='';store.update(config);
 cleanup(mountScannerCustomize(root,{store,navigate:()=>{},toast:()=>{}}));
 emit(root,'submit',{id:'scanner-customize-form'});
 const input=root.querySelector('#customize-name');
 assert.equal(document.activeElement,input);assert.equal(input.getAttribute('aria-invalid'),'true');
 assert.equal(input.getAttribute('aria-describedby'),'customize-name-error');
 assert.equal(root.querySelector('#customize-name-error').textContent,'Give your scanner a name.');
 input.value='Updated scanner';emit(root,'input',input);
 assert.equal(input.getAttribute('aria-invalid'),null);assert.equal(root.querySelector('#customize-name-error').textContent,'');
});

test('earlier age shortcuts preserve keyboard focus after updating the field',t=>{
 const {root,document,cleanup}=installDOM(t),store=createPersonalScannerStore(disk());store.begin();
 const config=store.state.draft.config;config.sources.projects.settings.ageMax='bad';store.update(config);
 cleanup(mountScannerCustomize(root,{store,navigate:()=>{},toast:()=>{}}));emit(root,'submit',{id:'scanner-customize-form'});
 const selector='[data-repair-action="age-shortcut"][data-value="6"]',button=root.querySelector(selector);button.focus();emit(root,'click',button);
 assert.equal(store.state.draft.config.sources.projects.settings.ageMax,'6');assert.equal(document.activeElement,root.querySelector(selector));
});

test('View filters in earlier source recovery opens the available filter controls',t=>{
 const {root,cleanup}=installDOM(t),store=createPersonalScannerStore(disk());store.begin();
 const config=store.state.draft.config;config.sources.projects.settings.ageMax='bad';config.sources.projects.settings.capMax='100000';store.update(config);
 cleanup(mountScannerCustomize(root,{store,navigate:()=>{},toast:()=>{}}));emit(root,'submit',{id:'scanner-customize-form'});
 const button=root.querySelector('[data-repair-action="builder-step"]');assert.ok(button);emit(root,'click',button);
 assert.ok(root.querySelector('#setting-capMax'));assert.ok(root.querySelector('#setting-ageMax'));
 assert.equal(store.state.draft.config.sources.projects.settings.capMax,'100000');
});
