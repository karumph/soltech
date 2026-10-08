// Hosted Feed: the same card design as the sample Feed in coin-feed.js, filled from the shared scan
// and filtered by the visitor's own scanner settings. Every value comes from the scan service. Nothing here is a sample.
import {matchScan,limitSummary} from './scanner-match.js';
import {subscribeLiveScan,refreshLiveScan,nextScanAt} from './live-scan.js';
import {lookupCoins} from './watchlist.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const compact=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1});
const riskWord={lower:'Lower risk',caution:'Caution',high:'High risk',unknown:'Not assessed'};
const chainName=chain=>({solana:'Solana',base:'Base'}[chain]||chain||'');
const PAGE=typeof matchMedia==='function'&&matchMedia('(max-width:700px)').matches?24:48;
export const ago=ms=>{const s=Math.max(0,Math.round(ms/1000));return s<45?'just now':s<3600?`${Math.max(1,Math.round(s/60))}m ago`:s<86400?`${Math.round(s/3600)}h ago`:`${Math.round(s/86400)}d ago`;};
const age=ms=>{const m=Math.max(0,Math.round(ms/60000));return m<60?`${Math.max(1,m)}m`:m<2880?`${Math.round(m/60)}h`:`${Math.round(m/1440)}d`;};
const safeLink=url=>{try{const link=new URL(url);return link.protocol==='https:'&&link.hostname==='dexscreener.com'?link.href:'';}catch{return '';}};
const logoHosts=/(^|\.)(dexscreener\.com|geckoterminal\.com|coingecko\.com|ipfs\.io|pump\.fun|arweave\.net)$/i;
const safeLogo=url=>{try{const link=new URL(url);return link.protocol==='https:'&&logoHosts.test(link.hostname)?link.href:'';}catch{return '';}};
const money=value=>Number(value)>0?compact.format(Number(value)):null;
const pct=value=>Number.isFinite(Number(value))&&value!==null?`${Number(value)>0?'+':''}${Math.abs(Number(value))>=1000?Math.round(Number(value)).toLocaleString('en-US'):Number(value).toFixed(Math.abs(Number(value))<10?1:0)}%`:null;
const copyIcon='<span class="feed-copy-default" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg></span><span class="feed-copy-success" aria-hidden="true" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m5 12 4 4L19 6"/></svg></span>';

const shell=(heading,aside,note,body)=>`<section class="coin-feed" id="live-feed" aria-labelledby="coin-feed-label" aria-describedby="feed-preview-note">
  <div class="feed-grid-heading"><h2 id="coin-feed-label">${heading}</h2><span>${aside}</span></div>
  <p class="feed-preview-note" id="feed-preview-note">${note}</p>${body}
 </section>`;
export const coinFeedLoadingHTML=()=>shell('Live feed','','Loading the latest scan…','<ol class="feed-grid feed-skeleton" aria-hidden="true">'+'<li><div class="feed-card"></div></li>'.repeat(6)+'</ol>');
export const coinFeedErrorHTML=()=>shell('Live feed','','The scan could not be loaded. Try again in a minute.','<button type="button" class="button glass feed-retry" data-feed-retry>Try again</button>');

// One card. `outcome` is the visitor's scanner result for this coin; `arrived` marks a coin that showed up while the page was open.
export function feedCardHTML(coin,{now=Date.now(),index=0,outcome=null,arrived=false,watched=null}={}){
 const id=String(coin.id||''),address=coin.address||(id.includes(':')?id.slice(id.indexOf(':')+1):id),chain=coin.chain||coin.category||id.split(':')[0];
 const name=String(coin.name||coin.symbol||'Unknown'),link=safeLink(coin.url),logo=safeLogo(coin.logo),risk=riskWord[coin.risk]?coin.risk:'unknown';
 const seen=Date.parse(coin.firstSeenAt||'')||0,found=seen?ago(now-seen):'';
 const cap=money(coin.marketCap??coin.fdv);
 const stats=[
  ['Liq',money(coin.liquidity)],
  ['Vol 24h',money(coin.volume24h)],
  ['1h',pct(coin.change1h),Number(coin.change1h)>0?'up':Number(coin.change1h)<0?'down':''],
  ['Pair',coin.pairCreatedAt?age(now-coin.pairCreatedAt):null],
 ];
 const initial=esc((name.trim().match(/[\p{L}\p{N}]/u)||['?'])[0].toUpperCase());
 return `<li data-coin="${esc(id)}"><article class="feed-card ${arrived?'feed-card-arrived':''} ${outcome&&!outcome.match?'feed-card-skipped':''}" aria-labelledby="feed-live-${index}">
    <div class="feed-card-top">
     <span class="feed-coin-logo feed-coin-initial" aria-hidden="true">${initial}${logo?`<img src="${esc(logo)}" alt="" loading="lazy" referrerpolicy="no-referrer" decoding="async">`:''}</span>
     <h3 class="feed-coin-name" id="feed-live-${index}">${link?`<a href="${esc(link)}" target="_blank" rel="noreferrer">${esc(name)}</a>`:esc(name)}${arrived?' <span class="feed-new-tag">New</span>':''}</h3>
     <dl class="feed-market-cap" title="Market cap"><dt><span aria-hidden="true">MC</span><span class="sr-only">Market cap</span></dt><dd>${cap?esc(cap):'<span aria-hidden="true">—</span><span class="sr-only">Not reported</span>'}</dd></dl>
     <div class="feed-coin-meta"><span class="feed-coin-symbol" title="${esc(coin.symbol||'')}">${esc(coin.symbol||'')}</span>${address?`<div class="feed-address"><span class="feed-address-label" aria-hidden="true">CA</span><span class="sr-only">Coin address ${esc(address)}</span><code class="feed-address-text" title="${esc(address)}" aria-hidden="true">${esc(address.slice(0,4))}…${esc(address.slice(-4))}</code><button class="feed-copy-button" type="button" data-feed-copy-address="${esc(address)}" data-coin-name="${esc(name)}" aria-label="Copy ${esc(name)} coin address" title="Copy full coin address">${copyIcon}</button></div>`:''}</div>
    </div>
    <dl class="feed-stats">${stats.map(([label,value,tone])=>`<div><dt>${label}</dt><dd class="${tone||''}">${value?esc(value):'<span aria-hidden="true">—</span><span class="sr-only">Not reported</span>'}</dd></div>`).join('')}</dl>
    <div class="feed-card-bottom"><p class="feed-summary"><span class="feed-risk feed-risk-${risk}">${riskWord[risk]}</span> · ${esc(coin.reason||'')}</p></div>
    ${flagChips(coin)}
    ${outcome&&!outcome.match?`<p class="feed-skip-reason">Not in your finds · ${esc(outcome.reason)}</p>`:''}
    <div class="feed-card-foot"><span class="feed-found-age">${esc(chainName(chain))}${coin.stage==='curve'?' · Launchpad':''}${found?` · <span class="sr-only">Found </span>${esc(found)}`:''}</span><span class="feed-card-actions">${watched!==null&&address?`<button type="button" class="feed-watch-button" data-watch-toggle="${esc(id)}" data-address="${esc(address)}" data-name="${esc(name)}" data-symbol="${esc(coin.symbol||'')}" aria-pressed="${watched}" aria-label="${watched?'Stop watching':'Watch'} ${esc(name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.6Z"/></svg><span>${watched?'Watching':'Watch'}</span></button>`:''}${address?`<a class="feed-check-link" href="#check/${esc(chain)}/${esc(address)}">Check coin</a>`:''}</span></div>
   </article></li>`;
}

// The most useful flags as chips (pair age is already shown above), plus momentum when the scan measured it.
const flagLabel={thinLiquidity:'Thin liquidity',lowLiquidity:'Low liquidity',tinyCap:'Tiny cap',inflatedCap:'Unrealistic cap',knownName:'Copycat name',copycat:'Copycat',sameTicker:'Shared ticker',selling:'Selling pressure',crash:'Price crash',drop:'Price drop',noLinks:'No links',boosted:'Paid boost',mintable:'Mintable',freezable:'Freezable',balanceMutable:'Balances editable',honeypot:'Honeypot',cannotBuy:'Buying blocked',sellTax:'Sell tax',buyTax:'Buy tax',hiddenOwner:'Hidden owner',pausable:'Pausable',blacklist:'Blacklist',taxModifiable:'Tax can change',closedSource:'Unverified code',creatorRugs:'Creator rugged before',topHolders:'Concentrated holders',singleHolder:'One big holder',creatorHolds:'Creator holds a lot',lpUnlocked:'Liquidity unlocked',transferFee:'Transfer fee',transferHook:'Transfer hook',mutableMetadata:'Editable metadata',noMarket:'No market data'};
function flagChips(coin){
 const flags=(Array.isArray(coin.flags)?coin.flags:[]).filter(f=>f.key!=='young'&&f.key!=='noMarket').slice(0,3);
 const checked=coin.safety&&!coin.safety.failedAt;
 const chips=flags.map(f=>`<li class="feed-flag is-${esc(f.level)}" title="${esc(f.text)}">${esc(flagLabel[f.key]||f.text)}</li>`);
 if(checked&&!(coin.flags||[]).some(f=>f.level==='danger'&&coin.safety.flags?.some(s=>s.key===f.key)))chips.push('<li class="feed-flag is-ok" title="Rugcheck or GoPlus found no serious contract risk">Contract checked</li>');
 if(coin.momentum!=null)chips.push(`<li class="feed-flag is-momentum${coin.momentum>=70?' is-hot':''}" title="How much trading is happening right now, 0 to 100">Momentum ${esc(coin.momentum)}</li>`);
 return chips.length?`<ul class="feed-flags" aria-label="Flags">${chips.join('')}</ul>`:'';
}

// A watched coin with no market reading yet.
const watchMissingHTML=(coin,index)=>`<li data-coin="${esc(coin.id)}"><article class="feed-card feed-card-skipped" aria-labelledby="feed-live-${index}"><div class="feed-card-top"><span class="feed-coin-logo feed-coin-initial" aria-hidden="true">${esc((String(coin.symbol||coin.name||'?').match(/[\p{L}\p{N}]/u)||['?'])[0].toUpperCase())}</span><h3 class="feed-coin-name" id="feed-live-${index}">${esc(coin.name||coin.symbol||coin.address.slice(0,6)+'…')}</h3></div><p class="feed-skip-reason">${coin.found===false?'No market has this coin yet. It will show up here once one does.':'Loading the latest price…'}</p><div class="feed-card-foot"><span class="feed-found-age">${coin.chain==='base'?'Base':'Solana'}</span><span class="feed-card-actions"><button type="button" class="feed-watch-button" data-watch-toggle="${esc(coin.id)}" data-address="${esc(coin.address)}" data-name="${esc(coin.name||coin.symbol||'this coin')}" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.6Z"/></svg><span>Watching</span></button></span></div></article></li>`;

// Static render of a whole scan, newest first. Used for the first paint and by tests.
export function coinFeedLiveHTML(scan,now=Date.now()){
 const seen=coin=>Date.parse(coin.firstSeenAt||'')||0;
 const coins=[...(scan.coins||[])].sort((a,b)=>seen(b)-seen(a)).slice(0,PAGE);
 const scanned=Date.parse(scan.updatedAt||'');
 if(!coins.length)return shell('Live feed','','The scheduled scan has not returned coins yet.','');
 return shell('Live feed',scanned?`Scanned ${esc(ago(now-scanned))}`:'','New Solana and Base coins from the shared scan.<br>Market checks, not buy recommendations. X posts aren’t connected.',
  `<ol class="feed-grid" aria-label="Coins from the latest scan, newest first">${coins.map((coin,index)=>feedCardHTML(coin,{now,index})).join('')}</ol>`);
}

const VIEW_KEY='soltech.feed-view.v1';
const SORT_KEY='soltech.feed-sort.v1';
const readSort=()=>{try{return localStorage.getItem(SORT_KEY)==='active'?'active':'newest';}catch{return 'newest';}};
const readView=()=>{try{const v=localStorage.getItem(VIEW_KEY);return ['all','watch'].includes(v)?v:'mine';}catch{return 'mine';}};
const saveView=view=>{try{localStorage.setItem(VIEW_KEY,view);}catch{}};

// Live Feed: subscribes to the poller, filters with the visitor's scanner, and inserts new coins without losing the reader's place.
export function mountLiveFeed(slot,{getConfig,toast=()=>{}}){
 let view=readView(),shown=PAGE,last=null,highlight=new Set(),gone=false,clock=0,priced=new Map(),pricing=false,priceTimer=0,priceError='';
 const watchlist=window.soltechWatchlist;
 let sort=readSort();
 slot.outerHTML=coinFeedLoadingHTML();
 const root=()=>document.querySelector('#live-feed');
 const statusText=s=>{
  if(!s.scan)return '';
  const scanned=Date.parse(s.scan.updatedAt),due=nextScanAt(s.scan),late=due&&Date.now()-due>150000;
  return late?`Scanned ${ago(Date.now()-scanned)} · scan is running late`:`Scanned ${ago(Date.now()-scanned)}`;
 };
 function render(s,{keepPlace=false}={}){
  const host=root();if(!host||gone)return;
  if(s.status==='loading'&&!s.scan)return;
  if(!s.scan){host.outerHTML=coinFeedErrorHTML();return;}
  const config=getConfig(),result=matchScan(s.scan.coins,config),now=Date.now();
  const all=[...s.scan.coins].sort((a,b)=>(Date.parse(b.firstSeenAt)||0)-(Date.parse(a.firstSeenAt)||0));
  const outcomes=new Map([...result.matched,...result.skipped].map(item=>[item.coin.id,item]));
  // Watching: the saved list, priced by /lookup, with the scan's own reading used when it is fresher.
  const watched=watchlist?watchlist.list:[];
  const watchedCoins=watched.map(item=>all.find(c=>c.id===item.id)||priced.get(item.id)||{...item,found:undefined});
  const watchOutcomes=new Map(watchedCoins.map(coin=>{const r=matchScan([coin],config);return [coin.id,r.matched.length?{match:true}:{match:false,reason:r.skipped[0]?.reason||'Outside your filters'}];}));
  let list=view==='mine'?all.filter(coin=>outcomes.get(coin.id)?.match):view==='watch'?watchedCoins:all;
  if(sort==='active'&&view!=='watch')list=[...list].sort((a,b)=>(b.momentum??-1)-(a.momentum??-1));
  const limits=limitSummary(result.limits);
  // Remember where the reader is so cards added above don't shove the page.
  let anchor=null,anchorTop=0;
  if(keepPlace&&window.scrollY>120){for(const li of host.querySelectorAll('.feed-grid>li')){const top=li.getBoundingClientRect().top;if(top>=0){anchor=li.dataset.coin;anchorTop=top;break;}}}
  const empty=view==='watch'?'You aren’t watching any coins yet. Tap <strong>Watch</strong> on a coin, or paste an address into <a href="#scanner">Scan a coin</a> on the Scanner.':view==='mine'?(!result.projectsOn?'New coins is turned off in your scanner, and X posts aren’t connected yet, so nothing can reach your finds. <a href="#scanner/edit">Turn on New coins</a>':`None of the ${all.length} coins the scan is tracking fit your scanner. <a href="#scanner/edit">Loosen your filters</a> or <button type="button" class="text-link" data-feed-view="all">see all new coins</button>.`):'The scan has no coins yet.';
  host.outerHTML=`<section class="coin-feed live-feed" id="live-feed" aria-labelledby="coin-feed-label">
   <div class="feed-side"><div class="feed-toolbar">
    <div class="feed-tabs" role="tablist" aria-label="Which coins to show">
     <button type="button" role="tab" data-feed-view="mine" aria-selected="${view==='mine'}">Your finds <span>${result.matched.length}</span></button>
     <button type="button" role="tab" data-feed-view="all" aria-selected="${view==='all'}">All new coins <span>${all.length}</span></button>
     ${watchlist?`<button type="button" role="tab" data-feed-view="watch" aria-selected="${view==='watch'}">Watching <span>${watched.length}</span></button>`:''}
    </div>
    ${view!=='watch'?`<div class="feed-sort" role="group" aria-label="Sort coins"><button type="button" data-feed-sort="newest" aria-pressed="${sort==='newest'}">Newest</button><button type="button" data-feed-sort="active" aria-pressed="${sort==='active'}">Most active</button></div>`:''}
    <span class="feed-live ${s.status==='stale'?'is-stale':''}" role="status"><span class="feed-live-dot" aria-hidden="true"></span><span data-feed-clock>${s.status==='stale'?'Reconnecting · ':''}${esc(statusText(s))}</span></span>
   </div>
   <h2 id="coin-feed-label" class="sr-only">${view==='mine'?'Your finds':view==='watch'?'Watching':'All new coins'}</h2>
   <p class="feed-filter-summary">${view==='watch'?`<strong>Coins you watch</strong> · re-priced every minute while this page is open${priceError?` · <span class="feed-unsupported">${esc(priceError)}</span>`:''}`:view==='mine'?`<strong>Your scanner</strong> · ${limits.length?esc(limits.join(' · ')):'No limits set, every new coin counts'}`:'<strong>Everything the scan is tracking</strong>, newest first. High-risk coins drop off sooner'} · <a href="#scanner/edit">Edit filters</a>${result.unsupported.length?`<span class="feed-unsupported">Not applied yet: ${esc(result.unsupported.join(', '))}. The live scan doesn’t read these.</span>`:''}</p>
   </div><div class="feed-main"><button type="button" class="feed-new-pill" data-feed-top hidden>New coins above</button>
   ${list.length?`<ol class="feed-grid" aria-label="${view==='mine'?'Your finds':'All new coins'}, newest first">${list.slice(0,shown).map((coin,index)=>(view==='watch'&&!coin.risk?watchMissingHTML(coin,index):feedCardHTML(coin,{now,index,outcome:view==='all'?outcomes.get(coin.id):view==='watch'?watchOutcomes.get(coin.id):null,arrived:view!=='watch'&&highlight.has(coin.id),watched:watchlist?watchlist.has(coin.id):null}))).join('')}</ol>${list.length>shown?`<button type="button" class="button glass feed-more" data-feed-more>Show more <span>(${list.length-shown})</span></button>`:''}`:`<p class="feed-empty">${empty}</p>`}
   <p class="feed-disclaimer">New Solana and Base coins from Dexscreener and GeckoTerminal, scanned every minute and kept for up to a day. Market checks, not buy recommendations. X posts aren’t connected yet.</p>
  </div></section>`;
  const next=root();
  next.querySelectorAll('.feed-coin-logo img').forEach(img=>{img.addEventListener('error',()=>img.remove(),{once:true});img.addEventListener('load',()=>img.parentElement.classList.add('has-image'),{once:true});if(img.complete&&img.naturalWidth)img.parentElement.classList.add('has-image');});
  if(anchor){const li=next.querySelector(`.feed-grid>li[data-coin="${CSS.escape(anchor)}"]`);if(li){window.scrollBy(0,li.getBoundingClientRect().top-anchorTop);const pill=next.querySelector('[data-feed-top]');if(pill&&highlight.size){pill.hidden=false;pill.textContent=`${highlight.size} new ${highlight.size===1?'coin':'coins'} above`;}}}
 }
 const unsubscribe=subscribeLiveScan(s=>{
  const fresh=s.scan&&s.scan.updatedAt!==last?.scan?.updatedAt;
  if(fresh&&s.arrived.length){highlight=new Set(s.arrived);}
  const keepPlace=!!(fresh&&last?.scan);
  last=s;render(s,{keepPlace});
 });
 const onClick=e=>{
  const tab=e.target.closest('[data-feed-view]');
  if(tab&&root()?.contains(tab)){view=tab.dataset.feedView;saveView(view);shown=PAGE;if(view==='watch')price();if(last)render(last);root()?.querySelector(`[data-feed-view="${view}"]`)?.focus({preventScroll:true});return;}
  const sortButton=e.target.closest('[data-feed-sort]');
  if(sortButton&&root()?.contains(sortButton)){sort=sortButton.dataset.feedSort;try{localStorage.setItem(SORT_KEY,sort);}catch{}shown=PAGE;if(last)render(last);root()?.querySelector(`[data-feed-sort="${sort}"]`)?.focus({preventScroll:true});return;}
  const star=e.target.closest('[data-watch-toggle]');
  if(star&&root()?.contains(star)&&watchlist){const on=watchlist.toggle({address:star.dataset.address,name:star.dataset.name,symbol:star.dataset.symbol});toast(on?`Watching ${star.dataset.name}.`:`Stopped watching ${star.dataset.name}.`);return;}
  if(e.target.closest('[data-feed-more]')){shown+=PAGE;if(last)render(last);return;}
  if(e.target.closest('[data-feed-top]')){window.scrollTo({top:0,behavior:'smooth'});e.target.closest('[data-feed-top]').hidden=true;return;}
  if(e.target.closest('[data-feed-retry]')){refreshLiveScan();}
 };
 const onKey=e=>{const tab=e.target.closest?.('[role=tab][data-feed-view]');if(!tab||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const tabs=[...(root()?.querySelectorAll('[role=tab][data-feed-view]')||[])],i=tabs.indexOf(tab);tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length]?.click();};
 const onScroll=()=>{if(window.scrollY<80){const pill=root()?.querySelector('[data-feed-top]');if(pill)pill.hidden=true;}};
 async function price(){
  if(!watchlist||pricing)return;const items=watchlist.list;if(!items.length)return;
  pricing=true;
  try{const coins=await lookupCoins(items);priced=new Map(coins.map(coin=>[coin.id,coin]));priceError='';}
  catch(error){priceError=error.message;}
  finally{pricing=false;}
  if(!gone&&last)render(last,{keepPlace:true});
 }
 const offWatch=watchlist?watchlist.onChange(()=>{if(view==='watch')price();if(last)render(last,{keepPlace:true});}):()=>{};
 if(view==='watch')price();
 priceTimer=setInterval(()=>{if(view==='watch'&&!document.hidden)price();},60000);
 document.addEventListener('click',onClick);document.addEventListener('keydown',onKey);window.addEventListener('scroll',onScroll,{passive:true});
 clock=setInterval(()=>{const el=root()?.querySelector('[data-feed-clock]');if(el&&last?.scan)el.textContent=(last.status==='stale'?'Reconnecting · ':'')+statusText(last);},5000);
 return ()=>{gone=true;unsubscribe();offWatch();clearInterval(priceTimer);clearInterval(clock);document.removeEventListener('click',onClick);document.removeEventListener('keydown',onKey);window.removeEventListener('scroll',onScroll);};
}
