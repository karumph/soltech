import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileFeature} from '../dist/profile.js';
import {createProfileStore,defaultProfile,PROFILE_KEY} from '../dist/profile-store.js';

function fixture(t){
 const originals=['document','window'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]),cleanup=[];
 Object.defineProperty(globalThis,'document',{configurable:true,value:{title:''}});
 Object.defineProperty(globalThis,'window',{configurable:true,value:new EventTarget()});
 t.after(()=>{try{for(const dispose of cleanup.reverse())dispose();}finally{for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 const root=new EventTarget(),nodes=new Map();let html='',readable=true;
 Object.defineProperty(root,'innerHTML',{get:()=>html,set:value=>{
  html=value;nodes.clear();
  if(value.includes('id="personal-feedback"'))nodes.set('#personal-feedback',{textContent:'',classList:{toggle(){}}});
  if(value.includes('data-profile-save'))nodes.set('[data-profile-save]',{disabled:/data-profile-save\s+disabled/.test(value),textContent:'Save changes'});
  if(value.includes('data-profile-action="reload-saved"'))nodes.set('[data-profile-action="reload-saved"]',{hidden:true});
 }});
 root.querySelector=selector=>nodes.get(selector)||null;
 const values=new Map([[PROFILE_KEY,JSON.stringify({...defaultProfile(),name:'Original'})]]);
 const storage={getItem:key=>{if(!readable)throw Error('Storage unavailable');return values.get(key)||null;},setItem:(key,value)=>values.set(key,value)};
 const store=createProfileStore(storage),navigations=[];
 const feature=createProfileFeature({store,getScanners:()=>[],getDraft:()=>null,navigate:view=>navigations.push(view),toast:()=>{}});
 const dispatch=(type,target)=>{const event=new Event(type,{cancelable:true});Object.defineProperty(event,'target',{value:target});root.dispatchEvent(event);return event;};
 return {root,nodes,store,storage,navigations,cleanup,
  setReadable:value=>{readable=value;},
  mount:(view='profile',page='edit')=>cleanup.push(feature.mount(root,view,page)),
  input:name=>dispatch('input',{dataset:{profileField:'name'},value:name}),
  click:action=>dispatch('click',{closest:()=>({dataset:{profileAction:action}})}),
  submit:()=>dispatch('submit',{id:'personal-edit-form'}),
  change:target=>dispatch('change',target)
 };
}

test('a failed conflict reload explains the failure and preserves local edits until the saved version can be loaded',t=>{
 const f=fixture(t);f.mount();f.input('Keep my edits');
 const other=createProfileStore(f.storage);assert.equal(other.save({...other.value,name:'Saved elsewhere'}).ok,true);
 f.submit();assert.equal(f.nodes.get('[data-profile-action="reload-saved"]').hidden,false);
 f.setReadable(false);f.click('reload-saved');
 assert.match(f.nodes.get('#personal-feedback').textContent,/couldn’t be loaded.*unsaved changes are still here/);
 assert.match(f.root.innerHTML,/value="Keep my edits"/);
 assert.equal(f.nodes.get('[data-profile-save]').disabled,true);
 assert.deepEqual(f.navigations,[]);
 f.setReadable(true);f.click('retry');f.submit();
 assert.match(f.nodes.get('#personal-feedback').textContent,/changed in another tab/);
 f.click('reload-saved');assert.match(f.root.innerHTML,/value="Saved elsewhere"/);
 assert.equal(f.nodes.get('[data-profile-save]').disabled,false);
 f.submit();assert.deepEqual(f.navigations,['profile']);
 assert.equal(createProfileStore(f.storage).value.name,'Saved elsewhere');
});

test('retrying storage while a photo is opening keeps Save disabled and shows photo progress',t=>{
 const f=fixture(t),originalImage=globalThis.Image,originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;let revoked=false;
 globalThis.Image=class {set src(value){}};
 URL.createObjectURL=()=> 'blob:profile-busy';URL.revokeObjectURL=()=>{revoked=true;};
 // Restore the image helpers only after fixture cleanup cancels the pending photo.
 f.cleanup.unshift(()=>{globalThis.Image=originalImage;URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;assert.equal(revoked,true);});
 f.setReadable(false);f.mount();
 f.change({id:'personal-photo-file',dataset:{},files:[{type:'image/png',size:10}],value:'photo.png'});
 assert.equal(f.nodes.get('[data-profile-save]').disabled,true);
 f.setReadable(true);f.click('retry');
 assert.equal(f.nodes.get('[data-profile-save]').disabled,true);
 assert.equal(f.nodes.get('[data-profile-save]').textContent,'Preparing photo…');
 f.submit();assert.deepEqual(f.navigations,[]);
});
