import test from 'node:test';
import assert from 'node:assert/strict';
import {PROFILE_KEY,createProfileStore,defaultProfile,validateProfile,validStoredPhoto,validatePhotoFile,prepareProfilePhoto} from '../dist/profile-store.js';
import {createWorkspace,STORAGE_KEY} from '../dist/workspace.js';
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};};
const identity=p=>({name:p.name,color:p.color,photo:p.photo});
test('profile persists separately from scanners and unfinished drafts',()=>{
 const disk=memory(),workspace=createWorkspace(disk);workspace.saveLibrary('balanced');workspace.beginDraft();workspace.updateDraft({name:'Keep my draft'});const before=disk.getItem(STORAGE_KEY);
 const store=createProfileStore(disk);assert.equal(store.save({...store.value,name:'  Jay  ',color:'violet'}).ok,true);
 assert.equal(createProfileStore(disk).value.name,'Jay');assert.equal(disk.getItem(STORAGE_KEY),before);
});
test('editing or canceling a candidate never alters saved profile',()=>{
 const store=createProfileStore(memory());store.save({...store.value,name:'Jay'});const candidate=store.value;candidate.name='Other';candidate.notifications.newFinds=true;
 assert.equal(store.value.name,'Jay');assert.equal(store.value.notifications.newFinds,false);
});
test('failed storage write keeps last saved profile and supports retry',()=>{
 const disk=memory();let fail=false;const store=createProfileStore({getItem:disk.getItem,setItem:(k,v)=>{if(fail)throw Error('quota');disk.setItem(k,v);}});
 store.save({...store.value,name:'Before'});const candidate={...store.value,name:'After'};fail=true;
 assert.equal(store.save(candidate).ok,false);assert.equal(store.value.name,'Before');assert.equal(createProfileStore(disk).value.name,'Before');
 fail=false;assert.equal(store.save(candidate).ok,true);assert.equal(createProfileStore(disk).value.name,'After');
});
test('unreadable profile is not silently replaced',()=>{
 const disk=memory();disk.setItem(PROFILE_KEY,'broken');const store=createProfileStore(disk);
 assert.equal(store.issue,'read');assert.equal(store.save(defaultProfile()).ok,false);assert.equal(disk.getItem(PROFILE_KEY),'broken');
 disk.setItem(PROFILE_KEY,JSON.stringify(defaultProfile()));assert.equal(store.retry(),true);assert.equal(store.issue,null);
});
test('section saves merge against current disk so another tab cannot erase identity',()=>{
 const disk=memory(),mobile=createProfileStore(disk),desktop=createProfileStore(disk),base=desktop.value.notifications;
 mobile.saveSection('identity',{name:'Jay',color:'mint',photo:''},identity(mobile.value));
 assert.equal(desktop.saveSection('notifications',{...base,newFinds:true},base).ok,true);
 const result=createProfileStore(disk).value;assert.equal(result.name,'Jay');assert.equal(result.color,'mint');assert.equal(result.notifications.newFinds,true);
});
test('identity saves preserve newer notification preferences',()=>{
 const disk=memory(),a=createProfileStore(disk),b=createProfileStore(disk),base=identity(a.value);
 b.saveSection('notifications',{newFinds:true,scanners:{'saved-one':false}},b.value.notifications);
 assert.equal(a.saveSection('identity',{...base,name:'New'},base).ok,true);assert.deepEqual(createProfileStore(disk).value.notifications,{newFinds:true,scanners:{'saved-one':false}});
});
test('concurrent edits to same section require recovery instead of overwriting',()=>{
 const disk=memory(),a=createProfileStore(disk),b=createProfileStore(disk),base=identity(b.value);
 a.saveSection('identity',{...base,name:'First'},identity(a.value));const result=b.saveSection('identity',{...base,name:'Second'},base);
 assert.equal(result.conflict,true);assert.equal(createProfileStore(disk).value.name,'First');
 assert.equal(b.saveSection('identity',{...identity(b.value),name:'Second'},identity(b.value)).ok,true);
});
test('malformed profiles and executable or corrupt photo sources are rejected',()=>{
 for(const update of [{name:'x'.repeat(41)},{color:'constructor'},{photo:'https://example.com/image.jpg'},{photo:'data:image/svg+xml,<svg/>'},{photo:'data:image/jpeg;base64,A'},{photo:'data:image/jpeg;base64,AAAA'},{schemaVersion:2},{notifications:{newFinds:'yes',scanners:{}}},{notifications:{newFinds:true,scanners:{'bad id':true}}}])assert.throws(()=>validateProfile({...defaultProfile(),...update}));
 assert.equal(validStoredPhoto('data:image/jpeg;base64,'+'A'.repeat(220000)),false);assert.equal(validStoredPhoto(''),true);
});
test('photo files reject oversized, empty or unsupported formats',()=>{
 for(const file of [{type:'image/svg+xml',size:10},{type:'image/jpeg',size:0},{type:'image/png',size:7*1024*1024}])assert.throws(()=>validatePhotoFile(file));
 assert.doesNotThrow(()=>validatePhotoFile({type:'image/webp',size:1000}));
});
test('profile names preserve Unicode without changing their content',()=>{
 assert.equal(validateProfile({...defaultProfile(),name:'  🌙 Éva Fernández  '}).name,'🌙 Éva Fernández');
});
test('photo cancellation rejects and releases the object URL',async()=>{
 const originalImage=globalThis.Image,originalURL=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;let revoked=false;
 globalThis.Image=class {set src(value){}};URL.createObjectURL=()=> 'blob:test';URL.revokeObjectURL=url=>{revoked=url==='blob:test';};
 try{const controller=new AbortController(),result=prepareProfilePhoto({type:'image/png',size:10},{signal:controller.signal});controller.abort();await assert.rejects(result,{name:'AbortError'});assert.equal(revoked,true);}
 finally{globalThis.Image=originalImage;URL.createObjectURL=originalURL;URL.revokeObjectURL=originalRevoke;}
});
test('failed image decode never produces a candidate photo',async()=>{
 const originalImage=globalThis.Image,originalURL=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;let image,revoked=false;
 globalThis.Image=class {constructor(){image=this;}set src(value){}};URL.createObjectURL=()=> 'blob:test';URL.revokeObjectURL=()=>{revoked=true;};
 try{const result=prepareProfilePhoto({type:'image/png',size:10});image.onerror();await assert.rejects(result,/couldn’t open/);assert.equal(revoked,true);}
 finally{globalThis.Image=originalImage;URL.createObjectURL=originalURL;URL.revokeObjectURL=originalRevoke;}
});
