import {createLookupSession,formatMoney,safeImageUrl,validTokenAddress} from './coin-checker-data.js';
import {historyHTML,historyAttributionHTML,mountHistoryChart} from './coin-history.js';
import {mountHistoryCopy} from './coin-history-copy.js';
import {NETWORKS,getNetwork,canonicalAddress,validLookupAddress} from './coin-networks.js';
import {discoverNetwork} from './coin-network-discovery.js';
import {createRecentCoinStore,recentCoinsHTML} from './coin-recent.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=n=>n==null?'Unavailable':new Intl.NumberFormat('en-US').format(n);
const compact=n=>n==null?'Unavailable':n>0&&n<.01?n.toExponential(3):new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(n);
const percent=n=>n==null?'Unavailable':`${n>0?'+':''}${n.toLocaleString('en-US',{maximumFractionDigits:2})}%`;
const shareText=n=>n==null?'Unavailable':n>0&&n<.01?'<0.01%':`${n.toLocaleString('en-US',{maximumFractionDigits:2})}%`;
const share=n=>esc(shareText(n));
const validShare=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100;
// Per-signal display bands, not a verdict on the coin. Top-10 lower/attention
// bands are Solventir rules applied to Rugcheck's non-pool account aggregate.
// Higher concentration and bundler cutoffs follow https://docs.solanatracker.io/data-api/risk.
const holderTone=n=>!validShare(n)?'unknown':n>15?'high':n>10?'caution':'lower';
function bundlerTone(data){
 if(!data)return 'unknown';
 const count=Number.isSafeInteger(data.total)&&data.total>=0?data.total:null;
 const held=validShare(data.percentage)?data.percentage:null;
 return count>=500||held>15?'high':count>0||held>0?'caution':count===0&&held===0?'lower':'unknown';
}
const signalValue=(value,label)=>`<strong${label&&label!==value?` aria-label="${esc(value+'. '+label)}" title="${esc(label)}"`:''}>${esc(value)}</strong>`;
const time=n=>new Date(n).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const shortAddress=s=>`${s.slice(0,5)}…${s.slice(-5)}`;
const riskLabels={lower:'No flags reported',caution:'Caution',high:'High risk reported',unknown:'Not fully assessed'};
const riskPill=(level,label)=>`<span class="risk ${level}"><span class="risk-dot" aria-hidden="true"></span>${esc(label||riskLabels[level])}</span>`;
const networkOptions=(selected,chains)=>'<option value="">Choose network</option>'+[...new Set(chains||[...Object.keys(NETWORKS),selected])].flatMap(id=>{const network=getNetwork(id);return network&&network.kind!=='solana'?[`<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(network.name)}</option>`]:[];}).join('');
const pending=state=>['market','risk','listing','history'].some(key=>['waiting','loading'].includes(state[key]?.status));
const welcomeHTML='';
let remembered=null,completedAt=0;
let rememberedChartView={range:'all',selected:null};
let recentHistory;
const getRecentHistory=()=>recentHistory??=createRecentCoinStore();

function sourceLink(url,label,style='text-link',key=label){return `<a class="${style}" data-view-key="${esc(key)}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} <span aria-hidden="true">↗</span></a>`;}
function metric(label,value,style=''){return `<div${style?` class="${esc(style)}"`:''}><dt>${label}</dt><dd class="${value==='Unavailable'?'metric-missing':''}">${value}</dd></div>`;}
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
function marketSection(part){
 if(part.status==='loading')return loading('Getting market data…');
 if(part.status==='error')return `<div class="source-empty"><h4>Market data unavailable</h4><p>${esc(part.message)}</p></div>`;
 if(part.status==='empty')return '<div class="source-empty"><h4>No market data found</h4><p>Check the address and network, or try again later.</p><p>Market data may not be available for new coins yet.</p></div>';
 const m=part.data;
 return `<dl class="check-metrics">${metric('Price',formatMoney(m.price),'metric-price')}${metric('Market cap',formatMoney(m.marketCap),'metric-market-cap')}${metric('Liquidity',formatMoney(m.liquidity))}${metric('Volume · 24h',formatMoney(m.volume))}</dl>`;
}
function mobileMarketExtras(state){
 const m=state.market.status==='ready'?state.market.data:null;
 const waiting=part=>['loading','waiting'].includes(part.status)?'Checking…':'Unavailable';
 const change1h=m?percent(m.change1h):waiting(state.market);
 const change24h=m?percent(m.change):waiting(state.market);
 return `<dl class="check-market-extra" data-view-key="market-extra">${metric('1H change',change1h)}${metric('24H change',change24h)}${promotionRows(state)}</dl>`;
}
function promotionRows(state){
 const listing=state.listing,m=state.market.status==='ready'?state.market.data:null;
 const paidLabels={paid:'Yes','not-reported':'No',cancelled:'No','not-approved':'No',pending:'Pending',unavailable:'Unavailable'};
 const paid=listing?.status==='ready'?(paidLabels[listing.data.profileStatus]||(listing.data.profilePaid===true?'Yes':listing.data.profilePaid===false?'No':'Unavailable')):['loading','waiting'].includes(listing?.status)?'Checking…':'Unavailable';
 const boosts=m?.boostsActive;
 const boostValue=Number.isSafeInteger(boosts)&&boosts>=0?`<span class="dex-boost-count ${boosts>0?'has-boosts':''}" aria-label="${boosts===0?'No active DEX boosts':number(boosts)+' active DEX boosts'}"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M13.5 2 4 14h7l-.5 8L20 10h-7z" fill="currentColor"/></svg><span>${number(boosts)}</span></span>`:['loading','waiting'].includes(state.market.status)?'Checking…':'Unavailable';
 return metric('DEX Screener paid',paid)+metric('DEX boosts',boostValue);
}
function mobileHolderCount(part){
 const count=part.status==='ready'?part.data?.holders:null;
 const value=Number.isSafeInteger(count)&&count>=0?number(count):['loading','waiting'].includes(part.status)?'Checking…':'Unavailable';
 return `<dl class="signal-facts" data-view-key="holder-count">${metric('Holders',value)}</dl>`;
}
function holdingsSection(r){
 const supply=r.supply?compact(Number(r.supply.exact)):'Unavailable';
 const reported=r.largestAccounts||[],topAccounts=reported.filter(a=>a.kind!=='pool').slice(0,10);
 const accounts=reported.filter(a=>a.kind==='pool'||topAccounts.includes(a));
 const tone=holderTone(r.top10Percent),label={lower:'Lower concentration',caution:'Elevated concentration',high:'High concentration',unknown:'Unavailable'}[tone];
 return `<details class="check-more" data-view-key="holders-details" data-signal-tone="${tone}"><summary class="summary-value"><span>Top 10 accounts<small>Known pools excluded</small></span>${signalValue(tone==='unknown'?'Unavailable':shareText(r.top10Percent),label)}</summary>
 <p>Known pools are excluded. Several accounts may share one owner.</p>
 ${r.top10Percent==null?'<p>Top 10 data is incomplete.</p>':''}
 ${accounts.length?`<ol class="holder-list">${accounts.map((a,i)=>`<li><span class="holder-index" aria-hidden="true">${i+1}</span>${sourceLink('https://solscan.io/account/'+a.address,shortAddress(a.address),'holder-address','holder-'+a.address)}${a.kind==='pool'||a.kind==='locker'?`<span class="account-kind">${a.kind==='pool'?'Pool':'Locker'}</span>`:''}<strong>${share(a.percent)}</strong></li>`).join('')}</ol><p>Pool entries are shown separately.</p>`:'<p>Account details unavailable.</p>'}
 <dl class="check-detail-list">${metric('Holders',number(r.holders))}${metric('Total supply',supply)}</dl>${r.supply?`<dl class="check-detail-list exact-supply">${metric('Exact total supply',esc(r.supply.exact))}</dl>`:''}<p>Total supply is not circulating or maximum supply.</p></details>`;
}
function riskSection(part,bundles='',chain='solana'){
 if(part.status!=='ready'){
  const value=part.status==='loading'?'Checking…':'Unavailable';
  const note=part.status==='loading'?'Holder and risk data is still loading.':part.message||'Risk report unavailable. Missing checks never mean low risk.';
  const tone='unknown';
  return `<details class="check-more" data-view-key="holders-details" data-signal-tone="${tone}"><summary class="summary-value"><span>Top 10 accounts<small>Known pools excluded</small></span><strong>${value}</strong></summary><p>${esc(note)}</p></details>${chain==='solana'?`<details class="check-more" data-view-key="insider-details" data-signal-tone="${tone}"><summary class="summary-value"><span>Insiders<small>Rugcheck network signal</small></span><strong>${value}</strong></summary><p>${esc(note)}</p></details>`:''}${bundles}`;
 }
 const r=part.data;
 const insiderCount=Number.isSafeInteger(r.insiderAccounts)&&r.insiderAccounts>=0?r.insiderAccounts:null;
 const insiderLabel=insiderCount>0?number(insiderCount)+(insiderCount===1?' account':' accounts'):'Unavailable';
 const insiderSignal=r.chainId==='solana'?`<details class="check-more" data-view-key="insider-details" data-signal-tone="unknown"><summary class="summary-value"><span>Insiders<small>Rugcheck network signal</small></span><strong>${insiderLabel}</strong></summary><p>The number of people with inside information cannot be verified from this data.</p><p>${insiderCount===null?'Rugcheck did not return a usable account count for this check.':insiderCount===0?'Rugcheck reported no flagged accounts for this check. This does not rule out insider activity.':`Rugcheck reported ${number(insiderCount)} flagged accounts. One person may control multiple accounts; these automated flags do not prove insider knowledge or common ownership.`}</p><p>Reports may be cached. Supply held by these accounts is unavailable. Bundled buys are checked separately.</p></details>`:'';
 return `${holdingsSection(r)}${insiderSignal}${bundles}`;
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
 const tone=bundlerTone(data),label={lower:'None reported',caution:'Attention',high:'High bundling signal',unknown:part?.status==='loading'?'Checking':'Unavailable'}[tone];
 return `<details class="check-more" data-view-key="bundler-details" data-signal-tone="${tone}"><summary class="summary-value"><span>Bundled buys<small>Solana Tracker</small></span>${signalValue(value,label)}</summary>${data?`<dl class="check-detail-list">${metric('Detected wallets',number(data.total))}${metric('Supply held now',share(data.percentage))}</dl><p>Reported wallet patterns, not proof of common ownership or a scam. Zero does not rule out undetected bundles.</p>${data.wallets.length?`<ol class="holder-list">${data.wallets.slice(0,10).map((w,i)=>`<li><span class="holder-index" aria-hidden="true">${i+1}</span>${sourceLink('https://solscan.io/account/'+w.wallet,shortAddress(w.wallet),'holder-address','bundler-'+w.wallet)}<strong>${share(w.percentage)}</strong></li>`).join('')}</ol><p>Showing ${Math.min(10,data.wallets.length)} returned wallets. Provider totals may cover more.</p>`:''}${data.walletsIncomplete?'<p>Some wallet details were unavailable.</p>':''}<p>Retrieved ${esc(time(data.retrievedAt))} · May be cached.</p>`:`<p>${esc(message)}</p>`}</details>`;
}
function aboutSection(part){
 const r=part.data;
 return `<details class="check-more" data-view-key="coin-about"><summary>About this coin</summary><p>${r?.description?esc(r.description):'Description unavailable.'}</p>${r?.description?'<p>Project description via Rugcheck · Unverified</p>':''}</details>`;
}
function projectSection(state){
 const m=state.market.data,listing=state.listing;
 const links=m?.links||[];
 return `<section class="check-project" data-view-key="project-details" aria-labelledby="project-heading"><h3 id="project-heading">Project & promotion</h3>
 ${links.length?`<div class="project-links">${links.map((l,i)=>sourceLink(l.url,l.label,'button project-link','project-link-'+i)).join('')}</div><p class="section-note">Project links · Unverified</p>`:`<p class="section-note">${state.market.status==='loading'?'Checking for project links…':'No project links available.'}</p>`}
 ${listing?.status==='error'?`<p class="section-note">${esc(listing.message)}</p>`:''}</section>`;
}
export function resultHTML(state){
 const m=state.market.data,r=state.risk.data,name=m?.name||r?.name||'Coin lookup',symbol=m?.symbol||r?.symbol;
 const level=r?.level||'unknown',chain=state.chainId||'solana',network=getNetwork(chain);
 const chartReady=state.history?.status==='ready'&&Boolean(state.history.data?.points?.length);
 const chartPart=state.history?.status==='unsupported'?{...state.history,status:'error',message:state.history.message||'Price history is not supported for this network.'}:state.history;
 const validIdentity=network&&validTokenAddress(state.mint,chain),address=encodeURIComponent(state.mint||''),chainPath=encodeURIComponent(chain);
 const sourceLinks=[
  m&&validIdentity?sourceLink('https://dexscreener.com/'+chainPath+'/'+encodeURIComponent(m.pair),'DEX Screener'):'',
  validIdentity&&chain==='solana'?sourceLink('https://rugcheck.xyz/tokens/'+address,'Rugcheck'):validIdentity&&network.securityId?sourceLink('https://api.gopluslabs.io/api/v1/token_security/'+encodeURIComponent(network.securityId)+'?contract_addresses='+address,'GoPlus report'):'',
  validIdentity&&network.explorer?sourceLink(network.explorer+'/token/'+address,'Token explorer'):''
 ].join('');
 const quickRisk=r?riskPill(level):riskPill('unknown',state.risk.status==='loading'?'Risk check pending':'Not assessed');
 const quickReason=r?(r.flags[0]?.name||(r.incomplete?'Some token checks are missing.':'This is not proof of safety.')):state.risk.status==='loading'?'Checking risk…':'Risk report unavailable.';
 const copy=typeof state.mint==='string'&&state.mint.trim()?`<button class="history-copy-ca" type="button" data-view-key="history-copy-ca" data-history-copy-address="${esc(state.mint)}"><span class="history-copy-label">Copy CA</span><svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/></svg></button>`:'';
 const feedback=copy?'<div class="history-copy-feedback" role="status" aria-live="polite" hidden><span class="history-copy-message"></span><code class="history-copy-address" tabindex="0" aria-label="Full token address" hidden></code></div>':'';
 const venue=m?.dex?`<span>${esc(network?.name||'Network unavailable')}</span><span aria-hidden="true">·</span><span class="coin-exchange"><span>${esc(m.dex)}</span>${copy}</span>`:`<span class="coin-exchange"><span>${esc(network?.name||'Network unavailable')}</span>${copy}</span>`;
 return `<article class="live-coin coin-report-priority" data-chart-ready="${chartReady}"><header class="live-coin-head">${coinAvatar(m,name,symbol)}<div class="coin-identity"><div class="coin-title-row"><h2 id="coin-report-title" data-view-key="coin-title" tabindex="-1">${esc(name)}</h2></div><div class="coin-subline">${symbol?`<span>${esc(symbol)}</span><span aria-hidden="true">·</span>`:''}${venue}</div></div></header>${feedback}
 <div class="report-meta"><span>${m?esc(poolAge(m)):'Pool age unavailable'}</span><span>${m||r?esc(time(m?.retrievedAt||r.retrievedAt)):pending(state)?'Checking…':'Check complete'}</span></div>
 <div class="report-risk-area"><div class="quick-risk ${level}"><div>${quickRisk}<p>${esc(quickReason)}</p></div></div><div class="mobile-risk-signals"></div></div>
 <section class="report-panel report-primary" role="region" data-view-key="report-panel-overview" id="report-panel-overview" aria-labelledby="coin-report-title" tabindex="-1">
 <section class="chart-panel" data-view-key="report-panel-chart" id="report-panel-chart" aria-label="Coin chart">${historyHTML(chartPart,m,{compact:true,attribution:false})}</section>
 <div class="report-key-data"><section class="live-market" aria-labelledby="market-heading"><h3 id="market-heading">Market snapshot</h3>${marketSection(state.market)}${mobileMarketExtras(state)}</section><section class="live-security" aria-labelledby="risk-heading"><h3 id="risk-heading">Ownership signals</h3>${riskSection(state.risk,bundlesSection(state.bundles,chain),chain)}${mobileHolderCount(state.risk)}</section></div></section>
 <section class="report-secondary" aria-label="More coin information">${projectSection(state)}
 ${securityDetails(state.risk)}${aboutSection(state.risk)}
 <details class="check-more report-sources" data-view-key="sources"><summary>Sources & coverage</summary><dl class="check-detail-list">${metric('Market data',m?'DEX Screener · '+esc(time(m.retrievedAt)):'Unavailable')}${metric('Holders & risk',r?esc(r.provider||'Rugcheck')+' · '+esc(time(r.retrievedAt)):'Unavailable')}${metric('Price history',state.history?.data?'GeckoTerminal · '+esc(time(state.history.data.retrievedAt)):'Unavailable')}${metric('Paid profile',state.listing?.data?'DEX Screener · '+esc(time(state.listing.data.retrievedAt)):'Unavailable')}</dl><p>Retrieval times shown. Source reports may be cached. Risk labels summarize available checks, not a full security audit.</p><p>Market stats use the highest-liquidity pool returned, not all exchanges.</p><p>Not available here: insider-held supply, all-time high, fresh-wallet percentages, social-account age, view counts, and circulating supply. Insider and bundler signals cover Solana only; bundler data needs a connected source.</p>${chain==='solana'?'<p data-view-key="sniper-coverage">Sniper activity is unavailable: no data source is connected. Insider and bundled-buy results do not establish sniper activity.</p>':''}${historyAttributionHTML()}<div class="report-source-links">${sourceLinks}</div></details>
 <div class="check-address"><span>Token address</span><code>${esc(state.mint)}</code><span>Names and logos can be copied. Check the address.</span></div></section></article>`;
}
export function mountReportLayout(root){
 const market=root?.querySelector('.live-market'),signals=root?.querySelector('.live-security'),mobile=root?.querySelector('.mobile-risk-signals'),desktop=root?.querySelector('.report-key-data');
 const riskArea=root?.querySelector('.report-risk-area'),primary=root?.querySelector('.report-primary'),chart=root?.querySelector('.chart-panel');
 if(!market||!signals||!mobile||!desktop||!riskArea||!primary||!chart)return ()=>{};
 const query=window.matchMedia('(max-width:800px)');
 const arrange=()=>{
  const destination=query.matches?mobile:desktop,[first,second]=query.matches?[signals,market]:[market,signals];
  const focused=market.contains(document.activeElement)||signals.contains(document.activeElement)?document.activeElement:null;
  if(query.matches){if(chart.nextElementSibling!==riskArea)chart.after(riskArea);}
  else if(primary.previousElementSibling!==riskArea)primary.before(riskArea);
  if(first.parentElement!==destination||first.nextElementSibling!==second)destination.append(first,second);
  if(focused&&document.activeElement!==focused)focused.focus({preventScroll:true});
 };
 arrange();query.addEventListener('change',arrange);
 return ()=>query.removeEventListener('change',arrange);
}
export function mountChecker(main,{discover=discoverNetwork,createSession=createLookupSession,historyStore=getRecentHistory(),initialCoin=null,clipboard}={}){
 document.title='Check a coin · Solventir';
 main.innerHTML=`<section class="checker"><div class="checker-intro"><h1>Check a coin<span class="accent">.</span></h1><p>A deeper look at your coin.</p></div><form class="coin-check-form" novalidate><div class="check-label"><label for="coin-address">Token address <span>(CA)</span></label></div><div class="check-input-row"><div class="check-address-input"><input id="coin-address" name="address" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="256" placeholder="Paste a token address" aria-describedby="address-error" value="${esc(remembered?.mint||'')}"><button type="button" class="button clear-address" aria-label="Clear address" title="Clear address" ${remembered?.mint?'':'disabled'}>Clear</button></div><div class="check-network" hidden><label class="sr-only" for="coin-network">Network</label><select id="coin-network" aria-describedby="network-help">${networkOptions(remembered?.chainId)}</select></div><button type="submit" class="button glass">Check coin</button></div><p id="network-help" class="section-note" hidden>Choose the network for this address.</p><p id="address-error" class="field-error" role="alert" hidden></p><details class="check-privacy"><summary>About coin checks</summary><ul class="check-privacy-points"><li>We send the token address to data providers for market data and risk checks. Coverage varies by network. No wallet connection required.</li><li>Up to five recently checked coins are saved in this browser. Clear your recent history anytime.</li><li>Data and image providers may receive your IP address.</li></ul><p><a href="#profile/privacy">Privacy details</a></p></details></form><p class="lookup-status" role="status" aria-live="polite"></p><div id="live-result">${remembered?resultHTML(remembered):welcomeHTML}</div></section>`;
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
 let chartView=remembered?{...rememberedChartView}:{range:'all',selected:null},disposeChart=()=>{},disposeLayout=()=>{},disposeCopy=()=>{};
 const bindChart=()=>{disposeChart();disposeLayout();disposeCopy();disposeLayout=mountReportLayout(output);disposeChart=mountHistoryChart(output.querySelector('.price-history'),current?.history?.data,chartView,current?.market?.data);disposeCopy=mountHistoryCopy(output,{clipboard});};
 bindChart();
 const session=createSession(state=>{
  const same=current?.mint===state.mint&&current?.chainId===state.chainId;
  const open=same?[...output.querySelectorAll('details[open][data-view-key]')].map(el=>el.dataset.viewKey):[];
  const focus=same&&output.contains(document.activeElement)?document.activeElement.closest('[data-view-key]')?.dataset.viewKey:null;
  disposeChart();disposeCopy();if(!same)chartView={range:'all',selected:null};
  current=state;output.innerHTML=resultHTML(state);bindChart();
  for(const el of output.querySelectorAll('[data-view-key]')){if(open.includes(el.dataset.viewKey))el.open=true;if(focus===el.dataset.viewKey)(el.matches('details')?el.querySelector('summary'):el).focus({preventScroll:true});}
  const busy=pending(state);
  output.setAttribute('aria-busy',String(busy));
  status.textContent=busy?'Checking market and risk data…':state.market.status==='ready'||state.risk.status==='ready'?'Results ready.':'No data returned. See details below.';
  if(!busy){remembered=state;finishedAt=completedAt=Date.now();if(!historyRecorded){historyRecorded=true;historyStore.remember(state,undefined,{clearToken:historyToken});renderRecent();}}
 });
 const addressKey=value=>canonicalAddress(value.trim())??value.trim();
 let observedMint=addressKey(input.value),resolvedMint=remembered?.mint?addressKey(remembered.mint):'',discoveryId=0,discoveryController=null,discoveringMint='';
 const cancelDiscovery=()=>{discoveryId++;discoveryController?.abort();discoveryController=null;discoveringMint='';form.setAttribute('aria-busy','false');};
 const hideNetwork=()=>{networkBox.hidden=true;networkHelp.hidden=true;networkSelect.removeAttribute('aria-invalid');};
 const resetNetwork=()=>{hideNetwork();networkSelect.innerHTML=networkOptions();networkSelect.value='';resolvedMint='';};
 hideNetwork();
 const clearReport=()=>{session.cancel();disposeChart();disposeLayout();disposeCopy();remembered=null;current=null;lastSubmitted='';output.innerHTML='';output.setAttribute('aria-busy','false');status.textContent='';};
 const discoveryChains=result=>[...new Set((Array.isArray(result?.chainIds)?result.chainIds:[]).filter(chain=>getNetwork(chain)&&validTokenAddress(addressKey(input.value),chain)))];
 const showNetwork=result=>{
  const chains=discoveryChains(result),ambiguous=result?.status==='ambiguous'&&chains.length>1;
  hideNetwork();networkSelect.value='';resolvedMint='';
  if(ambiguous){
   networkSelect.innerHTML=networkOptions('',chains);networkBox.hidden=false;networkHelp.hidden=false;
   networkHelp.textContent='This address matches more than one network. Choose which one to check.';
   status.textContent='Choose a network to continue.';networkSelect.focus();return;
  }
  const found=chains.map(chain=>getNetwork(chain).name).join(', ');
  status.textContent=result?.status==='not-found'?'No network match found. Check the address, then try Check coin again.':found?`Found on ${found}, but other networks couldn’t be checked. Try Check coin again.`:'We couldn’t finish checking the networks. Try Check coin again.';
 };
 const startLookup=(mint,chain,clearToken=historyStore.beginCheck?.())=>{
  syncRecentVisibility();
  const lookupKey=chain+':'+mint;
  if(lookupKey===lastSubmitted&&(pending(current||{})||current?.bundles?.status==='loading')){status.textContent='Already checking this address.';return;}
  if(lookupKey===lastSubmitted&&current?.market.status==='ready'&&current?.risk.status==='ready'&&current?.listing?.status==='ready'&&current?.history?.status==='ready'&&current?.bundles?.status!=='error'&&Date.now()-finishedAt<30000){status.textContent='Just updated. Wait a few seconds to refresh.';return;}
  lastSubmitted=lookupKey;remembered=null;historyRecorded=false;historyToken=clearToken;networkSelect.removeAttribute('aria-invalid');session.lookup(mint,chain);
 };
 const submit=async e=>{
  e.preventDefault();input.value=input.value.trim();const mint=addressKey(input.value),solana=validTokenAddress(mint,'solana');
  updateClear();
  error.hidden=true;input.removeAttribute('aria-invalid');networkSelect.removeAttribute('aria-invalid');
  if(!validLookupAddress(mint)){
   cancelDiscovery();clearReport();resetNetwork();
   error.textContent='Enter a full token or contract address, without a link.';error.hidden=false;input.setAttribute('aria-invalid','true');input.focus();return;
  }
  if(solana){cancelDiscovery();hideNetwork();startLookup(mint,'solana');return;}
  if(discoveringMint===mint)return;
  if(!networkBox.hidden){
   if(!networkSelect.value){networkSelect.setAttribute('aria-invalid','true');networkSelect.focus();return;}
   resolvedMint=mint;startLookup(mint,networkSelect.value);return;
  }
  if(resolvedMint===mint&&getNetwork(networkSelect.value)&&validTokenAddress(mint,networkSelect.value)){startLookup(mint,networkSelect.value);return;}
  cancelDiscovery();clearReport();resetNetwork();
  const id=discoveryId,controller=new AbortController(),lookupHistoryToken=historyStore.beginCheck?.();discoveryController=controller;discoveringMint=mint;
  form.setAttribute('aria-busy','true');status.textContent='Finding the network…';
  const activeDiscovery=()=>!disposed&&id===discoveryId&&discoveryController===controller&&!controller.signal.aborted&&mint===addressKey(input.value);
  const onRetry=()=>{if(activeDiscovery())status.textContent='Retrying network detection…';};
  let result;
  try{result=await discover(mint,{signal:controller.signal,onRetry});}
  catch{result={status:'incomplete',chainIds:[]};}
  if(!activeDiscovery())return;
  discoveryController=null;discoveringMint='';form.setAttribute('aria-busy','false');
  const chains=discoveryChains(result);
  if(result?.status==='resolved'&&chains.length===1){
   resolvedMint=mint;networkSelect.innerHTML=networkOptions(chains[0],[chains[0]]);networkSelect.value=chains[0];startLookup(mint,chains[0],lookupHistoryToken);
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
  cancelDiscovery();resetNetwork();session.cancel();disposeChart();disposeLayout();disposeCopy();chartView={range:'all',selected:null};input.value='';observedMint='';remembered=null;current=null;lastSubmitted='';finishedAt=completedAt=0;
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
  networkSelect.innerHTML=networkOptions(chain,[chain]);networkSelect.value=getNetwork(chain)?.kind!=='solana'?chain:'';clearButton.disabled=false;error.hidden=true;input.removeAttribute('aria-invalid');
  startLookup(mint,chain);form.scrollIntoView({block:'start',behavior:'auto'});input.focus({preventScroll:true});
 };
 recent.addEventListener('click',recentClick);
 if(initialCoin&&getNetwork(initialCoin.chainId)&&validTokenAddress(initialCoin.address,initialCoin.chainId)){
  const chain=initialCoin.chainId,mint=addressKey(initialCoin.address);
  cancelDiscovery();clearReport();resetNetwork();input.value=mint;observedMint=mint;resolvedMint=mint;
  networkSelect.innerHTML=networkOptions(chain,[chain]);networkSelect.value=getNetwork(chain).kind!=='solana'?chain:'';clearButton.disabled=false;
  startLookup(mint,chain);
 }
 return ()=>{disposed=true;unsubscribeHistory?.();if(remembered){rememberedChartView={...chartView};if(remembered.bundles?.status==='loading')remembered={...remembered,bundles:{status:'error',message:'The bundler check was interrupted. Check the coin again to retry.'}};}cancelDiscovery();session.dispose();disposeChart();disposeLayout();disposeCopy();form.removeEventListener('submit',submit);input.removeEventListener('input',updateClear);clearButton.removeEventListener('click',clear);output.removeEventListener('error',imageError,true);recent.removeEventListener('click',recentClick);recent.removeEventListener('error',recentImageError,true);};
}
