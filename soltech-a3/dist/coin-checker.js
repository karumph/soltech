import {createLookupSession,formatMoney,safeImageUrl,validTokenAddress} from './coin-checker-data.js';
import {historyHTML,mountHistoryChart} from './coin-history.js';
import {NETWORKS,validEvmAddress} from './coin-networks.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=n=>n==null?'Unavailable':new Intl.NumberFormat('en-US').format(n);
const compact=n=>n==null?'Unavailable':n>0&&n<.01?n.toExponential(3):new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(n);
const percent=n=>n==null?'Unavailable':`${n>0?'+':''}${n.toLocaleString('en-US',{maximumFractionDigits:2})}%`;
const shareText=n=>n==null?'Unavailable':n>0&&n<.01?'<0.01%':`${n.toLocaleString('en-US',{maximumFractionDigits:2})}%`;
const share=n=>esc(shareText(n));
const time=n=>new Date(n).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const shortAddress=s=>`${s.slice(0,5)}…${s.slice(-5)}`;
const riskLabels={lower:'No flags reported',caution:'Caution',high:'High risk reported',unknown:'Not fully assessed'};
const riskPill=(level,label)=>`<span class="risk ${level}"><span class="risk-dot" aria-hidden="true"></span>${esc(label||riskLabels[level])}</span>`;
const networkOptions=selected=>'<option value="">Choose network</option>'+Object.entries(NETWORKS).filter(([,n])=>n.kind==='evm').map(([id,n])=>`<option value="${id}" ${id===selected?'selected':''}>${n.name}</option>`).join('');
const pending=state=>['market','risk','listing','history'].some(key=>['waiting','loading'].includes(state[key]?.status));
const welcomeHTML='';
let remembered=null,completedAt=0,rememberedSection='overview';
let rememberedChartView={range:'all',selected:null};
const reportSections=['overview','chart','details'];

function sourceLink(url,label,style='text-link',key=label){return `<a class="${style}" data-view-key="${esc(key)}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} <span aria-hidden="true">↗</span></a>`;}
function metric(label,value){return `<div><dt>${label}</dt><dd class="${value==='Unavailable'?'metric-missing':''}">${value}</dd></div>`;}
function coinAvatar(m,name,symbol){
 const image=safeImageUrl(m?.imageUrl);
 return `<span class="coin-avatar" aria-hidden="true"><span class="coin-monogram">${esc((symbol||name).slice(0,2))}</span>${image?`<img class="coin-logo-image" src="${esc(image)}" alt="" width="52" height="52" referrerpolicy="no-referrer" decoding="async">`:''}</span>`;
}
function poolAge(m){
 if(!m?.created)return 'Age unavailable';
 const minutes=Math.max(0,Math.floor((m.retrievedAt-m.created)/60000));
 return minutes<60?`Pool · ${minutes<1?'<1':minutes}m old`:minutes<1440?`Pool · ${Math.floor(minutes/60)}h old`:`Pool · ${Math.floor(minutes/1440)}d old`;
}
function loading(title){return `<div class="check-pending"><span aria-hidden="true">◇</span><p>${title}</p></div>`;}
function marketSection(part,history){
 if(part.status==='loading')return loading('Getting market data…');
 if(part.status==='error')return `<div class="source-empty"><h4>Market data unavailable</h4><p>${esc(part.message)}</p></div>`;
 if(part.status==='empty')return '<div class="source-empty"><h4>No indexed market yet</h4><p>Check the address and network, or try again later.</p><p>New coins may not be indexed yet.</p></div>';
 const m=part.data;
 const activityRow=(label,change,buys,sells)=>`<tr><th scope="row">${label}</th><td class="${change==null?'':change<0?'change-down':change>0?'change-up':''}">${percent(change)}</td><td>${number(buys)}</td><td>${number(sells)}</td></tr>`;
 return `<dl class="check-metrics">${metric('Price',formatMoney(m.price))}${metric('Market cap',formatMoney(m.marketCap))}${metric('Liquidity',formatMoney(m.liquidity))}${metric('Volume · 24h',formatMoney(m.volume))}</dl>
 <table class="check-activity"><caption>Trading activity</caption><thead><tr><th scope="col">Period</th><th scope="col">Change</th><th scope="col">Buys</th><th scope="col">Sells</th></tr></thead><tbody>${activityRow('1h',m.change1h,m.buys1h,m.sells1h)}${activityRow('24h',m.change,m.buys,m.sells)}</tbody></table>
 <details class="check-more" data-view-key="market-details"><summary>Market details</summary><dl class="check-detail-list">${metric('Fully diluted value',formatMoney(m.fdv))}${metric('Pool created',m.created?esc(new Date(m.created).toLocaleDateString()):'Unavailable')}${metric('Exchange',esc(m.dex))}${metric('Paired with',esc(m.quote))}</dl><p>FDV uses a different supply estimate from market cap. Pool age is not token age.</p></details>`;
}
function holdingsSection(r){
 const supply=r.supply?compact(Number(r.supply.exact)):'Unavailable';
 const reported=r.largestAccounts||[],topAccounts=reported.filter(a=>a.kind!=='pool').slice(0,10);
 const accounts=reported.filter(a=>a.kind==='pool'||topAccounts.includes(a));
 return `<div class="holdings-overview"><dl>${metric('Holder accounts',number(r.holders))}${metric('Total supply',supply)}</dl></div>
 <details class="check-more" data-view-key="holders-details"><summary class="summary-value"><span>Top 10 accounts<small>Known pools excluded</small></span><strong>${share(r.top10Percent)}</strong></summary>
 <p>Known pools are excluded. Several accounts may share one owner.</p>
 ${r.top10Percent==null?'<p>Top 10 data is incomplete.</p>':''}
 ${accounts.length?`<ol class="holder-list">${accounts.map((a,i)=>`<li><span class="holder-index" aria-hidden="true">${i+1}</span>${sourceLink('https://solscan.io/account/'+a.address,shortAddress(a.address),'holder-address','holder-'+a.address)}${a.kind==='pool'||a.kind==='locker'?`<span class="account-kind">${a.kind==='pool'?'Pool':'Locker'}</span>`:''}<strong>${share(a.percent)}</strong></li>`).join('')}</ol><p>Pool entries are shown separately.</p>`:'<p>Account details unavailable.</p>'}
 ${r.supply?`<dl class="check-detail-list exact-supply">${metric('Exact total supply',esc(r.supply.exact))}</dl>`:''}<p>Total supply is not circulating or maximum supply.</p></details>`;
}
function riskSection(part,bundles=''){
 if(part.status==='loading')return loading('Getting holder and risk data…')+bundles;
 if(part.status!=='ready')return `<div class="source-empty">${riskPill('unknown','Not assessed')}<p>${esc(part.message||'Risk report unavailable.')}</p><p>Missing checks never mean low risk.</p></div>${bundles}`;
 const r=part.data;
 const insiderCount=Number.isSafeInteger(r.insiderAccounts)&&r.insiderAccounts>=0?r.insiderAccounts:null;
 const insiderSignal=r.chainId==='solana'?`<details class="check-more" data-view-key="insider-details"><summary class="summary-value"><span>Suspected insiders<small>Accounts reported by Rugcheck</small></span><strong>${insiderCount===null?'Unavailable':number(insiderCount)+' reported'}</strong></summary><p>${insiderCount===null?'Rugcheck did not supply a usable count.':insiderCount===0?'No accounts flagged by this check. This does not rule out insiders.':'Wallet connections can suggest coordinated activity. They do not prove insider knowledge or common ownership.'}</p><p>Insider-held supply is unavailable. Bundler signals are checked separately.</p></details>`:'';
 return `${holdingsSection(r)}${insiderSignal}${bundles}<dl class="check-detail-list visible-checks">${r.controls?r.controls.map(c=>metric(esc(c.label),esc(c.value))).join(''):metric('Can mint more',esc(r.mintAuthority))+metric('Can freeze tokens',esc(r.freezeAuthority))+metric('Metadata',esc(r.mutable))}</dl>
 <details class="check-more" data-view-key="risk-details"><summary>Risk details${r.flags.length?` · ${r.flags.length}`:''}</summary>${r.flags.length?`<ul class="live-risk-list">${r.flags.map(f=>`<li>${riskPill(f.level)}<h4>${esc(f.name)}</h4><p>${esc(f.description)}</p></li>`).join('')}</ul>`:`<p>${esc(r.provider||'Rugcheck')} reported no flags. That is not proof of safety.</p>`}${r.incomplete?'<p>Some checks are missing or unclassified.</p>':''}</details>`;
}
function bundlesSection(part,chain){
 if(chain!=='solana')return '';
 const data=part?.status==='ready'?part.data:null;
 const value=data?data.percentage===null?number(data.total)+' wallets':shareText(data.percentage)+' held':part?.status==='loading'?'Checking…':part?.status==='not-connected'?'Not connected':'Unavailable';
 const message=part?.status==='not-connected'?'Bundler data is not connected yet.':part?.status==='loading'?'Checking separately. Your other results are ready as they arrive.':part?.message||'No bundler report is available.';
 return `<details class="check-more" data-view-key="bundler-details"><summary class="summary-value"><span>Bundled buys<small>Solana Tracker</small></span><strong>${esc(value)}</strong></summary>${data?`<dl class="check-detail-list">${metric('Detected wallets',number(data.total))}${metric('Supply held now',share(data.percentage))}</dl><p>Reported wallet patterns, not proof of common ownership or a scam. Zero does not rule out undetected bundles.</p>${data.wallets.length?`<ol class="holder-list">${data.wallets.slice(0,10).map((w,i)=>`<li><span class="holder-index" aria-hidden="true">${i+1}</span>${sourceLink('https://solscan.io/account/'+w.wallet,shortAddress(w.wallet),'holder-address','bundler-'+w.wallet)}<strong>${share(w.percentage)}</strong></li>`).join('')}</ol><p>Showing ${Math.min(10,data.wallets.length)} returned wallets. Provider totals may cover more.</p>`:''}${data.walletsIncomplete?'<p>Some wallet details were unavailable.</p>':''}<p>Retrieved ${esc(time(data.retrievedAt))} · May be cached.</p>`:`<p>${esc(message)}</p>`}</details>`;
}
function projectSection(state){
 const m=state.market.data,r=state.risk.data,listing=state.listing;
 const links=m?.links||[];
 const paidLabels={paid:'Yes','not-reported':'Not reported',cancelled:'Cancelled','not-approved':'Not approved',pending:'Pending',unavailable:'Unavailable'};
 const paid=listing?.status==='ready'?(paidLabels[listing.data.profileStatus]||(listing.data.profilePaid===true?'Yes':listing.data.profilePaid===false?'Not reported':'Unavailable')):listing?.status==='loading'?'Checking…':'Unavailable';
 const boosts=m?.boostsActive;
 const boostValue=Number.isSafeInteger(boosts)&&boosts>=0?`<span class="dex-boost-count ${boosts>0?'has-boosts':''}" aria-label="${boosts===0?'No active DEX boosts':number(boosts)+' active DEX boosts'}"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M13.5 2 4 14h7l-.5 8L20 10h-7z" fill="currentColor"/></svg><span>${number(boosts)}</span></span>`:state.market.status==='loading'?'Checking…':m?.boostsStatus==='not-reported'?'Unknown':'Unavailable';
 return `<section class="check-project" aria-labelledby="project-heading"><h3 id="project-heading">Project</h3>
 ${links.length?`<div class="project-links">${links.map((l,i)=>sourceLink(l.url,l.label,'button project-link','project-link-'+i)).join('')}</div><p class="section-note">Project links · Unverified</p>`:`<p class="section-note">${state.market.status==='loading'?'Checking for project links…':'No project links available.'}</p>`}
 <details class="check-more" data-view-key="coin-about"><summary>About this coin</summary><p>${r?.description?esc(r.description):'Description unavailable.'}</p>${r?.description?'<p>Project description via Rugcheck · Unverified</p>':''}</details>
 <dl class="check-detail-list profile-status">${metric('DEX paid',paid)}${metric('DEX boosts',boostValue)}</dl><p class="section-note">Paid promotion, not a safety check.</p>
 <details class="check-more" data-view-key="dex-promotion"><summary>What does this mean?</summary><p>DEX paid shows the paid-profile order status on DEX Screener. Cancelled or pending orders are not approved profiles.</p><p>Boosts are temporary promotion. The count shows active boosts, not dollars spent. Zero means none were active at the source check. Unknown means no count was supplied. Unavailable means the check failed or returned unusable data.</p></details>${listing?.status==='error'?`<p class="section-note">${esc(listing.message)}</p>`:''}</section>`;
}
export function resultHTML(state,section='overview'){
 if(!reportSections.includes(section))section='overview';
 const m=state.market.data,r=state.risk.data,name=m?.name||r?.name||'Coin lookup',symbol=m?.symbol||r?.symbol;
 const level=r?.level||'unknown',chain=state.chainId||'solana',network=NETWORKS[chain];
 const quickRisk=r?riskPill(level):riskPill('unknown',state.risk.status==='loading'?'Risk check pending':'Not assessed');
 const quickReason=r?(r.flags[0]?.name||(r.incomplete?'Some token checks are missing.':'This is not proof of safety.')):state.risk.status==='loading'?'Checking risk…':'Risk report unavailable.';
 return `<article class="live-coin"><header class="live-coin-head">${coinAvatar(m,name,symbol)}<div><h2 data-view-key="coin-title" tabindex="-1">${esc(name)}</h2><div class="coin-subline">${symbol?`<span>${esc(symbol)}</span><span aria-hidden="true">·</span>`:''}<span>${esc(network.name)}</span>${m?`<span aria-hidden="true">·</span><span>${esc(m.dex)}</span>`:''}</div></div></header>
 <div class="report-meta"><span>${m?esc(poolAge(m)):'Pool age unavailable'}</span><span>${m||r?'Checked '+esc(time(m?.retrievedAt||r.retrievedAt)):'Checking…'}</span></div>
 <div class="quick-risk ${level}"><div>${quickRisk}<p>${esc(quickReason)}</p></div></div>
 <div class="report-tabs" role="tablist" aria-label="Coin report">${reportSections.map(id=>`<button type="button" role="tab" id="report-tab-${id}" data-report-section="${id}" data-view-key="report-tab-${id}" aria-controls="report-panel-${id}" aria-selected="${id===section}" tabindex="${id===section?0:-1}">${id[0].toUpperCase()+id.slice(1)}</button>`).join('')}</div>
 <section class="report-panel" role="tabpanel" id="report-panel-overview" aria-labelledby="report-tab-overview" tabindex="0" ${section==='overview'?'':'hidden'}><div class="live-data-columns"><section class="live-market" aria-labelledby="market-heading"><h3 id="market-heading">Market</h3>${marketSection(state.market)}</section>${projectSection(state)}</div></section>
 <section class="report-panel chart-panel" role="tabpanel" id="report-panel-chart" aria-labelledby="report-tab-chart" tabindex="0" ${section==='chart'?'':'hidden'}>${historyHTML(state.history,m)}</section>
 <section class="report-panel" role="tabpanel" id="report-panel-details" aria-labelledby="report-tab-details" tabindex="0" ${section==='details'?'':'hidden'}><section class="live-security" aria-labelledby="risk-heading"><h3 id="risk-heading">Holders & security</h3>${riskSection(state.risk,bundlesSection(state.bundles,chain))}</section>
 <details class="check-more report-sources" data-view-key="sources"><summary>Sources & coverage</summary><dl class="check-detail-list">${metric('Market data',m?'DEX Screener · '+esc(time(m.retrievedAt)):'Unavailable')}${metric('Holders & risk',r?esc(r.provider||'Rugcheck')+' · '+esc(time(r.retrievedAt)):'Unavailable')}${metric('Price history',state.history?.data?'GeckoTerminal · '+esc(time(state.history.data.retrievedAt)):'Unavailable')}${metric('Paid profile',state.listing?.data?'DEX Screener · '+esc(time(state.listing.data.retrievedAt)):'Unavailable')}</dl><p>Retrieval times shown. Source reports may be cached. Risk labels summarize available checks, not a full security audit.</p><p>Market stats use the highest-liquidity pool returned, not all exchanges.</p><p>Not available here: insider-held supply, all-time high, fresh-wallet percentages, social-account age, view counts, and circulating supply. Insider and bundler signals cover Solana only; bundler data needs a connected source.</p><div class="report-source-links">${m?sourceLink('https://dexscreener.com/'+chain+'/'+m.pair,'DEX Screener'):''}${sourceLink(chain==='solana'?'https://rugcheck.xyz/tokens/'+state.mint:'https://api.gopluslabs.io/api/v1/token_security/'+network.securityId+'?contract_addresses='+state.mint,chain==='solana'?'Rugcheck':'GoPlus report')}${sourceLink(network.explorer+'/token/'+state.mint,'Token explorer')}</div></details>
 <div class="check-address"><span>Token address</span><code>${esc(state.mint)}</code><span>Names and logos can be copied. Check the address.</span></div></section></article>`;
}
export function mountChecker(main){
 document.title='Check a coin · Soltech';
 main.innerHTML=`<section class="checker"><div class="checker-intro"><h1>Check a coin<span class="accent">.</span></h1><p>One address. A clearer picture.</p></div><form class="coin-check-form" novalidate><div class="check-label"><label for="coin-address">Token address <span>(CA)</span></label></div><div class="check-input-row"><div class="check-address-input"><input id="coin-address" name="address" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="120" placeholder="Paste a token address" aria-describedby="address-error" value="${esc(remembered?.mint||'')}"><button type="button" class="button clear-address" aria-label="Clear address" title="Clear address" ${remembered?.mint?'':'disabled'}>Clear</button></div><div class="check-network" ${validEvmAddress(remembered?.mint)?'':'hidden'}><label class="sr-only" for="coin-network">Network</label><select id="coin-network" aria-describedby="network-help">${networkOptions(remembered?.chainId)}</select></div><button type="submit" class="button glass">Check coin</button></div><p id="network-help" class="section-note" ${validEvmAddress(remembered?.mint)?'':'hidden'}>Choose the network for this address.</p><p id="address-error" class="field-error" role="alert" hidden></p><details class="check-privacy"><summary>No wallet needed · What gets shared?</summary><p>Supports Solana, Ethereum, Base, BNB Chain, Polygon, Arbitrum, Avalanche and Optimism token addresses. Names, wallet addresses and native coins without contracts are not supported.</p><p>DEX Screener receives the token address; Rugcheck (Solana) or GoPlus receives it for risk checks. GeckoTerminal receives the token and pool addresses. When connected, Solana Tracker receives the Solana address through the Soltech server for bundler checks. Direct data requests and coin images share your IP address with their hosts. Solana Tracker receives the server IP. No wallet connection.</p></details></form><p class="lookup-status" role="status" aria-live="polite"></p><div id="live-result">${remembered?resultHTML(remembered):welcomeHTML}</div></section>`;
 const form=main.querySelector('form'),input=form.querySelector('input'),error=form.querySelector('#address-error'),output=main.querySelector('#live-result'),status=main.querySelector('.lookup-status');
 const networkSelect=form.querySelector('#coin-network'),networkBox=form.querySelector('.check-network'),networkHelp=form.querySelector('#network-help');
 const imageError=e=>{if(e.target.matches?.('.coin-logo-image'))e.target.remove();};
 output.addEventListener('error',imageError,true);
 for(const image of output.querySelectorAll('.coin-logo-image'))if(image.complete&&!image.naturalWidth)image.remove();
 let current=remembered,lastSubmitted=remembered?remembered.chainId+':'+remembered.mint:'',finishedAt=completedAt;
 let chartView=remembered?{...rememberedChartView}:{range:'all',selected:null},disposeChart=()=>{},reportSection=remembered?rememberedSection:'overview';
 function activateSection(next,focus=false){
  if(!reportSections.includes(next))return;
  reportSection=rememberedSection=next;
  for(const button of output.querySelectorAll('[data-report-section]')){const selected=button.dataset.reportSection===next;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;if(selected&&focus)button.focus({preventScroll:true});}
  for(const panel of output.querySelectorAll('.report-panel'))panel.hidden=panel.id!=='report-panel-'+next;
 }
 const sectionClick=e=>{const button=e.target.closest('[data-report-section]');if(button)activateSection(button.dataset.reportSection);};
 const sectionKey=e=>{const button=e.target.closest('[data-report-section]');if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const index=reportSections.indexOf(button.dataset.reportSection),next=e.key==='Home'?0:e.key==='End'?2:(index+(e.key==='ArrowRight'?1:2))%3;activateSection(reportSections[next],true);};
 output.addEventListener('click',sectionClick);output.addEventListener('keydown',sectionKey);activateSection(reportSection);
 const bindChart=()=>{disposeChart();disposeChart=mountHistoryChart(output.querySelector('.price-history'),current?.history?.data,chartView,current?.market?.data);};
 bindChart();
 const session=createLookupSession(state=>{
  const same=current?.mint===state.mint&&current?.chainId===state.chainId;
  const open=same?[...output.querySelectorAll('details[open][data-view-key]')].map(el=>el.dataset.viewKey):[];
  const focus=same&&output.contains(document.activeElement)?document.activeElement.closest('[data-view-key]')?.dataset.viewKey:null;
  disposeChart();if(!same){chartView={range:'all',selected:null};reportSection=rememberedSection='overview';}
  current=state;output.innerHTML=resultHTML(state,reportSection);bindChart();
  for(const el of output.querySelectorAll('[data-view-key]')){if(open.includes(el.dataset.viewKey))el.open=true;if(focus===el.dataset.viewKey)(el.matches('details')?el.querySelector('summary'):el).focus({preventScroll:true});}
  const busy=pending(state);
  output.setAttribute('aria-busy',String(busy));
  status.textContent=busy?'Checking live sources…':state.market.status==='ready'||state.risk.status==='ready'?'Results ready.':'No data returned. See details below.';
  if(!busy){remembered=state;finishedAt=completedAt=Date.now();}
 });
 const submit=e=>{
  e.preventDefault();let mint=input.value.trim();input.value=mint;const evm=validEvmAddress(mint),chain=evm?networkSelect.value:'solana';
  if(evm)mint=mint.toLowerCase();
  const lookupKey=chain+':'+mint;
  error.hidden=true;input.removeAttribute('aria-invalid');
  if(!validTokenAddress(mint,chain)){
   session.cancel();disposeChart();remembered=null;current=null;output.innerHTML='';output.setAttribute('aria-busy','false');status.textContent='';
   error.textContent=evm&&!chain?'Choose the token’s network to continue.':'Enter a full Solana token address or a 0x contract address. Names and links won’t work.';error.hidden=false;(evm&&!chain?networkSelect:input).setAttribute('aria-invalid','true');(evm&&!chain?networkSelect:input).focus();return;
  }
  if(lookupKey===lastSubmitted&&pending(current||{})){status.textContent='Already checking this address.';return;}
  if(lookupKey===lastSubmitted&&current?.market.status==='ready'&&current?.risk.status==='ready'&&current?.listing?.status==='ready'&&current?.history?.status==='ready'&&Date.now()-finishedAt<30000){status.textContent='Just updated. Wait a few seconds to refresh.';return;}
  lastSubmitted=lookupKey;remembered=null;networkSelect.removeAttribute('aria-invalid');session.lookup(mint,chain);
 };
 form.addEventListener('submit',submit);
 const clearButton=form.querySelector('.clear-address');
 const updateClear=()=>{clearButton.disabled=input.value.length===0;const evm=input.value.trim().toLowerCase().startsWith('0x');networkBox.hidden=!evm;networkHelp.hidden=!evm;};
 const clear=()=>{
  session.cancel();disposeChart();chartView={range:'all',selected:null};reportSection=rememberedSection='overview';input.value='';remembered=null;current=null;lastSubmitted='';finishedAt=completedAt=0;
  error.hidden=true;input.removeAttribute('aria-invalid');output.innerHTML=welcomeHTML;output.setAttribute('aria-busy','false');
  status.textContent='Address cleared.';networkSelect.value='';networkSelect.removeAttribute('aria-invalid');updateClear();input.focus();
 };
 input.addEventListener('input',updateClear);clearButton.addEventListener('click',clear);
 return ()=>{if(remembered)rememberedChartView={...chartView};session.dispose();disposeChart();form.removeEventListener('submit',submit);input.removeEventListener('input',updateClear);clearButton.removeEventListener('click',clear);output.removeEventListener('error',imageError,true);output.removeEventListener('click',sectionClick);output.removeEventListener('keydown',sectionKey);};
}
