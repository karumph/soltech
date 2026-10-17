import test from 'node:test';
import assert from 'node:assert/strict';
import {RECENT_WALLETS_KEY,MAX_RECENT_WALLETS,createRecentWalletStore,getRecentWalletStore,recentWalletsHTML} from '../dist/wallet-recent.js';

const address='So11111111111111111111111111111111111111112';
const other='11111111111111111111111111111111';
const timestamp=Date.parse('2026-10-11T18:00:00.000Z');
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
const saved=entries=>JSON.stringify({schemaVersion:1,entries});

test('wallet recents persist only public address and check time under a separate key',()=>{
 const storage=memory();storage.setItem('soltech.profile.v1','keep profile');storage.setItem('soltech.recent-coins.v1','keep coins');
 const store=createRecentWalletStore({storage,now:()=>timestamp});
 assert.deepEqual(store.entries,[]);assert.equal(store.issue,null);
 assert.equal(store.add(address,{holdings:[{balance:900,risk:'high'}],sol:10}).ok,true);
 assert.deepEqual(JSON.parse(storage.getItem(RECENT_WALLETS_KEY)),{schemaVersion:1,entries:[{address,checkedAt:timestamp}]});
 assert.deepEqual(createRecentWalletStore({storage}).entries,store.entries);
 assert.equal(storage.getItem('soltech.profile.v1'),'keep profile');assert.equal(storage.getItem('soltech.recent-coins.v1'),'keep coins');
 assert.doesNotMatch(storage.getItem(RECENT_WALLETS_KEY),/holdings|balance|risk|sol"/);
});

test('rechecking an address moves it first and the list retains twelve distinct case-sensitive addresses',()=>{
 const storage=memory();let time=timestamp;
 const store=createRecentWalletStore({storage,now:()=>time++}),alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
 const addresses=Array.from({length:16},(_,i)=>'1'.repeat(31)+alphabet[i]);
 addresses.forEach(value=>assert.equal(store.add(value).ok,true));
 assert.equal(store.entries.length,MAX_RECENT_WALLETS);assert.deepEqual(store.entries.map(entry=>entry.address),addresses.slice(-12).reverse());
 store.add(addresses[5]);assert.equal(store.entries[0].address,addresses[5]);assert.equal(store.entries.filter(entry=>entry.address===addresses[5]).length,1);
 store.add('1'.repeat(31)+'A');store.add('1'.repeat(31)+'a');assert.deepEqual(store.entries.slice(0,2).map(entry=>entry.address),['1'.repeat(31)+'a','1'.repeat(31)+'A']);
 assert.deepEqual(createRecentWalletStore({storage}).entries,store.entries);
});

test('valid saved history is ordered, deduplicated and projected to metadata without exposing mutable state',()=>{
 const storage=memory();storage.setItem(RECENT_WALLETS_KEY,saved([{address,checkedAt:timestamp},{address:other,checkedAt:timestamp+2,holdings:['private']},{address,checkedAt:timestamp+1}]));
 const store=createRecentWalletStore({storage});assert.equal(store.issue,null);
 assert.deepEqual(store.entries,[{address:other,checkedAt:timestamp+2},{address,checkedAt:timestamp+1}]);
 const entries=store.entries;entries[0].address='changed';entries.push({address:'extra'});assert.equal(store.entries.length,2);assert.equal(store.entries[0].address,other);
});

test('corrupt, unsupported or malformed saved history falls back without overwriting it',()=>{
 const malformed=['broken','null','[]','{}',JSON.stringify({schemaVersion:2,entries:[]}),saved(null),saved([null]),saved([{address:'bad',checkedAt:timestamp}]),saved([{address,checkedAt:'2026-10-11'}]),saved([{address,checkedAt:-1}]),saved([{address,checkedAt:8640000000000001}]),saved(Array.from({length:13},()=>({address,checkedAt:timestamp}))), ' '.repeat(16385)];
 for(const raw of malformed){
  const storage=memory();storage.setItem(RECENT_WALLETS_KEY,raw);const store=createRecentWalletStore({storage,now:()=>timestamp});
  assert.equal(store.issue,'read');assert.deepEqual(store.entries,[]);assert.equal(store.add(address).ok,false);assert.deepEqual(store.entries,[{address,checkedAt:timestamp}]);assert.equal(storage.getItem(RECENT_WALLETS_KEY),raw);
  assert.match(recentWalletsHTML(store.entries,{issue:store.issue}),/role="alert"[^>]*>Saved wallet history couldn’t be opened/);
 }
});

test('blocked reads and an inaccessible localStorage getter keep a working session list',()=>{
 const storage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
 const store=createRecentWalletStore({storage,now:()=>timestamp});assert.equal(store.add(address).ok,false);assert.equal(store.entries[0].address,address);assert.equal(store.issue,'read');
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 try{Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('blocked');}});assert.equal(createRecentWalletStore().issue,'read');}
 finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;}
});

test('failed writes retain session entries, display persistence feedback and recover on a later check',()=>{
 const disk=memory();let fail=false,time=timestamp;
 const storage={...disk,setItem:(key,value)=>{if(fail)throw Error('quota');disk.setItem(key,value);}};
 const store=createRecentWalletStore({storage,now:()=>time++});store.add(address);const before=disk.getItem(RECENT_WALLETS_KEY);fail=true;
 assert.equal(store.add(other).ok,false);assert.equal(store.issue,'write');assert.equal(store.entries[0].address,other);assert.equal(disk.getItem(RECENT_WALLETS_KEY),before);
 const html=recentWalletsHTML(store.entries,{issue:store.issue});assert.match(html,/couldn’t be saved on this device/);assert.doesNotMatch(html,/Saved on this device/);
 fail=false;assert.equal(store.add(other).ok,true);assert.equal(store.issue,null);assert.deepEqual(createRecentWalletStore({storage:disk}).entries,store.entries);
});

test('explicit clear removes only wallet history and allows recovery from corrupt data',()=>{
 const storage=memory();storage.setItem(RECENT_WALLETS_KEY,'broken');storage.setItem('another-key','keep');
 const store=createRecentWalletStore({storage,now:()=>timestamp});store.add(address);assert.equal(store.clear().ok,true);assert.equal(store.issue,null);assert.deepEqual(store.entries,[]);
 const cleared=JSON.parse(storage.getItem(RECENT_WALLETS_KEY));assert.deepEqual(cleared.entries,[]);assert.equal(typeof cleared.clearId,'string');assert.equal(storage.getItem('another-key'),'keep');assert.equal(store.add(other).ok,true);assert.deepEqual(createRecentWalletStore({storage}).entries,store.entries);
});

test('failed clearing empties the session list while warning saved history may return',()=>{
 const disk=memory();let blocked=false;const storage={...disk,setItem(key,value){if(blocked)throw Error('blocked');disk.setItem(key,value);}};
 const store=createRecentWalletStore({storage,now:()=>timestamp});store.add(address);
 blocked=true;
 assert.equal(store.clear().ok,false);assert.deepEqual(store.entries,[]);assert.equal(store.issue,'clear');assert.equal(createRecentWalletStore({storage:disk}).entries[0].address,address);
 const html=recentWalletsHTML(store.entries,{issue:store.issue});assert.match(html,/may reappear after a reload/);assert.match(html,/data-clear-wallet-history/);assert.doesNotMatch(html,/data-recent-wallet=/);
});

test('invalid addresses and times never become saved history',()=>{
 const storage=memory();const store=createRecentWalletStore({storage,now:()=>timestamp});
 for(const invalid of ['',null,address+' ',address+'\n','<script>alert(1)</script>','0x'+'a'.repeat(40),{address}])assert.equal(store.add(invalid).ok,false);
 for(const invalid of [NaN,Infinity,-1,'today',8640000000000001])assert.equal(createRecentWalletStore({storage,now:()=>invalid}).add(address).ok,false);
 assert.deepEqual(store.entries,[]);assert.equal(storage.getItem(RECENT_WALLETS_KEY),null);
});

test('recent wallet markup includes full accessible addresses, safe dates, escaped feedback and usable empty state',()=>{
 const html=recentWalletsHTML([{address,checkedAt:timestamp},{address:'"><img src=x onerror=alert(1)>',checkedAt:timestamp},{address:other,checkedAt:NaN}],{now:timestamp,message:'<img src=x onerror="alert(1)">'});
 assert.match(html,/Recently checked wallets/);assert.match(html,/data-recent-wallet="So111/);assert.match(html,new RegExp(`aria-label="Check wallet ${address} again\\. Last checked `));assert.match(html,/datetime="2026-10-11T18:00:00.000Z"/);
 assert.equal((html.match(/data-recent-wallet=/g)||[]).length,1);assert.doesNotMatch(html,/<img|<script/);assert.match(html,/&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);assert.match(html,/class="recent-coin-logo" data-wallet-tone="[0-7]" aria-hidden="true"><svg/);
 const empty=recentWalletsHTML([]);assert.match(empty,/after a successful check/);assert.doesNotMatch(empty,/data-clear-wallet-history/);
});

test('the default session store retains fallback history between page mounts',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 try{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('blocked');}});
  const first=getRecentWalletStore();first.add(address);const next=getRecentWalletStore();
  assert.equal(first,next);assert.equal(next.issue,'read');assert.equal(next.entries[0].address,address);
 }finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;}
});

test('two tabs preserve each other’s new checks and do not resurrect cleared wallets',()=>{
 const storage=memory();let time=timestamp;const first=createRecentWalletStore({storage,now:()=>time++}),second=createRecentWalletStore({storage,now:()=>time++});
 first.add(address);second.add(other);assert.deepEqual(createRecentWalletStore({storage}).entries.map(entry=>entry.address),[other,address]);
 first.add(address);assert.deepEqual(first.entries.map(entry=>entry.address),[address,other]);
 first.clear();second.add(other);assert.deepEqual(createRecentWalletStore({storage}).entries.map(entry=>entry.address),[other]);
});

test('pre-clear wallet lookups stay unsaved while genuinely new lookups can be remembered',()=>{
 const storage=memory(),first=createRecentWalletStore({storage,now:()=>timestamp}),second=createRecentWalletStore({storage,now:()=>timestamp+1});
 const started=second.beginCheck();first.clear();first.add(other);
 assert.deepEqual(second.add(address,{clearToken:started}),{ok:false,cleared:true});assert.deepEqual(second.entries.map(entry=>entry.address),[other]);
 assert.equal(second.add(address,{clearToken:second.beginCheck()}).ok,true);
 const beforeEmptyClear=second.beginCheck();first.clear();first.clear();
 assert.equal(second.add(address,{clearToken:beforeEmptyClear}).cleared,true);assert.deepEqual(createRecentWalletStore({storage}).entries,[]);
});

function dispatchStorage(target,key,storageArea){const event=new Event('storage');Object.defineProperties(event,{key:{value:key},storageArea:{value:storageArea},newValue:{value:'outdated payload'}});target.dispatchEvent(event);}

test('wallet history subscriptions refresh external changes and detach cleanly',()=>{
 const storage=memory(),events=new EventTarget(),first=createRecentWalletStore({storage,now:()=>timestamp}),second=createRecentWalletStore({storage,eventTarget:events});let updates=0;
 const unsubscribe=second.subscribe(()=>updates++);first.add(address);
 dispatchStorage(events,'another-key',storage);dispatchStorage(events,RECENT_WALLETS_KEY,memory());assert.equal(updates,0);
 dispatchStorage(events,RECENT_WALLETS_KEY,storage);assert.equal(updates,1);assert.equal(second.entries[0].address,address);
 first.clear();dispatchStorage(events,RECENT_WALLETS_KEY,storage);assert.equal(updates,2);assert.deepEqual(second.entries,[]);
 dispatchStorage(events,RECENT_WALLETS_KEY,storage);assert.equal(updates,2);
 unsubscribe();first.add(other);dispatchStorage(events,RECENT_WALLETS_KEY,storage);assert.equal(updates,2);assert.deepEqual(second.entries,[]);
 const stop=second.subscribe(()=>updates++);assert.equal(updates,3);assert.equal(second.entries[0].address,other);stop();
});

test('storage-wide removal and failed local clear both invalidate pending wallet records',()=>{
 const storage=memory(),events=new EventTarget();let fail=false;const adapter={...storage,setItem(key,value){if(fail)throw Error('Quota');storage.setItem(key,value);}};
 const store=createRecentWalletStore({storage:adapter,now:()=>timestamp,eventTarget:events});store.add(address);
 const first=store.beginCheck(),stop=store.subscribe(()=>{});storage.removeItem(RECENT_WALLETS_KEY);dispatchStorage(events,null,adapter);
 assert.deepEqual(store.entries,[]);assert.equal(store.add(other,{clearToken:first}).cleared,true);
 store.add(address);const second=store.beginCheck();fail=true;assert.equal(store.clear().ok,false);
 assert.equal(store.add(other,{clearToken:second}).cleared,true);assert.deepEqual(store.entries,[]);stop();
});

test('wallet checks kept during blocked reads survive recovery unless another tab cleared them',()=>{
 for(const externallyCleared of [false,true]){
  const storage=memory();let blocked=true,time=timestamp;
  const adapter={getItem:key=>{if(blocked)throw Error('Blocked');return storage.getItem(key);},setItem:(key,value)=>{if(blocked)throw Error('Blocked');storage.setItem(key,value);}};
  const store=createRecentWalletStore({storage:adapter,now:()=>time++});store.add(address);
  if(externallyCleared)createRecentWalletStore({storage}).clear();
  blocked=false;store.add(other);assert.deepEqual(createRecentWalletStore({storage}).entries.map(entry=>entry.address),externallyCleared?[other]:[other,address]);
 }
});

test('an interleaved clear survives a stale wallet write and strips the stale addresses',()=>{
 const storage=memory();let duringWrite,time=timestamp;
 const adapter={getItem:storage.getItem,setItem(key,value){if(key===RECENT_WALLETS_KEY&&duringWrite){const run=duringWrite;duringWrite=null;run();}storage.setItem(key,value);}};
 const first=createRecentWalletStore({storage,now:()=>time++});first.add(address);const second=createRecentWalletStore({storage:adapter,now:()=>time++});
 duringWrite=()=>first.clear();assert.equal(second.add(other).cleared,true);assert.deepEqual(second.entries,[]);assert.deepEqual(createRecentWalletStore({storage}).entries,[]);
 const envelope=JSON.parse(storage.getItem(RECENT_WALLETS_KEY));assert.deepEqual(envelope.entries,[]);assert.equal(envelope.clearId,storage.getItem(RECENT_WALLETS_KEY+'.clear'));
 second.add(other);assert.deepEqual(createRecentWalletStore({storage}).entries.map(entry=>entry.address),[other]);
});

test('a wallet clear marker hides stale records when the address removal partly fails',()=>{
 const storage=memory(),events=new EventTarget();let fail=false,time=timestamp;
 const adapter={getItem:storage.getItem,setItem(key,value){if(fail&&key===RECENT_WALLETS_KEY)throw Error('Quota');storage.setItem(key,value);}};
 const first=createRecentWalletStore({storage:adapter,now:()=>time++}),second=createRecentWalletStore({storage,eventTarget:events});first.add(address);const started=second.beginCheck(),stop=second.subscribe(()=>{});
 fail=true;assert.equal(first.clear().ok,false);assert.equal(first.issue,'clear');dispatchStorage(events,RECENT_WALLETS_KEY+'.clear',storage);
 assert.deepEqual(second.entries,[]);assert.deepEqual(createRecentWalletStore({storage}).entries,[]);assert.equal(second.add(other,{clearToken:started}).cleared,true);
 fail=false;first.add(other);assert.deepEqual(createRecentWalletStore({storage}).entries.map(entry=>entry.address),[other]);stop();
});
