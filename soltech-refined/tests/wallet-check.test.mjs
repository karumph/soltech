import test from 'node:test';
import assert from 'node:assert/strict';
import {validWalletAddress,normalizeWalletReport,walletResultsHTML,createWalletLookup,mountWalletCheck} from '../dist/wallet-check.js';
import {RECENT_WALLETS_KEY,createRecentWalletStore} from '../dist/wallet-recent.js';

const address='So11111111111111111111111111111111111111112';
const validOther='11111111111111111111111111111111';
const holding=(overrides={})=>({address,name:'Example coin',symbol:'EX',amount:2,valueUsd:12,found:true,risk:'unknown',flags:[],...overrides});
const report=(holdings=[],overrides={})=>({supported:true,chain:'solana',address,holdings,tokens:holdings.length,shown:holdings.length,sol:1.5,checkedAt:'2026-10-11T18:00:00.000Z',...overrides});
const response=(body,{ok=true,status=200}={})=>({ok,status,json:async()=>body});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function pendingLookup(t,options={}){
 const changes=[],requests=[];
 const session=createWalletLookup({...options,onChange:state=>changes.push(state),fetcher:(url,init)=>{const pending=deferred();requests.push({url,init,...pending});return pending.promise;}});
 t.after(()=>session.dispose());
 return {session,changes,requests};
}

test('wallet addresses must decode to exactly 32 bytes and use the Solana alphabet',()=>{
 for(const input of [address,validOther,'1'.repeat(31)+'2'])assert.equal(validWalletAddress(input),true,input);
 for(const input of [null,undefined,{},'','1'.repeat(31),'1'.repeat(33),'2'.repeat(32),'z'.repeat(44),'0x'+'a'.repeat(40),address+' ',' '+address,address.replace('S','0'),address+'\n'])assert.equal(validWalletAddress(input),false,String(input));
});

test('malformed, mismatched and oversized responses are rejected instead of becoming an empty wallet',()=>{
 const bad=[null,{},[],report([],{supported:false}),report([],{chain:'base'}),report([],{address:validOther}),report([],{holdings:null}),report([],{tokens:undefined}),report([],{tokens:-1}),report([],{tokens:'0'}),report([],{shown:undefined}),report([holding()],{tokens:0}),report([holding()],{shown:0}),report([null]),report([holding({address:'not-a-wallet'})]),report(Array.from({length:151},()=>holding()))];
 for(const body of bad)assert.throws(()=>normalizeWalletReport(body,address),/incomplete response/);
 const empty=normalizeWalletReport(report(),address);
 assert.match(walletResultsHTML(empty),/No token holdings found/);
 assert.match(walletResultsHTML(empty),/<dt>SOL<\/dt><dd>—<small>1\.5 SOL<\/small>/);
});

test('unknown values remain unavailable and never turn into zero balances or risk labels',()=>{
 for(const value of [null,undefined,'12',-1,Infinity,NaN]){
  const data=normalizeWalletReport(report([holding({amount:value,valueUsd:value,risk:'unexpected'})],{sol:value}),address);
  assert.equal(data.holdings[0].amount,null);assert.equal(data.holdings[0].valueUsd,null);assert.equal(data.sol,null);assert.equal(data.holdings[0].risk,'unknown');
  const html=walletResultsHTML(data);
  assert.match(html,/<dt>Estimated wallet value \(USD\)<\/dt><dd>—<small>Value unavailable<\/small><\/dd>/);
  assert.match(html,/Quantity unavailable/);assert.match(html,/title="USD value unavailable">—<\/strong>/);
  assert.doesNotMatch(html,/data-risk=|Not assessed|High risk|Lower risk|Caution|NaN|Infinity|No token holdings found/);
 }
 const zeros=normalizeWalletReport(report([holding({amount:0,valueUsd:0})],{sol:0}),address);
 assert.equal(zeros.holdings[0].amount,0);assert.equal(zeros.holdings[0].valueUsd,0);assert.equal(zeros.sol,0);
 const zeroHTML=walletResultsHTML(zeros);assert.match(zeroHTML,/<dt>Estimated wallet value \(USD\)<\/dt><dd>\$0\.00/);assert.match(zeroHTML,/<dt>SOL<\/dt><dd>\$0\.00<small>0 SOL<\/small>/);assert.match(zeroHTML,/Quantity: <\/span>0<\/small>/);
});

test('all returned holdings stay visible regardless of price, provider found flags or risk metadata',()=>{
 const data=normalizeWalletReport(report([
  holding({name:'Known token',symbol:'KNOWN',found:false,risk:'high',valueUsd:100,reason:'Do not show this assessment',flags:[{level:'danger',text:'Do not show this flag'}]}),
  holding({address:validOther,name:'Second token',symbol:'SECOND',risk:'unknown',valueUsd:25}),
  holding({address:'1'.repeat(31)+'2',name:'No market',symbol:'NO_PRICE',found:true,risk:'lower',valueUsd:null}),
  holding({address:'1'.repeat(31)+'3',name:'Zero token',symbol:'ZERO',found:false,risk:'caution',valueUsd:0}),
 ]),address);
 const html=walletResultsHTML(data);
 assert.match(html,/<dt>Estimated wallet value \(USD\)<\/dt><dd>\$125\.00<small>Partial estimate<\/small>/);
 assert.match(html,/<dt>Tokens<\/dt><dd>\$125\.00<small>4 holdings<\/small>/);assert.equal((html.match(/class="wallet-row"/g)||[]).length,4);
 assert.match(html,/title="Known token"/);assert.match(html,/title="Second token"/);assert.match(html,/title="Zero token"/);assert.match(html,/title="No market"/);
 assert.doesNotMatch(html,/data-wallet-filter|wallet-filters|All coins|holdings have a USD value|data-risk=|High risk|Lower risk|Caution|Not assessed|Do not show this|wallet is safe|all clear/i);
});

test('a 150-token result limits the estimate to available prices and explains missing SOL pricing',()=>{
 const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
 const tokenAddress=n=>{let encoded='';for(;n;n=Math.floor(n/58))encoded=alphabet[n%58]+encoded;return '1'.repeat(31)+encoded;};
 const holdings=Array.from({length:150},(_,i)=>holding({address:tokenAddress(i+1),valueUsd:i===149?null:1,found:i!==149,risk:i===0?'high':'unknown'}));
 const data=normalizeWalletReport(report(holdings,{tokens:181,totalValueUsd:999999,highRisk:40}),address),html=walletResultsHTML(data);
 assert.match(html,/<dt>Estimated wallet value \(USD\)<\/dt><dd>\$149\.00<small>Partial estimate<\/small>/);
 assert.match(html,/<dt>Tokens<\/dt><dd>\$149\.00<small>150 of 181 holdings<\/small>/);
 assert.match(html,/Showing 150 of 181 token holdings\. Token value covers only the priced holdings shown/);
 assert.match(html,/SOL price unavailable; estimate excludes SOL/);assert.match(html,/Excludes 1 holding without a price/);
 assert.equal((html.match(/class="wallet-row"/g)||[]).length,150);
 assert.doesNotMatch(html,/999999|\$1M|High risk|No token holdings found|Total wallet value/);
});

test('holdings are sorted by largest USD value with stable ties, zero retained and unpriced entries last',()=>{
 const addresses=Array.from({length:6},(_,i)=>'1'.repeat(31)+'123456'[i]);
 const values=[null,20,0,100,20,null],data=normalizeWalletReport(report(values.map((valueUsd,i)=>holding({address:addresses[i],valueUsd}))),address);
 const order=html=>Array.from(html.matchAll(/class="wallet-check-link" href="#check\/solana\/([^"]+)"/g),match=>match[1]);
 assert.deepEqual(order(walletResultsHTML(data)),[addresses[3],addresses[1],addresses[4],addresses[2],addresses[0],addresses[5]]);
 assert.equal(order(walletResultsHTML(data)).length,data.holdings.length);
 assert.deepEqual(data.holdings.map(coin=>coin.address),addresses);
});

test('small positive values are distinguished from zero and unavailable or overflowing totals stay honest',()=>{
 const tiny=walletResultsHTML(normalizeWalletReport(report([holding({valueUsd:.001})]),address));assert.match(tiny,/&lt;\$0\.01/);assert.doesNotMatch(tiny,/>\$0\.00/);
 const overflow=walletResultsHTML(normalizeWalletReport(report([holding({valueUsd:Number.MAX_VALUE}),holding({address:validOther,valueUsd:Number.MAX_VALUE})]),address));assert.match(overflow,/<dt>Estimated wallet value \(USD\)<\/dt><dd>—/);assert.match(overflow,/Combined wallet value is unavailable/);assert.doesNotMatch(overflow,/Infinity|∞/);
 const uncovered=walletResultsHTML(normalizeWalletReport(report([],{tokens:10}),address));assert.match(uncovered,/Showing 0 of 10 token holdings/);assert.match(uncovered,/<dt>Estimated wallet value \(USD\)<\/dt><dd>—/);assert.doesNotMatch(uncovered,/No token holdings found/);
});

test('long coin names retain their full text and an accessible details destination without descriptive risk copy',()=>{
 const name='Very long coin name '.repeat(20),symbol='SYMBOL'.repeat(20),html=walletResultsHTML(normalizeWalletReport(report([holding({name,symbol,reason:'Provider risk assessment',flags:[{level:'warn',text:'Provider warning'}]})]),address));
 assert.ok(html.includes(`title="${name}"`));assert.ok(html.includes(`aria-label="Details for ${name}"`));assert.ok(html.includes(`<small>${symbol}</small>`));assert.match(html,/class="sr-only">Details<\/span>/);assert.match(html,new RegExp(`href="#check/solana/${address}"`));assert.doesNotMatch(html,/Provider risk assessment|Provider warning|wallet-row-status|wallet-risk/);
});

test('wallet identity has address copying and internal views without outbound explorer links',()=>{
 const html=walletResultsHTML(normalizeWalletReport(report([holding()]),address));
 assert.match(html,/data-copy-wallet-address>Copy address<\/button>/);assert.match(html,new RegExp(`aria-label="Public wallet address ${address}"`));assert.match(html,/data-wallet-copy-status role="status" aria-live="polite"/);
 assert.match(html,/data-wallet-view="holdings" aria-pressed="true"/);assert.match(html,/data-wallet-view="transactions" aria-pressed="false"/);assert.match(html,/id="wallet-transactions"[^>]* hidden/);
 assert.doesNotMatch(html,/solscan|href="https?:|data-wallet-filter/i);
 const invalid='\"><img src=x onerror=alert(1)>';
 assert.throws(()=>normalizeWalletReport(report([],{address:invalid}),invalid),/incomplete response/);
 const invalidHTML=walletResultsHTML(report([],{address:invalid}));assert.match(invalidHTML,/Wallet address unavailable/);assert.doesNotMatch(invalidHTML,/data-copy-wallet-address|<img|href="https?:/);
});

test('provider text is escaped and unsafe coin images cannot become HTML or executable links',()=>{
 const dangerous='<img src=x onerror="alert(1)">';
 for(const logo of ['javascript:alert(1)','data:image/svg+xml,<svg onload=alert(1)>','http://images.example/logo.png','https://user:password@images.example/logo.png','https://127.0.0.1/logo.png']){
  const data=normalizeWalletReport(report([holding({name:dangerous,symbol:'"><script>alert(1)</script>',logo,flags:[{level:'danger',text:dangerous}]})]),address),html=walletResultsHTML(data);
  assert.doesNotMatch(html,/<script|<img |href="javascript:|data:image/);
  assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html,new RegExp('href="#check/solana/'+address+'"'));
 }
 const safe=walletResultsHTML(normalizeWalletReport(report([holding({logo:'https://images.example/logo.png?size=64&width=64'})]),address));
 assert.match(safe,/src="https:\/\/images\.example\/logo\.png\?size=64&amp;width=64"/);
 assert.match(safe,/referrerpolicy="no-referrer"/);
});

test('invalid wallet input makes no request and explains the Solana-only restriction',async t=>{
 const {session,changes,requests}=pendingLookup(t);
 await session.lookup('0x'+'a'.repeat(40));assert.match(changes.at(-1).message,/Solana for now/);
 await session.lookup('z'.repeat(44));assert.match(changes.at(-1).message,/full Solana wallet address/);
 assert.equal(requests.length,0);assert.equal(changes.some(state=>state.status==='ready'),false);
});

test('lookup posts only the public address, omits cookies and validates successful server bodies',async t=>{
 const {session,changes,requests}=pendingLookup(t,{endpoint:'/test-wallet'}),pending=session.lookup(address);
 assert.equal(changes.at(-1).status,'loading');
 const call=requests[0];assert.equal(call.url,'/test-wallet');assert.equal(call.init.method,'POST');assert.equal(call.init.credentials,'omit');assert.deepEqual(JSON.parse(call.init.body),{address});
 call.resolve(response(report([holding()])));await pending;
 assert.equal(changes.at(-1).status,'ready');assert.equal(changes.at(-1).data.holdings.length,1);
 const malformed=session.lookup(address);requests[1].resolve(response({}));await malformed;
 assert.equal(changes.at(-1).status,'error');assert.match(changes.at(-1).message,/incomplete response/);
});

for(const action of ['cancel','dispose'])test(`${action} aborts the request and suppresses a late response even when the loader ignores abort`,async t=>{
 const {session,changes,requests}=pendingLookup(t),pending=session.lookup(address);
 session[action]();assert.equal(requests[0].init.signal.aborted,true);
 requests[0].resolve(response(report([holding()])));await pending;
 assert.deepEqual(changes.map(state=>state.status),['loading']);
 if(action==='dispose'){await session.lookup(validOther);assert.equal(requests.length,1);}
});

test('a newer wallet result wins over an older request and its late errors',async t=>{
 const {session,changes,requests}=pendingLookup(t),first=session.lookup(address),next=session.lookup(validOther);
 assert.equal(requests[0].init.signal.aborted,true);assert.equal(requests[1].init.signal.aborted,false);
 requests[1].resolve(response(report([],{address:validOther})));await next;
 requests[0].reject(new Error('Old request failed'));await first;
 assert.deepEqual(changes.map(state=>state.status),['loading','loading','ready']);
 assert.equal(changes.at(-1).address,validOther);
});

test('an older request timeout cannot abort or replace the newer wallet request',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const {session,changes,requests}=pendingLookup(t,{timeoutMs:10}),first=session.lookup(address);
 t.mock.timers.tick(6);const next=session.lookup(validOther);t.mock.timers.tick(5);
 assert.equal(requests[1].init.signal.aborted,false);
 requests[0].resolve(response(report()));await first;
 requests[1].resolve(response(report([],{address:validOther})));await next;
 assert.deepEqual(changes.map(state=>state.status),['loading','loading','ready']);assert.equal(changes.at(-1).address,validOther);
});

test('a timed-out response is never presented as a completed wallet',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const {session,changes,requests}=pendingLookup(t,{timeoutMs:10}),pending=session.lookup(address);
 t.mock.timers.tick(10);assert.equal(requests[0].init.signal.aborted,true);
 requests[0].resolve(response(report()));await pending;
 assert.equal(changes.at(-1).status,'error');assert.match(changes.at(-1).message,/took too long/);
 assert.equal(changes.some(state=>state.status==='ready'),false);
});

test('rate limits, server failures, invalid JSON and network errors produce retry feedback',async t=>{
 const {session,changes,requests}=pendingLookup(t);
 const scenarios=[
  {result:response({error:'ignored provider detail'},{ok:false,status:429}),message:/service is busy/},
  {result:response({error:'Wallet provider unavailable'},{ok:false,status:503}),message:/Wallet provider unavailable/},
  {result:response(null,{ok:false,status:502}),message:/could not be checked/},
  {result:{ok:true,status:200,json:async()=>{throw new SyntaxError('Not JSON');}},message:/incomplete response/},
  {error:new TypeError('Failed to fetch'),message:/could not be reached/},
 ];
 for(const scenario of scenarios){const pending=session.lookup(address),call=requests.at(-1);if(scenario.error)call.reject(scenario.error);else call.resolve(scenario.result);await pending;assert.equal(changes.at(-1).status,'error');assert.match(changes.at(-1).message,scenario.message);}
});

function mountedWallet(t,options={}){
 const original=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'document',{configurable:true,value:{title:'',activeElement:null}});
 class Node extends EventTarget{
  constructor(){super();this.attributes=new Map();this.value='';this.disabled=false;this.hidden=false;this.textContent='';this.innerHTML='';}
  setAttribute(key,value){this.attributes.set(key,value);}
  removeAttribute(key){this.attributes.delete(key);}
  focus(){document.activeElement=this;}
  scrollIntoView(){this.scrolled=true;}
  querySelector(){return null;}
 }
 const selectors=['.wallet-form','#wallet-address','#wallet-error','.lookup-status','#wallet-result','[data-wallet-submit]','[data-wallet-clear]','.wallet-cancel','#recent-wallets','[data-wallet-copy-status]','[data-wallet-address]','[data-copy-wallet-address]','#wallet-holdings','#wallet-transactions','[data-wallet-view="holdings"]','[data-wallet-view="transactions"]'];
 const nodes=new Map(selectors.map(selector=>[selector,new Node()])),main={innerHTML:'',querySelector:selector=>nodes.get(selector)||null},requests=[];
 const views=['holdings','transactions'].map(view=>{const button=nodes.get(`[data-wallet-view="${view}"]`);button.dataset={walletView:view};return button;});
 nodes.get('#wallet-result').querySelector=selector=>nodes.get(selector)||null;nodes.get('#wallet-result').querySelectorAll=selector=>selector==='[data-wallet-view]'?views:[];
 nodes.get('#wallet-transactions').hidden=true;
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 let time=Date.parse('2026-10-11T18:00:00.000Z');
 const historyStore=options.historyStore||createRecentWalletStore({storage,now:()=>time++});
 const copies=[],transactionMounts=[],logoMounts=[];
 const dispose=mountWalletCheck(main,{endpoint:options.endpoint||'/fake-wallet',historyStore,copyText:value=>{copies.push(value);return options.copyText?options.copyText(value):Promise.resolve();},mountLogos:(container,holdings,config)=>{const mounted={container,holdings,config,disposed:false};logoMounts.push(mounted);return ()=>{mounted.disposed=true;};},mountTransactions:(container,config)=>{const mounted={container,config,disposed:false};transactionMounts.push(mounted);container.innerHTML='Transactions fixture';return ()=>{mounted.disposed=true;};},fetcher:(url,init)=>{const pending=deferred();requests.push({url,init,...pending});return pending.promise;}});
 t.after(()=>{dispose();if(original)Object.defineProperty(globalThis,'document',original);else delete globalThis.document;});
 const input=nodes.get('#wallet-address'),submit=()=>nodes.get('.wallet-form').dispatchEvent(new Event('submit',{cancelable:true}));
 const fill=value=>{input.value=value;input.dispatchEvent(new Event('input'));};
 const clickHistory=(selector,address)=>{const event=new Event('click'),button={dataset:{recentWallet:address}};Object.defineProperty(event,'target',{value:{closest:value=>value===selector?button:null}});nodes.get('#recent-wallets').dispatchEvent(event);};
 const clickResult=(selector,view)=>{const event=new Event('click'),button=selector==='[data-copy-wallet-address]'?nodes.get(selector):{dataset:{walletView:view}};Object.defineProperty(event,'target',{value:{closest:value=>value===selector?button:null}});nodes.get('#wallet-result').dispatchEvent(event);};
 return {nodes,input,requests,dispose,fill,submit,main,storage,historyStore,clickHistory,clickResult,copies,transactionMounts,logoMounts};
}

test('logo enrichment belongs to the open report and is released on clear, editing, recheck and disposal',async t=>{
 const f=mountedWallet(t),out=f.nodes.get('#wallet-result');
 assert.equal(f.logoMounts.length,0);
 for(const action of ['clear','edit','recheck','dispose']){
  f.fill(address);f.submit();
  assert.equal(f.logoMounts.filter(mount=>!mount.disposed).length,0);
  f.requests.at(-1).resolve(response(report([holding()])));await new Promise(resolve=>setImmediate(resolve));
  const mount=f.logoMounts.at(-1);assert.equal(mount.container,out);assert.equal(mount.holdings[0].address,address);assert.match(out.innerHTML,/Wallet overview/);
  f.clickResult('[data-wallet-view]','transactions');assert.equal(mount.disposed,false);
  if(action==='clear')f.nodes.get('[data-wallet-clear]').dispatchEvent(new Event('click'));
  if(action==='edit')f.fill(validOther);
  if(action==='recheck')f.submit();
  if(action==='dispose')f.dispose();
  assert.equal(mount.disposed,true);
  if(action==='recheck'){f.fill('');f.requests.at(-1).resolve(response(report()));await new Promise(resolve=>setImmediate(resolve));}
 }
});

test('Clear, Cancel and editing during a request restore controls and prevent stale results',async t=>{
 const f=mountedWallet(t),submit=f.nodes.get('[data-wallet-submit]'),clear=f.nodes.get('[data-wallet-clear]'),cancel=f.nodes.get('.wallet-cancel'),out=f.nodes.get('#wallet-result'),status=f.nodes.get('.lookup-status');
 for(const action of ['cancel','clear','edit']){
  f.fill(address);f.submit();const request=f.requests.at(-1);
  assert.equal(submit.disabled,true);assert.equal(cancel.hidden,false);assert.equal(out.attributes.get('aria-busy'),'true');
  if(action==='cancel')cancel.dispatchEvent(new Event('click'));
  else if(action==='clear')clear.dispatchEvent(new Event('click'));
  else f.fill(validOther);
  assert.equal(request.init.signal.aborted,true);assert.equal(submit.disabled,false);assert.equal(cancel.hidden,true);assert.equal(out.attributes.get('aria-busy'),'false');assert.equal(out.innerHTML,'');
  if(action==='cancel'){assert.equal(f.input.value,address);assert.match(status.textContent,/cancelled/);}
  if(action==='clear'){assert.equal(f.input.value,'');assert.equal(clear.disabled,true);assert.match(status.textContent,/cleared/);}
  if(action==='edit')assert.equal(f.input.value,validOther);
  request.resolve(response(report()));await new Promise(resolve=>setImmediate(resolve));assert.equal(out.innerHTML,'');
  assert.deepEqual(f.historyStore.entries,[]);
 }
});

test('blank or unsupported form submissions show an error without starting a lookup',t=>{
 const f=mountedWallet(t),error=f.nodes.get('#wallet-error'),clear=f.nodes.get('[data-wallet-clear]');
 f.fill('   ');f.submit();assert.equal(f.input.value,'');assert.equal(clear.disabled,true);assert.equal(error.hidden,false);assert.equal(f.input.attributes.get('aria-invalid'),'true');assert.equal(document.activeElement,f.input);
 f.fill('0x'+'a'.repeat(40));f.submit();assert.match(error.textContent,/Solana for now/);assert.equal(f.requests.length,0);
});

test('wallet history appears only with an empty search, while saved entries remain intact',async t=>{
 const f=mountedWallet(t),recent=f.nodes.get('#recent-wallets'),clear=f.nodes.get('[data-wallet-clear]');
 assert.equal(recent.hidden,false);
 f.fill('  ');assert.equal(recent.hidden,false);
 f.fill('invalid');assert.equal(recent.hidden,true);f.submit();assert.equal(recent.hidden,true);
 clear.dispatchEvent(new Event('click'));assert.equal(recent.hidden,false);
 f.fill(address);assert.equal(recent.hidden,true);f.submit();assert.equal(recent.hidden,true);
 f.requests[0].resolve(response(report([holding()])));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(recent.hidden,true);assert.equal(f.historyStore.entries.length,1);
 f.clickResult('[data-wallet-view]','transactions');assert.equal(recent.hidden,true);
 clear.dispatchEvent(new Event('click'));assert.equal(recent.hidden,false);assert.equal(f.historyStore.entries[0].address,address);
 f.clickHistory('[data-recent-wallet]',address);assert.equal(recent.hidden,true);
 f.nodes.get('.wallet-cancel').dispatchEvent(new Event('click'));assert.equal(recent.hidden,true);
 f.fill('');assert.equal(recent.hidden,false);
 f.requests[1].resolve(response(report()));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(recent.hidden,false);assert.equal(f.nodes.get('#wallet-result').innerHTML,'');assert.equal(f.historyStore.entries.length,1);
});

test('a failed wallet check keeps history hidden until the input is cleared',async t=>{
 const f=mountedWallet(t),recent=f.nodes.get('#recent-wallets');
 f.fill(address);f.submit();f.requests[0].resolve(response({error:'Unavailable'},{ok:false,status:503}));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.nodes.get('#wallet-error').hidden,false);assert.equal(recent.hidden,true);
 f.nodes.get('[data-wallet-clear]').dispatchEvent(new Event('click'));assert.equal(recent.hidden,false);
});

test('successful empty wallets are remembered while Clear input preserves their history',async t=>{
 const f=mountedWallet(t),recent=f.nodes.get('#recent-wallets');
 assert.match(f.main.innerHTML,/Recent public wallet addresses and check times are saved on this device/);
 assert.match(f.main.innerHTML,/Holdings, balances and transaction reports are not saved/);
 assert.match(f.main.innerHTML,/Opening Transactions sends the public wallet address and transaction IDs through Solventir to Solana’s public data service to load transaction records/);
 assert.ok(f.main.innerHTML.indexOf('id="recent-wallets"')>f.main.innerHTML.indexOf('id="wallet-result"'));
 f.fill(address);f.submit();f.requests[0].resolve(response(report()));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.historyStore.entries.length,1);assert.equal(f.historyStore.entries[0].address,address);assert.match(recent.innerHTML,/data-recent-wallet=/);
 const persisted=JSON.parse(f.storage.getItem(RECENT_WALLETS_KEY));assert.deepEqual(Object.keys(persisted.entries[0]),['address','checkedAt']);assert.equal(persisted.entries[0].address,address);
 f.nodes.get('[data-wallet-clear]').dispatchEvent(new Event('click'));assert.equal(f.input.value,'');assert.equal(f.historyStore.entries.length,1);assert.match(recent.innerHTML,/data-recent-wallet=/);
});

test('choosing a recent wallet cancels the active check and fetches a fresh report',async t=>{
 const f=mountedWallet(t);f.fill(address);f.submit();f.requests[0].resolve(response(report()));await new Promise(resolve=>setImmediate(resolve));
 const firstTime=f.historyStore.entries[0].checkedAt;
 f.fill(validOther);f.submit();const cancelled=f.requests[1];f.clickHistory('[data-recent-wallet]',address);
 assert.equal(cancelled.init.signal.aborted,true);assert.equal(f.requests.length,3);assert.equal(f.input.value,address);assert.equal(document.activeElement,f.input);assert.equal(f.nodes.get('.wallet-form').scrolled,true);
 assert.equal(JSON.parse(f.requests[2].init.body).address,address);assert.equal(f.nodes.get('[data-wallet-submit]').disabled,true);
 cancelled.resolve(response(report([],{address:validOther})));await new Promise(resolve=>setImmediate(resolve));assert.equal(f.historyStore.entries.length,1);assert.equal(f.historyStore.entries[0].checkedAt,firstTime);
 f.requests[2].resolve(response(report([holding()])));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.historyStore.entries.length,1);assert.ok(f.historyStore.entries[0].checkedAt>firstTime);assert.match(f.nodes.get('#wallet-result').innerHTML,/Example coin/);
});

test('Clear history removes only recent addresses and keeps the displayed report and input',async t=>{
 const f=mountedWallet(t);f.fill(address);f.submit();f.requests[0].resolve(response(report([holding()])));await new Promise(resolve=>setImmediate(resolve));
 const output=f.nodes.get('#wallet-result').innerHTML,status=f.nodes.get('.lookup-status').textContent;
 f.clickHistory('[data-clear-wallet-history]');assert.deepEqual(f.historyStore.entries,[]);assert.deepEqual(JSON.parse(f.storage.getItem(RECENT_WALLETS_KEY)).entries,[]);
 assert.equal(f.input.value,address);assert.equal(f.nodes.get('#wallet-result').innerHTML,output);assert.equal(f.nodes.get('.lookup-status').textContent,status);assert.match(f.nodes.get('#recent-wallets').innerHTML,/Wallet history cleared/);
});

test('failed reports and results arriving after disposal never become recent wallets',async t=>{
 const f=mountedWallet(t);
 for(const result of [response(null),response({error:'Unavailable'},{ok:false,status:503})]){
  f.fill(address);f.submit();f.requests.at(-1).resolve(result);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.historyStore.entries,[]);
 }
 f.fill(address);f.submit();const pending=f.requests.at(-1);f.dispose();assert.equal(pending.init.signal.aborted,true);pending.resolve(response(report()));await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.historyStore.entries,[]);
});

test('persistence failures stay visible without turning a valid wallet result into a lookup error',async t=>{
 const storage={getItem:()=>null,setItem(){throw Error('quota');},removeItem(){throw Error('blocked');}},historyStore=createRecentWalletStore({storage});
 const f=mountedWallet(t,{historyStore});f.fill(address);f.submit();f.requests[0].resolve(response(report()));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.nodes.get('#wallet-error').hidden,true);assert.match(f.nodes.get('#wallet-result').innerHTML,/Wallet overview/);assert.match(f.nodes.get('#recent-wallets').innerHTML,/couldn’t be saved on this device/);assert.equal(historyStore.entries.length,1);
 f.clickHistory('[data-clear-wallet-history]');assert.match(f.nodes.get('#recent-wallets').innerHTML,/may reappear after a reload/);assert.match(f.nodes.get('#wallet-result').innerHTML,/Wallet overview/);
});

test('Copy address writes the checked public address and reports success without changing results',async t=>{
 const pending=deferred(),f=mountedWallet(t,{copyText:()=>pending.promise});f.fill(address);f.submit();f.requests[0].resolve(response(report()));await new Promise(resolve=>setImmediate(resolve));
 const html=f.nodes.get('#wallet-result').innerHTML,history=f.historyStore.entries,button=f.nodes.get('[data-copy-wallet-address]'),feedback=f.nodes.get('[data-wallet-copy-status]');
 f.clickResult('[data-copy-wallet-address]');assert.deepEqual(f.copies,[address]);assert.equal(button.disabled,true);assert.equal(feedback.textContent,'Copying address…');
 pending.resolve();await new Promise(resolve=>setImmediate(resolve));assert.equal(feedback.textContent,'Wallet address copied.');assert.equal(button.disabled,false);
 assert.equal(f.nodes.get('#wallet-result').innerHTML,html);assert.deepEqual(f.historyStore.entries,history);assert.equal(f.requests.length,1);
});

test('copy failures expose the full address for manual copying and keep the report usable',async t=>{
 const f=mountedWallet(t,{copyText:async()=>{throw Error('Denied');}});f.fill(address);f.submit();f.requests[0].resolve(response(report()));await new Promise(resolve=>setImmediate(resolve));
 f.clickResult('[data-copy-wallet-address]');await new Promise(resolve=>setImmediate(resolve));
 assert.match(f.nodes.get('[data-wallet-copy-status]').textContent,/Couldn’t copy/);assert.equal(f.nodes.get('[data-wallet-address]').textContent,address);assert.equal(f.nodes.get('[data-copy-wallet-address]').disabled,false);assert.equal(f.nodes.get('#wallet-error').hidden,true);assert.match(f.nodes.get('#wallet-result').innerHTML,/Wallet overview/);
});

test('late copy completion cannot overwrite feedback after another wallet loads or the page closes',async t=>{
 const copies=[],f=mountedWallet(t,{copyText:()=>{const copy=deferred();copies.push(copy);return copy.promise;}});f.fill(address);f.submit();f.requests[0].resolve(response(report()));await new Promise(resolve=>setImmediate(resolve));f.clickResult('[data-copy-wallet-address]');
 f.fill(validOther);f.submit();f.requests[1].resolve(response(report([],{address:validOther})));await new Promise(resolve=>setImmediate(resolve));
 const feedback=f.nodes.get('[data-wallet-copy-status]');feedback.textContent='New wallet feedback';copies[0].resolve();await new Promise(resolve=>setImmediate(resolve));assert.equal(feedback.textContent,'New wallet feedback');
 // The fixture reuses child nodes across innerHTML replacements; browsers create a fresh button.
 f.nodes.get('[data-copy-wallet-address]').disabled=false;f.clickResult('[data-copy-wallet-address]');f.dispose();feedback.textContent='Closed';copies[1].reject(Error('Denied'));await new Promise(resolve=>setImmediate(resolve));assert.equal(feedback.textContent,'Closed');
});

test('Transactions mounts lazily, keeps its list while toggling views and uses the checked wallet endpoint',async t=>{
 const f=mountedWallet(t,{endpoint:'/fake-wallet/'});f.fill(address);f.submit();f.requests[0].resolve(response(report([holding()])));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.transactionMounts.length,0);f.clickResult('[data-wallet-view]','transactions');assert.equal(f.transactionMounts.length,1);
 const mounted=f.transactionMounts[0],transactions=f.nodes.get('#wallet-transactions');assert.equal(mounted.config.address,address);assert.equal(mounted.config.endpoint,'/fake-wallet/transactions');assert.equal(mounted.container,transactions);assert.equal(typeof mounted.config.fetcher,'function');
 assert.deepEqual(mounted.config.tokenMetadata,[{address,name:'Example coin',symbol:'EX',logo:undefined}]);assert.deepEqual(Object.keys(mounted.config.tokenMetadata[0]),['address','name','symbol','logo']);
 assert.equal(transactions.hidden,false);assert.equal(f.nodes.get('#wallet-holdings').hidden,true);assert.equal(f.nodes.get('[data-wallet-view="transactions"]').attributes.get('aria-pressed'),'true');
 transactions.innerHTML='Loaded activity';f.clickResult('[data-wallet-view]','holdings');assert.equal(transactions.hidden,true);assert.equal(f.nodes.get('#wallet-holdings').hidden,false);assert.equal(f.nodes.get('[data-wallet-view="holdings"]').attributes.get('aria-pressed'),'true');
 f.clickResult('[data-wallet-view]','transactions');assert.equal(transactions.innerHTML,'Loaded activity');assert.equal(f.transactionMounts.length,1);assert.equal(mounted.disposed,false);
 f.clickHistory('[data-clear-wallet-history]');assert.equal(mounted.disposed,false);assert.equal(transactions.innerHTML,'Loaded activity');
});

test('transaction requests are disposed when rechecking, editing, clearing, cancelling or leaving a wallet',async t=>{
 const f=mountedWallet(t);
 for(const action of ['recheck','edit','clear','cancel','dispose']){
  f.fill(address);f.submit();f.requests.at(-1).resolve(response(report()));await new Promise(resolve=>setImmediate(resolve));f.clickResult('[data-wallet-view]','transactions');const mounted=f.transactionMounts.at(-1);assert.equal(mounted.disposed,false);
  if(action==='recheck')f.submit();
  else if(action==='edit')f.fill(validOther);
  else if(action==='clear')f.nodes.get('[data-wallet-clear]').dispatchEvent(new Event('click'));
  else if(action==='cancel')f.nodes.get('.wallet-cancel').dispatchEvent(new Event('click'));
  else f.dispose();
  assert.equal(mounted.disposed,true,action);
  if(action==='recheck'){f.requests.at(-1).resolve(response(report()));await new Promise(resolve=>setImmediate(resolve));}
 }
});

test('cross-tab updates render immediately without replacing a wallet report, and disposal unsubscribes',async t=>{
 const values=new Map(),events=new EventTarget(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const historyStore=createRecentWalletStore({storage,eventTarget:events}),otherTab=createRecentWalletStore({storage}),f=mountedWallet(t,{historyStore});
 const notify=()=>{const event=new Event('storage');Object.defineProperties(event,{key:{value:RECENT_WALLETS_KEY},storageArea:{value:storage}});events.dispatchEvent(event);};
 otherTab.add(validOther);notify();assert.match(f.nodes.get('#recent-wallets').innerHTML,new RegExp(`data-recent-wallet="${validOther}"`));
 f.fill(address);f.submit();f.requests[0].resolve(response(report()));await new Promise(resolve=>setImmediate(resolve));
 const output=f.nodes.get('#wallet-result').innerHTML;otherTab.clear();notify();assert.doesNotMatch(f.nodes.get('#recent-wallets').innerHTML,/data-recent-wallet=/);assert.equal(f.nodes.get('#wallet-result').innerHTML,output);assert.equal(f.nodes.get('#recent-wallets').hidden,true);
 f.dispose();const oldHTML=f.nodes.get('#recent-wallets').innerHTML;otherTab.add(validOther);notify();assert.equal(f.nodes.get('#recent-wallets').innerHTML,oldHTML);assert.deepEqual(historyStore.entries,[],'unsubscribed store should not receive late events');
});

test('clearing history during a wallet check preserves its report but does not re-add the pending address',async t=>{
 const f=mountedWallet(t);f.fill(address);f.submit();f.clickHistory('[data-clear-wallet-history]');
 f.requests[0].resolve(response(report()));await new Promise(resolve=>setImmediate(resolve));
 assert.match(f.nodes.get('#wallet-result').innerHTML,/Wallet overview/);assert.deepEqual(f.historyStore.entries,[]);assert.deepEqual(JSON.parse(f.storage.getItem(RECENT_WALLETS_KEY)).entries,[]);
 f.submit();f.requests[1].resolve(response(report()));await new Promise(resolve=>setImmediate(resolve));assert.equal(f.historyStore.entries[0].address,address,'a newly started check should save again');
});

test('a clear in another tab invalidates a pending wallet even before its storage event arrives',async t=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},historyStore=createRecentWalletStore({storage}),otherTab=createRecentWalletStore({storage}),f=mountedWallet(t,{historyStore});
 f.fill(address);f.submit();otherTab.clear();otherTab.add(validOther);
 f.requests[0].resolve(response(report()));await new Promise(resolve=>setImmediate(resolve));
 assert.match(f.nodes.get('#wallet-result').innerHTML,/Wallet overview/);assert.deepEqual(historyStore.entries.map(entry=>entry.address),[validOther]);
});
