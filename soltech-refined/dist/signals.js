import {NETWORKS} from './coin-networks.js';
import {validTokenAddress,safeImageUrl} from './coin-checker-data.js';

export const SIGNALS_KEY='soltech.signals.v1';
export const signalGroups=['Discovery','Safety','Social','Alerts'];
export const signalModules=[
 {key:'graduating',group:'Discovery',title:'Launch progress',text:'pump.fun coins at least halfway through their launch stage, based on the latest reported progress. Completion is not guaranteed.',status:'live',on:true},
 {key:'surges',group:'Discovery',title:'Rising activity',text:'Coins with a reported activity score of 80 or more, or an increase of at least 20 points since the previous scan. This does not measure coin quality.',status:'live',on:true},
 {key:'clean',group:'Discovery',title:'Lower-risk reports',text:'Coins with trading pools under 6 hours old and no flags in the reported checks. A lower-risk result does not mean a coin is safe.',status:'live',on:true},
 {key:'contract',group:'Safety',title:'Contract warnings',text:'Coins with reported token controls or restrictions, such as creating more tokens, freezing them or limiting transfers.',status:'live',on:false},
 {key:'copycats',group:'Safety',title:'Name and symbol matches',text:'Coins flagged for sharing a name or trading symbol with other coins. A match alone does not prove impersonation.',status:'live',on:false},
 {key:'holders',group:'Safety',title:'Large holders',text:'How much of a coin’s supply the biggest wallets hold, excluding known pools and launchpads.',status:'setup',needs:'Holder data is not connected for this feature.'},
 {key:'creator',group:'Safety',title:'Creator history',text:'Earlier coins associated with the same creator.',status:'soon',needs:'Not available yet.'},
 {key:'bundles',group:'Safety',title:'Early buying patterns',text:'Large purchases by connected wallets when a coin launches.',status:'soon',needs:'Not available yet.'},
 {key:'influencers',group:'Social',title:'X mentions',text:'Coin mentions from followed accounts on X.',status:'setup',needs:'X is not connected for this feature.'},
 {key:'smartWallets',group:'Social',title:'Wallet buying activity',text:'Purchases by wallets with an established trading record.',status:'soon',needs:'Not available yet.'},
 {key:'telegram',group:'Alerts',title:'Telegram alerts',text:'Messages when a coin matches an enabled signal.',status:'setup',needs:'Telegram is not connected. No alerts will be sent.'},
 {key:'email',group:'Alerts',title:'Email alerts',text:'Emails when a coin matches an enabled signal.',status:'setup',needs:'Email is not connected. No alerts will be sent.'},
];

const HOUR=3600000,POLL_MS=60000,STALE_MS=180000,MAX_BYTES=2000000;
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(value,max=120)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):'';
const number=(value,max=Number.MAX_SAFE_INTEGER)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max?value:null;
const timestamp=(value,now)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0&&value<=now&&Number.isFinite(new Date(value).getTime())?value:null;
const isoTime=(value,now,skew=0)=>typeof value==='string'&&value.length<=40&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&timestamp(Date.parse(value),now+skew)!==null?new Date(value).toISOString():null;
const logoHosts=/(^|\.)(dexscreener\.com|geckoterminal\.com|coingecko\.com|ipfs\.io|pump\.fun|arweave\.net)$/i;
const safeLogo=value=>{const url=safeImageUrl(value);return url&&logoHosts.test(new URL(url).hostname)?url:'';};
const invalid=()=>new Error('These scan results could not be verified. Select Refresh to try again.');
const sourceStatus=value=>['ok','error','not-connected','off','provider'].includes(value)?value:'unknown';
const stepsKeys=['liquidity','marketCap','age','safety'];
const dangerKeys=new Set(['mintable','freezable','permanentDelegate','balanceMutable','honeypot','cannotBuy','nonTransferable','defaultFrozen','hiddenOwner']);
const contractFlag=flag=>dangerKeys.has(flag.key)||(['transferFee','sellTax'].includes(flag.key)&&flag.level==='danger');
const copycatFlag=flag=>['knownName','copycat'].includes(flag.key)||(flag.key==='sameTicker'&&flag.level==='warn');

// A timestamp or source name alone cannot establish that the provider returned
// usable checks. Keep lower-risk labels behind the parsed evidence we receive.
function lowerRiskEvidence(safety,chain,now){
 if(!record(safety)||safety.failedAt||safety.incomplete!==undefined&&safety.incomplete!==false
  ||isoTime(safety.checkedAt,now)===null||!Array.isArray(safety.flags)||safety.flags.length!==0)return false;
 const reported=source=>safety.source===source||Array.isArray(safety.sources)&&safety.sources.includes(source);
 if(chain==='solana'){
  if(safety.mintable!==false||safety.freezable!==false)return false;
  const chainRead=isoTime(safety.chainAt,now)!==null&&['token','token-2022'].includes(safety.program)&&number(safety.supply)!==null;
  const historyRead=!safety.rugFailedAt&&(isoTime(safety.rugcheckAt,now)!==null||reported('rugcheck'))
   &&(number(safety.score)!==null||number(safety.lpLockedPct,100)!==null);
  const holdersRead=chainRead&&isoTime(safety.holdersAt,now)!==null
   &&number(safety.top10Pct,100)!==null&&number(safety.largestPct,100)!==null;
  return historyRead||holdersRead;
 }
 return reported('goplus')&&safety.mintable===false&&safety.honeypot===false
  &&number(safety.buyTax,1)!==null&&number(safety.sellTax,1)!==null;
}

function normalizeCoin(value,now){
 if(!record(value)||!Object.hasOwn(NETWORKS,value.chain)||!validTokenAddress(value.address,value.chain))return null;
 const chain=value.chain,address=NETWORKS[chain].kind==='evm'?value.address.toLowerCase():value.address;
 const rawFlags=Array.isArray(value.flags)&&value.flags.length<=40?value.flags:null;
 const flags=(rawFlags||[]).filter(flag=>record(flag)&&/^[a-zA-Z][a-zA-Z0-9]{0,39}$/.test(flag.key)&&['info','warn','danger'].includes(flag.level)).map(flag=>({key:flag.key,level:flag.level,text:text(flag.text,300)}));
 const rawSteps=Array.isArray(value.steps)&&value.steps.length<=12?value.steps:[];
 const steps=stepsKeys.map(key=>{const matches=rawSteps.filter(step=>step?.key===key);return {key,status:matches.length===1&&['pass','warn','fail','unknown'].includes(matches[0].status)?matches[0].status:'unknown'};});
 const safety=lowerRiskEvidence(value.safety,chain,now);
 const completeChecks=rawFlags!==null&&rawFlags.length===0&&rawSteps.length===stepsKeys.length&&steps.every(step=>step.status==='pass');
 const reportedRisk=['lower','caution','high','unknown'].includes(value.risk)?value.risk:'unknown';
 const risk=reportedRisk==='lower'&&(!safety||!completeChecks)?'unknown':reportedRisk;
 let curve=null;
 if(record(value.curve)&&typeof value.curve.complete==='boolean'&&number(value.curve.progress,100)!==null){curve={complete:value.curve.complete,progress:value.curve.progress,sol:number(value.curve.sol),targetSol:number(value.curve.targetSol),at:isoTime(value.curve.at,now)};if(curve.targetSol===0)curve.targetSol=null;}
 return {id:chain+':'+address,chain,address,name:text(value.name)||text(value.symbol,32)||'Unknown coin',symbol:text(value.symbol,32),logo:safeLogo(value.logo),risk,flags,flagsComplete:rawFlags!==null&&rawFlags.length===flags.length,steps,safetyChecked:safety,firstSeenAt:isoTime(value.firstSeenAt,now),updatedAt:isoTime(value.updatedAt,now),pairCreatedAt:timestamp(value.pairCreatedAt,now),liquidity:number(value.liquidity),marketCap:number(value.marketCap),fdv:number(value.fdv),momentum:number(value.momentum,100),momentumPrev:number(value.momentumPrev,100),curve};
}

export function normalizeSignalsSnapshot(body,now=Date.now()){
 if(!record(body)||!Array.isArray(body.coins)||body.coins.length>500||!record(body.run))throw invalid();
 const updatedAt=isoTime(body.updatedAt,now,60000);if(!updatedAt)throw invalid();
 const seen=new Set(),coins=[];
 for(const value of body.coins){const coin=normalizeCoin(value,now);if(coin&&!seen.has(coin.id)){seen.add(coin.id);coins.push(coin);}}
 if(body.coins.length&&!coins.length)throw invalid();
 const sources=record(body.run.sources)?body.run.sources:{};
 const detail=record(sources.detail)?Object.entries(sources.detail).slice(0,40).filter(([key])=>/^[a-zA-Z0-9-]{1,50}$/.test(key)).map(([key,value])=>({key,status:sourceStatus(value)})):[];
 return {coins,updatedAt,omitted:body.coins.length-coins.length,run:{every:60,sources:{projects:sourceStatus(sources.projects),posts:sourceStatus(sources.posts),detail},holders:sourceStatus(body.run.safety?.holders)}};
}

export function signalBoards(coins,now=Date.now()){
 const list=(Array.isArray(coins)?coins:[]).filter(coin=>record(coin)&&Object.hasOwn(NETWORKS,coin.chain)&&validTokenAddress(coin.address,coin.chain)),age=coin=>timestamp(coin.pairCreatedAt,now)!==null?now-coin.pairCreatedAt:null;
 const delta=coin=>number(coin.momentum,100)!==null&&number(coin.momentumPrev,100)!==null?coin.momentum-coin.momentumPrev:null;
 const recent=(a,b)=>(Date.parse(b.firstSeenAt)||0)-(Date.parse(a.firstSeenAt)||0);
 return {
  graduating:list.filter(coin=>coin.chain==='solana'&&coin.curve?.complete===false&&number(coin.curve.progress,100)!==null&&coin.curve.progress>=50).sort((a,b)=>b.curve.progress-a.curve.progress),
  surges:list.filter(coin=>coin.risk!=='high'&&((delta(coin)??0)>=20||(number(coin.momentum,100)??0)>=80)).sort((a,b)=>(delta(b)??0)-(delta(a)??0)||(b.momentum??0)-(a.momentum??0)),
  clean:list.filter(coin=>coin.risk==='lower'&&coin.flagsComplete&&coin.flags?.length===0&&coin.safetyChecked&&coin.steps?.length===4&&coin.steps.every(step=>step.status==='pass')&&number(coin.liquidity)!==null&&(number(coin.marketCap)!==null||number(coin.fdv)!==null)&&age(coin)!==null&&age(coin)>=0&&age(coin)<6*HOUR).sort((a,b)=>(b.momentum??0)-(a.momentum??0)),
  contract:list.filter(coin=>Array.isArray(coin.flags)&&coin.flags.some(flag=>record(flag)&&contractFlag(flag))).sort(recent),
  copycats:list.filter(coin=>Array.isArray(coin.flags)&&coin.flags.some(flag=>record(flag)&&copycatFlag(flag))).sort(recent),
 };
}

// Module choices belong to this tab even when browser storage cannot be used.
// Injected storage adapters have separate scopes, so fixtures or other stores
// cannot inherit choices from an unrelated adapter.
const signalStores=new WeakMap(),defaultStorageScope={},unavailableStorageScope={};
export function createSignalsStore(storage){
 const scope=storage===undefined?defaultStorageScope:storage&&(typeof storage==='object'||typeof storage==='function')?storage:unavailableStorageScope;
 if(signalStores.has(scope))return signalStores.get(scope);
 let values=Object.fromEntries(signalModules.map(module=>[module.key,module.on===true])),persistent=true,error='';
 try{
  if(storage===undefined)storage=globalThis.localStorage;
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw Error();
  const raw=storage.getItem(SIGNALS_KEY);
  if(raw!==null){if(typeof raw!=='string'||raw.length>5000)throw Error();const saved=JSON.parse(raw);if(!record(saved))throw Error();values=Object.fromEntries(signalModules.map(module=>[module.key,module.status==='live'?(typeof saved[module.key]==='boolean'?saved[module.key]:module.on===true):false]));}
 }catch{persistent=false;error='Saved choices could not be read. Changes will stay in this tab until they can be saved.';}
 const snapshot=()=>({values:{...values},persistent,error});
 const store={getSnapshot:snapshot,set(key,on){
  const module=signalModules.find(item=>item.key===key);if(!module||module.status!=='live'||typeof on!=='boolean')return false;
  values={...values,[key]:on};
  try{if(storage===undefined)storage=globalThis.localStorage;storage.setItem(SIGNALS_KEY,JSON.stringify(values));persistent=true;error='';}catch{persistent=false;error='Your choices could not be saved on this device. Kept in this tab only.';}
  return true;
 }};
 signalStores.set(scope,store);return store;
}
export const readSignals=storage=>createSignalsStore(storage).getSnapshot().values;

async function readSnapshot(response,signal){
 if(Number(response.headers?.get?.('content-length'))>MAX_BYTES){response.body?.cancel().catch(()=>{});throw invalid();}
 let raw='';
 if(response.body?.getReader){
  const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0;
  const cancel=()=>{reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
  try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_BYTES)throw invalid();raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}
  catch(error){cancel();throw error;}finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
 }else{raw=await response.text();if(new TextEncoder().encode(raw).byteLength>MAX_BYTES)throw invalid();}
 try{return JSON.parse(raw);}catch{throw invalid();}
}

// Reads shared snapshots only. It never starts, pauses or changes the scan.
export function createSignalsPoller({fetcher=globalThis.fetch,endpoint='/api/signals',document=globalThis.document,now=Date.now,onChange=()=>{},timeoutMs=15000,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 let state={status:'idle',scan:null,message:'',checkedAt:null},disposed=false,started=false,sequence=0,controller=null,inflight=null,pollTimer=null;
 const visible=()=>!document?.hidden;
 const snapshot=()=>({...state,stale:!!state.scan&&(state.status==='stale'||now()-Date.parse(state.scan.updatedAt)>STALE_MS)});
 const emit=changes=>{state={...state,...changes};onChange(snapshot());};
 const schedule=()=>{clearTimer(pollTimer);pollTimer=null;if(started&&!disposed&&visible())pollTimer=setTimer(()=>{pollTimer=null;refresh();},POLL_MS);};
 function refresh(){
  if(disposed||!visible())return Promise.resolve();if(inflight)return inflight;
  clearTimer(pollTimer);pollTimer=null;const id=++sequence,requestController=new AbortController();controller=requestController;
  let timedOut=false,rejectAbort;
  const stopped=new Promise((_,reject)=>{rejectAbort=()=>reject(Error('cancelled'));requestController.signal.addEventListener('abort',rejectAbort,{once:true});});
  const timer=setTimer(()=>{timedOut=true;requestController.abort();},Number.isFinite(timeoutMs)&&timeoutMs>0?Math.min(timeoutMs,30000):15000);
  emit({status:'loading',message:''});
  const request=(async()=>{
   const response=await fetcher(endpoint,{method:'GET',credentials:'omit',redirect:'error',cache:'no-store',headers:{Accept:'application/json'},signal:requestController.signal});
   if(!response.ok){response.body?.cancel().catch(()=>{});throw Error(response.status===429?'Too many requests. Wait a moment, then select Refresh.':'Signals could not refresh. Select Refresh to try again.');}
   return normalizeSignalsSnapshot(await readSnapshot(response,requestController.signal),now());
  })();
  inflight=Promise.race([request,stopped]).then(scan=>{
   if(disposed||id!==sequence)return;
   if(state.scan&&Date.parse(scan.updatedAt)<Date.parse(state.scan.updatedAt))throw invalid();
   emit({status:now()-Date.parse(scan.updatedAt)>STALE_MS?'stale':'ready',scan,message:'',checkedAt:now()});
  }).catch(error=>{
   if(disposed||id!==sequence)return;
   const safe=['Too many requests. Wait a moment, then select Refresh.','These scan results could not be verified. Select Refresh to try again.'].includes(error?.message)?error.message:'Signals could not refresh. Select Refresh to try again.';
   emit({status:state.scan?'stale':'error',message:timedOut?'Loading took too long. Select Refresh to try again.':safe,checkedAt:now()});
  }).finally(()=>{clearTimer(timer);requestController.signal.removeEventListener('abort',rejectAbort);if(id===sequence){controller=null;inflight=null;schedule();}});
  return inflight;
 }
 const onVisibility=()=>{
  clearTimer(pollTimer);pollTimer=null;
  if(!visible()){sequence++;controller?.abort();controller=null;inflight=null;if(state.status==='loading')emit({status:state.scan?'ready':'idle',message:''});}
  else refresh();
 };
 return {getSnapshot:snapshot,refresh,start(){if(started||disposed)return;started=true;document?.addEventListener('visibilitychange',onVisibility);refresh();},dispose(){disposed=true;sequence++;clearTimer(pollTimer);controller?.abort();controller=null;inflight=null;document?.removeEventListener('visibilitychange',onVisibility);}};
}

const compact=new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1});
const metricNumber=new Intl.NumberFormat(undefined,{maximumFractionDigits:1});
const riskWord={lower:'Lower risk',caution:'Caution',high:'High risk',unknown:'Not assessed'};
const badge=coin=>`<span class="signal-badge" aria-hidden="true">${esc((coin.name.match(/[\p{L}\p{N}]/u)||['?'])[0].toUpperCase())}${coin.logo?`<img src="${esc(coin.logo)}" alt="" referrerpolicy="no-referrer" loading="lazy">`:''}</span>`;
function metric(key,coin){
 if(key==='graduating'){const value=metricNumber.format(coin.curve.progress),totals=coin.curve.sol!==null&&coin.curve.targetSol!==null?` · ${metricNumber.format(coin.curve.sol)} of ${metricNumber.format(coin.curve.targetSol)} SOL`:'';return `<span class="signal-progress" role="img" aria-label="${esc(value)}% of launch target reached"><span style="width:${coin.curve.progress}%"></span></span><span class="signal-metric">${esc(value)}%${esc(totals)}</span>`;}
 if(key==='surges'){const delta=coin.momentum!==null&&coin.momentumPrev!==null?coin.momentum-coin.momentumPrev:null;return `<span class="signal-metric">Activity score ${esc(metricNumber.format(coin.momentum))}${delta!==null&&delta>0?` <strong class="up">+${esc(metricNumber.format(delta))}</strong>`:''}</span>`;}
 if(key==='clean')return `<span class="signal-metric">${esc([coin.liquidity!==null?'Liquidity '+compact.format(coin.liquidity):'',coin.momentum!==null?'Activity score '+metricNumber.format(coin.momentum):''].filter(Boolean).join(' · '))}</span>`;
 const flag=coin.flags.find(key==='copycats'?copycatFlag:contractFlag);return `<span class="signal-metric is-warning">${esc(flag?.text||(key==='copycats'?'Name or symbol match':'Token contract warning'))}</span>`;
}
const rowHTML=(key,coin)=>`<li>${badge(coin)}<span class="signal-copy"><strong title="${esc(coin.symbol||coin.name)}">${esc(coin.symbol||coin.name)}</strong><span class="signal-name" title="${esc(coin.name)}">${esc(coin.name)}</span><span class="signal-address"><span aria-hidden="true">${esc(NETWORKS[coin.chain].name)}</span><span class="sr-only">Coin address ${esc(coin.address)}</span><code title="${esc(coin.address)}" aria-hidden="true">${esc(coin.address.slice(0,4))}…${esc(coin.address.slice(-4))}</code></span>${metric(key,coin)}</span><span class="signal-side"><span class="risk ${coin.risk}"><span class="risk-dot" aria-hidden="true"></span>${riskWord[coin.risk]}</span><a class="feed-check-link" href="#check/${coin.chain}/${coin.address}" aria-label="Check ${esc(coin.name)} on ${esc(NETWORKS[coin.chain].name)}, ${esc(coin.address)}">Check</a></span></li>`;

export function signalsCoverage(scan){
 if(!scan)return [];
 const sources=scan.run.sources,notes=[];
 if(sources.projects!=='ok')notes.push('New coin data is unavailable.');
 if(sources.detail.some(source=>source.status==='error'))notes.push('Some market or launch progress data did not update.');
 if(sources.posts!=='ok')notes.push(sources.posts==='not-connected'?'X posts are not connected.':'X posts are unavailable.');
 if(scan.run.holders!=='provider')notes.push('Data about large holders is unavailable.');
 if(scan.omitted)notes.push(`${scan.omitted} coin ${scan.omitted===1?'entry was':'entries were'} skipped because ${scan.omitted===1?'it was':'they were'} invalid or repeated.`);
 return notes;
}
export function signalsBoardsHTML(values,state,now=Date.now()){
 const active=signalModules.filter(module=>module.status==='live'&&values[module.key]);
 if(!active.length)return '<p class="signal-empty">Turn on an available signal to see matching coins here.</p>';
 if(!state.scan)return `<p class="signal-empty">${state.status==='error'?'Results are unavailable. Select Refresh to try again.':state.status==='idle'?'Results will load when you return to this page.':'Loading the latest results…'}</p>`;
 const boards=signalBoards(state.scan.coins,now);
 return active.map(module=>{const items=boards[module.key];return `<section class="signal-board" aria-labelledby="board-${module.key}"><div class="signal-board-head"><h2 id="board-${module.key}">${esc(module.title)}</h2><span>${items.length}</span></div>${items.length?`<ul class="signal-rows">${items.slice(0,8).map(coin=>rowHTML(module.key,coin)).join('')}</ul>${items.length>8?`<p class="signal-more">${items.length-8} more matches in this scan (not shown)</p>`:''}`:'<p class="signal-empty">No matching coins in this scan.</p>'}</section>`;}).join('');
}
export function signalsHTML(store,state,{open=false,now=Date.now()}={}){
 const {values}=store,busy=state.status==='loading',scan=state.scan;
 const message=state.message||(busy?(scan?'Loading updated results…':'Loading scan results…'):state.stale?'These results are more than 3 minutes old.':scan?'Checks for updates every minute while you’re viewing this page.':'Updates resume when you return to this page.');
 const modules=group=>signalModules.filter(module=>module.group===group).map(module=>{
  const available=module.status==='live',tag=available?'<span class="signal-status is-live">Available</span>':module.status==='setup'?'<span class="signal-status is-setup">Not connected</span>':'<span class="signal-status is-soon">Planned</span>';
  return `<li class="signal-module ${values[module.key]?'is-on':''}${available?'':' is-disabled'}"><label><span class="signal-module-copy"><span class="signal-module-head"><strong>${esc(module.title)}</strong>${tag}</span><span>${esc(module.text)}</span>${available?'':`<em id="signal-reason-${module.key}">${esc(module.needs)}</em>`}</span><input type="checkbox" role="switch" data-signal="${module.key}" ${values[module.key]?'checked':''} ${available?'':`disabled aria-describedby="signal-reason-${module.key}"`} aria-label="${esc(module.title)}"><span class="signal-switch" aria-hidden="true"></span></label></li>`;
 }).join('');
 const notes=signalsCoverage(scan);
 return `<div class="page-width signals-page"><div class="page-intro"><h1>Signals<span class="accent">.</span></h1></div><p class="signals-lede">Choose signals below to see matching coins from the latest scan. Data may be delayed. Settings apply only on this device.</p><div class="signals-snapshot signals-toolbar"><button type="button" class="signals-refresh" data-signals-refresh ${busy?'disabled':''}>${busy?'Refreshing…':'Refresh'}</button><p class="signals-status signals-message${state.stale?' is-stale':''}" role="status" aria-live="polite">${esc(message)}${state.stale&&state.message?' Showing the last available results.':''}</p>${scan?`<p class="signals-updated">Scan updated <time datetime="${scan.updatedAt}">${esc(new Date(scan.updatedAt).toLocaleString())}</time></p>`:''}</div>${notes.length?`<p class="signals-coverage">${esc(notes.join(' '))}</p>`:''}${store.error?`<p class="signals-storage-note signals-storage" role="status">${esc(store.error)}</p>`:''}<div class="signals-layout"><details class="signal-modules-wrap" ${open?'open':''}><summary><span>Choose signals</span><span class="signal-count">${signalModules.filter(module=>values[module.key]&&module.status==='live').length} on</span></summary>${signalGroups.map(group=>`<div class="signal-group"><h2>${group}</h2><ul class="signal-modules">${modules(group)}</ul></div>`).join('')}</details><div class="signal-boards" aria-busy="${busy}">${signalsBoardsHTML(values,state,now)}</div></div></div>`;
}

export function mountSignals(root,{toast=()=>{},onChange=()=>{},fetcher=globalThis.fetch,endpoint='/api/signals',storage,document=root.ownerDocument||globalThis.document,now=Date.now}={}){
 if(document)document.title='Signals · Solventir';
 const store=createSignalsStore(storage);let gone=false,pendingFocus=null;
 const defaultOpen=document?.defaultView?.matchMedia?.('(min-width:1024px)').matches===true;
 function focusIdentity(active){
  if(active?.matches?.('[data-signal]')&&signalModules.some(module=>module.key===active.dataset.signal))return `[data-signal="${active.dataset.signal}"]`;
  if(active?.matches?.('[data-signals-refresh]'))return '[data-signals-refresh]';
  if(active?.matches?.('.signal-modules-wrap > summary'))return '.signal-modules-wrap > summary';
  if(active?.matches?.('.feed-check-link')){
   const href=active.getAttribute('href'),match=/^#check\/([^/]+)\/([^/]+)$/.exec(href||'');
   const board=active.closest('.signal-board')?.getAttribute('aria-labelledby');
   if(match&&Object.hasOwn(NETWORKS,match[1])&&validTokenAddress(match[2],match[1])&&signalModules.some(module=>module.status==='live'&&board==='board-'+module.key))return `[aria-labelledby="${board}"] .feed-check-link[href="${href}"]`;
  }
  return null;
 }
 const outsideInteraction=event=>{if(!root.contains?.(event.target))pendingFocus=null;};
 function render(state){
  if(gone)return;
  const sidebar=root.querySelector('.signal-modules-wrap'),open=sidebar?.open??defaultOpen,active=document?.activeElement;
  const view=document?.defaultView,scroll={sidebarTop:sidebar?.scrollTop,sidebarLeft:sidebar?.scrollLeft,rootTop:root.scrollTop,rootLeft:root.scrollLeft,x:view?.scrollX,y:view?.scrollY};
  if(root.contains?.(active))pendingFocus=focusIdentity(active);
  else if(active&&active!==document?.body&&active!==document?.documentElement)pendingFocus=null;
  root.innerHTML=signalsHTML(store.getSnapshot(),state,{open,now:now()});
  if(pendingFocus){const target=root.querySelector(pendingFocus);if(target&&!target.disabled)target.focus({preventScroll:true});else if(state.status!=='loading')pendingFocus=null;}
  const nextSidebar=root.querySelector('.signal-modules-wrap');
  if(nextSidebar&&Number.isFinite(scroll.sidebarTop)){nextSidebar.scrollTop=scroll.sidebarTop;nextSidebar.scrollLeft=scroll.sidebarLeft;}
  if(Number.isFinite(scroll.rootTop)){root.scrollTop=scroll.rootTop;root.scrollLeft=scroll.rootLeft;}
  if(Number.isFinite(scroll.x)&&Number.isFinite(scroll.y)&&(view.scrollX!==scroll.x||view.scrollY!==scroll.y))view.scrollTo?.(scroll.x,scroll.y);
 }
 const poller=createSignalsPoller({fetcher,endpoint,document,now,onChange:render});
 const change=event=>{const input=event.target.closest?.('[data-signal]');if(!input||input.disabled||!store.set(input.dataset.signal,input.checked))return;render(poller.getSnapshot());onChange();if(!store.getSnapshot().persistent)toast('Your choices are kept in this tab only.');};
 const click=event=>{if(event.target.closest?.('[data-signals-refresh]'))poller.refresh();};
 const imageError=event=>{if(event.target.matches?.('.signal-badge img'))event.target.remove();};
 root.addEventListener('change',change);root.addEventListener('click',click);root.addEventListener('error',imageError,true);
 document?.addEventListener('focusin',outsideInteraction);document?.addEventListener('pointerdown',outsideInteraction,true);
 render(poller.getSnapshot());poller.start();
 return ()=>{gone=true;pendingFocus=null;poller.dispose();root.removeEventListener('change',change);root.removeEventListener('click',click);root.removeEventListener('error',imageError,true);document?.removeEventListener('focusin',outsideInteraction);document?.removeEventListener('pointerdown',outsideInteraction,true);};
}
