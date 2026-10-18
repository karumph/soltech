import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRisk,normalizeMarket,normalizeListing} from '../dist/coin-checker-data.js';
import {resultHTML} from '../dist/coin-checker.js';
const mint='So11111111111111111111111111111111111111112';
const report=overrides=>normalizeRisk({mint,tokenProgram:'Token',risks:[],token:{supply:1,decimals:9,mintAuthority:null,freezeAuthority:null},...overrides},mint);
const state=risk=>({mint,market:{status:'empty'},risk,listing:{status:'ready',data:{profilePaid:true,retrievedAt:1}}});
const market=()=>({status:'ready',data:normalizeMarket([{chainId:'solana',baseToken:{address:mint,name:'Example coin',symbol:'EX'},pairAddress:mint,priceUsd:'1',marketCap:100000,liquidity:{usd:50000},volume:{h24:20000}}],mint)});
const history=()=>({status:'ready',data:{pair:mint,points:[{timestamp:1800000000000,close:1},{timestamp:1800003600000,close:2}],from:1800000000000,through:1800003600000,observedHigh:2}});
function assertInOrder(html,...markers){
 let previous=-1;
 for(const marker of markers){const index=html.indexOf(marker);assert.ok(index>previous,`Expected ${marker} after the preceding report content`);previous=index;}
}
function assertOutsideDisclosure(html,marker){
 const index=html.indexOf(marker);assert.notEqual(index,-1,`Missing ${marker}`);
 const before=html.slice(0,index);
 assert.equal((before.match(/<details\b/g)||[]).length,(before.match(/<\/details>/g)||[]).length,`${marker} must not require opening a disclosure`);
}
function signalTag(html,key){
 const tag=html.match(new RegExp('<details\\b[^>]*data-view-key="'+key+'"[^>]*>'))?.[0];
 assert.ok(tag,`Missing ${key}`);return tag;
}
function signalTone(html,key){return signalTag(html,key).match(/data-signal-tone="([^"]+)"/)?.[1];}
const bundleReport=(total,percentage,extra={})=>({status:'ready',data:{total,percentage,wallets:[],walletsIncomplete:false,retrievedAt:1,...extra}});

test('insiders show positive account counts and Unavailable for zero or missing counts',()=>{
 for(const [value,label] of [[2019,'2,019 accounts'],[6,'6 accounts'],[1,'1 account'],[0,'Unavailable'],[undefined,'Unavailable']]){
  const html=resultHTML(state({status:'ready',data:report({graphInsidersDetected:value})}),'details');
  assert.match(html,/Insiders/);assert.match(html,/Rugcheck network signal/);
  assert.match(html,new RegExp('<strong\\b[^>]*>'+label+'</strong>'));
  assert.match(html,/Supply held by these accounts is unavailable/);
  assert.equal(signalTone(html,'insider-details'),'unknown');
  const summary=html.match(/data-view-key="insider-details"[^>]*><summary[\s\S]*?<\/summary>/)?.[0];
  assert.doesNotMatch(summary,/Attention|None reported|Unverified/);
  assert.ok(summary.includes(label),'The account count or Unavailable stays visible in the summary');
  assert.match(html,/number of people with inside information cannot be verified/);
  assert.doesNotMatch(html,/data-report-open|View risk checks/);
  if(value>0){assert.ok(html.includes('Rugcheck reported '+value.toLocaleString('en-US')+' flagged accounts'));assert.match(html,/One person may control multiple accounts/);assert.match(html,/do not prove insider knowledge or common ownership/);}
  if(value===0){assert.doesNotMatch(summary,/0 accounts/);assert.match(html,/Rugcheck reported no flagged accounts for this check/);assert.match(html,/does not rule out insider activity/);}
  if(value===undefined)assert.match(html,/did not return a usable account count/);
 }
 const evm=resultHTML({...state({status:'ready',data:{...report({graphInsidersDetected:6}),chainId:'base'}}),chainId:'base'},'details');
 assert.doesNotMatch(evm,/Insiders|6 flagged accounts|sniper-details/);
 assert.doesNotMatch(evm,/Sniper activity is unavailable: no data source is connected/);
});

test('top-account concentration uses explicit percentage boundaries without coercing missing values',()=>{
 const cases=[[0,'lower'],[9.999,'lower'],[10,'lower'],[10.0001,'caution'],[15,'caution'],[15.0001,'high'],[18.4,'high'],[100,'high']];
 for(const [top10Percent,tone] of cases){
  const html=resultHTML(state({status:'ready',data:{...report(),top10Percent}}));
  assert.equal(signalTone(html,'holders-details'),tone,`Top 10 accounts at ${top10Percent}%`);
 }
 for(const top10Percent of [null,undefined,-1,100.001,NaN,Infinity,'10','',false]){
  const html=resultHTML(state({status:'ready',data:{...report(),top10Percent}}));
  assert.equal(signalTone(html,'holders-details'),'unknown',`Invalid concentration: ${String(top10Percent)}`);
 }
});

test('insider counts are counts rather than supply percentages and invalid counts stay unknown',()=>{
 for(const insiderAccounts of [1,6,500]){
  const html=resultHTML(state({status:'ready',data:{...report(),insiderAccounts}}));
  assert.equal(signalTone(html,'insider-details'),'unknown',`${insiderAccounts} reported accounts do not verify insider identities`);
 }
 for(const insiderAccounts of [null,undefined,-1,0.5,'6',NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
  const html=resultHTML(state({status:'ready',data:{...report(),insiderAccounts}}));
  assert.equal(signalTone(html,'insider-details'),'unknown',`Invalid insider count: ${String(insiderAccounts)}`);
  const summary=html.match(/data-view-key="insider-details"[^>]*><summary[\s\S]*?<\/summary>/)?.[0];
  assert.match(summary,/<strong>Unavailable<\/strong>/);
  assert.doesNotMatch(summary,/0 accounts/);
 }
});

test('unavailable and pending ownership checks stay neutral instead of implying a lower reading',()=>{
 for(const risk of [{status:'loading'},{status:'error',message:'Unavailable'},{status:'empty'}]){
  const html=resultHTML(state(risk));
  for(const key of ['holders-details','insider-details'])assert.equal(signalTone(html,key),'unknown',`${risk.status}: ${key}`);
 }
 for(const risk of [{status:'loading'},{status:'error',message:'Unavailable'},{status:'ready',data:report({graphInsidersDetected:0})}]){
  const html=resultHTML(state(risk));
  const sources=html.match(/<details\b[^>]*data-view-key="sources"[^>]*>[\s\S]*?<\/details>/)?.[0];
  assert.doesNotMatch(html,/data-view-key="sniper-details"/);
  assert.match(sources,/Sniper activity is unavailable: no data source is connected/);
  assert.match(sources,/Insider and bundled-buy results do not establish sniper activity/);
 }
});

test('bundler colors distinguish current supply and wallet counts, including positive counts with zero holdings',()=>{
 const cases=[
  [bundleReport(0,0),'lower'],
  [bundleReport(3,0),'caution'],[bundleReport(3,12),'caution'],[bundleReport(1,null),'caution'],[bundleReport(499,0),'caution'],[bundleReport(3,15),'caution'],
  [bundleReport(500,0),'high'],[bundleReport(500,null),'high'],[bundleReport(1,15.0001),'high'],[bundleReport(1,100),'high'],
  [bundleReport(null,5),'caution'],[bundleReport(null,16),'high'],
  [bundleReport(1,0,{initialPercentage:90}),'caution']
 ];
 for(const [bundles,tone] of cases){
  const html=resultHTML({...state({status:'ready',data:report()}),bundles});
  assert.equal(signalTone(html,'bundler-details'),tone,`Count ${bundles.data.total}; current ${bundles.data.percentage}%; initial ${bundles.data.initialPercentage}`);
 }
 const html=resultHTML({...state({status:'ready',data:report()}),bundles:bundleReport(6,null)});
 const summary=html.match(/data-view-key="bundler-details"[^>]*>[\s\S]*?<\/summary>/)?.[0];
 assert.match(summary,/<strong\b[^>]*>6 wallets<\/strong>/);
 assert.doesNotMatch(summary,/6%|6\.0%/);
});

test('bundler lower readings require explicit zero count and zero current supply',()=>{
 const cases=[
  bundleReport(0,null),bundleReport(null,0),bundleReport(undefined,undefined),bundleReport(null,null),
  bundleReport(-1,0),bundleReport(0,-1),bundleReport(0,101),bundleReport(0,NaN),bundleReport(Infinity,0),
  bundleReport('500',0),bundleReport(0,'16'),bundleReport(0.5,0),bundleReport(Number.MAX_SAFE_INTEGER+1,0),
  {status:'loading'},{status:'error',message:'Unavailable'},{status:'not-connected'}
 ];
 for(const bundles of cases){
  const html=resultHTML({...state({status:'ready',data:report()}),bundles});
  assert.equal(signalTone(html,'bundler-details'),'unknown',`Incomplete or invalid bundles: ${JSON.stringify(bundles)}`);
 }
});

test('a positive fractional total supply never renders as zero',()=>{
 const html=resultHTML(state({status:'ready',data:report()}));
 assert.match(html,/<dt>Total supply<\/dt><dd class="">1\.000e-9<\/dd>/);
 assert.match(html,/0\.000000001/);
});
test('unavailable risk stays unassessed even with an approved paid profile',()=>{
 const html=resultHTML(state({status:'error',message:'Unavailable'}));
 assert.match(html,/Not assessed/);assert.match(html,/<dt>DEX Screener paid<\/dt><dd class="">Yes<\/dd>/);assert.doesNotMatch(html,/risk lower|No flags reported/);
});

test('new-network market reports keep their identity and neutral unsupported checks without fabricated source links',()=>{
 const address='TokenCase123',chainId='future-network';
 const input={mint:address,chainId,market:{status:'ready',data:{...market().data,mint:address,chainId,pair:'PoolCase456',name:'Future coin',symbol:'FUT',dex:'Uniswap'}},risk:{status:'unsupported',message:'Risk checks are not supported for this network.'},listing:{status:'empty'},history:{status:'unsupported',message:'Price history is not supported for this network.'},bundles:{status:'unsupported'}};
 const html=resultHTML(input);
 assert.match(html,/Future coin/);assert.match(html,/Future Network/);assert.match(html,/<span>Uniswap<\/span>/);assert.match(html,/Not assessed/);
 assert.match(html,/Risk checks are not supported/);assert.match(html,/Price history is not supported/);
 assert.match(html,/https:\/\/dexscreener\.com\/future-network\/PoolCase456/);
 assert.doesNotMatch(html,/GoPlus report|Token explorer|undefined\/|null\/|risk lower|No flags reported|Insiders/);
 assert.equal(signalTone(html,'holders-details'),'unknown');
 assert.match(html,/data-chart-ready="false"/);assert.equal((html.match(/<dt>Price<\/dt>/g)||[]).length,1);assert.equal((html.match(/<dt>Market cap<\/dt>/g)||[]).length,1);
});

test('report source paths encode structured token identities and omit unknown explorer destinations',()=>{
 const address='0x2::coin::Example',chainId='sui',pair='0x3::pool::Pool';
 const input={mint:address,chainId,market:{status:'ready',data:{...market().data,mint:address,chainId,pair}},risk:{status:'unsupported'},listing:{status:'empty'},history:{status:'unsupported'},bundles:{status:'unsupported'}};
 const html=resultHTML(input);assert.match(html,/https:\/\/dexscreener\.com\/sui\/0x3%3A%3Apool%3A%3APool/);assert.match(html,/data-history-copy-address="0x2::coin::Example"/);assert.doesNotMatch(html,/Token explorer|gopluslabs|undefined/);
 const invalid=resultHTML({...input,chainId:'constructor'});assert.match(invalid,/Network unavailable/);assert.doesNotMatch(invalid,/href="[^"]*(?:constructor|undefined)/);
});

test('Robinhood preserves the exact contract and exchange with only mapped provider links',()=>{
 const address='0x2a13008CC2F5A853F6Fb21cbD90841806C64b247',chainId='robinhood';
 const html=resultHTML({mint:address,chainId,market:{status:'ready',data:{...market().data,mint:address,chainId,pair:'0x'+'1'.repeat(40),name:'TROLL',symbol:'TROLL',dex:'uniswap'}},risk:{status:'error',message:'Risk unavailable.'},listing:{status:'empty'},history:{status:'error',message:'History unavailable.'}});
 assert.match(html,/Robinhood/);assert.match(html,/TROLL/);assert.match(html,new RegExp('data-history-copy-address="'+address+'"'));
 assert.match(html,/dexscreener\.com\/robinhood\//);assert.doesNotMatch(html,/Token explorer|undefined\/|null\//);
});

test('chart readiness exposes current figures when history is pending or unavailable without duplicating their nodes',()=>{
 const input={...state({status:'error'}),market:market()};
 for(const part of [undefined,{status:'waiting'},{status:'loading'},{status:'empty'},{status:'error',message:'Unavailable'},{status:'unsupported'}]){
  const html=resultHTML({...input,history:part});assert.match(html,/data-chart-ready="false"/);
  assert.equal((html.match(/<dt>Price<\/dt>/g)||[]).length,1);assert.equal((html.match(/<dt>Market cap<\/dt>/g)||[]).length,1);
 }
 const complete=resultHTML({...input,history:history()});assert.match(complete,/data-chart-ready="true"/);assert.equal((complete.match(/data-history-plot/g)||[]).length,1);
});
test('boost counts stay separate from paid status, spend and risk; missing counts are not zero',()=>{
 const input=state({status:'error',message:'Unavailable'});
 const pair={chainId:'solana',baseToken:{address:mint,name:'SOL',symbol:'SOL'},pairAddress:mint,boosts:{active:50}};
 const html=resultHTML({...input,market:{status:'ready',data:normalizeMarket([pair],mint)}});
 assert.match(html,/50 active/);assert.doesNotMatch(html,/About paid profiles & boosts/);assert.match(html,/Not assessed/);
 assert.doesNotMatch(html,/risk lower|No flags reported|\$50/);
 const missing=resultHTML(input);
 assert.match(missing,/<dt>DEX boosts<\/dt><dd class="metric-missing">Unavailable<\/dd>/);assert.doesNotMatch(missing,/0 active/);
 const zero=resultHTML({...input,market:{status:'ready',data:normalizeMarket([{...pair,boosts:{active:0}}],mint)}});
 assert.match(zero,/aria-label="No active DEX boosts"/);assert.match(zero,/<span>0<\/span>/);assert.doesNotMatch(zero,/has-boosts/);
});
test('a report preserves the most serious warning and escapes source content',()=>{
 const html=resultHTML(state({status:'ready',data:report({tokenMeta:{name:'<img src=x onerror=alert(1)>'},risks:[{name:'Mutable',level:'warn'},{name:'Freeze enabled',description:'<script>bad</script>',level:'danger'}]})}));
 assert.match(html,/quick-risk high/);assert.match(html,/High risk reported/);assert.match(html,/Freeze enabled/);
 assert.doesNotMatch(html,/<img|<script/);assert.match(html,/&lt;script&gt;/);
});

test('promotion summary reports paid status separately and never turns missing or stale data into No or zero',()=>{
 const input={...state({status:'error',message:'Unavailable'}),market:{status:'ready',data:{...market().data,boostsActive:500}},history:history()};
 const cases=[['approved','Yes'],['cancelled','No'],['rejected','No'],['processing','Pending'],['new-status','Unavailable']];
 for(const [status,label] of cases){
  const html=resultHTML({...input,listing:{status:'ready',data:normalizeListing([{type:'tokenProfile',status}])}});
  const extra=html.match(/<dl class="check-market-extra"[^>]*>[\s\S]*?<\/dl>/)?.[0];
  assert.match(extra,new RegExp('<dt>DEX Screener paid</dt><dd[^>]*>'+label+'</dd>'));
  assert.match(extra,/aria-label="500 active DEX boosts"/);assert.match(extra,/<svg[^>]*aria-hidden="true"/);
  assert.equal((html.match(/<dt>DEX Screener paid<\/dt>/g)||[]).length,1);assert.equal((html.match(/<dt>DEX boosts<\/dt>/g)||[]).length,1);
  assertOutsideDisclosure(html,'<dt>DEX Screener paid</dt>');
  assertOutsideDisclosure(html,'<dt>DEX boosts</dt>');
  assert.doesNotMatch(html,/<dl class="check-detail-list profile-status">/);
 }
 const no=resultHTML({...input,listing:{status:'ready',data:normalizeListing([])}});
 assert.match(no,/<dt>DEX Screener paid<\/dt><dd class="">No<\/dd>/);
 for(const [status,label] of [['loading','Checking…'],['waiting','Checking…'],['error','Unavailable']]){
  const html=resultHTML({...input,market:{status,data:input.market.data},listing:{status,data:{profilePaid:true,profileStatus:'paid'}}});
  const extra=html.match(/<dl class="check-market-extra"[^>]*>[\s\S]*?<\/dl>/)?.[0];
  for(const name of ['DEX Screener paid','DEX boosts'])assert.match(extra,new RegExp('<dt>'+name+'</dt><dd[^>]*>'+label+'</dd>'));
  assert.doesNotMatch(extra,/>Yes<|>No<|500 active|No active/);
 }
});
test('a cancelled profile and absent boost field explain the observed report without claiming zero',()=>{
 const input=state({status:'error',message:'Unavailable'});
 input.market={status:'ready',data:normalizeMarket([{chainId:'solana',baseToken:{address:mint},pairAddress:mint}],mint)};
 input.listing={status:'ready',data:normalizeListing({orders:[{type:'tokenProfile',status:'cancelled'}],boosts:[]})};
 const html=resultHTML(input);
 assert.match(html,/<dt>DEX Screener paid<\/dt><dd class="">No<\/dd>/);
 assert.match(html,/<dt>DEX boosts<\/dt><dd class="metric-missing">Unavailable<\/dd>/);
 assert.doesNotMatch(html,/No active DEX boosts|<span>0<\/span>|has-boosts/);
});
test('the default report exposes one chart before key figures and holder signals',()=>{
 const html=resultHTML({...state({status:'ready',data:report({graphInsidersDetected:6,risks:[{name:'Freeze enabled',level:'danger'}]})}),market:market(),history:history(),bundles:{status:'not-connected'}});
 assertInOrder(html,'Example coin','High risk reported','id="report-panel-chart"','<dt>Market cap</dt>','Top 10 accounts','Insiders','Bundled buys','data-view-key="project-details"','data-view-key="risk-details"','data-view-key="coin-about"','data-view-key="sources"');
 const sources=html.match(/<details\b[^>]*data-view-key="sources"[^>]*>[\s\S]*?<\/details>/)?.[0];
 assert.match(sources,/href="https:\/\/www\.tradingview\.com\/"/);
 assert.match(sources,/TradingView Lightweight Charts™<\/a> · Copyright \(с\) 2025 TradingView, Inc\./);
 assert.equal((html.match(/class="section-note history-attribution"/g)||[]).length,1);
 assert.doesNotMatch(html,/data-view-key="dex-promotion"/);
 assertOutsideDisclosure(html,'High risk reported');
 assertOutsideDisclosure(html,'Freeze enabled');
 assertOutsideDisclosure(html,'id="report-panel-chart"');
 assert.equal((html.match(/data-history-plot/g)||[]).length,1,'A report must not duplicate the interactive chart');
 assert.match(html,/<div class="metric-price"><dt>Price<\/dt>/);
 assert.match(html,/<div class="metric-market-cap"><dt>Market cap<\/dt>/);
 assert.match(html,/<option value="price"[^>]*>Price<\/option>/);
 assert.match(html,/<option value="cap" selected>Market cap \(est\.\)<\/option>/);
 assert.match(html,new RegExp('data-history-copy-address="'+mint+'"'));
 assert.equal((html.match(/data-view-key="history-copy-ca"/g)||[]).length,1);
 assert.doesNotMatch(html,/role="tablist"|role="tabpanel"|data-report-section=/);
 const chartTag=html.match(/<section\b[^>]*\bid="report-panel-chart"[^>]*>/)?.[0];
 assert.ok(chartTag,'The chart has a stable report region');assert.doesNotMatch(chartTag,/\bhidden(?:\s|=|>)/);
 const overviewTag=html.match(/<section\b[^>]*\bid="report-panel-overview"[^>]*>/)?.[0];
 assert.ok(overviewTag,'The overview remains a focus target after network selection');
 assert.match(overviewTag,/role="region"/);assert.match(overviewTag,/tabindex="-1"/);assert.match(overviewTag,/aria-label(?:ledby)?="[^"]+"/);
 assert.match(overviewTag,/data-view-key="report-panel-overview"/);assert.doesNotMatch(overviewTag,/\bhidden(?:\s|=|>)/);
});

test('unassessed and incomplete risk warnings remain before the chart, outside disclosures',()=>{
 for(const risk of [{status:'error',message:'Unavailable'},{status:'loading'},{status:'ready',data:report({token:{supply:1,decimals:9}})}]){
  const html=resultHTML({...state(risk),market:market(),history:history()});
  const warning=risk.status==='loading'?'Risk check pending':risk.status==='ready'?'Not fully assessed':'Not assessed';
  assertInOrder(html,warning,'id="report-panel-chart"');assertOutsideDisclosure(html,warning);
  assert.doesNotMatch(html,/risk lower|No flags reported/);
 }
});

test('one header Copy CA action follows the exchange and remains available without chart data',()=>{
 for(const part of [history(),{status:'loading'},{status:'error',message:'Unavailable'},{status:'empty'}]){
  const tokenMarket=market();tokenMarket.data.dex='PumpSwap';
  const html=resultHTML({...state({status:'ready',data:report()}),market:tokenMarket,history:part});
  const header=html.match(/<header class="live-coin-head">[\s\S]*?<\/header>/)?.[0];
  assert.match(header,/<div class="coin-identity"><div class="coin-title-row"><h2[^>]*>Example coin<\/h2><\/div><div class="coin-subline">/);
  assert.match(header,/<span class="coin-exchange"><span>PumpSwap<\/span><button class="history-copy-ca" type="button"/);
  assert.match(header,new RegExp('data-history-copy-address="'+mint+'"'));
  assert.match(header,/<span class="history-copy-label">Copy CA<\/span><svg/);
  assert.equal((html.match(/data-view-key="history-copy-ca"/g)||[]).length,1);
  assert.match(html,/<\/header><div class="history-copy-feedback" role="status" aria-live="polite" hidden>/);
  assert.match(html,/<code class="history-copy-address" tabindex="0" aria-label="Full token address" hidden>/);
  const chart=html.match(/<section class="chart-panel"[^>]*>[\s\S]*?<\/section>/)?.[0];
  assert.doesNotMatch(chart,/history-copy-ca|history-copy-feedback/);
 }
 for(const mint of ['',null,undefined,'   '])assert.doesNotMatch(resultHTML({...state({status:'error',message:'Unavailable'}),mint}),/history-copy-ca|history-copy-feedback/);
 const escaped=resultHTML({...state({status:'error',message:'Unavailable'}),mint:'abc"><img src=x>'});
 assert.doesNotMatch(escaped,/<img/);assert.match(escaped,/data-history-copy-address="abc&quot;&gt;&lt;img src=x&gt;"/);
});

test('pending chart or bundler data does not hide available coin results',()=>{
 const input={...state({status:'ready',data:report({graphInsidersDetected:6})}),market:market()};
 const waitingChart=resultHTML({...input,history:{status:'loading'},bundles:{status:'not-connected'}});
 assertInOrder(waitingChart,'id="report-panel-chart"','Getting price history','<dt>Market cap</dt>','Top 10 accounts','Insiders','Bundled buys');
 for(const bundles of [{status:'loading'},{status:'error',message:'Bundler service unavailable.'},{status:'not-connected'}]){
  const html=resultHTML({...input,history:history(),bundles});
  assert.equal((html.match(/data-history-plot/g)||[]).length,1);
  assertInOrder(html,'id="report-panel-chart"','<dt>Market cap</dt>','Top 10 accounts','Insiders','Bundled buys');
  const bundleSummary=html.match(/<details\b[^>]*data-view-key="bundler-details"[^>]*>\s*<summary\b[^>]*>[\s\S]*?<\/summary>/)?.[0];
  assert.ok(bundleSummary,'Bundler availability is reported independently');
  assert.match(bundleSummary,new RegExp(bundles.status==='loading'?'Checking…':bundles.status==='not-connected'?'Not connected':'Unavailable'));
  assert.doesNotMatch(bundleSummary,/0%|0 wallets|0 held/);
 }
});

test('compact mobile facts use holder counts independently from insider counts and expose existing market data',()=>{
 const risk={status:'ready',data:report({totalHolders:2300,graphInsidersDetected:2019,token:{supply:'1000000000000000000',decimals:9,mintAuthority:null,freezeAuthority:null}})};
 const marketData={...market().data,change1h:8.1,change:-18,buys1h:848,sells1h:380};
 const html=resultHTML({...state(risk),market:{status:'ready',data:marketData},history:history()});
 const holders=html.match(/<dl class="signal-facts"[^>]*>[\s\S]*?<\/dl>/)?.[0];
 const extra=html.match(/<dl class="check-market-extra"[^>]*>[\s\S]*?<\/dl>/)?.[0];
 assert.match(holders,/<dt>Holders<\/dt><dd class="">2,300<\/dd>/);
 assert.doesNotMatch(html,/Holder accounts/);
 assert.doesNotMatch(holders,/2,019|2019|%/);
 assert.match(signalTag(html,'insider-details'),/data-signal-tone="unknown"/);
 assert.match(extra,/<dt>1H change<\/dt><dd class="">\+8\.1%<\/dd>/);
 assert.match(extra,/<dt>24H change<\/dt><dd class="">-18%<\/dd>/);
 assert.equal((extra.match(/<dt>/g)||[]).length,4,'Both change periods and promotion figures remain visible in compact extras');
 assertInOrder(extra,'1H change','24H change','DEX Screener paid','DEX boosts');
 assert.doesNotMatch(extra,/Total supply|buys|sells/);
 const holderDetails=html.match(/<details\b[^>]*data-view-key="holders-details"[^>]*>[\s\S]*?<\/details>/)?.[0];
 assert.match(holderDetails,/<dt>Total supply<\/dt><dd class="">1B<\/dd>/);
 assert.match(holderDetails,/<dt>Exact total supply<\/dt><dd class="">1000000000<\/dd>/);
 assert.doesNotMatch(html,/Trading activity|Trading & pool details|Market details|data-view-key="(?:trading|market)-details"|check-activity/);
 assertInOrder(html,'id="report-panel-chart"','class="check-metrics"','class="check-market-extra"');
 assertOutsideDisclosure(html,'class="check-market-extra"');
 assertOutsideDisclosure(html,'class="signal-facts"');
 assert.equal((html.match(/data-history-plot/g)||[]).length,1);
});

test('compact rows follow their own source readiness and never substitute stale figures or missing values with zero',()=>{
 const staleRisk=report({totalHolders:2300,graphInsidersDetected:2019});
 const staleMarket={...market().data,change1h:8.1,change:-18,buys1h:848,sells1h:380};
 for(const status of ['loading','error']){
  const html=resultHTML({...state({status,data:staleRisk}),market:{status,data:staleMarket}});
  const holders=html.match(/<dl class="signal-facts"[^>]*>[\s\S]*?<\/dl>/)?.[0];
  const extra=html.match(/<dl class="check-market-extra"[^>]*>[\s\S]*?<\/dl>/)?.[0];
  const fallback=status==='loading'?'Checking…':'Unavailable';
  assert.match(holders,new RegExp(fallback));assert.match(extra,new RegExp(fallback));
  assert.doesNotMatch(holders,/2,300|2,019/);assert.doesNotMatch(extra,/8\.1%|-18%|848|380|0 \/ 0/);
  assert.equal((extra.match(new RegExp(fallback,'g'))||[]).length,3,'Changes and boosts follow market readiness independently of the paid-profile result');
 }
 const partial=resultHTML({...state({status:'loading'}),market:{status:'ready',data:{...market().data,change1h:0,buys1h:0,sells1h:null}}});
 const extra=partial.match(/<dl class="check-market-extra"[^>]*>[\s\S]*?<\/dl>/)?.[0];
 assert.match(extra,/<dt>1H change<\/dt><dd class="">0%<\/dd>/);
 assert.doesNotMatch(extra,/Total supply|buys|sells/);
 assert.match(extra,/<dt>24H change<\/dt><dd class="metric-missing">Unavailable<\/dd>/);
 const zero24h=resultHTML({...state({status:'loading'}),market:{status:'ready',data:{...market().data,change1h:null,change:0}}});
 assert.match(zero24h,/<dt>1H change<\/dt><dd class="metric-missing">Unavailable<\/dd>/);
 assert.match(zero24h,/<dt>24H change<\/dt><dd class="">0%<\/dd>/);
 const missing=resultHTML(state({status:'ready',data:report()}));
 assert.match(missing,/<dl class="signal-facts"[^>]*><div><dt>Holders<\/dt><dd class="metric-missing">Unavailable<\/dd>/);
});

test('safe social links appear once in the visible Project and promotion section',()=>{
 const data=normalizeMarket([{chainId:'solana',baseToken:{address:mint,name:'Example coin'},pairAddress:mint,info:{
  websites:[{url:'https://example.com/project?x=1&y=2'},{url:'javascript:alert(1)'}],
  socials:[{type:'twitter',url:'https://x.com/example'},{type:'telegram',url:'https://t.me/example'},{type:'twitter',url:'https://unrelated.example/pretend'}]
 }}],mint);
 const html=resultHTML({...state({status:'ready',data:report()}),market:{status:'ready',data}});
 const links=html.match(/<div class="project-links">[\s\S]*?<\/div>/)?.[0];
 assert.ok(links);
 assert.match(links,/href="https:\/\/example\.com\/project\?x=1&amp;y=2"/);
 for(const label of ['Website','X','Telegram'])assert.match(links,new RegExp('>'+label+' <span'));
 assert.equal((links.match(/target="_blank" rel="noopener noreferrer"/g)||[]).length,3);
 assert.doesNotMatch(links,/javascript:|unrelated\.example/);
 assert.equal((html.match(/href="https:\/\/x\.com\/example"/g)||[]).length,1);
 assert.equal((html.match(/href="https:\/\/t\.me\/example"/g)||[]).length,1);
 assert.equal((html.match(/href="https:\/\/example\.com\/project\?x=1&amp;y=2"/g)||[]).length,1);
 assert.doesNotMatch(html,/class="check-social-links"|compact-project-link-/);
 const project=html.match(/<section\b[^>]*data-view-key="project-details"[^>]*>/)?.[0];
 assert.ok(project,'Project and promotion is a regular visible section');
 assert.doesNotMatch(project,/\bhidden(?:\s|=|>)/);
 assertOutsideDisclosure(html,'data-view-key="project-details"');
 assertOutsideDisclosure(html,'class="project-links"');
 const keys=[...html.matchAll(/data-view-key="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(new Set(keys).size,keys.length,'Project links retain unique stable keys');
 assert.doesNotMatch(resultHTML({...state({status:'ready',data:report()}),market:market()}),/class="check-social-links"/);
});

test('a completed empty or failed lookup does not leave the report checking forever',()=>{
 for(const status of ['empty','error']){
  const input={mint,market:{status},risk:{status},listing:{status},history:{status:'empty'}};
  const html=resultHTML(input);
  assert.match(html,/<div class="report-meta"><span>Pool age unavailable<\/span><span>Check complete<\/span><\/div>/);
  assert.doesNotMatch(html,/Checking…/);
 }
 const loading=resultHTML({mint,market:{status:'loading'},risk:{status:'loading'},listing:{status:'loading'},history:{status:'waiting'}});
 assert.match(loading,/<div class="report-meta"><span>Pool age unavailable<\/span><span>Checking…<\/span><\/div>/);
});
