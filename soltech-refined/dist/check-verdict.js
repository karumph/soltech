// "Soltech verdict" on the Check page: the same reading the Scanner, Feed and Signals use, for the one coin being
// checked. It sits right under the coin's name, in place of the report's own one-line risk box, so the page reads:
// which coin → how risky and why → the four checks at a glance → the full report below.
// Solana and Base only; other networks keep the report's own risk box.
import {lookupCoins,networkOf} from './watchlist.js';
import {matchCoin} from './scanner-match.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const riskWord={lower:'Lower risk',caution:'Caution',high:'High risk',unknown:'Not assessed'};
const checkName={liquidity:'Liquidity',marketCap:'Market cap',age:'Age',safety:'Contract'};
const glyph={pass:'<path d="m6 12 4 4 8-9"/>',warn:'<path d="M12 6v7M12 17v.5"/>',fail:'<path d="m7 7 10 10M17 7 7 17"/>',unknown:'<path d="M7 12h10"/>'};
const statusWord={pass:'Passed',warn:'Warning',fail:'Failed',unknown:'Not reported'};
const icon=p=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const STAR='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.6Z"/></svg>';
const headline={lower:'No major concerns found',caution:'Worth a closer look',high:'Serious concerns found',unknown:'Not enough data to judge'};

export function verdictHTML(coin,config){
 const steps=Array.isArray(coin.steps)?coin.steps:[];
 // Chips add what the four tiles don't already say.
 const shown=new Set(steps.map(s=>s.text));
 const flags=(coin.flags||[]).filter(f=>f.level!=='info'&&!shown.has(f.text)).slice(0,5);
 const notes=(coin.flags||[]).filter(f=>f.level==='info'&&['boosted','noLinks','mutableMetadata','lowLiquidity','mintable','freezable'].includes(f.key)).slice(0,3);
 const fit=config?matchCoin(coin,config):null;
 const watching=window.soltechWatchlist?.has(coin.id);
 const risk=riskWord[coin.risk]?coin.risk:'unknown';
 return `<div class="verdict-top verdict-${risk}"><div class="verdict-summary"><span class="verdict-label">Soltech verdict</span><div class="verdict-line"><span class="risk ${risk}"><span class="risk-dot" aria-hidden="true"></span>${riskWord[risk]}</span><strong>${headline[risk]}</strong></div><p>${esc(coin.reason||'')}</p></div>${window.soltechWatchlist?`<button type="button" class="feed-watch-button" data-verdict-watch aria-pressed="${!!watching}">${STAR}<span>${watching?'Watching':'Watch'}</span></button>`:''}</div>
  <ul class="verdict-tiles" aria-label="The four checks">${steps.map(s=>`<li data-result="${esc(s.status)}"><span class="verdict-tile-head">${icon(glyph[s.status]||glyph.unknown)}<strong>${checkName[s.key]||esc(s.key)}</strong><span class="sr-only">${statusWord[s.status]||''}</span></span><span>${esc(s.text)}</span></li>`).join('')}</ul>
  ${flags.length||notes.length?`<ul class="verdict-flags" aria-label="What we noticed">${flags.map(f=>`<li class="is-${esc(f.level)}">${esc(f.text)}</li>`).join('')}${notes.map(f=>`<li class="is-info">${esc(f.text)}</li>`).join('')}</ul>`:''}
  <div class="verdict-meta">${fit?`<span class="${fit.match?'verdict-fit':'verdict-nofit'}">${fit.match?'✓ Fits your scanner':`Not in your finds · ${esc(fit.reason)}`}</span>`:''}${coin.momentum!=null?`<span>Momentum <strong>${esc(coin.momentum)}</strong>/100</span>`:''}${coin.curve&&coin.curve.progress!=null?`<span class="verdict-curve">${coin.curve.complete?'<strong>Graduated</strong> from pump.fun':`<strong>${coin.curve.progress}%</strong> to graduation<span class="signal-progress"><span style="width:${Math.min(100,coin.curve.progress)}%"></span></span>`}</span>`:''}<a class="text-link" href="#how">How these checks work</a></div>`;
}

export function mountCheckVerdict(main,{getConfig}){
 if(!window.SOLTECH_HOSTED)return ()=>{};
 const result=main.querySelector('#live-result'),input=main.querySelector('#coin-address');
 if(!result||!input)return ()=>{};
 const host=document.createElement('section');
 host.className='check-verdict';host.setAttribute('aria-label','Soltech verdict');
 let current='',coin=null,job=0,state='idle';
 // The report re-renders itself as its sources arrive; keep the verdict in its slot under the coin's name.
 const place=()=>{
  const slot=result.querySelector('.live-coin .quick-risk');
  result.classList.toggle('has-verdict',state==='ready'||state==='loading');
  if(state==='idle'||state==='none'){host.remove();return;}
  if(slot&&host.nextElementSibling!==slot)slot.before(host);
 };
 async function load(address){
  const id=++job,chain=networkOf(address),network=main.querySelector('#coin-network');
  const picked=network&&!network.closest('[hidden]')&&network.value?network.value:null;
  if(!chain||(chain==='base'&&picked&&picked!=='base')){state='none';place();return;}
  state='loading';host.innerHTML='<p class="verdict-note">Running Soltech’s checks…</p>';place();
  try{
   const [found]=await lookupCoins([{chain,address}]);
   if(id!==job)return;
   if(!found?.found){state='none';place();return;}
   coin=found;state='ready';host.innerHTML=verdictHTML(found,getConfig());place();
  }catch{if(id===job){state='none';place();}}
 }
 const sync=()=>{
  if(!result.children.length){current='';coin=null;state='idle';place();return;}
  const address=input.value.trim();
  if(address&&address!==current){current=address;load(address);}else place();
 };
 const observer=new MutationObserver(sync);observer.observe(result,{childList:true});sync();
 const onClick=e=>{
  const watch=e.target.closest('[data-verdict-watch]');if(!watch||!coin||!window.soltechWatchlist)return;
  const on=window.soltechWatchlist.toggle({address:coin.address,name:coin.name,symbol:coin.symbol});
  watch.setAttribute('aria-pressed',String(on));watch.querySelector('span').textContent=on?'Watching':'Watch';
 };
 host.addEventListener('click',onClick);
 return ()=>{job++;observer.disconnect();host.removeEventListener('click',onClick);host.remove();result.classList.remove('has-verdict');};
}
