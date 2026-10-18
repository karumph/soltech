import {validTokenAddress,safeImageUrl} from './coin-checker-data.js';
import {getNetwork,canonicalAddress} from './coin-networks.js';

export const RECENT_COINS_KEY='soltech.recent-coins.v1';
const CLEAR_KEY=RECENT_COINS_KEY+'.clear';
const LIMIT=5;
const terminal=new Set(['ready','empty','error','unsupported']);
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
const text=value=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,120):'';
const timestamp=value=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0&&Number.isFinite(new Date(value).getTime());
const canonical=canonicalAddress;
const keyOf=entry=>entry.chainId+':'+entry.address;
const short=address=>address.slice(0,5)+'…'+address.slice(-5);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function cleanEntry(value){
 if(!record(value)||!getNetwork(value.chainId)||!validTokenAddress(value.address,value.chainId)||!timestamp(value.checkedAt))return null;
 const address=canonical(value.address,value.chainId),symbol=text(value.symbol);
 return {chainId:value.chainId,address,name:text(value.name)||symbol||short(address),symbol,logo:safeImageUrl(value.logo)||'',checkedAt:value.checkedAt};
}
function cleanEntries(values){
 if(!Array.isArray(values))return [];
 const seen=new Set();
 return values.map(cleanEntry).filter(Boolean).sort((a,b)=>b.checkedAt-a.checkedAt).filter(entry=>{const key=keyOf(entry);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,LIMIT);
}

// Stores identities only. Opening a recent coin starts a fresh lookup elsewhere.
export function createRecentCoinStore(storage,{now=Date.now,eventTarget=globalThis.window}={}){
 let entries=[],unsaved=[],persistent=false,error=null,blockedRead=false,lastRaw,lastGeneration=null,clearId='',clearToken={},clearPending=false;
 const listeners=new Set();
 const snapshot=()=>({entries:entries.map(entry=>({...entry})),persistent,error});
 const emit=()=>{for(const listener of listeners)listener(snapshot());};
 function read(){
  const previousError=error,previousPersistent=persistent;
  try{
   storage??=globalThis.localStorage;
   if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw Error('Storage unavailable');
   const raw=storage.getItem(RECENT_COINS_KEY)??null,generation=storage.getItem(CLEAR_KEY)??null;
   if(generation!==null&&(typeof generation!=='string'||!generation||generation.length>100))throw Error('Invalid clear marker');
   if(raw===lastRaw&&generation===lastGeneration){blockedRead=false;return false;}
   let saved=[],nextClearId='';
   if(raw!==null){
    if(typeof raw!=='string'||raw.length>100000)throw Error('Invalid history');
    const value=JSON.parse(raw);
    if(!record(value)||value.schemaVersion!==1||!Array.isArray(value.entries)||value.entries.some(entry=>!cleanEntry(entry))
     ||(value.clearId!==undefined&&(typeof value.clearId!=='string'||!value.clearId||value.clearId.length>100)))throw Error('Invalid history');
    saved=value.entries;nextClearId=value.clearId||'';
   }
   // Normal saves never write CLEAR_KEY, so even an interleaved stale save
   // cannot undo a clear. Old envelopes without a separate marker still load.
   if(generation!==null){if(nextClearId!==generation)saved=[];nextClearId=generation;}
   if(clearPending&&generation===lastGeneration&&nextClearId!==clearId){lastRaw=raw;blockedRead=false;return false;}
   const cleared=nextClearId!==clearId||(raw===null&&lastRaw!==undefined&&lastRaw!==null);
   if(cleared){clearToken={};unsaved=[];}
   clearId=nextClearId;lastRaw=raw;lastGeneration=generation;entries=cleanEntries([...unsaved,...saved]);blockedRead=false;clearPending=false;
   persistent=unsaved.length===0;error=persistent?null:'Recent checks could not be saved on this device. Kept in this tab only.';
   if(saved.length>LIMIT)write();
   return true;
  }catch{blockedRead=true;persistent=false;error='Saved history could not be read. New checks stay in this tab.';return previousError!==error||previousPersistent!==persistent;}
 }
 function write(clearing=false){
  if(blockedRead&&!clearing){persistent=false;return false;}
  try{
   if(!storage||typeof storage.setItem!=='function')throw Error('Storage unavailable');
   if(clearing||clearPending){storage.setItem(CLEAR_KEY,clearId);lastGeneration=clearId;}
   const writtenGeneration=clearId;
   const raw=JSON.stringify({schemaVersion:1,entries,...(clearId?{clearId}:{})});
   storage.setItem(RECENT_COINS_KEY,raw);lastRaw=raw;
   unsaved=[];clearPending=false;blockedRead=false;persistent=true;error=null;
   read();
   if(writtenGeneration!==clearId&&storage.getItem(RECENT_COINS_KEY)===raw){
    // Remove our own stale addresses after a clear raced this write. Leave a
    // newer writer's envelope untouched, then check the clear marker again.
    const empty=JSON.stringify({schemaVersion:1,entries:[],...(clearId?{clearId}:{})});
    storage.setItem(RECENT_COINS_KEY,empty);lastRaw=empty;read();
   }
   return persistent;
  }catch{
   persistent=false;
   error=clearing?'History cleared in this tab, but saved history could not be cleared on this device.':'Recent checks could not be saved on this device. Kept in this tab only.';
   return false;
  }
 }
 const refresh=()=>{if(read())emit();};
 const onStorage=event=>{if((event.key===RECENT_COINS_KEY||event.key===CLEAR_KEY||event.key===null)&&(!event.storageArea||event.storageArea===storage))refresh();};
 read();
 return {
  get entries(){return entries.map(entry=>({...entry}));},
  getSnapshot:snapshot,
  // A lookup begun before Clear history may finish its report, but not save itself again.
  beginCheck(){refresh();return clearToken;},
  subscribe(listener){
   if(typeof listener!=='function')return ()=>{};
   if(!listeners.size)eventTarget?.addEventListener?.('storage',onStorage);
   listeners.add(listener);refresh();
   return ()=>{listeners.delete(listener);if(!listeners.size)eventTarget?.removeEventListener?.('storage',onStorage);};
  },
  remember(state,checkedAt,{clearToken:startedBeforeClear}={}){
   if(!record(state)||!getNetwork(state.chainId)||!validTokenAddress(state.mint,state.chainId)||!['market','risk','listing','history'].every(part=>terminal.has(state[part]?.status)))return false;
   const chainId=state.chainId,address=canonical(state.mint,chainId);
   const matching=part=>part?.status==='ready'&&record(part.data)&&part.data.chainId===chainId&&validTokenAddress(part.data.mint,chainId)&&canonical(part.data.mint,chainId)===address?part.data:null;
   const market=matching(state.market),risk=matching(state.risk);
   if(!market&&!risk)return false;
   const sourceTimes=[market?.retrievedAt,risk?.retrievedAt].filter(timestamp);
   const at=checkedAt===undefined?(sourceTimes.length?Math.max(...sourceTimes):now()):checkedAt;
   if(!timestamp(at))return false;
   refresh();
   if(startedBeforeClear!==undefined&&startedBeforeClear!==clearToken)return false;
   const previous=entries.find(entry=>entry.chainId===chainId&&entry.address===address);
   if(previous&&previous.checkedAt>=at)return false;
   const symbol=text(market?.symbol)||text(risk?.symbol);
   const entry={chainId,address,name:text(market?.name)||text(risk?.name)||symbol||short(address),symbol,logo:safeImageUrl(market?.imageUrl)||'',checkedAt:at};
   entries=cleanEntries([entry,...entries.filter(item=>keyOf(item)!==keyOf(entry))]);
   unsaved=cleanEntries([entry,...unsaved]);const savingToken=clearToken;
   write();emit();return savingToken===clearToken;
  },
  clear(){
   read();entries=[];unsaved=[];clearToken={};clearPending=true;clearId=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
   const saved=write(true);emit();return saved;
  }
 };
}

export function recentCoinsHTML(snapshot){
 const entries=cleanEntries(snapshot?.entries),persistent=snapshot?.persistent===true;
 const note=persistent?'':text(snapshot?.error)||'Saving is unavailable. Recent checks stay in this tab.';
 return `<section class="recent-coins" aria-labelledby="recent-coins-title"><div class="recent-coins-header"><h2 id="recent-coins-title">Recently checked</h2><button type="button" class="recent-coins-clear" data-clear-recent ${entries.length||snapshot?.error?'':'disabled'}>Clear history</button></div>${note?`<p class="recent-coins-note is-unavailable">${esc(note)}</p>`:''}${entries.length?`<ol class="recent-coins-list">${entries.map(entry=>{
  const name=entry.symbol||entry.name,initial=Array.from(name)[0]||'?';
  const date=new Date(entry.checkedAt),day=date.toLocaleDateString([],{month:'short',day:'numeric'}),clock=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}),fullDate=date.toLocaleString([],{year:'numeric',month:'long',day:'numeric',hour:'numeric',minute:'2-digit'});
  return `<li><button type="button" class="recent-coin" data-recent-chain="${esc(entry.chainId)}" data-recent-address="${esc(entry.address)}" aria-label="Check ${esc(entry.name)} on ${esc(getNetwork(entry.chainId).name)} again. Last checked ${esc(fullDate)}"><span class="recent-coin-logo" aria-hidden="true"><span>${esc(initial)}</span>${entry.logo?`<img src="${esc(entry.logo)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}</span><span class="recent-coin-identity"><strong title="${esc(entry.name)}">${esc(entry.name)}</strong><small>${entry.symbol?esc(entry.symbol)+' · ':''}${esc(getNetwork(entry.chainId).name)}</small></span><span class="recent-coin-time"><time datetime="${date.toISOString()}" title="${esc(fullDate)}"><span>${esc(day)}</span><span>${esc(clock)}</span></time></span></button></li>`;
 }).join('')}</ol>`:'<p class="recent-coins-empty">Coins you check will appear here.</p>'}</section>`;
}
