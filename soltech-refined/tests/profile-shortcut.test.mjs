import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileShortcut} from '../dist/profile-shortcut.js';
import {createProfileStore,defaultProfile,PROFILE_KEY} from '../dist/profile-store.js';
import {renderProfileAvatar} from '../dist/profile.js';

const photo='data:image/jpeg;base64,/9j/ANn/2Q==';
const otherPhoto='data:image/jpeg;base64,/9j/Adn/2Q==';

function fixture(t,initial={}) {
 const values=new Map([[PROFILE_KEY,JSON.stringify({...defaultProfile(),...initial})]]);
 let readable=true,reads=0;
 const storage={getItem(key){reads++;if(!readable)throw Error('Unavailable');return values.get(key)||null;},setItem:(key,value)=>values.set(key,value)};
 const store=createProfileStore(storage),eventTarget=new EventTarget(),element=new EventTarget(),attributes=new Map();
 let html='',image=null,writes=0;
 Object.defineProperty(eventTarget,'localStorage',{value:storage});
 Object.defineProperty(element,'innerHTML',{get:()=>html,set(value){
  html=value;writes++;
  const src=value.match(/<img src="([^"]+)"/);
  image=src?{getAttribute:name=>name==='src'?src[1]:null}:null;
 }});
 element.setAttribute=(name,value)=>attributes.set(name,value);
 element.querySelector=selector=>selector==='img'?image:null;
 const shortcut=createProfileShortcut({element,store,eventTarget});
 t.after(()=>shortcut.dispose());
 const storageEvent=(key=PROFILE_KEY,storageArea=storage)=>{
  const event=new Event('storage');
  Object.defineProperties(event,{key:{value:key},storageArea:{value:storageArea}});
  eventTarget.dispatchEvent(event);
 };
 const failPhoto=target=>{
  const event=new Event('error');Object.defineProperty(event,'target',{value:target||image});element.dispatchEvent(event);
 };
 return {element,store,storage,values,attributes,shortcut,storageEvent,failPhoto,
  get image(){return image;},get writes(){return writes;},get reads(){return reads;},
  setReadable:value=>{readable=value;}
 };
}

test('the header uses the saved avatar and a distinct SVG identity without changing its link',t=>{
 const f=fixture(t,{name:'Saved name',color:'mint'});
 assert.equal(f.attributes.get('aria-label'),'Profile and settings');
 assert.equal(f.attributes.get('title'),'Profile and settings');
 assert.equal(f.attributes.has('href'),false);
 assert.match(f.element.innerHTML,/avatar-mint/);
 assert.match(f.element.innerHTML,/id="header-profile-silver"/);
 assert.match(renderProfileAvatar(f.store.value),/id="profile-silver"/);
 const writes=f.writes;
 f.shortcut.refresh();
 assert.equal(f.writes,writes);
 assert.equal(f.store.save({...f.store.value,name:'Updated name',notifications:{newFinds:true,scanners:{}}}).ok,true);
 f.shortcut.refresh();
 assert.equal(f.writes,writes,'unrelated preferences and name changes preserve the avatar node');
 assert.equal(f.store.save({...f.store.value,color:'violet'}).ok,true);
 f.shortcut.refresh();
 assert.match(f.element.innerHTML,/avatar-violet/);
 assert.equal(f.writes,writes+1);
});

test('a failed saved photo falls back to the saved color without modifying the profile or retrying on every route',t=>{
 const f=fixture(t,{photo,color:'mint'});
 assert.ok(f.image);
 const staleImage=f.image;
 f.failPhoto();
 assert.equal(f.image,null);
 assert.match(f.element.innerHTML,/avatar-mint/);
 assert.equal(f.store.value.photo,photo);
 assert.equal(JSON.parse(f.values.get(PROFILE_KEY)).photo,photo);
 const writes=f.writes;
 f.shortcut.refresh({retry:true});
 assert.equal(f.writes,writes);
 assert.equal(f.store.save({...f.store.value,photo:otherPhoto}).ok,true);
 f.shortcut.refresh();
 assert.equal(f.image.getAttribute('src'),otherPhoto);
 f.failPhoto(staleImage);
 assert.equal(f.image.getAttribute('src'),otherPhoto,'a detached failed image cannot replace the new photo');
});

test('cross-tab profile changes and clearing update the avatar, while unrelated storage events are ignored',t=>{
 const f=fixture(t,{color:'mint'}),other=createProfileStore(f.storage);
 assert.equal(other.save({...other.value,color:'violet'}).ok,true);
 const reads=f.reads;
 f.storageEvent('soltech.other');
 f.storageEvent(PROFILE_KEY,{});
 assert.equal(f.reads,reads);
 assert.match(f.element.innerHTML,/avatar-mint/);
 f.storageEvent();
 assert.match(f.element.innerHTML,/avatar-violet/);
 f.values.clear();f.storageEvent(null);
 assert.match(f.element.innerHTML,/avatar-sky/);
});

test('unavailable storage preserves the last saved avatar and disposal removes live updates',t=>{
 const f=fixture(t,{color:'graphite'});
 f.setReadable(false);f.storageEvent();
 assert.equal(f.store.issue,'read');
 assert.match(f.element.innerHTML,/avatar-graphite/);
 f.setReadable(true);f.values.set(PROFILE_KEY,JSON.stringify({...defaultProfile(),color:'mint'}));
 f.shortcut.refresh({retry:true});
 assert.match(f.element.innerHTML,/avatar-mint/);
 f.shortcut.dispose();
 f.values.set(PROFILE_KEY,JSON.stringify({...defaultProfile(),color:'violet'}));
 const writes=f.writes,reads=f.reads;
 f.storageEvent();f.shortcut.refresh({retry:true});
 assert.equal(f.writes,writes);
 assert.equal(f.reads,reads);
});
