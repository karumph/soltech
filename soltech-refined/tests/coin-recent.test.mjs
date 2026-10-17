import test from 'node:test';
import assert from 'node:assert/strict';
import {RECENT_COINS_KEY,createRecentCoinStore,recentCoinsHTML} from '../dist/coin-recent.js';

const mint='So11111111111111111111111111111111111111112';
const other='11111111111111111111111111111111';
const evm='0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const at=Date.UTC(2026,9,11,18);
const ready=(address=mint,chainId='solana',retrievedAt=at)=>({mint:address,chainId,market:{status:'ready',data:{mint:address,chainId,name:'Example coin',symbol:'EX',imageUrl:'https://images.example/coin.png',retrievedAt,price:99,marketCap:10000}},risk:{status:'empty'},listing:{status:'empty'},history:{status:'empty'},bundles:{status:'loading'}});
const disk=initial=>{const values=new Map(initial===undefined?[]:[[RECENT_COINS_KEY,initial]]);let writes=0;return {values,get writes(){return writes;},getItem:key=>values.get(key)??null,setItem:(key,value)=>{writes++;values.set(key,value);}};};

test('successful history survives reopening and contains identity metadata only',()=>{
 const storage=disk(),store=createRecentCoinStore(storage);
 assert.equal(store.remember(ready()),true);
 const snapshot=createRecentCoinStore(storage).getSnapshot();
 assert.equal(snapshot.persistent,true);assert.equal(snapshot.error,null);assert.equal(snapshot.entries.length,1);
 assert.deepEqual(snapshot.entries[0],{chainId:'solana',address:mint,name:'Example coin',symbol:'EX',logo:'https://images.example/coin.png',checkedAt:at});
 assert.deepEqual(Object.keys(JSON.parse(storage.values.get(RECENT_COINS_KEY)).entries[0]).sort(),['address','chainId','checkedAt','logo','name','symbol']);
 snapshot.entries[0].name='Changed outside the store';assert.equal(store.entries[0].name,'Example coin');
});

test('ready data must match both the requested network and coin identity',()=>{
 const storage=disk(),store=createRecentCoinStore(storage);
 for(const mutate of [state=>{state.market.data.mint=other;},state=>{state.market.data.chainId='base';},state=>{state.market.data={name:'Wrong coin'};},state=>{state.mint='bad';},state=>{state.chainId='constructor';},state=>{state.chainId='unknown';}]){
  const state=ready();mutate(state);assert.equal(store.remember(state),false);
 }
 assert.equal(storage.writes,0);assert.deepEqual(store.entries,[]);
 const state=ready();state.market.data.mint=other;state.risk={status:'ready',data:{mint,chainId:'solana',name:'Verified identity',symbol:'OK',retrievedAt:at}};
 assert.equal(store.remember(state),true);assert.equal(store.entries[0].name,'Verified identity');assert.equal(store.entries[0].logo,'');
});

test('loading or failed-only lookups never become recent coins while a risk-only success can',()=>{
 const storage=disk(),store=createRecentCoinStore(storage);
 for(const part of ['market','risk','listing','history'])for(const status of ['waiting','loading']){
  const state=ready();state[part]={status};assert.equal(store.remember(state),false);
 }
 for(const status of ['empty','error']){const state=ready();state.market={status};state.risk={status};assert.equal(store.remember(state),false);}
 const incomplete=ready();delete incomplete.listing;assert.equal(store.remember(incomplete),false);
 const riskOnly=ready();riskOnly.market={status:'error'};riskOnly.risk={status:'ready',data:{mint,chainId:'solana',name:'Risk report name',symbol:'RISK',retrievedAt:at}};
 assert.equal(store.remember(riskOnly),true);assert.equal(store.entries[0].name,'Risk report name');assert.equal(storage.writes,1);
});

test('late source callbacks do not re-save or reorder a lookup, but a new check moves it first',()=>{
 const storage=disk(),store=createRecentCoinStore(storage);
 const first=ready(),second=ready(other,'solana',at+1000);
 assert.equal(store.remember(first),true);assert.equal(store.remember(second),true);
 assert.equal(store.remember({...first,bundles:{status:'ready',data:{retrievedAt:at+2000}}}),false);
 assert.equal(store.entries[0].address,other);assert.equal(storage.writes,2);
 assert.equal(store.remember(ready(mint,'solana',at+3000)),true);
 assert.deepEqual(store.entries.map(entry=>entry.address),[mint,other]);assert.equal(store.entries.length,2);
 assert.equal(store.remember(first),false);
});

test('EVM case dedupes within a network and the same contract on different networks stays distinct',()=>{
 const storage=disk(),store=createRecentCoinStore(storage),mixed='0x'+evm.slice(2).toUpperCase();
 assert.equal(store.remember(ready(mixed,'base')),true);
 assert.equal(store.remember(ready(evm,'base',at+1000)),true);
 assert.equal(store.remember(ready(evm,'ethereum',at+2000)),true);
 assert.deepEqual(store.entries.map(entry=>[entry.chainId,entry.address]),[['ethereum',evm],['base',evm]]);
 assert.equal(store.entries[1].checkedAt,at+1000);
 const solana=ready(mint);assert.equal(store.remember(solana),true);assert.equal(store.entries.find(entry=>entry.chainId==='solana').address,mint);
});

test('history keeps only the 5 newest unique coins across remounts',()=>{
 const storage=disk(),store=createRecentCoinStore(storage),addresses=[];
 for(let i=1;i<=15;i++){const address='0x'+i.toString(16).padStart(40,'0');addresses.push(address);assert.equal(store.remember(ready(address,'base',at+i)),true);}
 assert.deepEqual(store.entries.map(entry=>entry.address),addresses.slice(-5).reverse());
 assert.deepEqual(createRecentCoinStore(storage).entries,store.entries);
 const rechecked=addresses.at(-3);assert.equal(store.remember(ready(rechecked,'base',at+20)),true);
 assert.deepEqual(store.entries.map(entry=>entry.address),[rechecked,...addresses.slice(-5).reverse().filter(address=>address!==rechecked)]);
 assert.equal(store.entries.length,5);assert.deepEqual(createRecentCoinStore(storage).entries,store.entries);
});

test('older 12-coin history is reduced to the newest 5 in storage on opening',()=>{
 const entries=Array.from({length:12},(_,i)=>({chainId:'base',address:'0x'+(i+1).toString(16).padStart(40,'0'),name:'Saved coin',symbol:'EX',logo:'',checkedAt:at+i}));
 const raw=JSON.stringify({schemaVersion:1,entries}),storage=disk(raw),store=createRecentCoinStore(storage);
 assert.deepEqual(store.entries,entries.slice(-5).reverse());assert.equal(storage.writes,1);
 assert.deepEqual(JSON.parse(storage.values.get(RECENT_COINS_KEY)).entries,store.entries);
 assert.deepEqual(createRecentCoinStore(storage).entries,store.entries);assert.equal(storage.writes,1);
 const blocked=createRecentCoinStore({getItem:key=>key===RECENT_COINS_KEY?raw:null,setItem(){throw Error('Blocked');}}).getSnapshot();
 assert.equal(blocked.entries.length,5);assert.equal(blocked.persistent,false);assert.match(blocked.error,/could not be saved/);
 const malformed=disk(JSON.stringify({schemaVersion:1,entries:[...entries,{chainId:'base',address:'invalid',checkedAt:at}]}));
 assert.equal(createRecentCoinStore(malformed).getSnapshot().persistent,false);assert.equal(malformed.writes,0);
});

test('an explicit check timestamp or injected clock is used when source timing is absent',()=>{
 const store=createRecentCoinStore(disk(),{now:()=>at+1000}),state=ready();delete state.market.data.retrievedAt;
 assert.equal(store.remember(state),true);assert.equal(store.entries[0].checkedAt,at+1000);
 assert.equal(store.remember(state,at+2000),true);assert.equal(store.entries[0].checkedAt,at+2000);
 for(const time of [NaN,Infinity,-1,0,'123'])assert.equal(store.remember(state,time),false);
});

test('malformed storage does not crash, render unsafe entries, or get overwritten by a lookup',()=>{
 for(const raw of ['not JSON','null','[]',JSON.stringify({schemaVersion:2,entries:[]}),JSON.stringify({schemaVersion:1,entries:'invalid'}),JSON.stringify({schemaVersion:1,entries:[{chainId:'solana',address:'javascript:alert(1)',checkedAt:at}]})]){
  const storage=disk(raw),store=createRecentCoinStore(storage),snapshot=store.getSnapshot();
  assert.equal(snapshot.persistent,false);assert.match(snapshot.error,/could not be read/);assert.deepEqual(snapshot.entries,[]);
  assert.doesNotMatch(recentCoinsHTML(snapshot),/data-clear-recent disabled/);
  assert.equal(store.remember(ready()),true);assert.equal(storage.writes,0);assert.equal(storage.values.get(RECENT_COINS_KEY),raw);
  assert.equal(store.clear(),true);assert.deepEqual(createRecentCoinStore(storage).entries,[]);
 }
});

test('blocked storage reads and writes retain recent coins in memory with truthful feedback',()=>{
 for(const storage of [{getItem(){throw Error('Blocked');},setItem(){throw Error('Blocked');}},{getItem:()=>null,setItem(){throw Error('Quota');}}]){
  const store=createRecentCoinStore(storage);
  assert.equal(store.remember(ready()),true);assert.equal(store.entries.length,1);
  assert.equal(store.getSnapshot().persistent,false);assert.match(store.getSnapshot().error,/this tab/);
  assert.match(recentCoinsHTML(store.getSnapshot()),/is-unavailable/);
  assert.equal(store.clear(),false);assert.deepEqual(store.entries,[]);assert.match(store.getSnapshot().error,/saved history could not be cleared/);
 }
});

test('a later successful save recovers after quota failure and persists all in-memory entries',()=>{
 const storage=disk();let blocked=true;const adapter={getItem:storage.getItem,setItem:(key,value)=>{if(blocked)throw Error('Quota');storage.setItem(key,value);}};
 const store=createRecentCoinStore(adapter);assert.equal(store.remember(ready()),true);blocked=false;
 assert.equal(store.remember(ready(other,'solana',at+1000)),true);
 assert.equal(store.getSnapshot().persistent,true);assert.equal(store.getSnapshot().error,null);assert.equal(createRecentCoinStore(storage).entries.length,2);
});

test('Clear history persists an empty list without touching unrelated app storage',()=>{
 const storage=disk(),store=createRecentCoinStore(storage);storage.values.set('soltech.scanner.v1','keep scanner');
 store.remember(ready());assert.equal(store.clear(),true);assert.deepEqual(store.entries,[]);assert.deepEqual(createRecentCoinStore(storage).entries,[]);assert.equal(storage.values.get('soltech.scanner.v1'),'keep scanner');
});

test('recent rows escape provider text and expose only validated fresh-check identities',()=>{
 const storage=disk(),store=createRecentCoinStore(storage),state=ready();state.market.data.name='<img src=x onerror="alert(1)">';state.market.data.symbol='"><script>bad</script>';state.market.data.imageUrl='javascript:alert(1)';
 assert.equal(store.remember(state),true);const html=recentCoinsHTML(store.getSnapshot());
 assert.match(html,/Recently checked/);assert.doesNotMatch(html,/recent-coins-note/);assert.match(html,/&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/<script|<img |href=|data-risk=|\$99/);
 assert.match(html,new RegExp('data-recent-chain="solana" data-recent-address="'+mint+'"'));
 assert.match(html,/<time datetime="2026-10-11T18:00:00\.000Z" title="[^"]*2026[^"]*">/);
 const safe=ready(other,'solana',at+1000);safe.market.data.imageUrl='https://images.example/coin.png?a=1&b=2';store.remember(safe);
 assert.match(recentCoinsHTML(store.getSnapshot()),/src="https:\/\/images\.example\/coin\.png\?a=1&amp;b=2"/);
});

test('empty history stays visible, and renderer independently rejects injected invalid records',()=>{
 const empty=recentCoinsHTML({entries:[],persistent:true});assert.match(empty,/Recently checked/);assert.match(empty,/Coins you check will appear here/);assert.match(empty,/data-clear-recent disabled/);
 const unsafe=recentCoinsHTML({entries:[{chainId:'constructor',address:'" onclick="alert(1)',checkedAt:at}],persistent:false,error:'<script>bad</script>'});
 assert.doesNotMatch(unsafe,/data-recent-address=|<script/);assert.match(unsafe,/&lt;script&gt;/);
});

test('separate tabs merge new checks and never restore a list cleared by another tab',()=>{
 const storage=disk(),first=createRecentCoinStore(storage),second=createRecentCoinStore(storage);
 first.remember(ready());second.remember(ready(other,'solana',at+1));
 assert.deepEqual(createRecentCoinStore(storage).entries.map(entry=>entry.address),[other,mint]);
 first.remember(ready(mint,'solana',at+2));assert.deepEqual(first.entries.map(entry=>entry.address),[mint,other]);
 first.clear();second.remember(ready(evm,'base',at+3));
 assert.deepEqual(createRecentCoinStore(storage).entries.map(entry=>entry.address),[evm]);
});

test('a lookup started before a cross-tab clear cannot save even after another new check',()=>{
 const storage=disk(),first=createRecentCoinStore(storage),second=createRecentCoinStore(storage);
 const oldCheck=second.beginCheck();first.clear();first.remember(ready(other,'solana',at+1));
 assert.equal(second.remember(ready(mint,'solana',at+2),undefined,{clearToken:oldCheck}),false);
 assert.deepEqual(createRecentCoinStore(storage).entries.map(entry=>entry.address),[other]);
 const newCheck=second.beginCheck();assert.equal(second.remember(ready(),undefined,{clearToken:newCheck}),true);
 const emptyCheck=second.beginCheck();first.clear();first.clear();
 assert.equal(second.remember(ready(mint,'solana',at+3),undefined,{clearToken:emptyCheck}),false);
 assert.deepEqual(createRecentCoinStore(storage).entries,[]);
});

function storageEvent(target,key,storageArea,newValue='ignored stale event payload'){
 const event=new Event('storage');Object.defineProperties(event,{key:{value:key},storageArea:{value:storageArea},newValue:{value:newValue}});target.dispatchEvent(event);
}

test('storage notifications read current data, ignore unrelated storage, and stop after unsubscribe',()=>{
 const storage=disk(),events=new EventTarget(),first=createRecentCoinStore(storage),second=createRecentCoinStore(storage,{eventTarget:events}),changes=[];
 const unsubscribe=second.subscribe(snapshot=>changes.push(snapshot));first.remember(ready());
 storageEvent(events,'another-key',storage);storageEvent(events,RECENT_COINS_KEY,disk());assert.equal(changes.length,0);
 storageEvent(events,RECENT_COINS_KEY,storage);assert.equal(changes.length,1);assert.equal(changes.at(-1).entries[0].address,mint);
 first.clear();storageEvent(events,RECENT_COINS_KEY,storage,'old record');assert.equal(changes.length,2);assert.deepEqual(changes.at(-1).entries,[]);
 storageEvent(events,RECENT_COINS_KEY,storage);assert.equal(changes.length,2,'a delayed duplicate event must not restore old data');
 unsubscribe();first.remember(ready(other));storageEvent(events,RECENT_COINS_KEY,storage);assert.equal(changes.length,2);assert.deepEqual(second.entries,[]);
 const unsubscribeAgain=second.subscribe(snapshot=>changes.push(snapshot));assert.equal(changes.at(-1).entries[0].address,other,'remount refreshes missed changes');unsubscribeAgain();
});

test('an external removal or clear replaces unsaved memory without resurrecting it on recovery',()=>{
 const storage=disk(),events=new EventTarget();let blocked=false;
 const adapter={getItem:storage.getItem,setItem:(key,value)=>{if(blocked)throw Error('Quota');storage.setItem(key,value);}};
 const store=createRecentCoinStore(adapter,{eventTarget:events});store.remember(ready());blocked=true;store.remember(ready(other,'solana',at+1));
 assert.equal(store.entries.length,2);const started=store.beginCheck(),unsubscribe=store.subscribe(()=>{});
 storage.values.delete(RECENT_COINS_KEY);storageEvent(events,null,adapter);assert.deepEqual(store.entries,[]);
 blocked=false;assert.equal(store.remember(ready(),undefined,{clearToken:started}),false);
 store.remember(ready(evm,'base',at+2));assert.deepEqual(createRecentCoinStore(storage).entries.map(entry=>entry.address),[evm]);unsubscribe();
});

test('a failed clear still rejects an earlier lookup within this tab',()=>{
 const storage=disk();let blocked=false;const store=createRecentCoinStore({getItem:storage.getItem,setItem:(key,value)=>{if(blocked)throw Error('Quota');storage.setItem(key,value);}});
 store.remember(ready());const started=store.beginCheck();blocked=true;assert.equal(store.clear(),false);
 assert.equal(store.remember(ready(other),undefined,{clearToken:started}),false);assert.deepEqual(store.entries,[]);
});

test('checks kept while reads are blocked survive recovery unless a newer clear exists',()=>{
 for(const externallyCleared of [false,true]){
  const storage=disk();let blocked=true;
  const adapter={getItem:key=>{if(blocked)throw Error('Blocked');return storage.getItem(key);},setItem:(key,value)=>{if(blocked)throw Error('Blocked');storage.setItem(key,value);}};
  const store=createRecentCoinStore(adapter);store.remember(ready());
  if(externallyCleared)createRecentCoinStore(storage).clear();
  blocked=false;store.remember(ready(other,'solana',at+1));
  assert.deepEqual(createRecentCoinStore(storage).entries.map(entry=>entry.address),externallyCleared?[other]:[other,mint]);
 }
});

test('a clear interleaved between another tab’s read and write wins and removes stale addresses',()=>{
 const storage=disk();let duringWrite;
 const adapter={getItem:storage.getItem,setItem(key,value){if(key===RECENT_COINS_KEY&&duringWrite){const run=duringWrite;duringWrite=null;run();}storage.setItem(key,value);}};
 const first=createRecentCoinStore(storage);first.remember(ready());const second=createRecentCoinStore(adapter);
 duringWrite=()=>first.clear();assert.equal(second.remember(ready(other,'solana',at+1)),false);
 assert.deepEqual(second.entries,[]);assert.deepEqual(createRecentCoinStore(storage).entries,[]);
 const envelope=JSON.parse(storage.getItem(RECENT_COINS_KEY));assert.deepEqual(envelope.entries,[]);assert.equal(envelope.clearId,storage.getItem(RECENT_COINS_KEY+'.clear'));
 second.remember(ready(other,'solana',at+2));assert.deepEqual(createRecentCoinStore(storage).entries.map(entry=>entry.address),[other]);
});

test('a separately published clear takes effect even if removing the address envelope fails',()=>{
 const storage=disk(),events=new EventTarget();let fail=false;
 const adapter={getItem:storage.getItem,setItem(key,value){if(fail&&key===RECENT_COINS_KEY)throw Error('Quota');storage.setItem(key,value);}};
 const first=createRecentCoinStore(adapter),second=createRecentCoinStore(storage,{eventTarget:events});first.remember(ready());const started=second.beginCheck(),stop=second.subscribe(()=>{});
 fail=true;assert.equal(first.clear(),false);assert.match(first.getSnapshot().error,/could not be cleared/);
 storageEvent(events,RECENT_COINS_KEY+'.clear',storage);assert.deepEqual(second.entries,[]);assert.deepEqual(createRecentCoinStore(storage).entries,[]);
 assert.equal(second.remember(ready(other),undefined,{clearToken:started}),false);fail=false;
 first.remember(ready(other,'solana',at+1));assert.deepEqual(createRecentCoinStore(storage).entries.map(entry=>entry.address),[other]);stop();
});
