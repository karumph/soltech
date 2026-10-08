import {matchScan,matchCoin,scannerLimits,limitSummary} from './scanner-match.js';
import {subscribeLiveScan,nextScanAt,liveScanAvailable} from './live-scan.js';
import {lookupCoins,networkOf} from './watchlist.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FLOW_PAUSE_KEY='soltech.scanner-demo-paused.v1';
let rememberedPause;
const readFlowPause=()=>{
 if(rememberedPause!==undefined)return rememberedPause;
 try{rememberedPause=window.localStorage.getItem(FLOW_PAUSE_KEY)==='true';}catch{rememberedPause=false;}
 return rememberedPause;
};
const saveFlowPause=paused=>{
 rememberedPause=paused;
 try{window.localStorage.setItem(FLOW_PAUSE_KEY,String(paused));}catch{/* Keep the choice across navigation when storage is unavailable. */}
};
// Demo cycles stay at the original 18 seconds. Live cycles are shorter so a busy minute of new coins keeps up.
const DEMO_CYCLE_MS=18000,LIVE_CYCLE_MS=8000,REPLAY_COUNT=12;
const hosted=liveScanAvailable;
const chainName=chain=>({solana:'Solana',base:'Base'}[chain]||chain||'');
const riskLabel={lower:'Lower risk',caution:'Caution',high:'High risk',unknown:'Not assessed'};
const dexNames={meteoradbc:'Meteora DBC',meteora:'Meteora',dlmm:'Meteora DLMM',pumpfun:'Pump.fun','pump-fun':'Pump.fun',pumpswap:'PumpSwap',raydium:'Raydium',launchlab:'LaunchLab',orca:'Orca',uniswap:'Uniswap',aerodrome:'Aerodrome',baseswap:'BaseSwap',sushiswap:'SushiSwap',pancakeswap:'PancakeSwap',moonshot:'Moonshot'};
const dexName=id=>dexNames[String(id||'').toLowerCase()]||String(id||'').replace(/(^|[-_ ])(\w)/g,(m,a,b)=>(a?' ':'')+b.toUpperCase());
// Tickers read as tickers, so a coin called "nothing" never reads like an empty message.
const tickerOf=coin=>{const raw=String(coin.symbol||coin.name||'this coin').trim();return /^\$/.test(raw)||!coin.symbol?raw:'$'+raw;};
const glyph={pass:'<path d="m6 12 4 4 8-9"/>',warn:'<path d="M12 6v7M12 17v.5"/>',fail:'<path d="m7 7 10 10M17 7 7 17"/>',unknown:'<path d="M7 12h10"/>'};
const ago=ms=>{const s=Math.max(0,Math.round(ms/1000));return s<45?'just now':s<3600?`${Math.max(1,Math.round(s/60))}m ago`:s<86400?`${Math.round(s/3600)}h ago`:`${Math.round(s/86400)}d ago`;};
const stepsOf=coin=>Array.isArray(coin.steps)&&coin.steps.length?coin.steps.slice(0,4):(coin.checks||[]).slice(0,3).map(([label,text])=>({key:label,status:'unknown',text:/https?:/.test(text||'')?String(label):String(text||label).replace(/\.$/,'')}));
const logoHosts=/(^|\.)(dexscreener\.com|geckoterminal\.com|coingecko\.com|ipfs\.io|pump\.fun|arweave\.net)$/i;
const safeLogo=url=>{try{const link=new URL(url);return link.protocol==='https:'&&logoHosts.test(link.hostname)?link.href:'';}catch{return '';}};
const initialOf=coin=>esc((String(coin.name||coin.symbol||'?').trim().match(/[\p{L}\p{N}]/u)||['?'])[0].toUpperCase());
const coinBadge=(coin,cls='flow-coin-badge')=>{const logo=safeLogo(coin.logo);return `<span class="${cls}" aria-hidden="true">${initialOf(coin)}${logo?`<img src="${esc(logo)}" alt="" referrerpolicy="no-referrer" decoding="async" onerror="this.remove()">`:''}</span>`;};
const icon=(paths,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
const icons={
 pause:'<path d="M8 5v14M16 5v14" stroke-width="2.2"/>',
 play:'<path d="m8 5 11 7-11 7V5Z"/>',
 sliders:'<path d="M4 7h5m4 0h7M4 17h9m4 0h3"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
 launch:'<path d="M12 15.5 8.5 12c1.2-4.3 4-7.4 9.5-8 0 5.5-3.4 8.3-6 11.5Z"/><path d="M8.5 12H5.2l2.6-3.2 3.3-.3M12 15.5v3.3l3.2-2.6.3-3.3"/><path d="M7.2 16.8c-1.2.3-2.1 1.2-2.4 2.4 1.2-.3 2.1-1.2 2.4-2.4Z" fill="currentColor"/>'
};
const pathLayer=(path,kind)=>`<path class="flow-channel-halo" d="${path}"/><path class="flow-channel-line" d="${path}"/>${kind?`<g class="flow-packet-veil"><path class="flow-packet ${kind}" pathLength="100" d="${path}"/></g>`:''}`;
const connector=stage=>`<div class="flow-connector" aria-hidden="true"><svg viewBox="0 0 320 48" preserveAspectRatio="none" focusable="false">${pathLayer('M160 0V48','flow-packet-'+stage)}</svg></div>`;
const scanPattern=kind=>{
 const heights=[5,10,7,15,9,18,12,6,15,8,17,10,14,6,12,18,8];
 if(kind==='pairs')heights.reverse();
 return `<svg class="flow-scan-pattern" viewBox="0 0 160 24" preserveAspectRatio="none" focusable="false">${heights.map((height,index)=>`<path d="M${8+index*9} ${(24-height)/2}v${height}"/>`).join('')}</svg>`;
};
const sourceMark=kind=>kind==='x'?'<img src="assets/x-logo.png" alt="X" class="flow-x-logo">':`<span class="flow-launch-mark" role="img" aria-label="New coins">${icon(icons.launch)}</span>`;
const source=(kind,title,caption)=>`<div class="flow-source flow-source-${kind}"><div class="flow-source-label">${sourceMark(kind)}<h3>${title}</h3></div><div class="flow-scan-window" aria-hidden="true">${scanPattern(kind)}<span class="flow-scan-beam"></span><span class="flow-scan-coin" data-flow-scan-coin></span></div><p data-flow-source-caption data-running-caption="${esc(caption)}">${readFlowPause()?'Paused':esc(caption)}</p></div>`;
const matchingActivity=()=>{
 const routes=[
  {from:8,to:36,path:'M8 8H43C79 8 109 36 145 36H180'},
  {from:22,to:8,path:'M8 22H43C79 22 109 8 145 8H180'},
  {from:36,to:22,path:'M8 36H43C79 36 109 22 145 22H180'}
 ];
 const activeRoute=(route,index,phase)=>`<g class="flow-route-active flow-route-${phase} flow-route-${phase}-${index+1}"><path d="${route.path}"/><circle cx="8" cy="${route.from}" r="4"/><circle cx="180" cy="${route.to}" r="4"/><circle class="flow-route-dot" cx="8" cy="${route.from}" r="1.5"/><circle class="flow-route-dot" cx="180" cy="${route.to}" r="1.5"/></g>`;
 return `<span class="flow-activity-veil flow-match-network" aria-hidden="true"><svg viewBox="0 0 188 44" fill="none" focusable="false">${routes.map((route,index)=>`<g class="flow-match-route"><path class="flow-route-track" d="${route.path}"/><circle class="flow-route-node" cx="8" cy="${route.from}" r="4"/><circle class="flow-route-node" cx="180" cy="${route.to}" r="4"/>${activeRoute(route,index,'scan')}</g>`).join('')}${routes.map((route,index)=>activeRoute(route,index,'confirm')).join('')}</svg></span>`;
};
const checkProgress=live=>`<span class="flow-activity-veil flow-check-progress" aria-hidden="true">${(live?[1,2,3,4]:[1,2,3]).map(step=>`<span class="flow-check-item"><span class="flow-check-step flow-check-step-${step}">${icon('<path d="m6 12 4 4 8-9"/>','flow-tick')}</span>${live?`<span class="flow-check-label">${['Liq','Cap','Age','Safe'][step-1]}</span>`:''}</span>`).join('')}</span>`;

export function scannerFlowHTML(name='Soltech scanner',config=null){
 const live=hosted(),total=word=>live?`Waiting for the latest scan`:`0 ${word} in this preview`;
 const limits=live&&config?limitSummary(scannerLimits(config).limits):[];
 const subtitle=live?`New coins${limits.length?' · '+limits.slice(0,3).join(' · ')+(limits.length>3?` · +${limits.length-3} more`:''):' · no limits'}`:'Posts + new projects';
 return `<section class="scanner-engine" data-paused="${live||readFlowPause()}" data-live="${live}" aria-labelledby="scanner-engine-title">
  <header class="engine-header"><div><h2 id="scanner-engine-title">${esc(name||'Soltech scanner')}</h2><p data-flow-subtitle>${esc(subtitle)}</p></div><span class="engine-status" role="status" aria-label="${live?'Scan activity':'Demo activity'}"><span class="engine-status-dot" aria-hidden="true"></span><span data-flow-status>${live?'Connecting':readFlowPause()?'Inactive':'Active'}</span></span></header>
  <div class="engine-flow" role="group" aria-label="${live?'New coins are scanned every minute. Each new coin is shown going through Match signals, then Coin checks and your filters, then Finds. Post is not connected yet.':'Post and New projects scan independently. Demo signals alternate between the two sources, following their own branch into Match signals, then Coin checks, then Finds.'}">
   <div class="flow-sources"><svg class="flow-source-link" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 0L100 100M0 100L100 0"/></svg>${source('x','Post',live?'Not connected yet':'Scanning posts')}${source('pairs','New projects',live?'Waiting for the scan':'Scanning projects')}</div>
   <div class="flow-merge" aria-hidden="true"><svg viewBox="0 0 320 72" preserveAspectRatio="none" focusable="false">${pathLayer('M77 0V14Q77 32 95 32H160')}${pathLayer('M243 0V14Q243 32 225 32H160')}${pathLayer('M160 32V72')}<g class="flow-packet-veil"><path class="flow-packet flow-packet-source-x" pathLength="100" d="M77 0V14Q77 32 95 32H160V72"/><path class="flow-packet flow-packet-source-pairs" pathLength="100" d="M243 0V14Q243 32 225 32H160V72"/></g></svg></div>
   <ol class="flow-stages">
    <li><div class="flow-stage flow-stage-match"><div class="flow-stage-copy"><h3>Match signals</h3>${live?'<p class="flow-stage-note" data-flow-note="match">Pair lookup</p>':''}${matchingActivity()}</div><span class="flow-stage-total" data-flow-total="matched" aria-label="${total('matched')}"><strong>0</strong><span>${live?'tracked':'matched'}</span></span></div>${connector('match')}</li>
    <li><div class="flow-stage flow-stage-check"><div class="flow-stage-copy"><h3>Coin checks</h3><p data-flow-note="check">${live?'Market, contract + your filters':'Apply your filters'}</p>${checkProgress(live)}</div><span class="flow-stage-total" data-flow-total="checked" aria-label="${total('checked')}"><strong>0</strong><span>${live?'new this scan':'checked'}</span></span></div>${connector('check')}</li>
    <li><a href="#finds" class="flow-stage flow-stage-finds" aria-label="Open Finds, 0 finds"><h3>Finds</h3>${live?'<span class="flow-finds-arrival" data-flow-arrival aria-hidden="true"></span>':''}<span class="flow-find-count" aria-hidden="true">0</span></a></li>
   </ol>
  </div>
  <footer class="engine-footer">${live?'<div class="engine-scan-clock" aria-hidden="true"><span class="engine-scan-label" data-flow-next-label>Next scan</span><span class="engine-scan-track"><span data-flow-progress></span></span><span class="engine-scan-time" data-flow-next>—</span></div>':''}<p class="engine-demo-note" aria-live="off">${live?'Loading the latest scan…':'Demo preview · Live scanning isn’t connected.'}</p><div class="engine-controls"><a href="#scanner/edit" class="engine-control">${icon(icons.sliders)}Customize</a><button type="button" class="engine-control" data-flow-pause aria-label="Pause demo">${icon(icons.pause)}<span>Pause</span></button></div></footer>
 </section>`;
}

// The side panel on the hosted Scanner page: what the scanner just did, the filters it used, and the last day's totals.
export function scannerActivityHTML(){
 return `<aside class="scanner-activity" aria-labelledby="scanner-activity-title">
  <section class="activity-card activity-scan" aria-labelledby="scan-coin-title"><div class="activity-head"><h2 id="scan-coin-title">Scan a coin</h2><span class="activity-live">Solana · Base</span></div><form class="activity-scan-form" data-scan-form novalidate><label class="sr-only" for="scan-coin-address">Token address</label><input id="scan-coin-address" data-scan-input type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="64" placeholder="Paste a token address"><button type="submit" class="activity-scan-button">Scan</button></form><p class="activity-scan-message" data-scan-message role="status" aria-live="polite"></p><div data-scan-result></div></section>
  <section class="activity-card activity-filters"><div class="activity-head"><h2>Your filters</h2><a href="#scanner/edit" class="text-link">Edit</a></div><ul class="activity-chips" data-activity-filters><li>Loading…</li></ul><p class="activity-fine" data-activity-unsupported hidden></p></section>
  <section class="activity-card activity-log"><div class="activity-head"><h2 id="scanner-activity-title">Live activity</h2><span class="activity-live" data-activity-clock></span></div><ol class="activity-list" data-activity-list aria-live="polite" aria-relevant="additions"><li class="activity-empty">Waiting for the latest scan…</li></ol><a class="activity-more" href="#finds">Open Feed</a></section>
  <section class="activity-card activity-totals"><h2 class="sr-only">Scan totals</h2><dl data-activity-totals><div><dt>Coins tracked</dt><dd>—</dd></div><div><dt>In your finds</dt><dd>—</dd></div><div><dt>New this scan</dt><dd>—</dd></div></dl></section>
 </aside>`;
}

export function mountScannerFlow(root,{getConfig=()=>null}={}){
 const engine=root.querySelector('.scanner-engine');if(!engine)return ()=>{};
 const button=engine.querySelector('[data-flow-pause]'),note=engine.querySelector('.engine-demo-note'),status=engine.querySelector('[data-flow-status]');
 const sources=engine.querySelector('.flow-sources'),sourceLink=sources.querySelector('.flow-source-link');
 const leftSource=sources.querySelector('.flow-source-x'),rightSource=sources.querySelector('.flow-source-pairs');
 const leftWindow=leftSource.querySelector('.flow-scan-window'),rightWindow=rightSource.querySelector('.flow-scan-window');
 const alignSourceLink=()=>{
  const row=sources.getBoundingClientRect(),left=leftSource.getBoundingClientRect(),right=rightSource.getBoundingClientRect();
  const first=leftWindow.getBoundingClientRect(),second=rightWindow.getBoundingClientRect();
  const firstTop=first.top+first.height*.25,firstBottom=first.bottom-first.height*.25;
  const secondTop=second.top+second.height*.25,secondBottom=second.bottom-second.height*.25;
  const top=Math.min(firstTop,secondTop),height=Math.max(firstBottom,secondBottom)-top,gap=right.left-left.right;
  if(gap<=0||height<=0)return;
  Object.assign(sourceLink.style,{left:`${left.right-row.left}px`,top:`${top-row.top}px`,width:`${gap}px`,height:`${height}px`});
  sourceLink.setAttribute('viewBox',`0 0 ${gap} ${height}`);
  sourceLink.querySelector('path').setAttribute('d',`M0 ${firstTop-top}L${gap} ${secondBottom-top}M0 ${firstBottom-top}L${gap} ${secondTop-top}`);
 };
 const sourceResize=new ResizeObserver(alignSourceLink);
 [sources,leftSource,rightSource,leftWindow,rightWindow].forEach(element=>sourceResize.observe(element));
 alignSourceLink();
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 let userPaused=readFlowPause();
 const live=hosted(),CYCLE_MS=live?LIVE_CYCLE_MS:DEMO_CYCLE_MS;
 // Hosted: each cycle carries one real coin. Coins that arrived since the page opened go first, then the latest few replay.
 let scan=null,liveState=live?'loading':'off',pending=[],injected=[],replay=[],replayAt=0,lastCycle=-1,coin=null,verdict=null,paintTimer=0,gone=false,unsubscribe=()=>{},matched=0,processed=new Set();
 const findsStage=engine.querySelector('.flow-stage-finds'),findCount=engine.querySelector('.flow-find-count'),arrival=engine.querySelector('[data-flow-arrival]');
 const postCaption=leftSource.querySelector('[data-flow-source-caption]'),pairsCaption=rightSource.querySelector('[data-flow-source-caption]'),stepEls=[...engine.querySelectorAll('.flow-check-step')];
 const scanCoin=rightSource.querySelector('[data-flow-scan-coin]'),matchNote=engine.querySelector('[data-flow-note="match"]'),checkNote=engine.querySelector('[data-flow-note="check"]'),progress=engine.querySelector('[data-flow-progress]'),nextTime=engine.querySelector('[data-flow-next]'),nextLabel=engine.querySelector('[data-flow-next-label]'),clockBox=engine.querySelector('.engine-scan-clock');
 const panel=root.querySelector('.scanner-activity');
 const say=(element,text)=>{if(element&&element.textContent!==text)element.textContent=text;};
 const setTotal=(key,count,label)=>{const total=engine.querySelector(`[data-flow-total="${key}"]`);if(!total)return;say(total.querySelector('strong'),String(count));total.setAttribute('aria-label',label);};
 const scanAge=()=>Date.now()-Date.parse(scan.updatedAt);
 const late=()=>{const due=nextScanAt(scan);return !!due&&Date.now()-due>150000;};
 const untilNext=()=>{const due=nextScanAt(scan);return due?due-Date.now():null;};
 const summary=()=>{
  const checked=scan.run?.checked??scan.coins.length,fresh=scan.run?.newCount??0;
  return `Last scan ${ago(scanAge())} · ${checked} coins checked · ${fresh} new`;
 };
 const update=()=>{
  const waiting=live&&!['ready','stale'].includes(liveState);
  const paused=userPaused||reduced.matches||waiting;
  engine.dataset.paused=String(paused);engine.dataset.reducedMotion=String(reduced.matches);
  status.textContent=live?(liveState==='loading'?'Connecting':liveState==='error'?'Offline':liveState==='empty'?'No results':userPaused?'Paused':liveState==='stale'?'Reconnecting':late()?'Delayed':'Live'):(paused?'Inactive':'Active');
  engine.dataset.state=live?liveState:'demo';
  if(!live)engine.querySelectorAll('[data-flow-source-caption]').forEach(caption=>{caption.textContent=paused?'Paused':caption.dataset.runningCaption;});
  button.innerHTML=icon(paused&&!waiting?icons.play:icons.pause)+`<span>${paused&&!waiting?'Resume':'Pause'}</span>`;
  button.setAttribute('aria-label',live?(paused?'Resume the scan view':'Pause the scan view'):(paused?'Resume demo':'Pause demo'));button.hidden=reduced.matches||waiting;
  if(!live)note.textContent=reduced.matches?'Static preview · Live scanning isn’t connected.':paused?'Demo paused · Live scanning isn’t connected.':'Demo preview · Live scanning isn’t connected.';
  else{
   say(postCaption,'Not connected yet');
   if(waiting){
    say(note,liveState==='loading'?'Loading the latest scan…':liveState==='error'?'The scan service can’t be reached right now. Retrying every 15 seconds.':'The last scan returned no coins.');
    say(pairsCaption,'Waiting for the scan');
   }else paint();
  }
 };
 // Animations are driven by CSS; the Finds highlight is the shared clock that tells us where in the cycle we are.
 const clock=()=>{const run=findsStage.getAnimations?.().find(a=>a.animationName==='flow-finds-highlight');return run?Number(run.currentTime)||0:null;};
 const nextCoin=()=>{
  if(injected.length)return {coin:injected.shift(),fresh:true,yours:true};
  while(pending.length){const id=pending.shift(),found=scan.coins.find(c=>c.id===id);if(found)return {coin:found,fresh:true};}
  if(!replay.length)return null;
  const item=replay[replayAt%replay.length];replayAt++;return {coin:item,fresh:false};
 };
 const show=next=>{
  coin=next.coin;coin.__fresh=next.fresh;coin.__yours=!!next.yours;verdict=matchCoin(coin,getConfig());processed.add(coin.id);
  engine.dataset.outcome=verdict.match?'kept':'excluded';
  const steps=stepsOf(coin);
  stepEls.forEach((element,index)=>{const result=glyph[steps[index]?.status]?steps[index].status:'unknown';element.dataset.result=result;element.innerHTML=icon(glyph[result],'flow-tick');element.parentElement.title=steps[index]?.text||'';});
  if(scanCoin)scanCoin.innerHTML=`${coinBadge(coin)}<span>${esc(coin.symbol||coin.name||'')}</span>`;
  if(arrival)arrival.innerHTML=verdict.match?`+1 <strong>${esc(coin.symbol||coin.name||'')}</strong>`:'';
  markActivity();
 };
 function paint(){
  if(gone||!scan)return;
  const next=untilNext(),every=(Number(scan.run?.every)||60)*1000;
  // Footer: a real countdown to the server's next scheduled scan. Past due, it shows the scan is running.
  if(progress){
   const due=next!=null&&next<=0;
   clockBox.dataset.state=late()?'late':due?'scanning':'waiting';
   progress.style.width=due?'100%':`${Math.max(0,Math.min(100,100-(next/every)*100))}%`;
   say(nextLabel,late()?'Scan delayed':due?'Scanning':'Next scan');
   say(nextTime,due?'…':`${Math.ceil(next/1000)}s`);
  }
  const total=`${scan.coins.length} coins tracked`;
  if(userPaused&&!reduced.matches){say(note,'Paused on this screen. The server keeps scanning every minute.');say(pairsCaption,'Paused');return;}
  const time=clock();
  if(time===null){say(note,summary());say(pairsCaption,total);return;}
  const cycle=Math.floor(time/CYCLE_MS),at=(time%CYCLE_MS)/CYCLE_MS;
  if(cycle!==lastCycle||!coin){lastCycle=cycle;const next=nextCoin();if(next)show(next);}
  if(!coin)return;
  const label=tickerOf(coin),steps=stepsOf(coin),where=chainName(coin.chain||coin.category),pool=coin.dex?dexName(coin.dex):'';
  engine.dataset.phase=at<.25?'receive':at<.5?'match':at<.82?'check':'deliver';
  say(pairsCaption,at<.3?`${label} · ${where}`:total);
  say(matchNote,at>=.25&&at<.82?`${label} · ${pool?`${pool} pool`:'deepest pool'}`:'Pair lookup');
  say(checkNote,at<.5?'Market, contract + your filters':at<.55?`Checking ${label}`:at<.62?steps[0]?.text||'Liquidity':at<.69?steps[1]?.text||'Market cap':at<.76?steps[2]?.text||'Age':at<.82?steps[3]?.text||'Contract':verdict?.match?'Fits your filters':verdict?.reason||'Left out');
  say(note,
   at<.12?summary():
   at<.25?`${coin.__yours?'Your coin':coin.__fresh?'New':'Recent'}: ${coin.name}${coin.symbol&&coin.symbol!==coin.name?` (${label})`:''} on ${where}${coin.stage==='curve'?', still on its launchpad':''}`:
   at<.5?`Found the deepest ${label} pool${pool?` on ${pool}`:''}`:
   at<.82?`Checking ${label} · ${riskLabel[coin.risk]||riskLabel.unknown}`:
   verdict?.match?`${label} added to your finds`:`${label} left out · ${verdict?.reason||'outside your filters'}`);
 }
 // Side panel.
 const markActivity=()=>{panel?.querySelectorAll('[data-activity-coin]').forEach(li=>li.classList.toggle('is-current',li.dataset.activityCoin===coin?.id));};
 function renderPanel(){
  if(!panel)return;
  const config=getConfig(),prepared=scannerLimits(config),result=scan?matchScan(scan.coins,config):null;
  const chips=panel.querySelector('[data-activity-filters]'),unsupported=panel.querySelector('[data-activity-unsupported]');
  const parts=[...(prepared.projectsOn?['New coins']:['New coins off']),...limitSummary(prepared.limits)];
  chips.innerHTML=parts.map(text=>`<li>${esc(text)}</li>`).join('')+(prepared.limits.length?'':'<li class="is-muted">No limits</li>');
  unsupported.hidden=!prepared.unsupported.length;unsupported.textContent=prepared.unsupported.length?`Not applied yet: ${prepared.unsupported.join(', ')}.`:'';
  if(!result)return;
  const list=panel.querySelector('[data-activity-list]'),recent=[...scan.coins].sort((a,b)=>(Date.parse(b.firstSeenAt)||0)-(Date.parse(a.firstSeenAt)||0)).slice(0,10);
  const verdicts=new Map([...result.matched,...result.skipped].map(item=>[item.coin.id,item]));
  list.innerHTML=recent.map(c=>{const v=verdicts.get(c.id);return `<li data-activity-coin="${esc(c.id)}" class="${c.id===coin?.id?'is-current':''}">${coinBadge(c,'activity-badge')}<span class="activity-copy"><strong>${esc(c.symbol||c.name)}</strong><span>${v?.match?'Added to your finds':esc(v?.reason||'Left out')}</span></span><span class="activity-tag ${v?.match?'is-kept':'is-skipped'}">${v?.match?'Find':'Skipped'}</span><time datetime="${esc(c.firstSeenAt||'')}">${esc(ago(Date.now()-(Date.parse(c.firstSeenAt)||Date.now())))}</time></li>`;}).join('')||'<li class="activity-empty">No coins yet.</li>';
  const totals=panel.querySelector('[data-activity-totals]');
  totals.innerHTML=`<div><dt>Coins tracked</dt><dd>${scan.coins.length}</dd></div><div><dt>In your finds</dt><dd>${result.matched.length}</dd></div><div><dt>New this scan</dt><dd>${scan.run?.newCount??0}</dd></div>`;
 }
 const tickPanel=()=>{const el=panel?.querySelector('[data-activity-clock]');if(el&&scan)say(el,liveState==='stale'?'Reconnecting':`Updated ${ago(scanAge())}`);panel?.querySelectorAll('[data-activity-list] time').forEach(t=>{const at=Date.parse(t.getAttribute('datetime'));if(at)say(t,ago(Date.now()-at));});};
 const onScan=s=>{
  if(gone)return;
  liveState=s.status==='idle'?'loading':s.status;
  if(s.scan&&s.scan!==scan){
   const first=!scan;scan=s.scan;
   // New arrivals jump the queue, newest first; the replay list is the latest few.
   const arrived=first?[]:s.arrived.filter(id=>!processed.has(id));
   pending=[...arrived,...pending.filter(id=>!arrived.includes(id))].slice(0,30);
   replay=[...scan.coins].sort((a,b)=>(Date.parse(b.firstSeenAt)||0)-(Date.parse(a.firstSeenAt)||0)).slice(0,REPLAY_COUNT);
   if(first)replayAt=0;
   const result=matchScan(scan.coins,getConfig());matched=result.matched.length;
   if(findCount)findCount.textContent=String(matched);findsStage.setAttribute('aria-label',`Open Feed, ${matched} coins fit your scanner`);
   setTotal('matched',scan.coins.length,`${scan.coins.length} coins tracked by the scan`);
   setTotal('checked',scan.run?.newCount??0,`${scan.run?.newCount??0} new coins in the latest scan`);
   renderPanel();
  }
  update();tickPanel();
 };
 // Scan a coin: price it now, show the verdict beside the flow, and send it through the flow next.
 const scanForm=panel?.querySelector('[data-scan-form]'),scanInput=panel?.querySelector('[data-scan-input]'),scanMessage=panel?.querySelector('[data-scan-message]'),scanResult=panel?.querySelector('[data-scan-result]');
 const resultHTML=(c,v)=>{
  const watching=window.soltechWatchlist?.has(c.id),steps=stepsOf(c);
  return `<div class="scan-result ${v.match?'is-kept':'is-skipped'}"><div class="scan-result-head">${coinBadge(c,'activity-badge')}<span class="activity-copy"><strong>${esc(c.name||c.symbol)}</strong><span>${esc(tickerOf(c))} · ${esc(chainName(c.chain))}${c.marketCap||c.fdv?` · MC ${esc(new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(c.marketCap||c.fdv))}`:''}</span></span><span class="activity-tag ${v.match?'is-kept':'is-skipped'}">${v.match?'Fits':'Skipped'}</span></div><p class="scan-result-verdict">${v.match?'Fits your filters. It would reach your finds.':esc(v.reason||'Outside your filters')}</p><ul class="scan-result-checks">${steps.map(step=>`<li data-result="${esc(step.status)}">${icon(glyph[step.status]||glyph.unknown)}<span>${esc(step.text)}</span></li>`).join('')}</ul><div class="scan-result-actions">${window.soltechWatchlist?`<button type="button" class="feed-watch-button" data-scan-watch aria-pressed="${!!watching}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.6Z"/></svg><span>${watching?'Watching':'Watch'}</span></button>`:''}<a class="feed-check-link" href="#check/${esc(c.chain)}/${esc(c.address)}">Full report</a></div></div>`;
 };
 let scanned=null;
 const onScanSubmit=async event=>{
  event.preventDefault();
  const address=scanInput.value.trim(),chain=networkOf(address);
  if(!chain){scanMessage.textContent='Paste a full Solana address or a 0x Base address.';scanMessage.dataset.tone='error';scanInput.focus();return;}
  scanMessage.textContent='Scanning…';scanMessage.dataset.tone='';scanForm.querySelector('button').disabled=true;
  try{
   const [found]=await lookupCoins([{chain,address}]);
   if(gone)return;
   if(!found?.found){scanMessage.textContent='No market has this coin yet. Try again once it starts trading.';scanMessage.dataset.tone='error';scanResult.innerHTML='';return;}
   scanned=found;const v=matchCoin(found,getConfig());
   scanResult.innerHTML=resultHTML(found,v);
   injected=[found,...injected.filter(c=>c.id!==found.id)];
   scanMessage.textContent=userPaused?'Resume the scanner to watch it go through the flow.':'Up next in the scanner.';scanMessage.dataset.tone='';
   scanInput.value='';
  }catch(error){scanMessage.textContent=error.message;scanMessage.dataset.tone='error';}
  finally{scanForm.querySelector('button').disabled=false;}
 };
 const onScanClick=event=>{
  const watch=event.target.closest('[data-scan-watch]');if(!watch||!scanned||!window.soltechWatchlist)return;
  const on=window.soltechWatchlist.toggle({address:scanned.address,name:scanned.name,symbol:scanned.symbol});
  watch.setAttribute('aria-pressed',String(on));watch.querySelector('span').textContent=on?'Watching':'Watch';
 };
 scanForm?.addEventListener('submit',onScanSubmit);scanResult?.addEventListener('click',onScanClick);
 const toggle=()=>{if(reduced.matches)return;userPaused=!userPaused;saveFlowPause(userPaused);update();};
 const change=()=>update();
 button.addEventListener('click',toggle);reduced.addEventListener('change',change);update();
 let panelTimer=0;
 if(live){unsubscribe=subscribeLiveScan(onScan);paintTimer=window.setInterval(()=>{if(['ready','stale'].includes(liveState))paint();},200);panelTimer=window.setInterval(tickPanel,5000);}
 return ()=>{gone=true;unsubscribe();scanForm?.removeEventListener('submit',onScanSubmit);scanResult?.removeEventListener('click',onScanClick);window.clearInterval(paintTimer);window.clearInterval(panelTimer);sourceResize.disconnect();button.removeEventListener('click',toggle);reduced.removeEventListener('change',change);};
}
