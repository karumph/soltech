import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileFeature,renderProfileAvatar} from '../dist/profile.js';
import {createProfileStore,defaultProfile,PROFILE_KEY} from '../dist/profile-store.js';

function fixture(t,{scanners=[],draft=null,scannerState={saved:null,draft:null}}={}){
 const originals=['document','window'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]),cleanup=[];
 Object.defineProperty(globalThis,'document',{configurable:true,value:{title:''}});
 Object.defineProperty(globalThis,'window',{configurable:true,value:new EventTarget()});
 t.after(()=>{try{for(const dispose of cleanup.reverse())dispose();}finally{for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 const root=new EventTarget(),nodes=new Map();let html='',readable=true,activeDispose=null;
 const unmount=()=>{activeDispose?.();activeDispose=null;};cleanup.push(unmount);
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
 const feature=createProfileFeature({store,getScanners:()=>scanners,getDraft:()=>draft,getScannerState:()=>scannerState,navigate:view=>navigations.push(view),toast:()=>{}});
 const dispatch=(type,target)=>{const event=new Event(type,{cancelable:true});Object.defineProperty(event,'target',{value:target});root.dispatchEvent(event);return event;};
 return {root,nodes,store,storage,navigations,cleanup,
  setReadable:value=>{readable=value;},
  mount:(view='profile',page='edit')=>{unmount();activeDispose=feature.mount(root,view,page);},unmount,
  input:name=>dispatch('input',{dataset:{profileField:'name'},value:name}),
  click:action=>dispatch('click',{closest:()=>({dataset:{profileAction:action}})}),
  submit:(id='personal-edit-form')=>dispatch('submit',{id}),
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

test('Profile contains identity editing, the existing scanner shortcuts, and one Settings section',t=>{
 const f=fixture(t,{scanners:[{id:'earlier'}],draft:{},scannerState:{saved:{},draft:{}}});f.mount('profile','');
 const html=f.root.innerHTML;
 assert.match(html,/href="#profile\/edit"[^>]*aria-label="Edit profile"/);
 assert.match(html,/Your scanner.*Scanner settings.*Your sources and filters.*Continue setup.*Previous setups/s);
 assert.match(html,/href="#previous"/);
 assert.match(html,/aria-labelledby="personal-settings-title"><h2 id="personal-settings-title">Settings<\/h2>/);
 assert.ok(html.indexOf('Your scanner')<html.indexOf('personal-settings-title'));
 for(const page of ['notifications','privacy','terms'])assert.equal(html.split(`href="#profile/${page}"`).length-1,1);
 assert.equal(html.split('<strong>Notifications</strong>').length-1,1);
 assert.match(html,/<button type="button" class="personal-row personal-about" data-action="about"/);
 assert.match(html,/Live alerts aren’t connected yet/);
 assert.doesNotMatch(html,/href="#settings|<h2[^>]*>Preferences<\/h2>/);
 const canonical=html;f.mount('settings','');assert.equal(f.root.innerHTML,canonical);assert.equal(document.title,'Profile · Solventir');
});

for(const [page,title] of [['edit','Edit profile'],['notifications','Notifications'],['privacy','Privacy'],['terms','Terms of Service']]){
 test(`Profile ${page} is directly accessible and the old Settings path is an equivalent alias`,t=>{
  const f=fixture(t);f.mount('profile',page);const canonical=f.root.innerHTML;
  assert.equal(document.title,`${title} · Solventir`);
  assert.match(canonical,/<a class="back-link" href="#profile">/);
  assert.doesNotMatch(canonical,/href="#settings/);
  f.mount('settings',page);assert.equal(f.root.innerHTML,canonical);assert.equal(document.title,`${title} · Solventir`);
 });
}

for(const view of ['profile','settings']){
 test(`${view} notification saves and cancellation return to Profile`,t=>{
  const f=fixture(t);f.mount(view,'notifications');
  f.change({dataset:{profileField:'newFinds'},checked:true});f.click('cancel');
  assert.equal(f.store.value.notifications.newFinds,false);
  assert.deepEqual(f.navigations,['profile']);
  f.mount(view,'notifications');f.change({dataset:{profileField:'newFinds'},checked:true});f.submit('personal-notifications-form');
  assert.equal(f.store.value.notifications.newFinds,true);
  assert.deepEqual(f.navigations,['profile','profile']);
 });
 test(`${view} identity saves and cancellation return to Profile`,t=>{
  const f=fixture(t);f.mount(view,'edit');f.input('Cancelled name');f.click('cancel');
  assert.equal(f.store.value.name,'Original');assert.deepEqual(f.navigations,['profile']);
  f.mount(view,'edit');f.input('Saved name');f.submit();
  assert.equal(f.store.value.name,'Saved name');assert.deepEqual(f.navigations,['profile','profile']);
 });
}

test('unsaved profile and notification drafts survive switching between canonical and alias routes',t=>{
 const f=fixture(t);f.mount();f.input('Still editing');f.mount('settings','');
 assert.match(f.root.innerHTML,/aria-label="Continue editing profile">Continue/);
 f.mount('settings','edit');assert.match(f.root.innerHTML,/value="Still editing"/);
 f.mount('profile','notifications');f.change({dataset:{profileField:'newFinds'},checked:true});
 f.mount('profile','');f.mount('settings','notifications');
 assert.match(f.root.innerHTML,/data-profile-field="newFinds" checked/);
 assert.equal(f.store.value.name,'Original');assert.equal(f.store.value.notifications.newFinds,false);
});

test('reusable avatars retain the existing appearance with distinct header and page gradient IDs',()=>{
 const p=defaultProfile(),page=renderProfileAvatar(p),header=renderProfileAvatar(p,{idPrefix:'header-profile'});
 assert.match(page,/<span class="personal-avatar avatar-sky" aria-hidden="true">/);
 assert.match(page,/id="profile-silver"/);assert.match(page,/fill="url\(#profile-silver\)"/);
 assert.match(header,/id="header-profile-silver"/);assert.match(header,/fill="url\(#header-profile-silver\)"/);
 assert.doesNotMatch(header,/id="profile-silver"/);
 const photo=renderProfileAvatar({...p,color:'mint',photo:'data:image/jpeg;base64,abcd'},{idPrefix:'header-profile'});
 assert.match(photo,/avatar-mint.*<img src="data:image\/jpeg;base64,abcd" alt="">/);
 assert.doesNotMatch(photo,/<svg/);
 const fallback=renderProfileAvatar({...p,photo:''},{idPrefix:'header-profile'});
 assert.match(fallback,/id="header-profile-silver"/);assert.doesNotMatch(fallback,/<img/);
});

test('avatar export escapes photo attributes and constrains color and gradient identifiers',()=>{
 const p={...defaultProfile(),color:'" onclick="bad',photo:'" onerror="bad'};
 const html=renderProfileAvatar(p,{idPrefix:'" onload="bad'});
 assert.match(html,/class="personal-avatar avatar-sky"/);
 assert.match(html,/src="&quot; onerror=&quot;bad"/);
 const fallback=renderProfileAvatar({...p,photo:''},{idPrefix:'" onload="bad'});
 assert.doesNotMatch(fallback,/[" ]onload=/);assert.match(fallback,/id="--onload--bad-silver"/);
});
