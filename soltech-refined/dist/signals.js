// Signals: optional scanner modules people switch on or off, beside the main Scanner (which stays as designed).
// Live modules show boards built from the shared scan. Modules waiting on a connection can still be switched on,
// so they start for that person the moment the connection exists.
import {subscribeLiveScan,liveScanAvailable} from './live-scan.js';

export const SIGNALS_KEY='soltech.signals.v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compact=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1});
const riskWord={lower:'Lower risk',caution:'Caution',high:'High risk',unknown:'Not assessed'};
const logoHosts=/(^|\.)(dexscreener\.com|geckoterminal\.com|coingecko\.com|ipfs\.io|pump\.fun|arweave\.net)$/i;
const safeLogo=url=>{try{const link=new URL(url);return link.protocol==='https:'&&logoHosts.test(link.hostname)?link.href:'';}catch{return '';}};
const HOUR=36e5;

export const signalGroups=['Discovery','Safety','Social','Alerts'];
export const signalModules=[
 {key:'graduating',group:'Discovery',title:'About to graduate',text:'pump.fun coins more than halfway to leaving the launchpad for a full exchange pool. Read from the blockchain every minute.',status:'live',on:true},
 {key:'surges',group:'Discovery',title:'Momentum surges',text:'Coins whose trading jumped by 20 points or more since the last scan, or that are very busy right now.',status:'live',on:true},
 {key:'clean',group:'Discovery',title:'Fresh and clean',text:'Coins under 6 hours old that passed every market and contract check.',status:'live',on:true},
 {key:'contract',group:'Safety',title:'Contract alerts',text:'New coins whose creator can still mint, freeze, tax or move tokens, or that look like a honeypot.',status:'live',on:false},
 {key:'copycats',group:'Safety',title:'Copycat radar',text:'New coins copying an established name or sharing a ticker with other new coins.',status:'live',on:false},
 {key:'holders',group:'Safety',title:'Holder concentration',text:'How much of the supply the biggest wallets hold, leaving out pools and launchpads.',status:'setup',needs:'Starts once a Solana data key is added'},
 {key:'creator',group:'Safety',title:'Creator history',text:'Flags creators who have launched many coins that went to zero.',status:'soon',needs:'In development'},
 {key:'bundles',group:'Safety',title:'Bundle and sniper detection',text:'Coins where connected wallets bought a big share of the supply in the first block.',status:'soon',needs:'In development'},
 {key:'influencers',group:'Social',title:'Influencer mentions on X',text:'Coins posted by the X accounts Soltech follows, as soon as they post.',status:'setup',needs:'Starts once X is connected'},
 {key:'smartWallets',group:'Social',title:'Smart-wallet buys',text:'When wallets with a strong trading record buy a coin.',status:'soon',needs:'In development'},
 {key:'telegram',group:'Alerts',title:'Telegram alerts',text:'A message when a coin matches your scanner or one of your signals.',status:'setup',needs:'Starts once the Telegram bot is connected'},
 {key:'email',group:'Alerts',title:'Email alerts',text:'An email when a coin matches your scanner or one of your signals.',status:'setup',needs:'Starts once email sending is set up'},
];

export function readSignals(storage=globalThis.localStorage){
 let saved={};try{saved=JSON.parse(storage?.getItem(SIGNALS_KEY)||'{}')||{};}catch{saved={};}
 return Object.fromEntries(signalModules.map(m=>[m.key,typeof saved[m.key]==='boolean'?saved[m.key]:m.on===true]));
}

// What each live module shows, from the shared scan. Pure, so it can be tested.
const dangerKeys=new Set(['mintable','freezable','permanentDelegate','balanceMutable','honeypot','cannotBuy','nonTransferable','defaultFrozen','hiddenOwner']);
export function signalBoards(coins,now=Date.now()){
 const list=Array.isArray(coins)?coins:[];
 const age=c=>c.pairCreatedAt?now-c.pairCreatedAt:null;
 const delta=c=>c.momentum!=null&&c.momentumPrev!=null?c.momentum-c.momentumPrev:null;
 return {
  graduating:list.filter(c=>c.curve&&!c.curve.complete&&c.curve.progress!=null&&c.curve.progress>=50).sort((a,b)=>b.curve.progress-a.curve.progress),
  surges:list.filter(c=>c.risk!=='high'&&((delta(c)??0)>=20||(c.momentum??0)>=80)).sort((a,b)=>(delta(b)??0)-(delta(a)??0)||(b.momentum??0)-(a.momentum??0)),
  clean:list.filter(c=>c.risk==='lower'&&age(c)!=null&&age(c)<6*HOUR).sort((a,b)=>(b.momentum??0)-(a.momentum??0)),
  contract:list.filter(c=>(c.flags||[]).some(f=>dangerKeys.has(f.key)||(f.key==='transferFee'&&f.level==='danger')||(f.key==='sellTax'&&f.level==='danger'))).sort((a,b)=>Date.parse(b.firstSeenAt)-Date.parse(a.firstSeenAt)),
  copycats:list.filter(c=>(c.flags||[]).some(f=>f.key==='knownName'||f.key==='copycat'||(f.key==='sameTicker'&&f.level==='warn'))).sort((a,b)=>Date.parse(b.firstSeenAt)-Date.parse(a.firstSeenAt)),
 };
}

const badge=c=>{const logo=safeLogo(c.logo);return `<span class="signal-badge" aria-hidden="true">${esc((String(c.name||c.symbol||'?').match(/[\p{L}\p{N}]/u)||['?'])[0].toUpperCase())}${logo?`<img src="${esc(logo)}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.remove()">`:''}</span>`;};
function metric(key,c){
 if(key==='graduating')return `<span class="signal-progress" role="img" aria-label="${c.curve.progress}% of the way to graduating"><span style="width:${Math.min(100,c.curve.progress)}%"></span></span><span class="signal-metric">${c.curve.progress}% · ${c.curve.sol.toFixed(1)} of ${Math.round(c.curve.targetSol)} SOL</span>`;
 if(key==='surges'){const d=c.momentum!=null&&c.momentumPrev!=null?c.momentum-c.momentumPrev:null;return `<span class="signal-metric">Momentum ${esc(c.momentum)}${d!=null&&d>0?` <strong class="up">+${d}</strong>`:''}</span>`;}
 if(key==='clean')return `<span class="signal-metric">${c.liquidity?`Liq ${esc(compact.format(c.liquidity))}`:''}${c.momentum!=null?` · Momentum ${esc(c.momentum)}`:''}</span>`;
 const f=(c.flags||[]).find(f=>key==='copycats'?['knownName','copycat','sameTicker'].includes(f.key):f.level==='danger'&&(dangerKeys.has(f.key)||['transferFee','sellTax'].includes(f.key)));
 return `<span class="signal-metric is-warning">${esc(f?.text||'')}</span>`;
}
const rowHTML=(key,c)=>`<li>${badge(c)}<span class="signal-copy"><strong>${esc(c.symbol||c.name)}</strong><span class="signal-name">${esc(c.name||'')}</span>${metric(key,c)}</span><span class="signal-side"><span class="risk ${esc(c.risk)}"><span class="risk-dot" aria-hidden="true"></span>${riskWord[c.risk]||riskWord.unknown}</span><a class="feed-check-link" href="#check/${esc(c.chain)}/${esc(c.address)}">Check</a></span></li>`;

export function mountSignals(root,{toast=()=>{},onChange=()=>{}}={}){
 document.title='Signals · Soltech';
 let state=readSignals(),scan=null,gone=false;
 const save=()=>{try{localStorage.setItem(SIGNALS_KEY,JSON.stringify(state));}catch{}onChange();};
 const enabled=()=>signalModules.filter(m=>state[m.key]).length;
 function moduleHTML(m){
  const tag=m.status==='live'?'<span class="signal-status is-live">Live</span>':m.status==='setup'?'<span class="signal-status is-setup">Needs setup</span>':'<span class="signal-status is-soon">Coming soon</span>';
  return `<li class="signal-module ${state[m.key]?'is-on':''}"><label title="${esc(m.text+(m.status!=='live'?' '+m.needs+'.':''))}"><span class="signal-module-copy"><span class="signal-module-head"><strong>${esc(m.title)}</strong>${tag}</span><span>${esc(m.text)}</span>${m.status!=='live'&&state[m.key]?`<em>${esc(m.needs)}. You’re signed up.</em>`:m.status!=='live'?`<em>${esc(m.needs)}.</em>`:''}</span><input type="checkbox" role="switch" data-signal="${m.key}" ${state[m.key]?'checked':''} aria-label="${esc(m.title)}"><span class="signal-switch" aria-hidden="true"></span></label></li>`;
 }
 function boardsHTML(){
  const live=signalModules.filter(m=>m.status==='live'&&state[m.key]);
  if(!live.length)return '<p class="signal-empty">Switch on a live module to see its board here.</p>';
  if(!scan)return '<p class="signal-empty">Loading the latest scan…</p>';
  const boards=signalBoards(scan.coins);
  return live.map(m=>{const items=boards[m.key]||[];return `<section class="signal-board" aria-labelledby="board-${m.key}"><div class="signal-board-head"><h2 id="board-${m.key}">${esc(m.title)}</h2><span>${items.length}</span></div>${items.length?`<ul class="signal-rows">${items.slice(0,8).map(c=>rowHTML(m.key,c)).join('')}</ul>${items.length>8?`<p class="signal-more">${items.length-8} more in the scan</p>`:''}`:'<p class="signal-empty">Nothing right now. This updates every minute.</p>'}</section>`;}).join('');
 }
 function render(){
  if(gone)return;
  const open=root.querySelector('.signal-modules-wrap')?.open;
  root.innerHTML=`<div class="page-width signals-page"><div class="page-intro"><h1>Signals<span class="accent">.</span></h1></div><p class="signals-lede">Extra scanner modules. Turn on the ones you want and their boards appear here. Your Scanner and Feed stay as they are.</p>
   <div class="signals-layout"><details class="signal-modules-wrap" ${open??matchMedia('(min-width:1024px)').matches?'open':''}><summary><span>Modules</span><span class="signal-count">${enabled()} on</span></summary>${signalGroups.map(g=>`<div class="signal-group"><h2>${g}</h2><ul class="signal-modules">${signalModules.filter(m=>m.group===g).map(moduleHTML).join('')}</ul></div>`).join('')}</details>
   <div class="signal-boards" aria-live="polite">${boardsHTML()}</div></div></div>`;
 }
 const onChangeInput=e=>{const el=e.target.closest('[data-signal]');if(!el)return;const m=signalModules.find(x=>x.key===el.dataset.signal);state={...state,[m.key]:el.checked};save();const scroll=window.scrollY;render();window.scrollTo(0,scroll);root.querySelector(`[data-signal="${m.key}"]`)?.focus({preventScroll:true});if(m.status!=='live'&&el.checked)toast(`${m.title}: you’re signed up. It starts once it’s connected.`);};
 root.addEventListener('change',onChangeInput);
 const unsubscribe=liveScanAvailable()?subscribeLiveScan(s=>{if(s.scan&&s.scan!==scan){scan=s.scan;const boards=root.querySelector('.signal-boards');if(boards)boards.innerHTML=boardsHTML();else render();}}):()=>{};
 render();
 return ()=>{gone=true;unsubscribe();root.removeEventListener('change',onChangeInput);};
}
