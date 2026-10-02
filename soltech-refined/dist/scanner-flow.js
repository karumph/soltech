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
const icon=(paths,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
const icons={
 pause:'<path d="M8 5v14M16 5v14" stroke-width="2.2"/>',
 play:'<path d="m8 5 11 7-11 7V5Z"/>',
 sliders:'<path d="M4 7h5m4 0h7M4 17h9m4 0h3"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>'
};
const pathLayer=(path,kind)=>`<path class="flow-channel-halo" d="${path}"/><path class="flow-channel-line" d="${path}"/>${kind?`<g class="flow-packet-veil"><path class="flow-packet ${kind}" pathLength="100" d="${path}"/></g>`:''}`;
const connector=stage=>`<div class="flow-connector" aria-hidden="true"><svg viewBox="0 0 320 48" preserveAspectRatio="none" focusable="false">${pathLayer('M160 0V48','flow-packet-'+stage)}</svg></div>`;
const source=(kind,title,caption)=>`<div class="flow-source flow-source-${kind}"><div class="flow-source-label"><img src="assets/x-logo.png" alt="X" class="flow-x-logo"><h3>${title}</h3></div><div class="flow-scan-window" aria-hidden="true"><span class="flow-scan-line"></span><i></i><i></i><i></i><span class="flow-scan-beam"></span></div><p>${caption}</p></div>`;
const xCoin=()=>'<span class="flow-x-coin"><img src="assets/x-logo.png" alt=""></span>';
const matchingActivity=()=>{
 const routes=[
  {from:8,to:36,path:'M8 8H43C79 8 109 36 145 36H180'},
  {from:22,to:8,path:'M8 22H43C79 22 109 8 145 8H180'},
  {from:36,to:22,path:'M8 36H43C79 36 109 22 145 22H180'}
 ];
 const activeRoute=(route,index,phase)=>`<g class="flow-route-active flow-route-${phase} flow-route-${phase}-${index+1}"><path d="${route.path}"/><circle cx="8" cy="${route.from}" r="4"/><circle cx="180" cy="${route.to}" r="4"/><circle class="flow-route-dot" cx="8" cy="${route.from}" r="1.5"/><circle class="flow-route-dot" cx="180" cy="${route.to}" r="1.5"/></g>`;
 return `<span class="sr-only">Compare incoming signals with candidate coins, then confirm a different matching connection each demo cycle.</span><span class="flow-activity-veil flow-match-network" aria-hidden="true"><svg viewBox="0 0 188 44" fill="none" focusable="false">${routes.map((route,index)=>`<g class="flow-match-route"><path class="flow-route-track" d="${route.path}"/><circle class="flow-route-node" cx="8" cy="${route.from}" r="4"/><circle class="flow-route-node" cx="180" cy="${route.to}" r="4"/>${activeRoute(route,index,'scan')}</g>`).join('')}${routes.map((route,index)=>activeRoute(route,index,'confirm')).join('')}</svg></span>`;
};
const checkProgress=()=>`<span class="flow-activity-veil flow-check-progress" aria-hidden="true">${[1,2,3].map(step=>`<span class="flow-check-step flow-check-step-${step}">${icon('<path d="m6 12 4 4 8-9"/>','flow-tick')}</span>`).join('')}</span>`;

export function scannerFlowHTML(name='Soltech scanner'){
 return `<section class="scanner-engine" data-paused="${readFlowPause()}" aria-labelledby="scanner-engine-title">
  <header class="engine-header"><div><h2 id="scanner-engine-title">${esc(name||'Soltech scanner')}</h2><p>Posts + new projects</p></div><span class="engine-status" role="status" aria-label="Demo activity"><span class="engine-status-dot" aria-hidden="true"></span><span data-flow-status>${readFlowPause()?'Inactive':'Active'}</span></span></header>
  <div class="engine-flow" role="group" aria-label="Post and New projects scan independently. Demo signals alternate between the two sources, following their own branch into Match signals, then Coin checks, then Finds.">
   <div class="flow-sources"><svg class="flow-source-link" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 0L100 100M0 100L100 0"/></svg>${source('x','Post','Scanning posts')}${source('pairs','New projects','Scanning projects')}</div>
   <div class="flow-merge" aria-hidden="true"><svg viewBox="0 0 320 72" preserveAspectRatio="none" focusable="false">${pathLayer('M77 0V14Q77 32 95 32H160')}${pathLayer('M243 0V14Q243 32 225 32H160')}${pathLayer('M160 32V72')}<g class="flow-packet-veil"><path class="flow-packet flow-packet-source-x" pathLength="100" d="M77 0V14Q77 32 95 32H160V72"/><path class="flow-packet flow-packet-source-pairs" pathLength="100" d="M243 0V14Q243 32 225 32H160V72"/></g></svg></div>
   <ol class="flow-stages">
    <li><div class="flow-stage flow-stage-match"><div class="flow-stage-copy"><h3>Match signals</h3>${matchingActivity()}</div></div>${connector('match')}</li>
    <li><div class="flow-stage flow-stage-check"><span class="flow-activity-veil" aria-hidden="true"><span class="flow-check-coin">${xCoin()}<span class="flow-check-sweep"></span></span></span><div class="flow-stage-copy"><h3>Coin checks</h3><span class="sr-only">Apply your filters</span>${checkProgress()}</div></div>${connector('check')}</li>
    <li><a href="#finds" class="flow-stage flow-stage-finds" aria-label="Open Finds, 0 finds"><h3>Finds</h3><span class="flow-find-count" aria-hidden="true">0</span></a></li>
   </ol>
  </div>
  <footer class="engine-footer"><p class="engine-demo-note">Demo preview · Live scanning isn’t connected.</p><div class="engine-controls"><a href="#scanner/edit" class="engine-control">${icon(icons.sliders)}Customize</a><button type="button" class="engine-control" data-flow-pause aria-label="Pause demo">${icon(icons.pause)}<span>Pause</span></button></div></footer>
 </section>`;
}

export function mountScannerFlow(root){
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
 const update=()=>{
  const paused=userPaused||reduced.matches;
  engine.dataset.paused=String(paused);engine.dataset.reducedMotion=String(reduced.matches);
  status.textContent=paused?'Inactive':'Active';
  button.innerHTML=icon(paused?icons.play:icons.pause)+`<span>${paused?'Resume':'Pause'}</span>`;
  button.setAttribute('aria-label',paused?'Resume demo':'Pause demo');button.hidden=reduced.matches;
  note.textContent=reduced.matches?'Static preview · Live scanning isn’t connected.':paused?'Demo paused · Live scanning isn’t connected.':'Demo preview · Live scanning isn’t connected.';
 };
 const toggle=()=>{if(reduced.matches)return;userPaused=!userPaused;saveFlowPause(userPaused);update();};
 const change=()=>update();
 button.addEventListener('click',toggle);reduced.addEventListener('change',change);update();
 return ()=>{sourceResize.disconnect();button.removeEventListener('click',toggle);reduced.removeEventListener('change',change);};
}
