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

test('suspected insiders remain provider signals, not bundle percentages or a clean bill of health',()=>{
 for(const [value,label] of [[6,'6 reported'],[0,'0 reported'],[undefined,'Unavailable']]){
  const html=resultHTML(state({status:'ready',data:report({graphInsidersDetected:value})}),'details');
  assert.match(html,/Suspected insiders/);assert.match(html,/Accounts reported by Rugcheck/);
  assert.ok(html.includes('<strong>'+label+'</strong>'));
  assert.match(html,/Insider-held supply is unavailable/);
  assert.match(signalTag(html,'insider-details'),new RegExp('data-signal-tone="'+(value===undefined?'unknown':value>0?'caution':'info')+'"'));
  assert.doesNotMatch(html,/data-report-open|View risk checks/);
  if(value===0)assert.match(html,/does not rule out insiders/);
  if(value===undefined)assert.match(html,/did not supply a usable count/);
 }
 const evm=resultHTML({...state({status:'ready',data:{...report({graphInsidersDetected:6}),chainId:'base'}}),chainId:'base'},'details');
 assert.doesNotMatch(evm,/Suspected insiders|6 reported|sniper-details/);
});

test('ownership signal tones distinguish reported figures from unavailable data',()=>{
 for(const top10Percent of [null,0,18.4]){
  const html=resultHTML(state({status:'ready',data:{...report(),top10Percent}}));
  assert.match(signalTag(html,'holders-details'),new RegExp('data-signal-tone="'+(top10Percent===null?'unknown':'info')+'"'));
 }
 for(const risk of [{status:'loading'},{status:'error',message:'Unavailable'},{status:'ready',data:report({graphInsidersDetected:0})}]){
  const html=resultHTML(state(risk));
  const sniper=html.match(/<details\b[^>]*data-view-key="sniper-details"[^>]*>[\s\S]*?<\/details>/)?.[0];
  assert.ok(sniper,'Solana shows unavailable sniper coverage rather than borrowing another signal');
  assert.match(signalTag(html,'sniper-details'),/data-signal-tone="unknown"/);
  assert.match(sniper,/<strong>Unavailable<\/strong>/);assert.doesNotMatch(sniper,/Checking…|0 reported|0%/);
 }
});

test('bundler caution reflects detected wallets even when those wallets hold zero supply now',()=>{
 const ready=(total,percentage)=>({status:'ready',data:{total,percentage,wallets:[],walletsIncomplete:false,retrievedAt:1}});
 const cases=[[ready(3,0),'caution'],[ready(3,12),'caution'],[ready(0,0),'info'],[{status:'loading'},'info'],[{status:'error',message:'Unavailable'},'unknown'],[{status:'not-connected'},'unknown']];
 for(const [bundles,tone] of cases){
  const html=resultHTML({...state({status:'ready',data:report()}),bundles});
  assert.match(signalTag(html,'bundler-details'),new RegExp('data-signal-tone="'+tone+'"'));
 }
});

test('a positive fractional total supply never renders as zero',()=>{
 const html=resultHTML(state({status:'ready',data:report()}));
 assert.match(html,/<dt>Total supply<\/dt><dd class="">1\.000e-9<\/dd>/);
 assert.match(html,/0\.000000001/);
});
test('unavailable risk stays unassessed even with an approved paid profile',()=>{
 const html=resultHTML(state({status:'error',message:'Unavailable'}));
 assert.match(html,/Not assessed/);assert.match(html,/<dt>Paid DEX Screener profile<\/dt><dd class="">Yes<\/dd>/);assert.doesNotMatch(html,/risk lower|No flags reported/);
});
test('boost counts stay separate from paid status, spend and risk; missing counts are not zero',()=>{
 const input=state({status:'error',message:'Unavailable'});
 const pair={chainId:'solana',baseToken:{address:mint,name:'SOL',symbol:'SOL'},pairAddress:mint,boosts:{active:50}};
 const html=resultHTML({...input,market:{status:'ready',data:normalizeMarket([pair],mint)}});
 assert.match(html,/50 active/);assert.match(html,/not dollars spent/);assert.match(html,/Not assessed/);
 assert.doesNotMatch(html,/risk lower|No flags reported|\$50/);
 const missing=resultHTML(input);
 assert.match(missing,/<dt>DEX Screener boosts<\/dt><dd class="metric-missing">Unavailable<\/dd>/);assert.doesNotMatch(missing,/0 active/);
 const zero=resultHTML({...input,market:{status:'ready',data:normalizeMarket([{...pair,boosts:{active:0}}],mint)}});
 assert.match(zero,/aria-label="No active DEX boosts"/);assert.match(zero,/<span>0<\/span>/);assert.doesNotMatch(zero,/has-boosts/);
});
test('a report preserves the most serious warning and escapes source content',()=>{
 const html=resultHTML(state({status:'ready',data:report({tokenMeta:{name:'<img src=x onerror=alert(1)>'},risks:[{name:'Mutable',level:'warn'},{name:'Freeze enabled',description:'<script>bad</script>',level:'danger'}]})}));
 assert.match(html,/quick-risk high/);assert.match(html,/High risk reported/);assert.match(html,/Freeze enabled/);
 assert.doesNotMatch(html,/<img|<script/);assert.match(html,/&lt;script&gt;/);
});
test('a cancelled profile and absent boost field explain the observed report without claiming zero',()=>{
 const input=state({status:'error',message:'Unavailable'});
 input.market={status:'ready',data:normalizeMarket([{chainId:'solana',baseToken:{address:mint},pairAddress:mint}],mint)};
 input.listing={status:'ready',data:normalizeListing({orders:[{type:'tokenProfile',status:'cancelled'}],boosts:[]})};
 const html=resultHTML(input);
 assert.match(html,/<dt>Paid DEX Screener profile<\/dt><dd class="">Cancelled<\/dd>/);
 assert.match(html,/<dt>DEX Screener boosts<\/dt><dd class="">Unknown<\/dd>/);
 assert.doesNotMatch(html,/No active DEX boosts|<span>0<\/span>|has-boosts/);
});
test('the default report exposes one chart before key figures and holder signals',()=>{
 const html=resultHTML({...state({status:'ready',data:report({graphInsidersDetected:6,risks:[{name:'Freeze enabled',level:'danger'}]})}),market:market(),history:history(),bundles:{status:'not-connected'}});
 assertInOrder(html,'Example coin','High risk reported','id="report-panel-chart"','<dt>Market cap</dt>','Top 10 accounts','Suspected insiders','Bundled buys','data-view-key="coin-about"','data-view-key="sources"');
 assertOutsideDisclosure(html,'High risk reported');
 assertOutsideDisclosure(html,'Freeze enabled');
 assertOutsideDisclosure(html,'id="report-panel-chart"');
 assert.equal((html.match(/data-history-plot/g)||[]).length,1,'A report must not duplicate the interactive chart');
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

test('pending chart or bundler data does not hide available coin results',()=>{
 const input={...state({status:'ready',data:report({graphInsidersDetected:6})}),market:market()};
 const waitingChart=resultHTML({...input,history:{status:'loading'},bundles:{status:'not-connected'}});
 assertInOrder(waitingChart,'id="report-panel-chart"','Getting price history','<dt>Market cap</dt>','Top 10 accounts','Suspected insiders','Bundled buys');
 for(const bundles of [{status:'loading'},{status:'error',message:'Bundler service unavailable.'},{status:'not-connected'}]){
  const html=resultHTML({...input,history:history(),bundles});
  assert.equal((html.match(/data-history-plot/g)||[]).length,1);
  assertInOrder(html,'id="report-panel-chart"','<dt>Market cap</dt>','Top 10 accounts','Suspected insiders','Bundled buys');
  const bundleSummary=html.match(/<details\b[^>]*data-view-key="bundler-details"[^>]*>\s*<summary\b[^>]*>[\s\S]*?<\/summary>/)?.[0];
  assert.ok(bundleSummary,'Bundler availability is reported independently');
  assert.match(bundleSummary,new RegExp(bundles.status==='loading'?'Checking…':bundles.status==='not-connected'?'Not connected':'Unavailable'));
  assert.doesNotMatch(bundleSummary,/0%|0 wallets|0 held/);
 }
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
