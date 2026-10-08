import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRisk,normalizeMarket,normalizeListing} from '../dist/coin-checker-data.js';
import {resultHTML} from '../dist/coin-checker.js';
const mint='So11111111111111111111111111111111111111112';
const report=overrides=>normalizeRisk({mint,tokenProgram:'Token',risks:[],token:{supply:1,decimals:9,mintAuthority:null,freezeAuthority:null},...overrides},mint);
const state=risk=>({mint,market:{status:'empty'},risk,listing:{status:'ready',data:{profilePaid:true,retrievedAt:1}}});

test('suspected insiders remain provider signals, not bundle percentages or a clean bill of health',()=>{
 for(const [value,label] of [[6,'6 reported'],[0,'0 reported'],[undefined,'Unavailable']]){
  const html=resultHTML(state({status:'ready',data:report({graphInsidersDetected:value})}),'details');
  assert.match(html,/Suspected insiders/);assert.match(html,/Accounts reported by Rugcheck/);
  assert.ok(html.includes('<strong>'+label+'</strong>'));
  assert.match(html,/Insider-held supply is unavailable/);
  assert.doesNotMatch(html,/data-report-open|View risk checks/);
  if(value===0)assert.match(html,/does not rule out insiders/);
  if(value===undefined)assert.match(html,/didn’t return a holder count/);
 }
 const evm=resultHTML({...state({status:'ready',data:{...report({graphInsidersDetected:6}),chainId:'base'}}),chainId:'base'},'details');
 assert.doesNotMatch(evm,/Suspected insiders|6 reported/);
});

test('a positive fractional total supply never renders as zero',()=>{
 const html=resultHTML(state({status:'ready',data:report()}));
 assert.match(html,/<dt>Total supply<\/dt><dd class="">1\.000e-9<\/dd>/);
 assert.match(html,/0\.000000001/);
});
test('unavailable risk stays unassessed even with an approved paid profile',()=>{
 const html=resultHTML(state({status:'error',message:'Unavailable'}));
 assert.match(html,/Not assessed/);assert.match(html,/<dt>DEX paid<\/dt><dd class="">Yes<\/dd>/);assert.doesNotMatch(html,/risk lower|No flags reported/);
});
test('boost counts stay separate from paid status, spend and risk; missing counts are not zero',()=>{
 const input=state({status:'error',message:'Unavailable'});
 const pair={chainId:'solana',baseToken:{address:mint,name:'SOL',symbol:'SOL'},pairAddress:mint,boosts:{active:50}};
 const html=resultHTML({...input,market:{status:'ready',data:normalizeMarket([pair],mint)}});
 assert.match(html,/50 active/);assert.match(html,/not dollars spent/);assert.match(html,/Not assessed/);
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
test('a cancelled profile and absent boost field explain the observed report without claiming zero',()=>{
 const input=state({status:'error',message:'Unavailable'});
 input.market={status:'ready',data:normalizeMarket([{chainId:'solana',baseToken:{address:mint},pairAddress:mint}],mint)};
 input.listing={status:'ready',data:normalizeListing({orders:[{type:'tokenProfile',status:'cancelled'}],boosts:[]})};
 const html=resultHTML(input);
 assert.match(html,/<dt>DEX paid<\/dt><dd class="">Cancelled<\/dd>/);
 assert.match(html,/<dt>DEX boosts<\/dt><dd class="">Unknown<\/dd>/);
 assert.doesNotMatch(html,/No active DEX boosts|<span>0<\/span>|has-boosts/);
});
test('risk stays outside switchable report panels and each panel has its labeled tab',()=>{
 const input=state({status:'ready',data:report({risks:[{name:'Freeze enabled',level:'danger'}]})});
 for(const section of ['overview','chart','details']){
  const html=resultHTML(input,section);
  assert.ok(html.indexOf('High risk reported')<html.indexOf('role="tablist"'));
  assert.match(html,new RegExp('id="report-tab-'+section+'"[^>]*aria-selected="true"[^>]*tabindex="0"'));
  assert.match(html,new RegExp('id="report-panel-'+section+'"[^>]*aria-labelledby="report-tab-'+section+'"[^>]*tabindex="0" >'));
  assert.equal((html.match(/role="tabpanel"/g)||[]).length,3);
 }
});
