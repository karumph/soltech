import test from 'node:test';
import assert from 'node:assert/strict';
import {createScannerRuntime,createScannerFileStore} from '../scanner-runtime.mjs';
import {defaultPersonalScanner} from '../dist/personal-scanner-store.js';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const mint='So11111111111111111111111111111111111111112',pool='Vote111111111111111111111111111111111111111';
const at=Date.parse('2026-10-12T12:00:00Z'),copy=value=>JSON.parse(JSON.stringify(value));
const seed=(patch={})=>({chain:'solana',address:mint,name:'Electric Otter',symbol:'OTTER',poolCreatedAt:'2026-10-12T11:59:00Z',marketCap:null,liquidity:15000,volume24h:2300,marketProvider:'GeckoTerminal',marketCheckedAt:new Date(at).toISOString(),...patch});
const checks=()=>({status:'complete',label:'Basic checks clear',items:[{key:'mintAuthority',status:'pass',detail:'No mint authority is set.'}],checkedAt:new Date(at).toISOString()});
function memory(saved=null){let value=saved;return {writes:[],async read(){return copy(value);},async write(next){this.writes.push(copy(next));value=copy(next);},get value(){return copy(value);}};}
function providers(patch={}){return {discover:async()=>({coins:[seed()],message:'Recent indexed pools only.'}),enrich:async()=>new Map(),postsStatus:()=>({status:'disconnected',message:'X is not connected.'}),posts:async()=>({status:'disconnected',message:'X is not connected.',posts:[],cursors:{}}),...patch};}
const options={now:()=>at,checkSpacingMs:0,intervalMs:60000,inspect:async()=>checks()};
async function until(predicate){for(let tries=0;tries<100;tries++){if(predicate())return;await new Promise(resolve=>setImmediate(resolve));}throw Error('Expected scanner state did not arrive');}

test('live discovery publishes progressive states, persists results, and deduplicates repeated pools',async()=>{
 const storage=memory(),events=[];const runtime=await createScannerRuntime({...options,storage,providers:providers()});runtime.subscribe(snapshot=>events.push(snapshot));
 await runtime.start(defaultPersonalScanner());await runtime.settled();let state=runtime.getSnapshot();assert.equal(state.status,'running');assert.equal(state.groups[0].coins[0].marketCap,null);assert.equal(state.counts.discovered,1);assert.equal(state.counts.matched,0);assert.equal(state.counts.finds,1);assert.ok(events.some(snapshot=>snapshot.groups.some(group=>group.coins.some(coin=>coin.stage==='checking'))));
 await runtime.start(defaultPersonalScanner());await runtime.settled();state=runtime.getSnapshot();assert.equal(state.groups.length,1);assert.equal(state.counts.discovered,1);assert.ok(storage.writes.length>2);await runtime.dispose();
});
test('saved results survive a real file-store roundtrip and every restart begins paused with a new instance and higher revision',async()=>{
 const testRoot=fileURLToPath(new URL('../.runtime/',import.meta.url));await mkdir(testRoot,{recursive:true});
 const directory=await mkdtemp(join(testRoot,'test-scanner-'));
 try{const storage=createScannerFileStore(join(directory,'scanner.json')),runtime=await createScannerRuntime({...options,storage,providers:providers()});await runtime.start(defaultPersonalScanner());await runtime.settled();const before=runtime.getSnapshot();await runtime.dispose();
  const restored=await createScannerRuntime({...options,storage,providers:providers()});const state=restored.getSnapshot();assert.equal(state.status,'paused');assert.equal(state.groups.length,1);assert.ok(state.revision>before.revision);assert.notEqual(state.instanceId,before.instanceId);assert.equal(state.sources.projects.status,'idle');await restored.dispose();
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('pause fences a late discovery response and resume accepts only the new generation',async()=>{
 let resolve,calls=0;const storage=memory(),runtime=await createScannerRuntime({...options,storage,providers:providers({discover:()=>++calls===1?new Promise(done=>{resolve=done;}):Promise.resolve({coins:[seed({name:'New run'})],message:'Ready'})})});
 await runtime.start(defaultPersonalScanner());await until(()=>resolve);await runtime.pause();resolve({coins:[seed({name:'Old run'})],message:'Old'});await runtime.settled();assert.equal(runtime.getSnapshot().groups.length,0);
 await runtime.start(defaultPersonalScanner());await runtime.settled();assert.equal(runtime.getSnapshot().groups[0].coins[0].name,'New run');await runtime.dispose();
});
test('pause during mint checks aborts the request and ignores a late successful check',async()=>{
 let resolve,signal;const runtime=await createScannerRuntime({...options,storage:memory(),providers:providers(),inspect:(address,options)=>{signal=options.signal;return new Promise(done=>{resolve=done;});}});
 await runtime.start(defaultPersonalScanner());await until(()=>resolve);const paused=await runtime.pause();assert.equal(signal.aborted,true);assert.equal(paused.groups[0].coins[0].stage,'unavailable');resolve(checks());await runtime.settled();assert.equal(runtime.getSnapshot().groups[0].coins[0].checks.status,'unavailable');await runtime.dispose();
});
test('unreadable saved data is never overwritten by pause, start or shutdown',async()=>{
 let writes=0;const runtime=await createScannerRuntime({...options,storage:{read:async()=>{throw Error('corrupt private data');},write:async()=>{writes++;}},providers:providers()});
 assert.equal(runtime.getSnapshot().persistent,false);await runtime.pause();assert.match(runtime.getSnapshot().message,/left untouched/);await assert.rejects(runtime.start(defaultPersonalScanner()));await runtime.dispose();assert.equal(writes,0);
});
test('write failures stop work and explicitly report that results were not saved',async()=>{
 let calls=0;const runtime=await createScannerRuntime({...options,storage:{read:async()=>null,write:async()=>{throw Error('disk full private path');}},providers:providers({discover:async()=>{calls++;return {coins:[],message:'Ready'};}})});
 await assert.rejects(runtime.start(defaultPersonalScanner()));const state=runtime.getSnapshot();assert.equal(state.status,'paused');assert.equal(state.persistent,false);assert.match(state.persistenceError,/could not be saved/);assert.doesNotMatch(JSON.stringify(state),/private path/);assert.equal(calls,0);await runtime.dispose();
});
test('per-post associations survive shared enrichment and possible names are not disabled by hidden legacy settings',async()=>{
 const posts=[{id:'1',handle:'one',author:'One',text:'Watching Electric Otter',url:'https://x.com/one/status/1',publishedAt:new Date(at).toISOString()},
  {id:'2',handle:'two',author:'Two',text:mint,url:'https://x.com/two/status/2',publishedAt:new Date(at).toISOString()}];
 const market={mint,chainId:'solana',pair:pool,name:'Electric Otter',symbol:'OTTER',marketCap:5000,liquidity:10000,volume:20,created:at-60000,retrievedAt:at};
 const runtime=await createScannerRuntime({...options,storage:memory(),providers:providers({discover:async()=>({coins:[seed({name:'Unnamed coin'})],message:'Ready'}),postsStatus:()=>({status:'ready',message:'Configured'}),posts:async()=>({status:'ready',message:'Read',posts,cursors:{}}),enrich:async()=>new Map([[mint,market]])})});
 await runtime.start(defaultPersonalScanner());await runtime.settled();const state=runtime.getSnapshot(),one=state.groups.find(group=>group.id==='post:1'),two=state.groups.find(group=>group.id==='post:2'),launch=state.groups.find(group=>group.kind==='launch');
 assert.equal(one.coins[0].match.kind,'possible');assert.equal(two.coins[0].match.kind,'address');assert.equal(launch.coins[0].match.kind,'launch');assert.equal(one.coins[0].marketCap,5000);assert.equal(two.coins[0].marketCap,5000);assert.equal(state.counts.matched,1);assert.equal(state.sources.posts.status,'running');await runtime.dispose();
});
test('X continues when pool discovery fails; source failures and filter missing values stay explicit',async()=>{
 const post={id:'1',handle:'one',author:'One',text:mint,url:'https://x.com/one/status/1',publishedAt:new Date(at).toISOString()};const config=defaultPersonalScanner();config.resultFilters.capMin='1';
 const runtime=await createScannerRuntime({...options,storage:memory(),providers:providers({discover:async()=>{throw Error('private');},posts:async()=>({status:'ready',message:'Read',posts:[post],cursors:{}})})});
 await runtime.start(config);await runtime.settled();const state=runtime.getSnapshot();assert.equal(state.sources.projects.status,'error');assert.equal(state.sources.posts.status,'running');assert.equal(state.groups[0].coins[0].filter.status,'pending');assert.equal(state.groups[0].coins[0].stage,'unavailable');assert.equal(state.counts.finds,0);await runtime.dispose();
});
test('only visible shared filters apply, and retained results are reevaluated as their pool age changes',async()=>{
 let time=at;const config=defaultPersonalScanner();config.sources.projects.enabled=false;config.sources.public.settings.accountScope='custom';config.sources.public.settings.accounts='';config.sources.projects.settings.riskLevels=[];config.resultFilters.ageMax='1';
 const runtime=await createScannerRuntime({...options,now:()=>time,storage:memory(),providers:providers()});await runtime.start(config);await runtime.settled();assert.equal(runtime.getSnapshot().counts.finds,1);
 time+=7200000;await runtime.start(config);await runtime.settled();assert.equal(runtime.getSnapshot().groups[0].coins[0].filter.status,'excluded');await runtime.dispose();
});
test('mint-provider cooldown skips further RPC checks while retaining unknown results',async()=>{
 let calls=0;const runtime=await createScannerRuntime({...options,storage:memory(),providers:providers({discover:async()=>({coins:[seed(),seed({address:pool})],message:'Ready'})}),inspect:async()=>{calls++;return {status:'unavailable',label:'Busy',items:[],errorCode:'rate-limit',retryAfterMs:120000};}});
 await runtime.start(defaultPersonalScanner());await runtime.settled();assert.equal(calls,1);assert.equal(runtime.getSnapshot().groups[0].coins[1].checks.status,'unavailable');await runtime.dispose();
});

test('discovery continues on schedule while mint checks are slow, and batch market values appear first',async()=>{
 let discoverCalls=0,finishCheck,secondPoll;const polled=new Promise(resolve=>{secondPoll=resolve;});
 const market={mint,chainId:'solana',pair:pool,name:'Electric Otter',symbol:'OTTER',marketCap:7654,liquidity:10000,volume:20,retrievedAt:at};
 const runtime=await createScannerRuntime({...options,intervalMs:1000,storage:memory(),providers:providers({discover:async()=>{discoverCalls++;if(discoverCalls===2)secondPoll();return {coins:[seed()],message:'Ready'};},enrich:async()=>new Map([[mint,market]])}),inspect:()=>new Promise(resolve=>{finishCheck=resolve;})});
 try{await runtime.start(defaultPersonalScanner());await until(()=>finishCheck);assert.equal(runtime.getSnapshot().groups[0].coins[0].marketCap,7654);assert.equal(runtime.getSnapshot().groups[0].coins[0].checks.status,'pending');
  await Promise.race([polled,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Discovery was blocked by checks')),1800);timer.unref();})]);assert.ok(discoverCalls>=2);
  await runtime.pause();finishCheck(checks());await runtime.settled();
 }finally{await runtime.dispose();}
});
test('a weak name association is removed when verified enrichment no longer supports it',async()=>{
 const post={id:'1',handle:'one',author:'One',text:'Watching Electric Otter',url:'https://x.com/one/status/1',publishedAt:new Date(at).toISOString()};
 const market={mint,chainId:'solana',pair:pool,name:'Different Name',symbol:'DIFF',marketCap:5000,liquidity:10000,volume:20,retrievedAt:at};
 const runtime=await createScannerRuntime({...options,storage:memory(),providers:providers({posts:async()=>({status:'ready',message:'Read',posts:[post],cursors:{}}),enrich:async()=>new Map([[mint,market]])})});
 await runtime.start(defaultPersonalScanner());await runtime.settled();const group=runtime.getSnapshot().groups.find(group=>group.kind==='post');assert.equal(group.coins.length,0);assert.equal(group.summaryStatus,'excerpt');assert.equal(group.summary,'Watching Electric Otter');await runtime.dispose();
});
test('a later indexed pool upgrades an earlier unverified post address without duplicating the token',async()=>{
 let discovered=false;const post={id:'1',handle:'one',author:'One',text:mint,url:'https://x.com/one/status/1',publishedAt:new Date(at).toISOString()};
 const runtime=await createScannerRuntime({...options,storage:memory(),providers:providers({discover:async()=>({coins:discovered?[seed()]:[],message:'Ready'}),posts:async()=>({status:'ready',message:'Read',posts:[post],cursors:{}})})});
 await runtime.start(defaultPersonalScanner());await runtime.settled();assert.equal(runtime.getSnapshot().groups[0].coins[0].name,'Unverified address');
 discovered=true;await runtime.start(defaultPersonalScanner());await runtime.settled();const state=runtime.getSnapshot();assert.equal(state.counts.discovered,1);assert.equal(state.groups.find(group=>group.kind==='post').coins[0].name,'Electric Otter');assert.equal(state.groups.find(group=>group.kind==='launch').coins[0].match.kind,'launch');await runtime.dispose();
});
test('repeated source failures stop after the configured attempt limit',async()=>{
 const runtime=await createScannerRuntime({...options,maxFailures:1,storage:memory(),providers:providers({discover:async()=>{throw Error('failed');}})});await runtime.start(defaultPersonalScanner());await runtime.settled();assert.equal(runtime.getSnapshot().status,'paused');assert.match(runtime.getSnapshot().message,/repeated provider failures/);await runtime.dispose();
});

test('a slow X response does not delay independent pool publication or enrichment',async()=>{
 let finishPosts;const runtime=await createScannerRuntime({...options,storage:memory(),providers:providers({posts:()=>new Promise(resolve=>{finishPosts=resolve;})})});
 try{await runtime.start(defaultPersonalScanner());await until(()=>finishPosts&&runtime.getSnapshot().groups[0]?.coins[0]?.stage==='ready');
  const state=runtime.getSnapshot();assert.equal(state.counts.discovered,1);assert.equal(state.groups[0].coins[0].name,'Electric Otter');assert.equal(state.sources.projects.status,'running');
  finishPosts({status:'disconnected',message:'X is not connected.',posts:[],cursors:{}});await runtime.settled();assert.equal(runtime.getSnapshot().counts.discovered,1);
 }finally{finishPosts?.({status:'disconnected',message:'X is not connected.',posts:[],cursors:{}});await runtime.dispose();}
});

test('a post brief survives matching, market enrichment, and restored results',async()=>{
 const storage=memory(),post={id:'101',handle:'one',author:'One',text:'We are watching Electric Otter today. This is not an endorsement.',url:'https://x.com/one/status/101',publishedAt:new Date(at).toISOString()};
 const connected=providers({posts:async()=>({status:'ready',message:'Read',posts:[post],cursors:{}})});
 const runtime=await createScannerRuntime({...options,storage,providers:connected});
 await runtime.start(defaultPersonalScanner());await runtime.settled();
 const group=runtime.getSnapshot().groups.find(group=>group.kind==='post');
 assert.equal(group.summary,post.text);assert.equal(group.summaryStatus,'excerpt');assert.equal(group.coins[0].match.kind,'possible');
 await runtime.dispose();
 const restored=await createScannerRuntime({...options,storage,providers:connected});
 const saved=restored.getSnapshot().groups.find(group=>group.kind==='post');assert.equal(saved.summary,post.text);assert.equal(saved.summaryStatus,'excerpt');await restored.dispose();
});

test('repost display content never becomes the reposting author\'s matching evidence',async()=>{
 const post={id:'102',handle:'one',author:'One',text:mint,displayText:'RT @other: '+mint,links:['https://pump.fun/coin/'+mint],context:{kind:'repost'},url:'https://x.com/one/status/102',publishedAt:new Date(at).toISOString()};
 const runtime=await createScannerRuntime({...options,storage:memory(),providers:providers({posts:async()=>({status:'ready',message:'Read',posts:[post],cursors:{}})})});
 await runtime.start(defaultPersonalScanner());await runtime.settled();const group=runtime.getSnapshot().groups.find(group=>group.kind==='post');
 assert.equal(group.coins.length,0);assert.equal(group.post.displayText,post.displayText);await runtime.dispose();
});

test('long original posts trim oldest whole groups before snapshots and saves exceed the byte budget',async()=>{
 const posts=Array.from({length:60},(_,i)=>({id:String(200+i),handle:'one',author:'One',text:'界'.repeat(25000),url:'https://x.com/one/status/'+(200+i),publishedAt:new Date(at-i*1000).toISOString()}));
 const storage=memory(),runtime=await createScannerRuntime({...options,storage,providers:providers({discover:async()=>({coins:[],message:'Ready'}),posts:async()=>({status:'ready',message:'Read',posts,cursors:{}})})});
 await runtime.start(defaultPersonalScanner());await runtime.settled();const state=runtime.getSnapshot();
 assert.ok(state.groups.length>0&&state.groups.length<60);assert.equal(state.groups[0].post.id,'200');
 assert.equal(state.groups[0].post.text.length,25000);assert.ok(Buffer.byteLength(JSON.stringify(state))<2500000);
 assert.ok(storage.writes.every(value=>Buffer.byteLength(JSON.stringify(value))<3000000));assert.equal(state.persistent,true);await runtime.dispose();
});
