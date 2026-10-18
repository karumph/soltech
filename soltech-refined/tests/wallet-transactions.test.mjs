import test from 'node:test';
import assert from 'node:assert/strict';
import {validTransactionSignature,normalizeTransactionsPage,normalizeTransactionDetails,summarizeWalletTransaction,createWalletTransactions,createWalletTransactionDetails,walletTransactionsHTML,mountWalletTransactions} from '../dist/wallet-transactions.js';

const address='So11111111111111111111111111111111111111112',other='11111111111111111111111111111111';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const signature=index=>'1'.repeat(63)+alphabet[index];
const transaction=(index=1,overrides={})=>({signature:signature(index),slot:1000-index,blockTime:1791723600-index,status:index%2?'succeeded':'failed',confirmationStatus:'finalized',...overrides});
const page=(transactions=[],overrides={})=>({status:'ready',address,transactions,nextBefore:transactions.length===20?transactions.at(-1).signature:null,checkedAt:'2026-10-11T13:00:00.000Z',...overrides});
const first=()=>Array.from({length:20},(_,index)=>transaction(index+1));
const response=(body,{ok=true,status=200}={})=>({ok,status,json:async()=>body});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const detail=(overrides={})=>({status:'ready',address,signature:signature(1),slot:999,blockTime:1791723599,transactionStatus:'succeeded',feeSol:.000005,solChange:-.012,transfers:[],tokenChanges:[],detailsComplete:true,detailsNote:null,...overrides});
const waitFor=async predicate=>{const deadline=Date.now()+2500;while(!predicate()){assert.ok(Date.now()<deadline,'condition did not become true');await new Promise(resolve=>setTimeout(resolve,10));}};
function fixture(t,options={}){
 const changes=[],requests=[];
 const session=createWalletTransactions({address,...options,onChange:state=>changes.push(state),fetcher:(url,init)=>{const pending=deferred();requests.push({url,init,...pending});return pending.promise;}});
 t.after(()=>session.dispose());return {session,changes,requests};
}

test('signatures must encode exactly 64 bytes, not merely resemble Base58',()=>{
 assert.equal(validTransactionSignature('1'.repeat(64)),true);assert.equal(validTransactionSignature(signature(1)),true);
 for(const value of [null,{},'',signature(1)+'111','1'.repeat(63),'1'.repeat(65),'z'.repeat(88),'0'.repeat(64),'2'.repeat(64),signature(1)+'\n'])assert.equal(validTransactionSignature(value),false,String(value));
});

test('validation rejects mismatched identity, invalid rows, duplicate IDs and non-progressing cursors',()=>{
 const rows=first(),bad=[null,{},page([],{status:'error'}),page([],{address:other}),page([],{checkedAt:'yesterday'}),page(Array(21).fill(transaction())),page([transaction(),transaction()]),page([transaction(1,{slot:-1})]),page([transaction(1,{blockTime:1.5})]),page([transaction(1,{blockTime:undefined})]),page([transaction(1,{status:'unknown'})]),page([transaction(1,{confirmationStatus:'unknown'})]),page([transaction(1,{signature:'unsafe<script>'})]),page([],{nextBefore:signature(1)}),page(rows,{nextBefore:signature(2)})];
 for(const body of bad)assert.throws(()=>normalizeTransactionsPage(body,address),/could not be verified/);
 assert.throws(()=>normalizeTransactionsPage(page(rows),address,{before:signature(1)}),/verified/);
 assert.throws(()=>normalizeTransactionsPage(page(rows),address,{seenSignatures:[signature(2)]}),/verified/);
 assert.throws(()=>normalizeTransactionsPage(page(rows),address,{seenCursors:[signature(20)]}),/verified/);
 const accepted=normalizeTransactionsPage(page([transaction(1,{blockTime:null,confirmationStatus:null})]),address);
 assert.equal(accepted.transactions[0].blockTime,null);assert.equal(accepted.transactions[0].confirmationStatus,null);
});

test('detail validation checks both identities and preserves unavailable or signed SOL change',()=>{
 for(const body of [null,{},detail({address:other}),detail({signature:signature(2)}),detail({status:'error'}),detail({slot:-1}),detail({blockTime:undefined}),detail({transactionStatus:'unknown'}),detail({feeSol:null}),detail({feeSol:-1}),detail({feeSol:Infinity}),detail({solChange:undefined}),detail({solChange:'1'}),detail({solChange:NaN})])assert.throws(()=>normalizeTransactionDetails(body,address,signature(1)),/verified/);
 assert.equal(normalizeTransactionDetails(detail({solChange:null,blockTime:null}),address,signature(1)).solChange,null);
 for(const solChange of [-1,0,1])assert.equal(normalizeTransactionDetails(detail({solChange}),address,signature(1)).solChange,solChange);
 const state={status:'ready',transactions:[transaction()],nextBefore:null};
 for(const [solChange,label] of [[null,'Unavailable'],[-.012,'-0.012 SOL'],[0,'0 SOL'],[.012,'+0.012 SOL']]){
  const html=walletTransactionsHTML(state,new Map([[signature(1),{open:true,state:{status:'ready',data:normalizeTransactionDetails(detail({solChange}),address,signature(1))}}]]));
  assert.ok(html.includes(label));assert.match(html,/SOL balance change/);assert.match(html,/Network fee/);assert.match(html,/0\.000005 SOL/);assert.match(html,/network fee covers the whole transaction/);assert.doesNotMatch(html,/transfer amount|Sent|Received|href=/i);
 }
});

test('detail requests are bounded and cancellation suppresses non-cooperative late responses',async t=>{
 const changes=[],requests=[];
 const session=createWalletTransactionDetails({address,signature:signature(1),timeoutMs:10,onChange:state=>changes.push(state),fetcher:(url,init)=>{const pending=deferred();requests.push({url,init,...pending});return pending.promise;}});t.after(()=>session.dispose());
 let pending=session.load();assert.deepEqual(JSON.parse(requests[0].init.body),{address,signature:signature(1)});assert.equal(requests[0].init.credentials,'omit');assert.equal(requests[0].init.redirect,'error');
 session.cancel();requests[0].resolve(response(detail()));await pending;assert.equal(requests[0].init.signal.aborted,true);assert.equal(changes.at(-1).status,'loading');
 pending=session.load();await pending;assert.match(changes.at(-1).message,/too long/);assert.equal(requests[1].init.signal.aborted,true);
 pending=session.load();requests[2].resolve(response(detail()));await pending;assert.equal(changes.at(-1).status,'ready');
});

test('missing and unsupported transaction details have distinct safe messages',async()=>{
 for(const [status,expected] of [[404,/has not returned details/],[422,/newer format/],[429,/busy/],[502,/unavailable/]]){
  const changes=[],session=createWalletTransactionDetails({address,signature:signature(1),onChange:state=>changes.push(state),fetcher:async()=>response({error:'private upstream detail'},{ok:false,status})});
  await session.load();assert.match(changes.at(-1).message,expected);assert.doesNotMatch(changes.at(-1).message,/private/);session.dispose();
 }
});

test('invalid wallet addresses never trigger a request',async t=>{
 const f=fixture(t,{address:'not-an-address'});await f.session.refresh();
 assert.equal(f.requests.length,0);assert.equal(f.changes.at(-1).status,'error');
});

test('pagination sends only address and cursor, appends distinct results, and ends without extra calls',async t=>{
 const f=fixture(t,{endpoint:'/custom-api/wallet/transactions'}),pending=f.session.refresh();
 const request=f.requests[0];assert.equal(request.url,'/custom-api/wallet/transactions');assert.equal(request.init.method,'POST');assert.equal(request.init.credentials,'omit');assert.equal(request.init.redirect,'error');assert.deepEqual(JSON.parse(request.init.body),{address});
 request.resolve(response(page(first())));await pending;assert.equal(f.session.getSnapshot().transactions.length,20);
 const more=f.session.more();assert.deepEqual(JSON.parse(f.requests[1].init.body),{address,before:signature(20)});
 await f.session.more();assert.equal(f.requests.length,2,'duplicate click created another request');
 f.requests[1].resolve(response(page([transaction(21),transaction(22)])));await more;
 assert.equal(f.session.getSnapshot().transactions.length,22);assert.equal(f.session.getSnapshot().nextBefore,null);
 await f.session.more();assert.equal(f.requests.length,2);
});

test('malformed pages and provider failures preserve rows and retry the same cursor',async t=>{
 const f=fixture(t);let pending=f.session.refresh();f.requests[0].resolve(response(page(first())));await pending;
 for(const body of [response(page([transaction(1)])),response({error:'private upstream detail'},{ok:false,status:500})]){
  pending=f.session.more();f.requests.at(-1).resolve(body);await pending;
  const state=f.session.getSnapshot();assert.equal(state.status,'error');assert.equal(state.transactions.length,20);assert.equal(state.nextBefore,signature(20));assert.ok(!state.message.includes('private'));
  pending=f.session.retry();assert.deepEqual(JSON.parse(f.requests.at(-1).init.body),{address,before:signature(20)});
  f.requests.at(-1).resolve(response(page([])));await pending;assert.equal(f.session.getSnapshot().status,'ready');
  // Restore the first page before testing the next independent failure.
  pending=f.session.refresh();f.requests.at(-1).resolve(response(page(first())));await pending;
 }
});

test('refresh aborts older pagination and suppresses its late results',async t=>{
 const f=fixture(t);let pending=f.session.refresh();f.requests[0].resolve(response(page(first())));await pending;
 const old=f.session.more(),oldRequest=f.requests[1];pending=f.session.refresh();
 assert.equal(oldRequest.init.signal.aborted,true);assert.deepEqual(JSON.parse(f.requests[2].init.body),{address});
 f.requests[2].resolve(response(page([transaction(30)])));await pending;
 oldRequest.resolve(response(page([transaction(21)])));await old;await tick();
 assert.deepEqual(f.session.getSnapshot().transactions.map(row=>row.signature),[signature(30)]);
});

test('refresh failure retains existing rows and retries from the newest page',async t=>{
 const f=fixture(t);let pending=f.session.refresh();f.requests[0].resolve(response(page(first())));await pending;
 pending=f.session.refresh();f.requests[1].reject(new Error('network detail'));await pending;
 assert.equal(f.session.getSnapshot().transactions.length,20);assert.equal(f.session.getSnapshot().status,'error');
 pending=f.session.retry();assert.deepEqual(JSON.parse(f.requests[2].init.body),{address});f.requests[2].resolve(response(page([])));await pending;
 assert.equal(f.session.getSnapshot().transactions.length,0);assert.match(walletTransactionsHTML(f.session.getSnapshot()),/No recent transactions found/);
});

test('deadline bounds both a non-cooperative fetch and a stalled JSON body',async t=>{
 const f=fixture(t,{timeoutMs:5});await f.session.refresh();assert.equal(f.requests[0].init.signal.aborted,true);assert.match(f.session.getSnapshot().message,/too long/);
 const changes=[],session=createWalletTransactions({address,timeoutMs:5,onChange:state=>changes.push(state),fetcher:async()=>({ok:true,json:()=>new Promise(()=>{})})});t.after(()=>session.dispose());
 await session.refresh();assert.equal(changes.at(-1).status,'error');assert.match(changes.at(-1).message,/too long/);
});

test('disposal aborts active work, suppresses late callbacks and prevents future requests',async t=>{
 const f=fixture(t),pending=f.session.refresh(),request=f.requests[0],count=f.changes.length;
 f.session.dispose();assert.equal(request.init.signal.aborted,true);request.resolve(response(page([transaction()])));await pending;await tick();
 assert.equal(f.changes.length,count);await f.session.refresh();assert.equal(f.requests.length,1);
});

test('rendering shows transaction outcomes and dates without external links or invented actions',()=>{
 const html=walletTransactionsHTML({status:'ready',transactions:[transaction(1,{blockTime:null}),transaction(2)],nextBefore:null});
 assert.match(html,/<ol class="wallet-transactions-list">/);assert.match(html,/Succeeded/);assert.match(html,/Failed/);assert.match(html,/Time unavailable/);assert.match(html,/<time[^>]+datetime=/);assert.match(html,/Copy ID/);
 assert.match(html,/Recent activity referencing this wallet address/);assert.doesNotMatch(html,/<a\b|https?:|Solscan|Transferred|Swap|Bought|Sold|High risk|Lower risk|Caution|\$/i);
 const error=walletTransactionsHTML({status:'error',transactions:[],nextBefore:null,message:'<img src=x onerror=alert(1)>'});
 assert.match(error,/&lt;img/);assert.doesNotMatch(error,/<img/);assert.match(error,/data-wallet-transactions-action="retry"/);assert.doesNotMatch(error,/No recent transactions found/);
});

test('mounted controls fetch, paginate, copy known IDs and dispose without persistence',async t=>{
 class Container extends EventTarget{
  innerHTML='';status={textContent:''};
  querySelector(selector){return selector==='.wallet-transactions-copy-status'?this.status:null;}
  contains(){return false;}
 }
 const container=new Container(),requests=[],copies=[];
 const dispose=mountWalletTransactions(container,{address,autoDetails:false,endpoint:'/fixture-transactions',clipboard:{writeText:async text=>copies.push(text)},fetcher:(url,init)=>{const pending=deferred();requests.push({url,init,...pending});return pending.promise;}});t.after(dispose);
 const click=(selector,dataset)=>{const event=new Event('click');Object.defineProperty(event,'target',{value:{closest:value=>value===selector?{dataset}:null}});container.dispatchEvent(event);};
 assert.match(container.innerHTML,/Loading transactions/);requests[0].resolve(response(page(first())));await tick();
 click('[data-wallet-transaction-copy]',{walletTransactionCopy:signature(1)});await tick();assert.deepEqual(copies,[signature(1)]);assert.equal(container.status.textContent,'Transaction ID copied.');
 click('[data-wallet-transaction-copy]',{walletTransactionCopy:signature(50)});await tick();assert.equal(copies.length,1,'forged IDs must not be copied');
 click('[data-wallet-transactions-action]',{walletTransactionsAction:'more'});assert.equal(requests.length,2);requests[1].resolve(response(page([])));await tick();
 click('[data-wallet-transactions-action]',{walletTransactionsAction:'refresh'});assert.equal(requests.length,3);const before=container.innerHTML;dispose();assert.equal(requests[2].init.signal.aborted,true);
 requests[2].resolve(response(page([transaction(30)])));await tick();assert.equal(container.innerHTML,before);
});

function mountedDetails(t,options={}){
 class Container extends EventTarget{innerHTML='';querySelector(){return null;}contains(){return false;}}
 const container=new Container(),requests=[];
 const dispose=mountWalletTransactions(container,{address,autoDetails:false,endpoint:'/custom/wallet/transactions',...options,fetcher:(url,init)=>{const pending=deferred();requests.push({url,init,startedAt:Date.now(),...pending});return pending.promise;}});t.after(dispose);
 const click=(selector,dataset)=>{const event=new Event('click');Object.defineProperty(event,'target',{value:{closest:value=>value===selector?{dataset}:null}});container.dispatchEvent(event);};
 return {container,requests,dispose,
  toggle:(index=1)=>click('[data-wallet-transaction-toggle]',{walletTransactionToggle:signature(index)}),
  retry:(index=1)=>click('[data-wallet-transaction-retry]',{walletTransactionRetry:signature(index)}),
  action:value=>click('[data-wallet-transactions-action]',{walletTransactionsAction:value})
 };
}

test('details load only on expansion and retry inside the row without replacing the list',async t=>{
 const f=mountedDetails(t);f.requests[0].resolve(response(page(first())));await tick();assert.equal(f.requests.length,1,'list must not prefetch details');
 f.toggle();assert.equal(f.requests.length,2);assert.equal(f.requests[1].url,'/custom/wallet/transaction');assert.deepEqual(JSON.parse(f.requests[1].init.body),{address,signature:signature(1)});
 f.requests[1].resolve(response({error:'private error'},{ok:false,status:503}));await tick();assert.match(f.container.innerHTML,/Transaction details are unavailable/);assert.match(f.container.innerHTML,/Retry details/);assert.match(f.container.innerHTML,/20 transactions shown/);
 f.retry();await waitFor(()=>f.requests.length===3);f.requests[2].resolve(response(detail()));await tick();assert.match(f.container.innerHTML,/-0\.012 SOL/);assert.match(f.container.innerHTML,/20 transactions shown/);assert.doesNotMatch(f.container.innerHTML,/private error|href=/);
 f.toggle();f.toggle();assert.equal(f.requests.length,3,'reopening loaded details should reuse this page’s result');assert.match(f.container.innerHTML,/-0\.012 SOL/);
});

test('reopening failed details retries only that transaction and keeps successful results cached',async t=>{
 const f=mountedDetails(t);f.requests[0].resolve(response(page([transaction(1),transaction(2)])));await tick();
 f.toggle();f.requests[1].resolve(response(null,{ok:false,status:502}));await tick();f.toggle();f.toggle();
 await waitFor(()=>f.requests.length===3);assert.equal(JSON.parse(f.requests[2].init.body).signature,signature(1));
 f.requests[2].resolve(response(detail()));await tick();f.toggle();f.toggle();
 assert.equal(f.requests.length,3);assert.match(f.container.innerHTML,/-0\.012 SOL/);
});

test('closing or removing a transaction aborts its details and suppresses late updates',async t=>{
 const f=mountedDetails(t);f.requests[0].resolve(response(page(first())));await tick();
 f.toggle();const closed=f.requests[1];f.toggle();assert.equal(closed.init.signal.aborted,true);closed.resolve(response(detail()));await tick();assert.doesNotMatch(f.container.innerHTML,/-0\.012 SOL/);
 f.toggle();await waitFor(()=>f.requests.length===3);const removed=f.requests[2];f.action('refresh');assert.equal(removed.init.signal.aborted,false,'list refresh should leave visible-row details independent until replaced');
 f.requests[3].resolve(response(page([transaction(30)])));await tick();assert.equal(removed.init.signal.aborted,true);removed.resolve(response(detail()));await tick();assert.doesNotMatch(f.container.innerHTML,/-0\.012 SOL/);assert.match(f.container.innerHTML,/1 transaction shown/);
 f.toggle(30);await waitFor(()=>f.requests.length===5);const disposed=f.requests[4];f.dispose();assert.equal(disposed.init.signal.aborted,true);const html=f.container.innerHTML;disposed.resolve(response(detail({signature:signature(30)})));await tick();assert.equal(f.container.innerHTML,html);
});

test('verified transfers drive amount/direction while net changes stay clearly labeled',()=>{
 const state={status:'ready',transactions:[transaction()],nextBefore:null};
 const transfer={asset:'SOL',amount:'1.234567891',direction:'sent',source:address,destination:other};
 const render=data=>walletTransactionsHTML(state,new Map([[signature(1),{open:true,state:{status:'ready',data:normalizeTransactionDetails(detail(data),address,signature(1))}}]]),{tokenMetadata:[{address:other,symbol:'USDC',name:'Verified holding'},{address:'bad',symbol:'FALSE'}]});
 let html=render({transfers:[transfer]});assert.match(html,/wallet-transaction-description">Sent/);assert.match(html,/wallet-transaction-amount is-sent/);assert.match(html,/1\.234567891 SOL/);
 html=render({transfers:[{...transfer,asset:other,amount:'12.5',direction:'received'}]});assert.match(html,/wallet-transaction-description">Received/);assert.match(html,/12\.5 USDC/);assert.match(html,/From token account/);assert.match(html,/To token account/);
 html=render({transfers:[{...transfer,direction:'self'}]});assert.match(html,/Self transfer/);
 html=render({transfers:[transfer,{...transfer,direction:'received'}]});assert.match(html,/Sent &amp; received SOL/);assert.doesNotMatch(html,/Multiple transfers/);
 html=render({tokenChanges:[{mint:other,change:'+12.500000000001'}]});assert.match(html,/wallet-transaction-description">Balance change /);assert.match(html,/\+12\.500000000001 USDC/);assert.doesNotMatch(html,/wallet-transaction-description">Received|Swap|Bought|Sold|href=/i);
 html=render({transfers:[{...transfer,asset:address,amount:'5'}],detailsComplete:false,detailsNote:'Some parsed instructions are unavailable.'});assert.match(html,/5 Token/);assert.match(html,/Some parsed instructions are unavailable/);assert.ok(html.includes(address));
 for(const data of [{transfers:undefined},{tokenChanges:undefined},{detailsComplete:undefined},{transfers:[{...transfer,amount:'-1'}]},{transfers:[{...transfer,source:'bad'}]},{transfers:[transfer],transactionStatus:'failed'},{tokenChanges:[{mint:other,change:'+0'}]},{tokenChanges:[{mint:other,change:'1'}]}])assert.throws(()=>normalizeTransactionDetails(detail(data),address,signature(1)),/verified/);
});

test('automatic enrichment limits concurrency, spaces starts and prioritizes an opened queued row',async t=>{
 const f=mountedDetails(t,{autoDetails:true});f.requests[0].resolve(response(page([transaction(1),transaction(2),transaction(3)])));await tick();assert.equal(f.requests.length,2,'first detail should start promptly');
 assert.match(f.container.innerHTML,/Loading details/);f.toggle(3);
 await waitFor(()=>f.requests.length===3);assert.deepEqual(JSON.parse(f.requests[2].init.body),{address,signature:signature(3)});
 assert.ok(f.requests[2].startedAt-f.requests[1].startedAt>=400,'detail starts must be at least 400ms apart');
 await new Promise(resolve=>setTimeout(resolve,450));assert.equal(f.requests.length,3,'more than two detail requests ran concurrently');
 f.requests[1].resolve(response(detail({transfers:[{asset:'SOL',amount:'2',direction:'received',source:other,destination:address}]})));await waitFor(()=>f.requests.length===4);
 assert.deepEqual(JSON.parse(f.requests[3].init.body),{address,signature:signature(2)});assert.match(f.container.innerHTML,/wallet-transaction-description">Received/);assert.match(f.container.innerHTML,/2 SOL/);
 f.dispose();assert.equal(f.requests[2].init.signal.aborted,true);assert.equal(f.requests[3].init.signal.aborted,true);
});

test('rate limiting pauses automatic enrichment until explicit retry',async t=>{
 const f=mountedDetails(t,{autoDetails:true});f.requests[0].resolve(response(page([transaction(1),transaction(2),transaction(3)])));await tick();
 f.requests[1].resolve(response({retryAfterMs:1000},{ok:false,status:429}));await tick();assert.match(f.container.innerHTML,/The public Solana service is busy/);assert.match(f.container.innerHTML,/retry-details/);assert.doesNotMatch(f.container.innerHTML,/Loading details…/);
 await new Promise(resolve=>setTimeout(resolve,450));assert.equal(f.requests.length,2,'rate limit should stop automatic requests');
 f.toggle(2);assert.equal(f.requests.length,2,'manual retry should honor the provider cooldown');await waitFor(()=>f.requests.length===3);assert.equal(JSON.parse(f.requests[2].init.body).signature,signature(2));f.requests[2].resolve(response(detail({signature:signature(2)})));await tick();
 await new Promise(resolve=>setTimeout(resolve,450));assert.equal(f.requests.length,3,'a row retry must not restart the automatic queue');
 f.action('retry-details');await waitFor(()=>f.requests.length===4);assert.doesNotMatch(f.container.innerHTML,/class="wallet-transactions-detail-warning"/);f.dispose();assert.equal(f.requests[3].init.signal.aborted,true);
});

test('wallet-centric summaries prefer net received coin over routing legs and SOL tips',()=>{
 const mint='1'.repeat(31)+'2',metadata=[{address:mint,name:'USD Coin',symbol:'USDC'}];
 const data=detail({solChange:-.002005,tokenChanges:[{mint,change:'+90.000000001'}],transfers:[
  {asset:'SOL',amount:'0.1',direction:'sent',source:address,destination:other},
  {asset:'SOL',amount:'0.0001',direction:'sent',source:address,destination:other},
  {asset:mint,amount:'100.000000001',direction:'received',source:other,destination:address},
  {asset:mint,amount:'10',direction:'sent',source:address,destination:other},
  {asset:address,amount:'2',direction:'sent',source:address,destination:other}
 ]});
 const summary=summarizeWalletTransaction(data,metadata);
 assert.equal(summary.description,'Received USD Coin');assert.equal(summary.changes.length,1);assert.equal(summary.changes[0].amount,'90.000000001');assert.equal(summary.direction,'received');assert.equal(summary.amount,'+90 USDC');assert.equal(summary.secondary,'SOL change -0.002005');
 assert.doesNotMatch(summary.description,/Multiple|Swap|Buy|Sell/);
 const html=walletTransactionsHTML({status:'ready',transactions:[transaction()],nextBefore:null},new Map([[signature(1),{open:true,state:{status:'ready',data}}]]),{tokenMetadata:metadata});
 assert.match(html,/wallet-transaction-description">Received USD Coin/);assert.match(html,/wallet-transaction-secondary/);assert.match(html,/100\.000000001 USDC/);assert.match(html,/\+90\.000000001 USDC/);assert.doesNotMatch(html,/wallet-transaction-signature/);
});

test('same-coin transfer sums use exact decimals and never combine different assets',()=>{
 const mint='1'.repeat(31)+'2',secondMint='1'.repeat(31)+'3',metadata=[{address:mint,name:'Coin A',symbol:'AAA'},{address:secondMint,name:'Coin B',symbol:'BBB'}];
 const transfer=(asset,amount,direction)=>({asset,amount,direction,source:address,destination:other});
 const data=detail({solChange:null,transfers:[transfer(mint,'0.1','received'),transfer(mint,'0.2','received'),transfer(mint,'0.05','sent')]});
 let summary=summarizeWalletTransaction(data,metadata);assert.equal(summary.description,'Received Coin A');assert.equal(summary.changes[0].amount,'0.25');assert.equal(summary.amount,'+0.25 AAA');
 summary=summarizeWalletTransaction({...data,transfers:[...data.transfers,transfer(secondMint,'5000','sent')]},metadata);
 assert.equal(summary.description,'Coin activity');assert.deepEqual(summary.changes.map(item=>[item.asset,item.amount,item.direction]),[[mint,'0.25','received'],[secondMint,'5000','sent']]);
 summary=summarizeWalletTransaction(detail({solChange:null,transfers:[transfer(mint,'9007199254740993.1','received'),transfer(mint,'9007199254740993','sent')]}),metadata);assert.equal(summary.changes[0].amount,'0.1');
 const netOnly=summarizeWalletTransaction(detail({tokenChanges:[{mint,change:'+10'}],transfers:[transfer(mint,'1','sent')]}),metadata);assert.equal(netOnly.description,'Balance change Coin A');assert.equal(netOnly.direction,'change');
 for(const [change,transfers] of [['+100',[transfer(mint,'1','received')]],['-100',[transfer(mint,'1','sent')]],['+100',[transfer(mint,'100','received'),transfer(mint,'10','sent')]]]){
  const mismatch=summarizeWalletTransaction(detail({tokenChanges:[{mint,change}],transfers}),metadata);assert.equal(mismatch.description,'Balance change Coin A');assert.equal(mismatch.direction,'change','a partial transfer match must not describe the whole balance change as a transfer');
 }
 const exact=summarizeWalletTransaction(detail({tokenChanges:[{mint,change:'-0.1000'}],transfers:[transfer(mint,'0.300','sent'),transfer(mint,'0.2','received')]}),metadata);assert.equal(exact.description,'Sent Coin A');assert.equal(exact.changes[0].amount,'0.1');
 const failed=summarizeWalletTransaction(detail({transactionStatus:'failed',transfers:[]}),metadata);assert.equal(failed.description,'Failed transaction');assert.equal(failed.changes.length,0);
});

test('quick-look dates and SOL change are compact while Details retain exact values and time',()=>{
 const year=new Date().getFullYear(),date=new Date(year,5,12,14,23,45),blockTime=Math.floor(date.getTime()/1000);
 const data=detail({blockTime,solChange:-0.400805,tokenChanges:[{mint:other,change:'+12.5'}]});
 const render=at=>walletTransactionsHTML({status:'ready',transactions:[transaction(1,{blockTime:at})],nextBefore:null},new Map([[signature(1),{open:true,state:{status:'ready',data:{...data,blockTime:at}}}]]));
 const html=render(blockTime),rowTime=html.match(/<time[^>]*>([^<]+)<\/time>/)[1];
 assert.equal(rowTime,date.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}));
 assert.match(html,/SOL change -0\.40081<\/span>/);assert.match(html,/-0\.400805 SOL/);assert.doesNotMatch(html,/incl\. fees|Includes fees/);
 assert.ok(html.includes(date.toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit'})));
 const older=new Date(year-1,5,12,14,23,45);assert.ok(render(Math.floor(older.getTime()/1000)).match(/<time[^>]*>([^<]+)<\/time>/)[1].includes(String(year-1)));
});

test('detail rate-limit hints are bounded and old responses retain a safe default',async t=>{
 for(const [body,header,expected] of [[null,null,10000],[{retryAfterMs:25},null,1000],[{retryAfterMs:90000},null,60000],[null,'3',3000]]){
  const changes=[],session=createWalletTransactionDetails({address,signature:signature(1),onChange:state=>changes.push(state),fetcher:async()=>({...response(body,{ok:false,status:429}),headers:{get:()=>header}})});t.after(()=>session.dispose());
  await session.load();assert.equal(changes.at(-1).retryAfterMs,expected);assert.equal(changes.at(-1).rateLimited,true);assert.match(changes.at(-1).message,/public Solana service is busy/);
 }
});

test('missing token names are batched after detail work and update rows without changing amounts',async t=>{
 const mint='1'.repeat(31)+'2',names=[];
 const f=mountedDetails(t,{autoDetails:true,metadataFetcher:(mints,options)=>{const pending=deferred();names.push({mints,options,...pending});return pending.promise;}});
 f.requests[0].resolve(response(page([transaction(1),transaction(2)])));await tick();
 const transfer={asset:mint,amount:'12.5',direction:'received',source:other,destination:address};
 f.requests[1].resolve(response(detail({tokenChanges:[{mint,change:'+12.5'}],transfers:[transfer]})));await tick();assert.equal(names.length,0,'metadata must wait for the detail queue');
 await waitFor(()=>f.requests.length===3);f.requests[2].resolve(response(detail({signature:signature(2),transfers:[transfer],tokenChanges:[{mint,change:'+12.5'}]})));await waitFor(()=>names.length===1);
 assert.deepEqual(names[0].mints,[mint]);assert.match(f.container.innerHTML,/\+12\.5 Token/);names[0].resolve([{address:mint,name:'USD Coin',symbol:'USDC'}]);await tick();
 assert.match(f.container.innerHTML,/Received USD Coin/);assert.match(f.container.innerHTML,/\+12\.5 USDC/);assert.equal(names.length,1);
 f.action('refresh');f.requests[3].resolve(response(page([transaction(1)])));await tick();assert.equal(names.length,1,'cached name should not refetch');assert.match(f.container.innerHTML,/Received USD Coin/);
});

test('optional name failures preserve activity and disposal suppresses late metadata',async t=>{
 const mint='1'.repeat(31)+'2',jobs=[];
 const f=mountedDetails(t,{autoDetails:true,metadataFetcher:(mints,options)=>{const pending=deferred();jobs.push({mints,options,...pending});return pending.promise;}});
 f.requests[0].resolve(response(page([transaction(1)])));await tick();f.requests[1].resolve(response(detail({tokenChanges:[{mint,change:'+1'}]})));await waitFor(()=>jobs.length===1);
 const prior=f.container.innerHTML;f.dispose();assert.equal(jobs[0].options.signal.aborted,true);jobs[0].resolve([{address:mint,name:'Late name',symbol:'LATE'}]);await tick();assert.equal(f.container.innerHTML,prior);
 const failed=mountedDetails(t,{autoDetails:true,metadataFetcher:async()=>{throw new Error('metadata offline');}});
 failed.requests[0].resolve(response(page([transaction(1)])));await tick();failed.requests[1].resolve(response(detail({tokenChanges:[{mint,change:'+1'}]})));await new Promise(resolve=>setTimeout(resolve,300));
 assert.match(failed.container.innerHTML,/Balance change Token/);assert.match(failed.container.innerHTML,/\+1 Token/);assert.doesNotMatch(failed.container.innerHTML,/metadata offline|Transaction details are unavailable/);
});

test('completed detail data is reused if refresh removes a row and a later page restores it',async t=>{
 const f=mountedDetails(t,{autoDetails:true});f.requests[0].resolve(response(page([transaction(1)])));await tick();f.requests[1].resolve(response(detail()));await tick();
 f.action('refresh');f.requests[2].resolve(response(page([])));await tick();assert.match(f.container.innerHTML,/No recent transactions found/);
 f.action('refresh');f.requests[3].resolve(response(page([transaction(1)])));await tick();
 assert.equal(f.requests.length,4,'restored transaction must use the in-memory detail cache');assert.match(f.container.innerHTML,/-0\.012 SOL/);
});
