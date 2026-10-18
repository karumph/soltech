import test from 'node:test';
import assert from 'node:assert/strict';
import {SIGNALS_KEY,signalModules,signalGroups,normalizeSignalsSnapshot,signalBoards,createSignalsStore,readSignals,createSignalsPoller,signalsHTML,signalsCoverage,mountSignals} from '../dist/signals.js';

const now=Date.parse('2026-10-12T05:37:10.000Z'),iso=value=>new Date(value).toISOString();
const address='So11111111111111111111111111111111111111112',other='1'.repeat(31)+'2',third='1'.repeat(31)+'3';
const evm='0x'+'aB'.repeat(20);
const steps=()=>['liquidity','marketCap','age','safety'].map(key=>({key,status:'pass',text:'Passed'}));
const safety=()=>({checkedAt:iso(now-1000),rugcheckAt:iso(now-1000),sources:['rugcheck'],score:0,lpLockedPct:null,mintable:false,freezable:false,flags:[]});
const coin=(patch={})=>({chain:'solana',address,name:'Example',symbol:'EX',logo:'https://cdn.dexscreener.com/token.png',risk:'lower',flags:[],steps:steps(),safety:safety(),firstSeenAt:iso(now-10000),updatedAt:iso(now),pairCreatedAt:now-4*3600000,liquidity:100000,marketCap:200000,momentum:85,momentumPrev:60,...patch});
const body=(coins=[coin()],patch={})=>({coins,updatedAt:iso(now),run:{sources:{projects:'ok',posts:'not-connected',detail:{profiles:'ok','pools-base':'error'}},safety:{holders:'off'}},...patch});
const normalized=(coins,patch)=>normalizeSignalsSnapshot(body(coins,patch),now);
const response=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const storage=(initial=null)=>{let value=initial;const writes=[];return {writes,getItem:key=>{assert.equal(key,SIGNALS_KEY);return value;},setItem:(key,next)=>{assert.equal(key,SIGNALS_KEY);value=next;writes.push(next);}};};

test('same-name signal coins expose different visible addresses and exact accessible identities',()=>{
 const scan=normalized([coin({address}),coin({address:other})]);
 const html=signalsHTML({values:{clean:true},error:''},{status:'ready',scan,stale:false},{now});
 for(const mint of [address,other]){
  assert.ok(html.includes(`title="${mint}" aria-hidden="true">${mint.slice(0,4)}…${mint.slice(-4)}</code>`));
  assert.ok(html.includes(`Coin address ${mint}</span>`));
  assert.ok(html.includes(`href="#check/solana/${mint}"`));
  assert.ok(html.includes(`aria-label="Check Example on Solana, ${mint}"`));
 }
});

test('normalization preserves exact chain identities and coverage while bounding untrusted fields',()=>{
 const scan=normalized([coin({name:'X'.repeat(500),momentum:101,momentumPrev:'90',liquidity:Infinity}),coin({chain:'base',address:evm,logo:'https://dexscreener.com.evil.test/token.png'}),coin({chain:'base',address:evm.toLowerCase()}),coin({chain:'__proto__'}),coin({address:'1'.repeat(33)})]);
 assert.equal(scan.coins.length,2);assert.equal(scan.omitted,3);assert.equal(scan.coins[0].name.length,120);assert.equal(scan.coins[0].momentum,null);assert.equal(scan.coins[0].momentumPrev,null);assert.equal(scan.coins[0].liquidity,null);
 assert.equal(scan.coins[1].address,evm.toLowerCase());assert.equal(scan.coins[1].logo,'');assert.equal(scan.run.sources.detail.find(source=>source.key==='pools-base').status,'error');
 assert.deepEqual(signalsCoverage(scan),['Some market or launch progress data did not update.','X posts are not connected.','Data about large holders is unavailable.','3 coin entries were skipped because they were invalid or repeated.']);
 for(const logo of ['javascript:alert(1)','https://u:p@dexscreener.com/x','https://localhost/x','https://dexscreener.com\n.evil.test/x'])assert.equal(normalized([coin({logo})]).coins[0].logo,'');
});

test('malformed snapshots and all-invalid rows are errors rather than empty success',()=>{
 for(const value of [null,[],{},body('bad'),body(Array(501).fill(coin())),body([coin({address:'bad'})]),body([],{updatedAt:'bad'}),body([],{updatedAt:iso(now+60001)}),body([],{run:null})])assert.throws(()=>normalizeSignalsSnapshot(value,now),/could not be verified/);
 assert.deepEqual(normalized([]).coins,[]);
});

test('fresh and clean requires complete known checks, no flags, and a nonnegative age under six hours',()=>{
 const patches=[{}, {risk:'unknown'},{pairCreatedAt:now+1},{pairCreatedAt:now-6*3600000},{pairCreatedAt:null},{steps:steps().filter(step=>step.key!=='safety')},{steps:steps().map(step=>({...step,status:'unknown'}))},{safety:null},{safety:{checkedAt:iso(now),failedAt:iso(now)}},{flags:null},{flags:[{key:'note',level:'info',text:'Minor note'}]},{flags:[{key:'bad',level:'invented'}]},{liquidity:null},{marketCap:null,fdv:null}];
 for(const [index,patch] of patches.entries()){const scan=normalized([coin(patch)]);assert.equal(signalBoards(scan.coins,now).clean.length,index===0?1:0,JSON.stringify(patch));}
 assert.equal(signalBoards(normalized([coin({marketCap:null,fdv:200000})]).coins,now).clean.length,1);
 assert.deepEqual(signalBoards([null,{},coin({momentum:Infinity,flags:undefined})],now).clean,[]);
});

test('incomplete reports and source labels without parsed safety evidence cannot claim lower risk',()=>{
 const invalid=[{checkedAt:iso(now)}, {...safety(),incomplete:true},{...safety(),incomplete:'true'},
  {...safety(),score:null,lpLockedPct:null},{...safety(),score:'0',lpLockedPct:null},
  {...safety(),checkedAt:'invalid'},{...safety(),checkedAt:iso(now+1)},
  {...safety(),flags:undefined},{...safety(),flags:[{key:'mintable',level:'danger'}]},
  {...safety(),mintable:undefined},{...safety(),freezable:true},{...safety(),rugFailedAt:iso(now)},
  {...safety(),rugcheckAt:undefined,sources:['unrecognized']},
  {checkedAt:iso(now),source:'goplus',mintable:false,freezable:false,flags:[]}];
 for(const report of invalid){
  const scan=normalized([coin({safety:report})]),value=scan.coins[0];
  assert.equal(value.safetyChecked,false,JSON.stringify(report));assert.equal(value.risk,'unknown');
  assert.equal(signalBoards(scan.coins,now).clean.length,0);
  const html=signalsHTML({values:{surges:true},error:''},{status:'ready',scan,stale:false},{now});
  assert.doesNotMatch(html,/class="risk lower"/);assert.match(html,/class="risk unknown"/);
 }
 const risky=normalized([coin({risk:'high',safety:{incomplete:true},flags:[{key:'mintable',level:'danger',text:'Minting enabled'}]})]);
 assert.equal(risky.coins[0].risk,'high');assert.equal(signalBoards(risky.coins,now).contract.length,1);
});

test('actual history, holder and EVM readings remain eligible without treating missing controls as false',()=>{
 const holders={checkedAt:iso(now),chainAt:iso(now),holdersAt:iso(now),source:'chain',program:'token',supply:1000000,mintable:false,freezable:false,top10Pct:20,largestPct:5,flags:[]};
 const evmSafety={checkedAt:iso(now),source:'goplus',mintable:false,honeypot:false,buyTax:0,sellTax:0,flags:[]};
 for(const patch of [{safety:safety()},{safety:{...safety(),score:null,lpLockedPct:100}},{safety:holders},{chain:'base',address:evm,safety:evmSafety}]){
  const scan=normalized([coin(patch)]);assert.equal(scan.coins[0].safetyChecked,true);assert.equal(signalBoards(scan.coins,now).clean.length,1);
 }
 for(const patch of [{top10Pct:null},{largestPct:undefined},{supply:null},{program:'unrelated-program'},{holdersAt:'invalid'}])assert.equal(normalized([coin({safety:{...holders,...patch}})]).coins[0].risk,'unknown');
 for(const patch of [{buyTax:null},{sellTax:undefined},{honeypot:null},{mintable:undefined},{source:'unrecognized'},{incomplete:true}])assert.equal(normalized([coin({chain:'base',address:evm,safety:{...evmSafety,...patch}})]).coins[0].risk,'unknown');
});

test('contradictory or incomplete flags and steps cannot retain a lower-risk badge on other boards',()=>{
 const patches=[{flags:undefined},{flags:null},{flags:[{key:'note',level:'info',text:'Reported note'}]},{flags:[{key:'bad',level:'invalid'}]},
  {steps:null},{steps:steps().slice(0,3)},{steps:[...steps(),{key:'extra',status:'fail'}]},
  ...['warn','fail','unknown'].map(status=>({steps:steps().map(step=>step.key==='safety'?{...step,status}:step)}))];
 for(const patch of patches){
  const scan=normalized([coin(patch)]);assert.equal(scan.coins[0].risk,'unknown',JSON.stringify(patch));
  assert.equal(signalBoards(scan.coins,now).surges.length,1,'reported activity remains available');
  const html=signalsHTML({values:{surges:true},error:''},{status:'ready',scan,stale:false},{now});
  assert.doesNotMatch(html,/class="risk lower"/);assert.match(html,/class="risk unknown"/);
 }
});

test('boards classify graduation, momentum and reported flags without invented deltas',()=>{
 const scan=normalized([
  coin({curve:{complete:false,progress:62.5,sol:null,targetSol:null},momentumPrev:null,flags:[{key:'mintable',level:'danger',text:'Mint enabled'}],risk:'high'}),
  coin({address:other,momentum:50,momentumPrev:25,flags:[{key:'sameTicker',level:'warn',text:'Ticker reused'}],risk:'caution'}),
  coin({address:third,curve:{complete:true,progress:100},momentum:80,momentumPrev:null,risk:'unknown'}),
 ]);
 const boards=signalBoards(scan.coins,now);assert.deepEqual(boards.graduating.map(item=>item.address),[address]);assert.deepEqual(boards.surges.map(item=>item.address),[other,third]);assert.equal(boards.contract[0].address,address);assert.equal(boards.copycats[0].address,other);
 assert.equal(signalBoards(normalized([coin({curve:{complete:false,progress:101}})]).coins,now).graduating.length,0);
 const html=signalsHTML({values:readSignals(storage()),error:''},{status:'ready',scan,stale:false},{now});assert.match(html,/62.5%/);assert.doesNotMatch(html,/NaN|null SOL|undefined/);
});

test('only live switches persist under one key; setup and coming-soon choices stay disabled',()=>{
 const disk=storage(),store=createSignalsStore(disk);assert.deepEqual(Object.entries(store.getSnapshot().values).filter(([,on])=>on).map(([key])=>key),['graduating','surges','clean']);
 assert.equal(store.set('contract',true),true);assert.equal(store.set('email',true),false);assert.equal(store.set('__proto__',true),false);assert.equal(store.set('clean','yes'),false);assert.equal(disk.writes.length,1);
 assert.equal(createSignalsStore(disk).getSnapshot().values.contract,true);assert.equal(readSignals(storage(JSON.stringify({clean:false,email:true,creator:true}))).email,false);
 const html=signalsHTML(store.getSnapshot(),{status:'idle',scan:null},{now});
 for(const module of signalModules.filter(module=>module.status!=='live'))assert.match(html,new RegExp('data-signal="'+module.key+'"[^>]*disabled aria-describedby="signal-reason-'+module.key+'"'));
 assert.doesNotMatch(html,/signed up|starts once|will send/i);assert.deepEqual(signalGroups,['Discovery','Safety','Social','Alerts']);
});

test('storage read and write failures stay visible and keep switches usable in memory',()=>{
 const blocked=createSignalsStore({getItem(){throw Error('private');},setItem(){throw Error('quota');}});assert.equal(blocked.getSnapshot().persistent,false);assert.match(blocked.getSnapshot().error,/could not be read/);
 blocked.set('clean',false);assert.equal(blocked.getSnapshot().values.clean,false);assert.match(blocked.getSnapshot().error,/this tab only/);assert.doesNotMatch(blocked.getSnapshot().error,/private|quota/);
 const malformed=createSignalsStore(storage('bad'));assert.equal(malformed.getSnapshot().persistent,false);malformed.set('contract',true);assert.equal(malformed.getSnapshot().persistent,true);
 const unavailable=createSignalsStore(null);assert.equal(unavailable.set('surges',false),true);assert.equal(unavailable.getSnapshot().values.surges,false);
});

test('module choices survive new stores in this tab when reads or writes fail, with isolated storage scopes',t=>{
 for(const disk of [{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}},{getItem:()=>JSON.stringify({clean:true}),setItem(){throw Error('quota');}}]){
  const first=createSignalsStore(disk);first.set('clean',false);first.set('contract',true);
  const remounted=createSignalsStore(disk);assert.equal(remounted.getSnapshot().values.clean,false);assert.equal(remounted.getSnapshot().values.contract,true);assert.equal(remounted.getSnapshot().persistent,false);
 }
 const separate=createSignalsStore(storage());assert.equal(separate.getSnapshot().values.clean,true);assert.equal(separate.getSnapshot().values.contract,false);
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 t.after(()=>{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;});
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('getter denied');}});
 createSignalsStore().set('copycats',true);assert.equal(createSignalsStore().getSnapshot().values.copycats,true);assert.equal(createSignalsStore().getSnapshot().persistent,false);
});

test('rendered provider text is escaped, links are internal identities and source limits remain visible',()=>{
 const scan=normalized([coin({name:'<img src=x onerror=alert(1)>',symbol:'"<script>',flags:[{key:'mintable',level:'danger',text:'<svg/onload=alert(1)>'}],risk:'high',curve:{complete:false,progress:60,sol:4,targetSol:8}})]);
 const store=createSignalsStore(storage());store.set('contract',true);const html=signalsHTML(store.getSnapshot(),{status:'stale',scan,message:'Refresh failed.',stale:true},{now});
 assert.match(html,/&lt;img/);assert.match(html,/&lt;svg/);assert.doesNotMatch(html,/<script|<svg|onerror="|onload="/);assert.match(html,new RegExp('href="#check/solana/'+address+'"'));assert.match(html,/Showing the last available results/);assert.match(html,/datetime="2026-10-12T05:37:10.000Z"/);assert.match(html,/market or launch progress data did not update/);
 assert.match(html,/Lower-risk reports/);assert.match(html,/A lower-risk result does not mean a coin is safe/);assert.match(html,/Scan updated <time/);assert.match(html,/Data may be delayed/);assert.doesNotMatch(html,/Fresh and clean|passed every|guaranteed safe/i);
 const empty=signalsHTML(store.getSnapshot(),{status:'error',scan:null,message:'Could not load.'},{now});assert.match(empty,/Results are unavailable\. Select Refresh to try again\./);assert.doesNotMatch(empty,/Loading the latest results/);
});

class Visibility extends EventTarget{hidden=false;set(value){this.hidden=value;this.dispatchEvent(new Event('visibilitychange'));}}
function clock(){
 let time=now,id=0;const jobs=new Map();
 return {now:()=>time,setTimer:(fn,ms)=>{jobs.set(++id,{fn,at:time+ms});return id;},clearTimer:id=>jobs.delete(id),count:()=>jobs.size,async advance(ms){const end=time+ms;for(let steps=0;steps<100;steps++){const next=[...jobs].filter(([,job])=>job.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;jobs.delete(next[0]);time=next[1].at;next[1].fn();await tick();}time=end;await tick();}};
}
function polling(t,options={}){
 const time=clock(),document=new Visibility(),requests=[],changes=[];
 const poller=createSignalsPoller({document,...time,fetcher:(url,init)=>{const pending=deferred();requests.push({url,init,...pending});return pending.promise;},onChange:state=>changes.push(state),...options});t.after(()=>poller.dispose());
 return {poller,time,document,requests,changes};
}

test('read-only poll starts once, coalesces manual refresh and waits sixty visible seconds',async t=>{
 const f=polling(t);f.poller.start();f.poller.start();assert.equal(f.requests.length,1);f.poller.refresh();assert.equal(f.requests.length,1);
 const request=f.requests[0];assert.equal(request.url,'/api/signals');assert.equal(request.init.method,'GET');assert.equal(request.init.credentials,'omit');assert.equal(request.init.redirect,'error');assert.equal(request.init.body,undefined);
 request.resolve(response(body()));await tick();assert.equal(f.poller.getSnapshot().status,'ready');await f.time.advance(59999);assert.equal(f.requests.length,1);await f.time.advance(1);assert.equal(f.requests.length,2);
 f.requests[1].resolve(response(body()));await tick();assert.equal(f.poller.getSnapshot().scan.updatedAt,iso(now));
});

test('hidden tabs stop polling and abort in-flight work; visible tabs resume with one request',async t=>{
 const f=polling(t);f.document.hidden=true;f.poller.start();assert.equal(f.requests.length,0);await f.time.advance(120000);assert.equal(f.requests.length,0);
 f.document.set(false);assert.equal(f.requests.length,1);const old=f.requests[0];f.document.set(true);assert.equal(old.init.signal.aborted,true);await f.time.advance(120000);assert.equal(f.requests.length,1);
 f.document.set(false);assert.equal(f.requests.length,2);f.requests[1].resolve(response(body([],{updatedAt:iso(f.time.now())})));await tick();old.resolve(response(body()));await tick();assert.equal(f.poller.getSnapshot().scan.coins.length,0);assert.equal(f.poller.getSnapshot().status,'ready');
});

test('initial failure is recoverable; later failure keeps the previous snapshot and timestamp visibly stale',async t=>{
 const f=polling(t);f.poller.start();f.requests[0].resolve(new Response('private',{status:503}));await tick();assert.equal(f.poller.getSnapshot().status,'error');assert.equal(f.poller.getSnapshot().scan,null);
 const retry=f.poller.refresh();f.requests[1].resolve(response(body()));await retry;const first=f.poller.getSnapshot().scan;
 const pending=f.poller.refresh();f.requests[2].reject(Error('private provider stack'));await pending;const state=f.poller.getSnapshot();assert.equal(state.status,'stale');assert.equal(state.stale,true);assert.equal(state.scan,first);assert.equal(state.scan.updatedAt,iso(now));assert.doesNotMatch(state.message,/private/);
 const recovery=f.poller.refresh();f.requests[3].resolve(response(body([])));await recovery;assert.equal(f.poller.getSnapshot().status,'ready');assert.deepEqual(f.poller.getSnapshot().scan.coins,[]);
});

test('old successful snapshots are stale and a regressing response cannot replace newer data',async t=>{
 const f=polling(t);f.poller.start();f.requests[0].resolve(response(body([],{updatedAt:iso(now-180001)})));await tick();assert.equal(f.poller.getSnapshot().status,'stale');assert.equal(f.poller.getSnapshot().stale,true);
 let pending=f.poller.refresh();f.requests[1].resolve(response(body()));await pending;pending=f.poller.refresh();f.requests[2].resolve(response(body([],{updatedAt:iso(now-1)})));await pending;
 assert.equal(f.poller.getSnapshot().scan.updatedAt,iso(now));assert.equal(f.poller.getSnapshot().scan.coins.length,1);assert.equal(f.poller.getSnapshot().status,'stale');
});

test('response size limits and stalled requests fail safely without an unbounded loading state',async t=>{
 for(const oversized of [new Response('{}',{headers:{'content-length':'2000001'}}),new Response(' '.repeat(2000001)),{ok:true,headers:new Headers(),text:async()=>' '.repeat(2000001)}]){
  const f=polling(t);f.poller.start();f.requests[0].resolve(oversized);await tick();assert.equal(f.poller.getSnapshot().status,'error');assert.match(f.poller.getSnapshot().message,/could not be verified/);
 }
 const f=polling(t);f.poller.start();await f.time.advance(15000);assert.equal(f.requests[0].init.signal.aborted,true);assert.equal(f.poller.getSnapshot().status,'error');assert.match(f.poller.getSnapshot().message,/too long/);
 const bodyStalled=polling(t);bodyStalled.poller.start();bodyStalled.requests[0].resolve({ok:true,headers:new Headers(),text:()=>new Promise(()=>{})});await tick();await bodyStalled.time.advance(15000);assert.equal(bodyStalled.poller.getSnapshot().status,'error');
});

test('disposal aborts work, removes visibility polling and ignores late results',async t=>{
 const f=polling(t);f.poller.start();const count=f.changes.length;f.poller.dispose();assert.equal(f.requests[0].init.signal.aborted,true);f.requests[0].resolve(response(body()));await tick();assert.equal(f.changes.length,count);
 f.document.set(true);f.document.set(false);await f.time.advance(120000);await f.poller.refresh();assert.equal(f.requests.length,1);assert.equal(f.time.count(),0);
});

test('mount connects switches, manual refresh, safe image fallback and disposal without sending alerts',async t=>{
 class Root extends EventTarget{innerHTML='';querySelector(){return null;}contains(){return false;}}
 const root=new Root(),document=new Visibility(),disk=storage(),requests=[];document.defaultView={matchMedia:()=>({matches:false})};
 const dispose=mountSignals(root,{document,storage:disk,now:()=>now,fetcher:(url,init)=>{const pending=deferred();requests.push({url,init,...pending});return pending.promise;}});t.after(dispose);
 requests[0].resolve(response(body()));await tick();assert.equal(document.title,'Signals · Solventir');assert.match(root.innerHTML,/3 on/);
 const dispatch=(type,target)=>{const event=new Event(type);Object.defineProperty(event,'target',{value:target});root.dispatchEvent(event);};
 dispatch('change',{closest:()=>({dataset:{signal:'contract'},checked:true,disabled:false})});assert.equal(disk.writes.length,1);assert.match(root.innerHTML,/4 on/);assert.match(root.innerHTML,/board-contract/);
 dispatch('change',{closest:()=>({dataset:{signal:'email'},checked:true,disabled:false})});assert.equal(disk.writes.length,1,'forged unavailable switch must not be persisted');
 dispatch('click',{closest:()=>({})});assert.equal(requests.length,2);let removed=false;dispatch('error',{matches:value=>value==='.signal-badge img',remove:()=>{removed=true;}});assert.equal(removed,true);
 const html=root.innerHTML;dispose();assert.equal(requests[1].init.signal.aborted,true);requests[1].resolve(response(body([])));await tick();assert.equal(root.innerHTML,html);
});

// This DOM adapter models the relevant browser replacement behavior: old nodes
// detach to body focus, new sidebar nodes start at scrollTop 0, and focus events
// identify the new node. It lets lifecycle tests exercise actual mount handlers.
function interactiveMount(t,{disk=storage()}={}){
 const document=new Visibility();document.body={};document.documentElement={};document.activeElement=document.body;
 document.defaultView={scrollX:0,scrollY:0,matchMedia:()=>({matches:true}),scrollTo(x,y){this.scrollX=x;this.scrollY=y;}};
 const send=(target,type,eventTarget)=>{const event=new Event(type);Object.defineProperty(event,'target',{value:eventTarget});target.dispatchEvent(event);};
 class Node{
  constructor(kind,attributes={}){this.kind=kind;this.attributes=attributes;this.dataset={};this.disabled=false;this.scrollTop=0;this.scrollLeft=0;}
  matches(selector){return selector==='.feed-check-link'?this.kind==='link':selector==='[data-signals-refresh]'?this.kind==='refresh':selector==='[data-signal]'?this.kind==='input':selector==='.signal-modules-wrap > summary'?this.kind==='summary':false;}
  closest(selector){return this.matches(selector)?this:selector==='.signal-board'?this.board:null;}
  getAttribute(key){return this.attributes[key]??null;}
  focus(options){if(this.disabled)return;this.focusOptions=options;document.activeElement=this;send(document,'focusin',this);}
 }
 class Root extends EventTarget{
  nodes=[];scrollTop=0;scrollLeft=0;html='';
  contains(node){return this.nodes.includes(node);}
  get innerHTML(){return this.html;}
  set innerHTML(html){
   if(this.contains(document.activeElement))document.activeElement=document.body;
   this.html=html;this.nodes=[];this.scrollTop=0;this.scrollLeft=0;document.defaultView.scrollX=0;document.defaultView.scrollY=0;
   this.sidebar=new Node('sidebar');this.sidebar.open=/<details class="signal-modules-wrap" open>/.test(html);this.nodes.push(this.sidebar,new Node('summary'));
   const refresh=new Node('refresh');refresh.disabled=/<button[^>]*data-signals-refresh disabled>/.test(html);this.nodes.push(refresh);
   for(const match of html.matchAll(/<input[^>]*data-signal="([^"]+)"([^>]*)>/g)){const input=new Node('input');input.dataset.signal=match[1];input.checked=/checked/.test(match[2]);input.disabled=/disabled/.test(match[2]);this.nodes.push(input);}
   for(const section of html.matchAll(/<section class="signal-board" aria-labelledby="(board-[^"]+)">([\s\S]*?)<\/section>/g)){
    const board=new Node('board',{'aria-labelledby':section[1]});this.nodes.push(board);
    for(const match of section[2].matchAll(/<a class="feed-check-link" href="([^"]+)"/g)){const link=new Node('link',{href:match[1]});link.board=board;this.nodes.push(link);}
   }
  }
  querySelector(selector){
   if(selector==='.signal-modules-wrap')return this.sidebar;
   if(selector==='[data-signals-refresh]')return this.nodes.find(node=>node.kind==='refresh');
   if(selector==='.signal-modules-wrap > summary')return this.nodes.find(node=>node.kind==='summary');
   const input=/^\[data-signal="([^"]+)"\]$/.exec(selector);if(input)return this.nodes.find(node=>node.dataset.signal===input[1]);
   const link=/^\[aria-labelledby="(board-[^"]+)"\] \.feed-check-link\[href="([^"]+)"\]$/.exec(selector);if(link)return this.nodes.find(node=>node.kind==='link'&&node.board.getAttribute('aria-labelledby')===link[1]&&node.getAttribute('href')===link[2]);
   return null;
  }
 }
 const root=new Root(),requests=[];
 const options={document,storage:disk,now:()=>now,fetcher:(url,init)=>{const pending=deferred();requests.push({url,init,...pending});return pending.promise;}};
 let dispose=mountSignals(root,options);t.after(()=>dispose());
 return {root,document,requests,refresh:()=>send(root,'click',root.querySelector('[data-signals-refresh]')),focusOutside(){document.activeElement={};send(document,'focusin',document.activeElement);},pointerOutside:()=>send(document,'pointerdown',document.body),change(key,value){const input=root.querySelector(`[data-signal="${key}"]`);input.focus();input.checked=value;send(root,'change',input);},remount(){dispose();dispose=mountSignals(root,options);}};
}

test('poll rerenders preserve the exact board link, expanded modules and current sidebar/page scroll',async t=>{
 const f=interactiveMount(t);f.requests[0].resolve(response(body()));await tick();
 const selector=`[aria-labelledby="board-clean"] .feed-check-link[href="#check/solana/${address}"]`,oldLink=f.root.querySelector(selector);oldLink.focus();
 f.root.sidebar.open=true;f.root.sidebar.scrollTop=237;f.root.sidebar.scrollLeft=4;f.root.scrollTop=60;f.root.scrollLeft=2;f.document.defaultView.scrollY=520;
 f.document.set(false);assert.equal(f.requests.length,2);assert.notEqual(f.document.activeElement,oldLink);assert.equal(f.document.activeElement,f.root.querySelector(selector));assert.equal(f.root.sidebar.scrollTop,237);assert.equal(f.root.sidebar.scrollLeft,4);assert.equal(f.root.scrollTop,60);assert.equal(f.document.defaultView.scrollY,520);
 f.root.sidebar.scrollTop=301;f.document.defaultView.scrollY=650;f.requests[1].resolve(response(body()));await tick();
 assert.equal(f.document.activeElement,f.root.querySelector(selector));assert.deepEqual(f.document.activeElement.focusOptions,{preventScroll:true});assert.equal(f.root.sidebar.open,true);assert.equal(f.root.sidebar.scrollTop,301);assert.equal(f.document.defaultView.scrollY,650);
 f.root.querySelector('[data-signal="contract"]').focus();f.root.sidebar.scrollTop=280;f.change('contract',true);assert.equal(f.document.activeElement.dataset.signal,'contract');assert.equal(f.root.sidebar.scrollTop,280);
});

test('manual Refresh focus returns after disabling but never overrides outside focus or pointer choices',async t=>{
 const f=interactiveMount(t);f.requests[0].resolve(response(body()));await tick();
 f.root.querySelector('[data-signals-refresh]').focus();f.refresh();assert.equal(f.root.querySelector('[data-signals-refresh]').disabled,true);assert.equal(f.document.activeElement,f.document.body);
 f.requests[1].resolve(response(body()));await tick();assert.equal(f.document.activeElement,f.root.querySelector('[data-signals-refresh]'));
 f.refresh();f.focusOutside();const outside=f.document.activeElement;f.requests[2].resolve(response(body()));await tick();assert.equal(f.document.activeElement,outside);
 f.root.querySelector('[data-signals-refresh]').focus();f.refresh();f.pointerOutside();f.requests[3].resolve(response(body()));await tick();assert.equal(f.document.activeElement,f.document.body);
});

test('removed links do not focus a duplicate in another board or reclaim focus on a later refresh',async t=>{
 const f=interactiveMount(t);f.requests[0].resolve(response(body()));await tick();
 const selector=`[aria-labelledby="board-clean"] .feed-check-link[href="#check/solana/${address}"]`;f.root.querySelector(selector).focus();f.document.set(false);
 f.requests[1].resolve(response(body([coin({risk:'caution'})])));await tick();assert.equal(f.root.querySelector(selector),undefined);assert.equal(f.document.activeElement,f.document.body);
 f.document.set(false);f.requests[2].resolve(response(body()));await tick();assert.ok(f.root.querySelector(selector));assert.equal(f.document.activeElement,f.document.body);
});

test('leaving and remounting Signals retains unsaved module choices and the storage notice',async t=>{
 const disk={getItem:()=>JSON.stringify({contract:false}),setItem(){throw Error('storage blocked');}};
 const f=interactiveMount(t,{disk});f.requests[0].resolve(response(body()));await tick();f.change('contract',true);f.change('clean',false);
 assert.match(f.root.innerHTML,/Kept in this tab only/);f.remount();assert.equal(f.root.querySelector('[data-signal="contract"]').checked,true);assert.equal(f.root.querySelector('[data-signal="clean"]').checked,false);assert.match(f.root.innerHTML,/Kept in this tab only/);
 f.requests[1].resolve(response(body()));await tick();assert.match(f.root.innerHTML,/board-contract/);assert.doesNotMatch(f.root.innerHTML,/id="board-clean"/);
});
