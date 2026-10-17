import {createLookupSession,formatMoney,safeImageUrl,validTokenAddress} from './coin-checker-data.js';
import {historyHTML,mountHistoryChart} from './coin-history.js';
import {NETWORKS,validEvmAddress} from './coin-networks.js';
import {discoverNetwork} from './coin-network-discovery.js';
import {createRecentCoinStore,recentCoinsHTML} from './coin-recent.js';

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
const networkOptions=(selected,chains)=>'<option value="">Choose network</option>'+Object.entries(NETWORKS).filter(([id,n])=>n.kind==='evm'&&(!chains||chains.includes(id))).map(([id,n])=>`<option value="${id}" ${id===selected?'selected':''}>${n.name}</option>`).join('');
const pending=state=>['market','risk','listing','history'].some(key=>['waiting','loading'].includes(state[key]?.status));
const welcomeHTML='';
let remembered=null,completedAt=0;
let rememberedChartView={range:'all',selected:null};
let recentHistory;
const getRecentHistory=()=>recentHistory??=createRecentCoinStore();

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
function marketSection(part,details=false){
 if(part.status==='loading')return loading('Getting market data…');
 if(part.status==='error')return `<div class="source-empty"><h4>Market data unavailable</h4><p>${esc(part.message)}</p></div>`;
 if(part.status==='empty')return '<div class="source-empty"><h4>No market data found</h4><p>Check the address and network, or try again later.</p><p>Market data may not be available for new coins yet.</p></div>';
 const m=part.data;
 const activityRow=(label,change,buys,sells)=>`<tr><th scope="row">${label}</th><td class="${change==null?'':change<0?'change-down':change>0?'change-up':''}">${percent(change)}</td><td>${number(buys)}</td><td>${number(sells)}</td></tr>`;
 if(!details)return `<dl class="check-metrics">${metric('Price',formatMoney(m.price))}${metric('Market cap',formatMoney(m.marketCap))}${metric('Liquidity',formatMoney(m.liquidity))}${metric('Volume · 24h',formatMoney(m.volume))}</dl>`;
 return `<table class="check-activity"><caption>Trading activity</caption><thead><tr><th scope="col">Period</th><th scope="col">Change</th><th scope="col">Buys</th><th scope="col">Sells</th></tr></thead><tbody>${activityRow('1h',m.change1h,m.buys1h,m.sells1h)}${activityRow('24h',m.change,m.buys,m.sells)}</tbody></table>
 <details class="check-more" data-view-key="market-details"><summary>Market details</summary><dl class="check-detail-list">${metric('Fully diluted value',formatMoney(m.fdv))}${metric('Pool created',m.created?esc(new Date(m.created).toLocaleDateString()):'Unavailable')}${metric('Exchange',esc(m.dex))}${metric('Paired with',esc(m.quote))}</dl><p>FDV uses a different supply estimate from market cap. Pool age is not token age.</p></details>`;
}
function holdingsSection(r){
 const supply=r.supply?compact(Number(r.supply.exact)):'Unavailable';
 const reported=r.largestAccounts||[],topAccounts=reported.filter(a=>a.kind!=='pool').slice(0,10);
 const accounts=reported.filter(a=>a.kind==='pool'||topAccounts.includes(a));
 return `<details class="check-more" data-view-key="holders-details" data-signal-tone="${r.top10Percent==null?'unknown':'info'}"><summary class="summary-value"><span>Top 10 accounts<small>Known pools excluded</small></span><strong>${share(r.top10Percent)}</strong></summary>
 <p>Known pools are excluded. Several accounts may share one owner.</p>
 ${r.top10Percent==null?'<p>Top 10 data is incomplete.</p>':''}
 ${accounts.length?`<ol class="holder-list">${accounts.map((a,i)=>`<li><span class="holder-index" aria-hidden="true">${i+1}</span>${sourceLink('https://solscan.io/account/'+a.address,shortAddress(a.address),'holder-address','holder-'+a.address)}${a.kind==='pool'||a.kind==='locker'?`<span class="account-kind">${a.kind==='pool'?'Pool':'Locker'}</span>`:''}<strong>${share(a.percent)}</strong></li>`).join('')}</ol><p>Pool entries are shown separately.</p>`:'<p>Account details unavailable.</p>'}
 <dl class="check-detail-list">${metric('Holder accounts',number(r.holders))}${metric('Total supply',supply)}</dl>${r.supply?`<dl class="check-detail-list exact-supply">${metric('Exact total supply',esc(r.supply.exact))}</dl>`:''}<p>Total supply is not circulating or maximum supply.</p></details>`;
}
function riskSection(part,bundles='',chain='solana'){
 const snipers=chain==='solana'?'<details class="check-more mobile-only-signal" data-view-key="sniper-details" data-signal-tone="unknown"><summary class="summary-value"><span>Snipers<small>Early-buy activity</small></span><strong>Unavailable</strong></summary><p>A sniper-data source is not connected. Insider and bundled-buy results do not establish sniper activity.</p></details>':'';
 if(part.status!=='ready'){
  const value=part.status==='loading'?'Checking…':'Unavailable';
  const note=part.status==='loading'?'Holder and risk data is still loading.':part.message||'Risk report unavailable. Missing checks never mean low risk.';
  const tone=part.status==='loading'?'info':'unknown';
  return `<details class="check-more" data-view-key="holders-details" data-signal-tone="${tone}"><summary class="summary-value"><span>Top 10 accounts<small>Known pools excluded</small></span><strong>${value}</strong></summary><p>${esc(note)}</p></details>${chain==='solana'?`<details class="check-more" data-view-key="insider-details" data-signal-tone="${tone}"><summary class="summary-value"><span>Suspected insiders<small>Accounts reported by Rugcheck</small></span><strong>${value}</strong></summary><p>${esc(note)}</p></details>`:''}${bundles}${snipers}`;
 }
 const r=part.data;
 const insiderCount=Number.isSafeInteger(r.insiderAccounts)&&r.insiderAccounts>=0?r.insiderAccounts:null;
 const insiderSignal=r.chainId==='solana'?`<details class="check-more" data-view-key="insider-details" data-signal-tone="${insiderCount===null?'unknown':insiderCount>0?'caution':'info'}"><summary class="summary-value"><span>Suspected insiders<small>Accounts reported by Rugcheck</small></span><strong>${insiderCount===null?'Unavailable':number(insiderCount)+' reported'}</strong></summary><p>${insiderCount===null?'Rugcheck did not supply a usable count.':insiderCount===0?'No accounts flagged by this check. This does not rule out insiders.':'Wallet connections can suggest coordinated activity. They do not prove insider knowledge or common ownership.'}</p><p>Insider-held supply is unavailable. Bundler signals are checked separately.</p></details>`:'';
 return `${holdingsSection(r)}${insiderSignal}${bundles}${snipers}`;
}
function securityDetails(part){
 const r=part.status==='ready'?part.data:null;
 return `<details class="check-more" data-view-key="risk-details"><summary>Token checks${r?.flags.length?` · ${r.flags.length} ${r.flags.length===1?'flag':'flags'}`:''}</summary>${r?`<dl class="check-detail-list visible-checks">${r.controls?r.controls.map(c=>metric(esc(c.label),esc(c.value))).join(''):metric('Can mint more',esc(r.mintAuthority))+metric('Can freeze tokens',esc(r.freezeAuthority))+metric('Metadata',esc(r.mutable))}</dl>${r.flags.length?`<ul class="live-risk-list">${r.flags.map(f=>`<li>${riskPill(f.level)}<h4>${esc(f.name)}</h4><p>${esc(f.description)}</p></li>`).join('')}</ul>`:`<p>${esc(r.provider||'Rugcheck')} reported no flags. That is not proof of safety.</p>`}${r.incomplete?'<p>Some checks are missing or unclassified.</p>':''}`:`<p>${esc(part.status==='loading'?'Token checks are still loading.':part.message||'Risk report unavailable. Missing checks never mean low risk.')}</p>`}</details>`;
}
function bundlesSection(part,chain){
 if(chain!=='solana')return '';
 const data=part?.status==='ready'?part.data:null;
 const value=data?data.percentage===null?number(data.total)+' wallets':shareText(data.percentage)+' held':part?.status==='loading'?'Checking…':part?.status==='not-connected'?'Not connected':'Unavailable';
 const message=part?.status==='not-connected'?'Bundler data is not connected yet.':part?.status==='loading'?'Checking separately. Your other results are ready as they arrive.':part?.message||'No bundler report is available.';
 return `<details class="check-more" data-view-key="bundler-details" data-signal-tone="${data?data.total>0?'caution':'info':part?.status==='loading'?'info':'unknown'}"><summary class="summary-value"><span>Bundled buys<small>Solana Tracker</small></span><strong>${esc(value)}</strong></summary>${data?`<dl class="check-detail-list">${metric('Detected wallets',number(data.total))}${metric('Supply held now',share(data.percentage))}</dl><p>Reported wallet patterns, not proof of common ownership or a scam. Zero does not rule out undetected bundles.</p>${data.wallets.length?`<ol class="holder-list">${data.wallets.slice(0,10).map((w,i)=>`<li><span class="holder-index" aria-hidden="true">${i+1}</span>${sourceLink('https://solscan.io/account/'+w.wallet,shortAddress(w.wallet),'holder-address','bundler-'+w.wallet)}<strong>${share(w.percentage)}</strong></li>`).join('')}</ol><p>Showing ${Math.min(10,data.wallets.length)} returned wallets. Provider totals may cover more.</p>`:''}${data.walletsIncomplete?'<p>Some wallet details were unavailable.</p>':''}<p>Retrieved ${esc(time(data.retrievedAt))} · May be cached.</p>`:`<p>${esc(message)}</p>`}</details>`;
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
 <dl class="check-detail-list profile-status">${metric('Paid DEX Screener profile',paid)}${metric('DEX Screener boosts',boostValue)}</dl><p class="section-note">Paid promotion, not a safety check.</p>
 <details class="check-more" data-view-key="dex-promotion"><summary>What does this mean?</summary><p>This shows the status of a paid profile on DEX Screener. Cancelled or pending orders are not approved profiles.</p><p>Boosts are temporary promotion. The count shows active boosts, not dollars spent. Zero means none were active at the source check. Unknown means no count was supplied. Unavailable means the check failed or returned unusable data.</p></details>${listing?.status==='error'?`<p class="section-note">${esc(listing.message)}</p>`:''}</section>`;
}
export function resultHTML(state){
 const m=state.market.data,r=state.risk.data,name=m?.name||r?.name||'Coin lookup',symbol=m?.symbol||r?.symbol;
 const level=r?.level||'unknown',chain=state.chainId||'solana',network=NETWORKS[chain];
 const quickRisk=r?riskPill(level):riskPill('unknown',state.risk.status==='loading'?'Risk check pending':'Not assessed');
 const quickReason=r?(r.flags[0]?.name||(r.incomplete?'Some token checks are missing.':'This is not proof of safety.')):state.risk.status==='loading'?'Checking risk…':'Risk report unavailable.';
 return `<article class="live-coin coin-report-priority"><header class="live-coin-head">${coinAvatar(m,name,symbol)}<div><h2 id="coin-report-title" data-view-key="coin-title" tabindex="-1">${esc(name)}</h2><div class="coin-subline">${symbol?`<span>${esc(symbol)}</span><span aria-hidden="true">·</span>`:''}<span>${esc(network.name)}</span>${m?`<span aria-hidden="true">·</span><span>${esc(m.dex)}</span>`:''}</div></div></header>
 <div class="report-meta"><span>${m?esc(poolAge(m)):'Pool age unavailable'}</span><span>${m||r?'Checked '+esc(time(m?.retrievedAt||r.retrievedAt)):pending(state)?'Checking…':'Check complete'}</span></div>
 <div class="report-risk-area"><div class="quick-risk ${level}"><div>${quickRisk}<p>${esc(quickReason)}</p></div></div><div class="mobile-risk-signals"></div></div>
 <section class="report-panel report-primary" role="region" data-view-key="report-panel-overview" id="report-panel-overview" aria-labelledby="coin-report-title" tabindex="-1">
 <section class="chart-panel" data-view-key="report-panel-chart" id="report-panel-chart" aria-label="Coin chart">${historyHTML(state.history,m,{compact:true})}</section>
 <div class="report-key-data"><section class="live-market" aria-labelledby="market-heading"><h3 id="market-heading">Market snapshot</h3>${marketSection(state.market)}</section><section class="live-security" aria-labelledby="risk-heading"><h3 id="risk-heading">Ownership signals</h3>${riskSection(state.risk,bundlesSection(state.bundles,chain),chain)}</section></div></section>
 <section class="report-secondary" aria-label="More coin information">${securityDetails(state.risk)}
 ${m?`<details class="check-more" data-view-key="trading-details"><summary>Trading & pool details</summary>${marketSection(state.market,true)}</details>`:''}
 <details class="check-more" data-view-key="project-details"><summary>Project & promotion</summary>${projectSection(state)}</details>
 <details class="check-more report-sources" data-view-key="sources"><summary>Sources & coverage</summary><dl class="check-detail-list">${metric('Market data',m?'DEX Screener · '+esc(time(m.retrievedAt)):'Unavailable')}${metric('Holders & risk',r?esc(r.provider||'Rugcheck')+' · '+esc(time(r.retrievedAt)):'Unavailable')}${metric('Price history',state.history?.data?'GeckoTerminal · '+esc(time(state.history.data.retrievedAt)):'Unavailable')}${metric('Paid profile',state.listing?.data?'DEX Screener · '+esc(time(state.listing.data.retrievedAt)):'Unavailable')}</dl><p>Retrieval times shown. Source reports may be cached. Risk labels summarize available checks, not a full security audit.</p><p>Market stats use the highest-liquidity pool returned, not all exchanges.</p><p>Not available here: insider-held supply, all-time high, fresh-wallet percentages, social-account age, view counts, and circulating supply. Insider and bundler signals cover Solana only; bundler data needs a connected source.</p><div class="report-source-links">${m?sourceLink('https://dexscreener.com/'+chain+'/'+m.pair,'DEX Screener'):''}${sourceLink(chain==='solana'?'https://rugcheck.xyz/tokens/'+state.mint:'https://api.gopluslabs.io/api/v1/token_security/'+network.securityId+'?contract_addresses='+state.mint,chain==='solana'?'Rugcheck':'GoPlus report')}${sourceLink(network.explorer+'/token/'+state.mint,'Token explorer')}</div></details>
 <div class="check-address"><span>Token address</span><code>${esc(state.mint)}</code><span>Names and logos can be copied. Check the address.</span></div></section></article>`;
}
export function mountReportLayout(root){
 const signals=root?.querySelector('.live-security'),mobile=root?.querySelector('.mobile-risk-signals'),desktop=root?.querySelector('.report-key-data');
 if(!signals||!mobile||!desktop)return ()=>{};
 const query=window.matchMedia('(max-width:800px)');
 const arrange=()=>{const destination=query.matches?mobile:desktop;if(signals.parentElement===destination)return;const focused=signals.contains(document.activeElement)?document.activeElement:null;destination.append(signals);focused?.focus({preventScroll:true});};
 arrange();query.addEventListener('change',arrange);
 return ()=>query.removeEventListener('change',arrange);
}
export function mountChecker(main,{discover=discoverNetwork,createSession=createLookupSession,historyStore=getRecentHistory(),initialCoin=null}={}){
 document.title='Check a coin · Solventir';
 main.innerHTML=`<section class="checker"><div class="checker-intro"><h1>Check a coin<span class="accent">.</span></h1><p>A deeper look at your coin.</p></div><form class="coin-check-form" novalidate><div class="check-label"><label for="coin-address">Token address <span>(CA)</span></label></div><div class="check-input-row"><div class="check-address-input"><input id="coin-address" name="address" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="120" placeholder="Paste a token address" aria-describedby="address-error" value="${esc(remembered?.mint||'')}"><button type="button" class="button clear-address" aria-label="Clear address" title="Clear address" ${remembered?.mint?'':'disabled'}>Clear</button></div><div class="check-network" hidden><label class="sr-only" for="coin-network">Network</label><select id="coin-network" aria-describedby="network-help">${networkOptions(remembered?.chainId)}</select></div><button type="submit" class="button glass">Check coin</button></div><p id="network-help" class="section-note" hidden>Choose the network for this address.</p><p id="address-error" class="field-error" role="alert" hidden></p><details class="check-privacy"><summary>No wallet needed · What gets shared?</summary><p>Supports Solana, Ethereum, Base, BNB Chain, Polygon, Arbitrum, Avalanche and Optimism token addresses. Names, wallet addresses and native coins without contracts are not supported.</p><p>DEX Screener receives the token address; Rugcheck (Solana) or GoPlus receives it for risk checks. GeckoTerminal receives the token and pool addresses. When connected, Solana Tracker receives the Solana address through the Solventir server for bundler checks. Direct data requests and coin images share your IP address with their hosts. Solana Tracker receives the server IP. No wallet connection.</p><p>Your five most recently checked coins are saved on this device with their names, addresses, networks, and check times. A new coin replaces the oldest; Clear history removes the list. Prices and risk reports are fetched again when you reopen a coin.</p></details></form><p class="lookup-status" role="status" aria-live="polite"></p><div id="live-result">${remembered?resultHTML(remembered):welcomeHTML}</div></section>`;
 const form=main.querySelector('form'),input=form.querySelector('input'),error=form.querySelector('#address-error'),output=main.querySelector('#live-result'),status=main.querySelector('.lookup-status');
 output.insertAdjacentHTML('afterend','<div id="recent-coins"></div>');
 const recent=main.querySelector('#recent-coins');
 let disposed=false,historyToken;
 const syncRecentVisibility=()=>{recent.hidden=Boolean(input.value.trim());};
 const renderRecent=()=>{
  if(disposed)return;
  const active=recent.contains(document.activeElement)?document.activeElement:null;
  const address=active?.dataset.recentAddress,chain=active?.dataset.recentChain,wasClear=active?.hasAttribute('data-clear-recent');
  recent.innerHTML=recentCoinsHTML(historyStore.getSnapshot());syncRecentVisibility();
  if(active&&!recent.hidden){const target=wasClear?recent.querySelector('[data-clear-recent]'):[...recent.querySelectorAll('[data-recent-address]')].find(row=>row.dataset.recentAddress===address&&row.dataset.recentChain===chain);(target&&!target.disabled?target:input).focus({preventScroll:true});}
 };
 const unsubscribeHistory=historyStore.subscribe?.(renderRecent);
 renderRecent();
 let historyRecorded=true;
 const recentImageError=event=>{if(event.target.matches?.('.recent-coin-logo img'))event.target.remove();};
 recent.addEventListener('error',recentImageError,true);
 const networkSelect=form.querySelector('#coin-network'),networkBox=form.querySelector('.check-network'),networkHelp=form.querySelector('#network-help');
 const imageError=e=>{if(e.target.matches?.('.coin-logo-image'))e.target.remove();};
 output.addEventListener('error',imageError,true);
 for(const image of output.querySelectorAll('.coin-logo-image'))if(image.complete&&!image.naturalWidth)image.remove();
 let current=remembered,lastSubmitted=remembered?remembered.chainId+':'+remembered.mint:'',finishedAt=completedAt;
 let chartView=remembered?{...rememberedChartView}:{range:'all',selected:null},disposeChart=()=>{},disposeLayout=()=>{};
 const bindChart=()=>{disposeChart();disposeLayout();disposeLayout=mountReportLayout(output);disposeChart=mountHistoryChart(output.querySelector('.price-history'),current?.history?.data,chartView,current?.market?.data);};
 bindChart();
 const session=createSession(state=>{
  const same=current?.mint===state.mint&&current?.chainId===state.chainId;
  const open=same?[...output.querySelectorAll('details[open][data-view-key]')].map(el=>el.dataset.viewKey):[];
  const focus=same&&output.contains(document.activeElement)?document.activeElement.closest('[data-view-key]')?.dataset.viewKey:null;
  disposeChart();if(!same)chartView={range:'all',selected:null};
  current=state;output.innerHTML=resultHTML(state);bindChart();
  for(const el of output.querySelectorAll('[data-view-key]')){if(open.includes(el.dataset.viewKey))el.open=true;if(focus===el.dataset.viewKey)(el.matches('details')?el.querySelector('summary'):el).focus({preventScroll:true});}
  const busy=pending(state);
  output.setAttribute('aria-busy',String(busy));
  status.textContent=busy?'Checking market and risk data…':state.market.status==='ready'||state.risk.status==='ready'?'Results ready.':'No data returned. See details below.';
  if(!busy){remembered=state;finishedAt=completedAt=Date.now();if(!historyRecorded){historyRecorded=true;historyStore.remember(state,undefined,{clearToken:historyToken});renderRecent();}}
 });
 const addressKey=value=>validEvmAddress(value.trim())?value.trim().toLowerCase():value.trim();
 let observedMint=addressKey(input.value),resolvedMint=remembered?.mint?addressKey(remembered.mint):'',discoveryId=0,discoveryController=null,discoveringMint='';
 const cancelDiscovery=()=>{discoveryId++;discoveryController?.abort();discoveryController=null;discoveringMint='';form.setAttribute('aria-busy','false');};
 const hideNetwork=()=>{networkBox.hidden=true;networkHelp.hidden=true;networkSelect.removeAttribute('aria-invalid');};
 const resetNetwork=()=>{hideNetwork();networkSelect.innerHTML=networkOptions();networkSelect.value='';resolvedMint='';};
 hideNetwork();
 const clearReport=()=>{session.cancel();disposeChart();disposeLayout();remembered=null;current=null;lastSubmitted='';output.innerHTML='';output.setAttribute('aria-busy','false');status.textContent='';};
 const showNetwork=result=>{
  const ambiguous=result.status==='ambiguous';
  networkSelect.innerHTML=networkOptions('',ambiguous?result.chainIds:undefined);networkSelect.value='';
  networkBox.hidden=false;networkHelp.hidden=false;
  networkHelp.textContent=ambiguous?'This address matches more than one network. Choose which one to check.':result.status==='not-found'?'We couldn’t find a network match. Choose the token’s network to try directly.':'We couldn’t finish checking the networks. Choose the token’s network to continue.';
  status.textContent='Choose a network to continue.';networkSelect.focus();
 };
 const startLookup=(mint,chain,clearToken=historyStore.beginCheck?.())=>{
  syncRecentVisibility();
  const lookupKey=chain+':'+mint;
  if(lookupKey===lastSubmitted&&(pending(current||{})||current?.bundles?.status==='loading')){status.textContent='Already checking this address.';return;}
  if(lookupKey===lastSubmitted&&current?.market.status==='ready'&&current?.risk.status==='ready'&&current?.listing?.status==='ready'&&current?.history?.status==='ready'&&current?.bundles?.status!=='error'&&Date.now()-finishedAt<30000){status.textContent='Just updated. Wait a few seconds to refresh.';return;}
  lastSubmitted=lookupKey;remembered=null;historyRecorded=false;historyToken=clearToken;networkSelect.removeAttribute('aria-invalid');session.lookup(mint,chain);
 };
 const submit=async e=>{
  e.preventDefault();input.value=input.value.trim();const mint=addressKey(input.value),evm=validEvmAddress(mint);
  updateClear();
  error.hidden=true;input.removeAttribute('aria-invalid');networkSelect.removeAttribute('aria-invalid');
  if(!evm&&!validTokenAddress(mint,'solana')){
   cancelDiscovery();clearReport();resetNetwork();
   error.textContent='Enter a full Solana token address or a 0x contract address. Names and links won’t work.';error.hidden=false;input.setAttribute('aria-invalid','true');input.focus();return;
  }
  if(!evm){cancelDiscovery();hideNetwork();startLookup(mint,'solana');return;}
  if(discoveringMint===mint){status.textContent='Finding the network…';return;}
  if(!networkBox.hidden){
   if(!networkSelect.value){networkSelect.setAttribute('aria-invalid','true');networkSelect.focus();return;}
   resolvedMint=mint;startLookup(mint,networkSelect.value);return;
  }
  if(resolvedMint===mint&&NETWORKS[networkSelect.value]?.kind==='evm'){startLookup(mint,networkSelect.value);return;}
  cancelDiscovery();clearReport();resetNetwork();
  const id=discoveryId,controller=new AbortController(),lookupHistoryToken=historyStore.beginCheck?.();discoveryController=controller;discoveringMint=mint;
  form.setAttribute('aria-busy','true');status.textContent='Finding the network…';
  let result;
  try{result=await discover(mint,{signal:controller.signal});}
  catch{result={status:'incomplete',chainIds:[]};}
  if(id!==discoveryId||controller.signal.aborted||mint!==addressKey(input.value))return;
  discoveryController=null;discoveringMint='';form.setAttribute('aria-busy','false');
  if(result.status==='resolved'){
   resolvedMint=mint;networkSelect.value=result.chainIds[0];startLookup(mint,result.chainIds[0],lookupHistoryToken);
  }else showNetwork(result);
 };
 form.addEventListener('submit',submit);
 const clearButton=form.querySelector('.clear-address');
 const updateClear=()=>{
  clearButton.disabled=input.value.length===0;
  syncRecentVisibility();
  const next=addressKey(input.value);if(next===observedMint)return;
  observedMint=next;cancelDiscovery();clearReport();resetNetwork();error.hidden=true;input.removeAttribute('aria-invalid');
 };
 const clear=()=>{
  cancelDiscovery();resetNetwork();session.cancel();disposeChart();disposeLayout();chartView={range:'all',selected:null};input.value='';observedMint='';remembered=null;current=null;lastSubmitted='';finishedAt=completedAt=0;
  error.hidden=true;input.removeAttribute('aria-invalid');output.innerHTML=welcomeHTML;output.setAttribute('aria-busy','false');
  status.textContent='Address cleared.';networkSelect.value='';networkSelect.removeAttribute('aria-invalid');updateClear();input.focus();
 };
 input.addEventListener('input',updateClear);clearButton.addEventListener('click',clear);
 const recentClick=event=>{
  if(event.target.closest('[data-clear-recent]')){const cleared=historyStore.clear();renderRecent();status.textContent=cleared?'Recent history cleared.':historyStore.getSnapshot().error||'History cleared for this session; the saved list could not be updated.';input.focus();return;}
  const button=event.target.closest('[data-recent-address]');if(!button)return;
  const {recentAddress:mint,recentChain:chain}=button.dataset;
  if(!historyStore.getSnapshot().entries.some(coin=>coin.address===mint&&coin.chainId===chain))return;
  cancelDiscovery();clearReport();resetNetwork();input.value=mint;observedMint=addressKey(mint);resolvedMint=observedMint;
  networkSelect.value=NETWORKS[chain]?.kind==='evm'?chain:'';clearButton.disabled=false;error.hidden=true;input.removeAttribute('aria-invalid');
  startLookup(mint,chain);form.scrollIntoView({block:'start',behavior:'auto'});input.focus({preventScroll:true});
 };
 recent.addEventListener('click',recentClick);
 if(initialCoin&&Object.hasOwn(NETWORKS,initialCoin.chainId)&&validTokenAddress(initialCoin.address,initialCoin.chainId)){
  const chain=initialCoin.chainId,mint=addressKey(initialCoin.address);
  cancelDiscovery();clearReport();resetNetwork();input.value=mint;observedMint=mint;resolvedMint=mint;
  networkSelect.value=NETWORKS[chain].kind==='evm'?chain:'';clearButton.disabled=false;
  startLookup(mint,chain);
 }
 return ()=>{disposed=true;unsubscribeHistory?.();if(remembered){rememberedChartView={...chartView};if(remembered.bundles?.status==='loading')remembered={...remembered,bundles:{status:'error',message:'The bundler check was interrupted. Check the coin again to retry.'}};}cancelDiscovery();session.dispose();disposeChart();disposeLayout();form.removeEventListener('submit',submit);input.removeEventListener('input',updateClear);clearButton.removeEventListener('click',clear);output.removeEventListener('error',imageError,true);recent.removeEventListener('click',recentClick);recent.removeEventListener('error',recentImageError,true);};
}
