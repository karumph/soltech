import {validMint} from './coin-checker-data.js';

export const RECENT_WALLETS_KEY='soltech.recent-wallets.v1';
const CLEAR_KEY=RECENT_WALLETS_KEY+'.clear';
export const MAX_RECENT_WALLETS=12;
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const validTime=value=>Number.isSafeInteger(value)&&value>=0&&value<=8640000000000000;
const validEntry=value=>value&&typeof value==='object'&&!Array.isArray(value)&&validMint(value.address)&&validTime(value.checkedAt);
const copy=entries=>entries.map(({address,checkedAt})=>({address,checkedAt}));
const issueText={
 read:'Saved wallet history couldn’t be opened. Recent checks are available for this visit only.',
 write:'Recent wallets couldn’t be saved on this device. This list is available for this visit only.',
 clear:'History was cleared for this visit, but couldn’t be removed from this device. It may reappear after a reload.'
};

function distinct(entries){
 const seen=new Set();
 return copy(entries.filter(validEntry).sort((a,b)=>b.checkedAt-a.checkedAt).filter(entry=>{
  if(seen.has(entry.address))return false;
  seen.add(entry.address);return true;
 }).slice(0,MAX_RECENT_WALLETS));
}

// Only public addresses and local check times are persisted; reports never enter this store.
export function createRecentWalletStore({storage,now=Date.now,eventTarget=globalThis.window}={}){
 let disk=storage,entries=[],unsaved=[],issue=null,unreadable=false,lastRaw,lastGeneration=null,clearId='',clearToken={},clearPending=false;
 const listeners=new Set();
 const emit=()=>{for(const listener of listeners)listener();};
 function read(){
  const previousIssue=issue;
  try{
   if(disk===undefined)disk=globalThis.localStorage;
   if(!disk)throw new Error('Storage unavailable');
   const raw=disk.getItem(RECENT_WALLETS_KEY)??null,generation=disk.getItem(CLEAR_KEY)??null;
   if(generation!==null&&(typeof generation!=='string'||!generation||generation.length>100))throw new Error('Invalid clear marker');
   if(raw===lastRaw&&generation===lastGeneration){unreadable=false;return false;}
   let saved=[],nextClearId='';
   if(raw!==null){
    if(typeof raw!=='string'||raw.length>16384)throw new Error('Invalid history');
    const value=JSON.parse(raw);
    if(!value||value.schemaVersion!==1||!Array.isArray(value.entries)||value.entries.length>MAX_RECENT_WALLETS||!value.entries.every(validEntry)
     ||(value.clearId!==undefined&&(typeof value.clearId!=='string'||!value.clearId||value.clearId.length>100)))throw new Error('Invalid history');
    saved=value.entries;nextClearId=value.clearId||'';
   }
   if(generation!==null){if(nextClearId!==generation)saved=[];nextClearId=generation;}
   if(clearPending&&generation===lastGeneration&&nextClearId!==clearId){lastRaw=raw;unreadable=false;return false;}
   const cleared=nextClearId!==clearId||(raw===null&&lastRaw!==undefined&&lastRaw!==null);
   if(cleared){clearToken={};unsaved=[];}
   clearId=nextClearId;lastRaw=raw;lastGeneration=generation;entries=distinct([...unsaved,...saved]);issue=unsaved.length?'write':null;unreadable=false;clearPending=false;return true;
  }catch{issue='read';unreadable=true;return previousIssue!==issue;}
 }
 function write(clearing=false){
  if(unreadable&&!clearing){issue='read';return {ok:false,error:issueText.read};}
  try{
   // A normal addition cannot replace another tab's separately stored clear.
   if(clearing||clearPending){disk.setItem(CLEAR_KEY,clearId);lastGeneration=clearId;}
   const writtenGeneration=clearId;
   const raw=JSON.stringify({schemaVersion:1,entries,...(clearId?{clearId}:{})});
   disk.setItem(RECENT_WALLETS_KEY,raw);lastRaw=raw;unsaved=[];issue=null;unreadable=false;clearPending=false;
   read();
   if(writtenGeneration!==clearId&&disk.getItem(RECENT_WALLETS_KEY)===raw){
    const empty=JSON.stringify({schemaVersion:1,entries:[],...(clearId?{clearId}:{})});
    disk.setItem(RECENT_WALLETS_KEY,empty);lastRaw=empty;read();
   }
   return writtenGeneration!==clearId?{ok:false,cleared:true}:issue?{ok:false,error:issueText[issue]}:{ok:true};
  }catch{issue=clearing?'clear':'write';return {ok:false,error:issueText[issue]};}
 }
 const refresh=()=>{if(read())emit();};
 const onStorage=event=>{if((event.key===RECENT_WALLETS_KEY||event.key===CLEAR_KEY||event.key===null)&&(!event.storageArea||event.storageArea===disk))refresh();};
 read();
 return {
  get entries(){return copy(entries);},
  get issue(){return issue;},
  beginCheck(){refresh();return clearToken;},
  subscribe(listener){
   if(typeof listener!=='function')return ()=>{};
   if(!listeners.size)eventTarget?.addEventListener?.('storage',onStorage);
   listeners.add(listener);refresh();
   return ()=>{listeners.delete(listener);if(!listeners.size)eventTarget?.removeEventListener?.('storage',onStorage);};
  },
  add(address,{clearToken:startedBeforeClear}={}){
   const checkedAt=now();
   if(!validMint(address)||!validTime(checkedAt))return {ok:false,error:'This wallet could not be added to recent checks.'};
   refresh();
   if(startedBeforeClear!==undefined&&startedBeforeClear!==clearToken)return {ok:false,cleared:true};
   entries=[{address,checkedAt},...entries.filter(entry=>entry.address!==address)].slice(0,MAX_RECENT_WALLETS);
   unsaved=distinct([{address,checkedAt},...unsaved]);
   const result=write();emit();return result;
  },
  clear(){
   read();entries=[];unsaved=[];clearToken={};clearPending=true;clearId=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
   const result=write(true);emit();return result;
  }
 };
}

let recentWalletStore;
export const getRecentWalletStore=()=>recentWalletStore??=createRecentWalletStore();

// Derive the badge from the full address so it stays familiar after reordering or reopening.
function walletBadge(address){
 let hash=2166136261;
 for(const character of address)hash=Math.imul(hash^character.charCodeAt(0),16777619);
 return `<span class="recent-coin-logo" data-wallet-tone="${(hash>>>0)%8}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" focusable="false"><path d="M4.5 9V6a1.5 1.5 0 0 1 1.5-1.5h12A1.5 1.5 0 0 1 19.5 6v3Z" fill="var(--wallet-badge-top,#fff)" stroke="var(--wallet-badge-edge,#586572)" stroke-width="1.1"/><rect x="3" y="8" width="18" height="12" rx="2.8" fill="var(--wallet-badge-face,#dce2e8)" stroke="var(--wallet-badge-edge,#586572)" stroke-width="1.2"/><rect x="15" y="11.5" width="6.5" height="5" rx="1.6" fill="currentColor"/><circle cx="17.25" cy="14" r=".7" fill="var(--wallet-badge-top,#fff)"/></svg></span>`;
}

export function recentWalletsHTML(entries,{issue=null,message=''}={}){
 const list=distinct(Array.isArray(entries)?entries:[]),warning=Object.hasOwn(issueText,issue)?issueText[issue]:'';
 return `<section class="recent-coins" aria-labelledby="recent-wallets-title"><div class="recent-coins-header"><h2 id="recent-wallets-title" tabindex="-1">Recently checked wallets</h2>${list.length||issue?'<button type="button" data-clear-wallet-history>Clear history</button>':''}</div>${warning?`<p class="recent-coins-note" role="alert">${esc(warning)}</p>`:''}${message?`<p class="recent-coins-note" role="status">${esc(message)}</p>`:''}${list.length?`<ol class="recent-coins-list">${list.map(entry=>{
  const date=new Date(entry.checkedAt),day=date.toLocaleDateString([],{month:'short',day:'numeric'}),clock=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}),fullDate=date.toLocaleString([],{year:'numeric',month:'long',day:'numeric',hour:'numeric',minute:'2-digit'});
  const address=entry.address,short=`${address.slice(0,6)}…${address.slice(-6)}`;
  return `<li><button type="button" class="recent-coin" data-recent-wallet="${esc(address)}" aria-label="Check wallet ${esc(address)} again. Last checked ${esc(fullDate)}">${walletBadge(address)}<span class="recent-coin-identity"><strong title="${esc(address)}">${esc(short)}</strong><small>Solana</small></span><span class="recent-coin-time"><time datetime="${esc(date.toISOString())}" title="${esc(fullDate)}"><span>${esc(day)}</span><span>${esc(clock)}</span></time></span></button></li>`;
 }).join('')}</ol>`:'<p class="recent-coins-empty">Wallets will appear here after a successful check.</p>'}</section>`;
}
