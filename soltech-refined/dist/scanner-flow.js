const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
import {getScannerClient} from './scanner-client.js';
const icon=(paths,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
const icons={
 pause:'<path d="M8 5v14M16 5v14" stroke-width="2.2"/>',
 play:'<path d="m8 5 11 7-11 7V5Z"/>',
 sliders:'<path d="M4 7h5m4 0h7M4 17h9m4 0h3"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>'
};
const pathLayer=(path,kind)=>`<path class="flow-channel-halo" d="${path}"/><path class="flow-channel-line" d="${path}"/>${kind?`<g class="flow-packet-veil"><path class="flow-packet ${kind}" pathLength="100" d="${path}"/></g>`:''}`;
const connector=stage=>`<div class="flow-connector" aria-hidden="true"><svg viewBox="0 0 320 48" preserveAspectRatio="none" focusable="false">${pathLayer('M160 0V48','flow-packet-'+stage)}</svg></div>`;
const scanPattern=kind=>{
 const heights=[5,10,7,15,9,18,12,6,15,8,17,10,14,6,12,18,8];
 if(kind==='pairs')heights.reverse();
 return `<svg class="flow-scan-pattern" viewBox="0 0 160 24" preserveAspectRatio="none" focusable="false">${heights.map((height,index)=>`<path d="M${8+index*9} ${(24-height)/2}v${height}"/>`).join('')}</svg>`;
};
const source=(kind,title)=>`<div class="flow-source flow-source-${kind}" data-source-active="false"><div class="flow-source-label">${kind==='x'?'<img src="assets/x-logo.png" alt="" class="flow-x-logo">':icon('<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v9m8-4.5L12 12 4 7.5m8 4.5v9"/>')}<h3>${title}</h3></div><div class="flow-scan-window" aria-hidden="true">${scanPattern(kind)}<span class="flow-scan-beam"></span></div><p data-flow-source-caption="${kind}">${kind==='x'?'Not connected':'Ready'}</p></div>`;
const matchingActivity=()=>{
 const routes=[
  {from:8,to:36,path:'M8 8H43C79 8 109 36 145 36H180'},
  {from:22,to:8,path:'M8 22H43C79 22 109 8 145 8H180'},
  {from:36,to:22,path:'M8 36H43C79 36 109 22 145 22H180'}
 ];
 const activeRoute=(route,index,phase)=>`<g class="flow-route-active flow-route-${phase} flow-route-${phase}-${index+1}"><path d="${route.path}"/><circle cx="8" cy="${route.from}" r="4"/><circle cx="180" cy="${route.to}" r="4"/><circle class="flow-route-dot" cx="8" cy="${route.from}" r="1.5"/><circle class="flow-route-dot" cx="180" cy="${route.to}" r="1.5"/></g>`;
 return `<span class="sr-only">Compare post evidence with candidate coins.</span><span class="flow-activity-veil flow-match-network" aria-hidden="true"><svg viewBox="0 0 188 44" fill="none" focusable="false">${routes.map((route,index)=>`<g class="flow-match-route"><path class="flow-route-track" d="${route.path}"/><circle class="flow-route-node" cx="8" cy="${route.from}" r="4"/><circle class="flow-route-node" cx="180" cy="${route.to}" r="4"/>${activeRoute(route,index,'scan')}</g>`).join('')}${routes.map((route,index)=>activeRoute(route,index,'confirm')).join('')}</svg></span>`;
};
const checkProgress=()=>`<span class="flow-activity-veil flow-check-progress" aria-hidden="true">${[1,2,3].map(step=>`<span class="flow-check-step flow-check-step-${step}">${icon('<path d="m6 12 4 4 8-9"/>','flow-tick')}</span>`).join('')}</span>`;

export function scannerFlowHTML(name='Coin discovery'){
 return `<section class="scanner-engine" data-live="true" data-paused="true" aria-labelledby="scanner-engine-title">
  <header class="engine-header"><div><h2 id="scanner-engine-title">${esc(name||'Coin discovery')}</h2><p>Discover · Match · Check</p></div><span class="engine-status" role="status" aria-label="Scanner status"><span class="engine-status-dot" aria-hidden="true"></span><span data-flow-status>Connecting</span></span></header>
  <div class="engine-flow" role="group" aria-label="X posts and new markets, with matching, coin checks and Feed results.">
   <div class="flow-sources"><svg class="flow-source-link" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 0L100 100M0 100L100 0"/></svg>${source('x','X post')}${source('pairs','New projects')}</div>
   <div class="flow-merge" aria-hidden="true"><svg viewBox="0 0 320 72" preserveAspectRatio="none" focusable="false">${pathLayer('M77 0V14Q77 32 95 32H160')}${pathLayer('M243 0V14Q243 32 225 32H160')}${pathLayer('M160 32V72')}<g class="flow-packet-veil"><path class="flow-packet flow-packet-source-x" pathLength="100" d="M77 0V14Q77 32 95 32H160V72"/><path class="flow-packet flow-packet-source-pairs" pathLength="100" d="M243 0V14Q243 32 225 32H160V72"/></g></svg></div>
   <ol class="flow-stages">
    <li><div class="flow-stage flow-stage-match"><div class="flow-stage-copy"><h3>Match signals</h3>${matchingActivity()}</div><span class="flow-stage-total"><strong data-flow-count="matched">0</strong><span>matched</span></span></div>${connector('match')}</li>
    <li><div class="flow-stage flow-stage-check"><div class="flow-stage-copy"><h3>Coin checks</h3><p data-flow-check-note>Waiting for coins</p>${checkProgress()}</div><span class="flow-stage-total"><strong data-flow-count="checked">0</strong><span>checked</span></span></div>${connector('check')}</li>
    <li><a href="#finds" class="flow-stage flow-stage-finds" aria-label="Open Feed, 0 finds"><h3>Finds</h3><span class="flow-find-count" aria-hidden="true">0</span></a></li>
   </ol>
  </div>
  <footer class="engine-footer"><p class="engine-demo-note" role="status">Connecting to your local scanner…</p><p class="engine-service-note">X access is not connected. New projects currently discovers new Solana markets.</p><div class="engine-controls"><a href="#scanner/edit" class="engine-control">${icon(icons.sliders)}Customize</a><button type="button" class="engine-control" data-flow-pause disabled aria-label="Start scanner">${icon(icons.play)}<span>Start</span></button></div><p class="engine-run-note">Runs while this local service is open, even if you leave this page.</p></footer>
 </section>`;
}

export function mountScannerFlow(root,{client=getScannerClient(),getConfig=()=>undefined,toast=()=>{}}={}){
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
 let snapshot=client.state,busy=false,disposed=false,commandError='';
 const update=value=>{
  snapshot=value||snapshot;
  const connected=snapshot.connection?.status==='connected',running=snapshot.status==='running';
  const projects=snapshot.sources.projects,posts=snapshot.sources.posts;
  const projectActive=connected&&running&&projects.status==='running',postActive=connected&&running&&posts.status==='running';
  engine.dataset.paused=String(!connected||!running);engine.dataset.reducedMotion=String(reduced.matches);
  engine.dataset.postsActive=String(postActive);engine.dataset.projectsActive=String(projectActive);
  engine.dataset.connection=snapshot.connection?.status||'connecting';
  engine.dataset.checking=String(connected&&running&&snapshot.groups.some(group=>group.coins.some(coin=>coin.stage==='checking')));
  status.textContent=!connected?(snapshot.connection?.status==='offline'?'Offline':'Connecting'):running?(projectActive||postActive?'Active':'Waiting'):'Inactive';
  const caption=(source,active)=>active?'Scanning':source.status==='disconnected'?'Not connected':source.status==='error'?'Retrying':running?'Waiting':'Paused';
  leftSource.dataset.sourceActive=String(postActive);rightSource.dataset.sourceActive=String(projectActive);
  leftSource.querySelector('[data-flow-source-caption]').textContent=caption(posts,postActive);
  rightSource.querySelector('[data-flow-source-caption]').textContent=caption(projects,projectActive);
  for(const key of ['matched','checked']){const value=Math.max(0,Number(snapshot.counts[key])||0);engine.querySelector(`[data-flow-count="${key}"]`).textContent=String(value);}
  const count=Math.max(0,Number(snapshot.counts.finds)||0);
  engine.querySelector('.flow-find-count').textContent=String(count);
  engine.querySelector('.flow-stage-finds').setAttribute('aria-label',`Open Feed, ${count} finds`);
  const coins=snapshot.groups.flatMap(group=>group.coins),latest=coins.filter(coin=>coin.checks?.checkedAt).sort((a,b)=>Date.parse(b.checks.checkedAt)-Date.parse(a.checks.checkedAt))[0];
  const items=latest?.checks?.items||[];
  engine.querySelectorAll('.flow-check-step').forEach((step,index)=>{step.dataset.checkState=items[index]?.status||'pending';});
  engine.querySelector('[data-flow-check-note]').textContent=engine.dataset.checking==='true'?'Checking mint data':latest?'Latest coin checks':'Waiting for coins';
  button.innerHTML=icon(running?icons.pause:icons.play)+`<span>${busy?'Working…':running?'Pause':'Start'}</span>`;
  button.setAttribute('aria-label',running?'Pause scanner':'Start scanner');button.disabled=busy||(!connected&&!running);
  note.textContent=commandError||(!connected?snapshot.connection?.message:snapshot.persistenceError||snapshot.message)||(running?'Discovering new markets…':'Start to discover new markets.');
  engine.querySelector('.engine-service-note').textContent=posts.status==='disconnected'?'X access is not connected. New projects discovers new Solana markets.':posts.message||'Post matches and market listings appear in Feed as they arrive.';
 };
 const toggle=async()=>{
  if(busy)return;busy=true;commandError='';update();
  try{if(snapshot.status==='running')await client.pause();else await client.start(getConfig());}
  catch(error){if(!disposed){commandError=error.message||'Scanner request failed. Try again.';toast(commandError);}}
  finally{if(!disposed){busy=false;update(client.state);}}
 };
 const change=()=>update();
 button.addEventListener('click',toggle);reduced.addEventListener('change',change);
 const unsubscribe=client.subscribe(update);
 return ()=>{disposed=true;unsubscribe();sourceResize.disconnect();button.removeEventListener('click',toggle);reduced.removeEventListener('change',change);};
}
