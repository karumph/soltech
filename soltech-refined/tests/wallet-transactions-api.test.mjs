import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {createWalletTransactionsAPI,createWalletTransactionAPI,createWalletTransactionsHandler,validTransactionSignature} from '../wallet-transactions-api.mjs';

const address='So11111111111111111111111111111111111111112';
const other='11111111111111111111111111111111';
const signature=n=>'1'.repeat(63)+'123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[n];
const row=(n=1,overrides={})=>({signature:signature(n),slot:1000-n,blockTime:1791748800-n,err:null,confirmationStatus:'confirmed',...overrides});
const rpc=result=>({jsonrpc:'2.0',id:1,result});
const response=body=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
const now=()=>Date.UTC(2026,9,11,18);

test('addresses and page cursors must decode to 32 and 64 bytes before any network call',async()=>{
 let calls=0;const api=createWalletTransactionsAPI({fetcher:async()=>{calls++;return response(rpc([]));}});
 for(const value of [null,{},address,{address:null},{address:'1'.repeat(33)},{address:'z'.repeat(44)},{address:'0x'+'a'.repeat(40)},{address,url:'https://evil.example',before:'bad'}])assert.equal((await api(value)).statusCode,400);
 for(const cursor of ['',null,undefined,{},'0'.repeat(88),'1'.repeat(63),'1'.repeat(65),'2'.repeat(64),'z'.repeat(88),signature(1)+' ']){
  assert.equal(validTransactionSignature(cursor),false,String(cursor));
  if(cursor!==null&&cursor!==undefined)assert.equal((await api({address,before:cursor})).statusCode,400);
 }
 assert.equal(validTransactionSignature('1'.repeat(64)),true);assert.equal(validTransactionSignature(signature(1)),true);assert.equal(calls,0);
 assert.equal((await api({address:' '+address+' ',before:null})).statusCode,200);
});

test('only the fixed public RPC method and bounded parameters are sent without credentials',async()=>{
 let sent;const api=createWalletTransactionsAPI({now,fetcher:async(url,options)=>{
  assert.equal(url,'https://api.mainnet-beta.solana.com');sent=options;
  return response(rpc([row(1),row(2,{err:{InstructionError:[1,'Custom']},blockTime:null,confirmationStatus:null})]));
 }});
 const result=await api({address,before:signature(40),url:'https://evil.example',method:'sendTransaction',token:'do-not-forward'});
 assert.deepEqual(JSON.parse(sent.body),{jsonrpc:'2.0',id:1,method:'getSignaturesForAddress',params:[address,{limit:20,commitment:'confirmed',before:signature(40)}]});
 assert.equal(sent.method,'POST');assert.equal(sent.credentials,'omit');assert.equal(sent.redirect,'error');assert.equal(sent.referrerPolicy,'no-referrer');
 assert.deepEqual(result,{statusCode:200,body:{status:'ready',address,transactions:[{signature:signature(1),slot:999,blockTime:1791748799,status:'succeeded',confirmationStatus:'confirmed'},{signature:signature(2),slot:998,blockTime:null,status:'failed',confirmationStatus:null}],nextBefore:null,checkedAt:'2026-10-11T18:00:00.000Z'}});
 assert.equal(result.body.transactions[0].amount,undefined);assert.equal(result.body.transactions[0].type,undefined);
});

test('full pages expose the final signature as cursor and subsequent short or empty pages finish pagination',async()=>{
 const requests=[],pages=[Array.from({length:20},(_,i)=>row(i+1)),[row(21)],[]];
 const api=createWalletTransactionsAPI({fetcher:async(url,options)=>{requests.push(JSON.parse(options.body));return response(rpc(pages.shift()));}});
 const first=await api({address});assert.equal(first.body.transactions.length,20);assert.equal(first.body.nextBefore,signature(20));
 const second=await api({address,before:first.body.nextBefore});assert.equal(second.body.transactions.length,1);assert.equal(second.body.nextBefore,null);
 const empty=await api({address,before:signature(21)});assert.deepEqual(empty.body.transactions,[]);assert.equal(empty.body.nextBefore,null);
 assert.equal(Object.hasOwn(requests[0].params[1],'before'),false);assert.equal(requests[1].params[1].before,signature(20));
});

test('provider errors stay sanitized and cannot become an empty successful page',async()=>{
 for(const [status,expected] of [[401,503],[403,503],[404,502],[408,504],[429,429],[500,502],[504,504]]){
  const result=await createWalletTransactionsAPI({fetcher:async()=>new Response('private upstream detail',{status})})({address});
  assert.equal(result.statusCode,expected);assert.equal(result.body.status,'error');assert.equal(result.body.transactions,undefined);assert.doesNotMatch(JSON.stringify(result),/private/);
 }
 for(const [code,expected] of [[429,429],[-32005,503],[-32602,502],[-32603,502]]){
  const result=await createWalletTransactionsAPI({fetcher:async()=>response({jsonrpc:'2.0',id:1,error:{code,message:'private RPC detail'},result:[]})})({address});
  assert.equal(result.statusCode,expected);assert.equal(result.body.status,'error');assert.doesNotMatch(JSON.stringify(result),/private/);
 }
 const network=await createWalletTransactionsAPI({fetcher:async()=>{throw Error('private network detail');}})({address});assert.equal(network.statusCode,502);assert.doesNotMatch(JSON.stringify(network),/private/);
});

test('rate limits honor bounded retry-after and prevent upstream calls during cooldown',async()=>{
 for(const [header,expected,providerWait] of [['3',3000,3000],['9999999',60000,9999999000],['invalid',10000,10000]]){
  let clock=100000,calls=0;
  const api=createWalletTransactionsAPI({clock:()=>clock,fetcher:async()=>{calls++;return calls===1?new Response('private limit',{status:429,headers:{'Retry-After':header}}):response(rpc([]));}});
  const limited=await api({address});assert.equal(limited.body.retryAfterMs,expected);
  clock+=500;assert.equal((await api({address})).statusCode,429);assert.equal(calls,1);
  if(providerWait>expected){clock+=expected;assert.equal((await api({address})).statusCode,429);assert.equal(calls,1);}
  clock+=providerWait;assert.equal((await api({address})).statusCode,200);assert.equal(calls,2);
 }
});

test('malformed RPC and transaction fields are rejected instead of claiming there are no transactions',async()=>{
 const invalid=[null,{},[],{result:[]},{...rpc([]),id:2},{...rpc([]),jsonrpc:'1.0'},rpc(null),rpc('empty'),rpc(Array.from({length:21},(_,i)=>row(i+1))),rpc([row(),row()]),
  ...[{signature:'bad'},{slot:-1},{slot:1.5},{slot:Number.MAX_SAFE_INTEGER+1},{blockTime:undefined},{blockTime:'1791748800'},{blockTime:-1},{blockTime:9000000000000},{err:undefined},{err:false},{err:{}},{confirmationStatus:'unknown'},{confirmationStatus:undefined}].map(patch=>rpc([row(1,patch)]))];
 for(const body of invalid){const result=await createWalletTransactionsAPI({fetcher:async()=>response(body)})({address});assert.equal(result.statusCode,502);assert.equal(result.body.status,'error');}
 assert.equal((await createWalletTransactionsAPI({fetcher:async()=>new Response('<html>not JSON</html>')})({address})).statusCode,502);
 const repeatedCursor=await createWalletTransactionsAPI({fetcher:async()=>response(rpc([row(1)]))})({address,before:signature(1)});assert.equal(repeatedCursor.statusCode,502);
 const enumError=await createWalletTransactionsAPI({fetcher:async()=>response(rpc([row(1,{err:'AccountInUse',confirmationStatus:'finalized'})]))})({address});assert.equal(enumError.body.transactions[0].status,'failed');
});

test('response byte limits apply to announced and streamed bodies',async()=>{
 for(const headers of [{},{'Content-Length':'1025'}]){
  const result=await createWalletTransactionsAPI({maxResponseBytes:1024,fetcher:async()=>new Response('x'.repeat(1025),{headers})})({address});assert.equal(result.statusCode,502);
 }
 const noBody=await createWalletTransactionsAPI({fetcher:async()=>new Response(null)})({address});assert.equal(noBody.statusCode,502);
});

test('timeouts cover stalled headers and bodies, abort the request, and permit retry',async()=>{
 let signal,calls=0;
 const api=createWalletTransactionsAPI({timeoutMs:10,fetcher:async(url,options)=>{signal=options.signal;calls++;return calls===1?new Promise(()=>{}):response(rpc([]));}});
 assert.equal((await api({address})).statusCode,504);assert.equal(signal.aborted,true);assert.equal((await api({address})).statusCode,200);
 const body=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{'));}});
 const stalled=createWalletTransactionsAPI({timeoutMs:10,fetcher:async()=>new Response(body)});assert.equal((await stalled({address})).statusCode,504);
});

test('identical address and cursor requests coalesce while concurrent distinct pages are bounded at two',async()=>{
 const completions=[];const api=createWalletTransactionsAPI({fetcher:()=>new Promise(resolve=>completions.push(resolve))});
 const first=api({address}),same=api({address}),page=api({address,before:signature(20)});
 assert.equal(completions.length,2);assert.equal((await api({address:other})).statusCode,429);
 completions[0](response(rpc([row(1)])));completions[1](response(rpc([row(21)])));
 assert.deepEqual(await first,await same);assert.equal((await page).body.transactions[0].signature,signature(21));
 const retried=api({address:other});assert.equal(completions.length,3);completions[2](response(rpc([])));assert.equal((await retried).statusCode,200);
});

const port=4183,host='127.0.0.1:'+port,origin='http://'+host;
function request({method='POST',headers={},chunks=[JSON.stringify({address})],remoteAddress='127.0.0.1'}={}){
 return {method,headers:{host,origin,'content-type':'application/json',...headers},socket:{remoteAddress},async *[Symbol.asyncIterator](){for(const chunk of chunks)yield Buffer.from(chunk);}};
}
async function invoke(handler,options={},pathname='/api/wallet/transactions'){
 const res={statusCode:null,headers:{},body:''};
 const handled=await handler(request(options),{writeHead(statusCode,headers){res.statusCode=statusCode;res.headers=headers;},end(body=''){res.body+=body;}},pathname);
 return {...res,handled};
}

test('history and detail routes share provider cooldown with a safe Retry-After header',async()=>{
 let calls=0;const handler=createWalletTransactionsHandler({port,fetcher:async()=>{calls++;return new Response('limited',{status:429,headers:{'Retry-After':'5'}});}});
 const list=await invoke(handler);assert.equal(list.statusCode,429);assert.equal(list.headers['Retry-After'],'5');
 const details=await invoke(handler,{chunks:[JSON.stringify({address,signature:signature(1)})]},'/api/wallet/transaction');
 assert.equal(details.statusCode,429);assert.equal(calls,1);assert.ok(JSON.parse(details.body).retryAfterMs<=5000);
});

test('handler rejects non-local, cross-origin, non-JSON, invalid and oversized requests',async()=>{
 let calls=0;const handler=createWalletTransactionsHandler({port,fetcher:async()=>{calls++;return response(rpc([]));}});
 for(const options of [{headers:{host:'evil.example'}},{headers:{host:'127.0.0.1:9999'}},{headers:{origin:'https://evil.example'}},{headers:{origin:'null'}},{headers:{'sec-fetch-site':'cross-site'}},{remoteAddress:'192.168.1.1'}])assert.equal((await invoke(handler,options)).statusCode,403);
 const get=await invoke(handler,{method:'GET'});assert.equal(get.statusCode,405);assert.equal(get.headers.Allow,'POST');
 assert.equal((await invoke(handler,{headers:{'content-type':'text/plain'}})).statusCode,415);
 assert.equal((await invoke(handler,{headers:{'content-length':'1025'}})).statusCode,413);
 assert.equal((await invoke(handler,{chunks:['é'.repeat(513)]})).statusCode,413);
 for(const body of ['{bad','null','{}','[]',JSON.stringify({address,before:'invalid'})])assert.equal((await invoke(handler,{chunks:[body]})).statusCode,400);
 assert.equal(calls,0);
 const good=await invoke(handler,{headers:{'content-type':'application/json; charset=UTF-8'},chunks:['{"address":"',address,'","url":"https://evil.example"}']});
 assert.equal(good.statusCode,200);assert.equal(JSON.parse(good.body).status,'ready');assert.equal(calls,1);assert.equal(good.headers['Cache-Control'],'no-store');assert.equal(good.headers['X-Content-Type-Options'],'nosniff');
 const unrelated=await invoke(handler,{},'/api/wallet');assert.equal(unrelated.handled,false);assert.equal(unrelated.statusCode,null);
});

test('streamed oversized requests receive an error without destroying the response socket',async t=>{
 const req=new PassThrough();t.after(()=>req.destroy());Object.assign(req,{method:'POST',headers:{host,origin,'content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'}});
 const handler=createWalletTransactionsHandler({port,fetcher:()=>{throw Error('must not call upstream');}}),res={statusCode:null,body:''};
 const pending=handler(req,{writeHead(statusCode){res.statusCode=statusCode;},end(body){res.body=body;}},'/api/wallet/transactions');
 req.write('x'.repeat(800));req.write('x'.repeat(800));assert.equal(await pending,true);assert.equal(res.statusCode,413);assert.equal(JSON.parse(res.body).status,'error');assert.equal(req.destroyed,false);
});

const detail=(overrides={})=>({slot:1000,blockTime:1791748800,transaction:{signatures:[signature(1)],message:{accountKeys:[{pubkey:other,signer:true,writable:true},{pubkey:address,signer:false,writable:true}],instructions:[]}},meta:{err:null,fee:5000,preBalances:[2000000000,1000000000],postBalances:[1999995000,1500000000],preTokenBalances:[],postTokenBalances:[],innerInstructions:[]},...overrides});

test('transaction details use the fixed parsed RPC and measure the selected wallet balance change',async()=>{
 let sent;const api=createWalletTransactionAPI({fetcher:async(url,options)=>{assert.equal(url,'https://api.mainnet-beta.solana.com');sent=JSON.parse(options.body);return response(rpc(detail()));}});
 const result=await api({address,signature:signature(1),url:'https://evil.example',method:'sendTransaction'});
 assert.deepEqual(sent,{jsonrpc:'2.0',id:1,method:'getTransaction',params:[signature(1),{encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:1}]});
 assert.deepEqual(result,{statusCode:200,body:{status:'ready',address,signature:signature(1),slot:1000,blockTime:1791748800,transactionStatus:'succeeded',feeSol:0.000005,solChange:0.5,transfers:[],tokenChanges:[],detailsComplete:true,detailsNote:null}});
 assert.equal(result.body.amount,undefined);assert.equal(result.body.type,undefined);
});

test('failed transactions still report their fee and real negative balance change, with string keys supported',async()=>{
 const data=detail({blockTime:null});data.transaction.message.accountKeys=[other,address];data.meta={err:{InstructionError:[0,'AccountNotFound']},fee:5000,preBalances:[10,1000000000],postBalances:[10,999995000]};
 const result=await createWalletTransactionAPI({fetcher:async()=>response(rpc(data))})({address,signature:signature(1)});
 assert.equal(result.statusCode,200);assert.equal(result.body.transactionStatus,'failed');assert.equal(result.body.feeSol,0.000005);assert.equal(result.body.solChange,-0.000005);assert.equal(result.body.blockTime,null);
 data.meta.postBalances[1]=data.meta.preBalances[1];assert.equal((await createWalletTransactionAPI({fetcher:async()=>response(rpc(data))})({address,signature:signature(1)})).body.solChange,0,'a verified unchanged balance is distinct from missing data');
});

test('missing, mismatched and malformed transaction details never imply a zero balance change',async()=>{
 const cases=[null,{},detail({meta:null}),detail({blockTime:undefined}),detail({slot:-1})];
 for(const mutate of [
  value=>{value.transaction.signatures=[signature(2)];},
  value=>{value.transaction.message.accountKeys=[other,'1'.repeat(31)+'2'];},
  value=>{value.transaction.message.accountKeys=[address,address];},
  value=>{value.transaction.message.accountKeys[0]='bad';},
  value=>{value.meta.fee='5000';},value=>{value.meta.fee=Number.MAX_SAFE_INTEGER+1;},value=>{value.meta.fee=-1;},
  value=>{delete value.meta.err;},value=>{value.meta.preBalances=null;},value=>{value.meta.postBalances=[0];},
  value=>{value.meta.preBalances[0]=Number.MAX_SAFE_INTEGER+1;},value=>{value.meta.postBalances[1]=-1;},value=>{value.meta.postBalances[1]=1.5;},
 ]){const value=detail();mutate(value);cases.push(value);}
 for(const data of cases){const result=await createWalletTransactionAPI({fetcher:async()=>response(rpc(data))})({address,signature:signature(1)});assert.ok([404,502].includes(result.statusCode));assert.equal(result.body.status,'error');assert.equal(result.body.solChange,undefined);}
 let calls=0;const invalid=createWalletTransactionAPI({fetcher:async()=>{calls++;return response(rpc(detail()));}});
 for(const input of [{address:'invalid',signature:signature(1)},{address,signature:'bad'},{address}])assert.equal((await invalid(input)).statusCode,400);assert.equal(calls,0);
});

test('detail provider errors, oversized responses and deadlines remain bounded and sanitized',async()=>{
 for(const fetcher of [async()=>response({jsonrpc:'2.0',id:1,error:{code:-32603,message:'private failure'}}),async()=>new Response('private failure',{status:403}),async()=>new Response('x'.repeat(2097153))]){
  const result=await createWalletTransactionAPI({fetcher})({address,signature:signature(1)});assert.equal(result.body.status,'error');assert.doesNotMatch(JSON.stringify(result),/private/);
 }
 const timedOut=await createWalletTransactionAPI({timeoutMs:10,fetcher:()=>new Promise(()=>{})})({address,signature:signature(1)});assert.equal(timedOut.statusCode,504);
});

test('history and on-demand details share the two-request bound and never preload other details',async()=>{
 const requests=[];const handler=createWalletTransactionsHandler({port,fetcher:(url,options)=>new Promise(resolve=>requests.push({body:JSON.parse(options.body),resolve}))});
 const history=invoke(handler),same=invoke(handler),detailsOptions={chunks:[JSON.stringify({address,signature:signature(1)})]},detailRequest=invoke(handler,detailsOptions,'/api/wallet/transaction');
 await new Promise(resolve=>setImmediate(resolve));assert.equal(requests.length,2);assert.deepEqual(requests.map(request=>request.body.method),['getSignaturesForAddress','getTransaction']);
 const busy=await invoke(handler,{chunks:[JSON.stringify({address,signature:signature(2)})]},'/api/wallet/transaction');assert.equal(busy.statusCode,429);
 requests[0].resolve(response(rpc([row(1)])));requests[1].resolve(response(rpc(detail())));
 assert.equal((await history).statusCode,200);assert.deepEqual(await history,await same);assert.equal((await detailRequest).statusCode,200);assert.equal(requests.length,2);
 for(const options of [{headers:{origin:'https://evil.example'}},{remoteAddress:'192.168.1.1'}])assert.equal((await invoke(handler,options,'/api/wallet/transaction')).statusCode,403);
});

const tokenProgram='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const token2022='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const pubkey=n=>'1'.repeat(31)+alphabet[n];
const tokenA=pubkey(2),tokenB=pubkey(3),tokenC=pubkey(4),mintA=pubkey(5),mintB=pubkey(6);
const parsedTransfer=(source,destination,lamports,type='transfer')=>({programId:'11111111111111111111111111111111',parsed:{type,info:{source,destination,lamports}}});
const tokenBalance=(accountIndex,owner,amount,mint=mintA,decimals=6)=>({accountIndex,mint,owner,uiTokenAmount:{amount,decimals,uiAmount:99999999,uiAmountString:'never-trust-this'}});
const lookupDetail=async data=>createWalletTransactionAPI({fetcher:async()=>response(rpc(data))})({address,signature:signature(1)});

test('version 1 transactions request provider support and preserve strict identity validation',async()=>{
 const data=detail({version:1});data.transaction.message.instructions=[parsedTransfer(other,address,123456789)];
 let requests=0;
 const api=createWalletTransactionAPI({fetcher:async(url,options)=>{
  requests++;const maxVersion=JSON.parse(options.body).params[1].maxSupportedTransactionVersion;
  return response(maxVersion>=1?rpc(data):{jsonrpc:'2.0',id:1,error:{code:-32015,message:'Transaction version (1) is not supported by the requesting client.'}});
 }});
 const result=await api({address,signature:signature(1)});assert.equal(requests,1);assert.equal(result.statusCode,200);assert.equal(result.body.transfers[0].amount,'0.123456789');assert.equal(result.body.transfers[0].direction,'received');
 data.transaction.signatures=[signature(2)];assert.equal((await api({address,signature:signature(1)})).statusCode,502,'supporting a newer version must not bypass signature checks');
 data.transaction.signatures=[signature(1)];data.transaction.message.accountKeys=[other,pubkey(8)];assert.equal((await api({address,signature:signature(1)})).statusCode,502,'the queried wallet must still be present');
});

test('unsupported future formats have a distinct safe error rather than a misleading transient failure',async()=>{
 const result=await createWalletTransactionAPI({fetcher:async()=>response({jsonrpc:'2.0',id:1,error:{code:-32015,message:'private unsupported version detail'}})})({address,signature:signature(1)});
 assert.equal(result.statusCode,422);assert.equal(result.body.status,'error');assert.match(result.body.error,/newer format/);assert.doesNotMatch(JSON.stringify(result),/private|Try again/);
});

function tokenDetail(){
 const data=detail();data.transaction.message.accountKeys=[other,address,tokenA,tokenB,tokenC];
 data.meta.preBalances=[0,1000000000,0,0,0];data.meta.postBalances=[0,1000000000,0,0,0];
 data.meta.preTokenBalances=[tokenBalance(2,address,'2500001'),tokenBalance(3,other,'10'),tokenBalance(4,address,'100')];
 data.meta.postTokenBalances=[tokenBalance(2,address,'1000000'),tokenBalance(3,other,'1500011'),tokenBalance(4,address,'100')];
 return data;
}

test('SOL transfers show exact sent, received and self quantities, independently of the fee and net balance',async()=>{
 const data=detail();data.transaction.message.instructions=[parsedTransfer(address,other,100000001),parsedTransfer(other,address,1),parsedTransfer(address,address,0)];
 const result=await lookupDetail(data);
 assert.deepEqual(result.body.transfers,[
  {asset:'SOL',amount:'0.100000001',direction:'sent',source:address,destination:other},
  {asset:'SOL',amount:'0.000000001',direction:'received',source:other,destination:address},
  {asset:'SOL',amount:'0',direction:'self',source:address,destination:address}
 ]);
 assert.equal(result.body.solChange,0.5);assert.equal(result.body.feeSol,0.000005);assert.equal(result.body.detailsComplete,true);
});

test('parsed inner transferWithSeed is available while an unsupported outer program remains partial',async()=>{
 const data=detail();data.transaction.message.instructions=[{programId:tokenProgram,accounts:[address,other],data:'unparsed'}];
 data.meta.innerInstructions=[{index:0,instructions:[parsedTransfer(other,address,2500000000,'transferWithSeed')]}];
 const result=await lookupDetail(data);assert.equal(result.body.transfers[0].amount,'2.5');assert.equal(result.body.transfers[0].direction,'received');assert.equal(result.body.detailsComplete,false);assert.match(result.body.detailsNote,/could not be verified/);
 data.meta.innerInstructions.push(data.meta.innerInstructions[0]);
 assert.equal((await lookupDetail(data)).body.transfers.length,1,'duplicate inner groups cannot double-count a transfer');
});

test('SPL transferChecked uses exact raw quantity and explicit account ownership, including Token-2022',async()=>{
 for(const programId of [tokenProgram,token2022]){
  const data=tokenDetail();data.transaction.message.instructions=[{programId,parsed:{type:'transferChecked',info:{source:tokenA,destination:tokenB,mint:mintA,authority:other,tokenAmount:{amount:'1500001',decimals:6,uiAmount:9999999,uiAmountString:'9000'}}}}];
  const result=await lookupDetail(data);
  assert.deepEqual(result.body.transfers,[{asset:mintA,amount:'1.500001',direction:'sent',source:tokenA,destination:tokenB}]);
  assert.deepEqual(result.body.tokenChanges,[{mint:mintA,change:'-1.500001'}]);assert.equal(result.body.detailsComplete,true);
 }
});

test('unchecked SPL transfers derive verified decimals and distinguish received from movement between own accounts',async()=>{
 const data=tokenDetail();data.transaction.message.instructions=[
  {programId:tokenProgram,parsed:{type:'transfer',info:{source:tokenB,destination:tokenA,amount:'42',authority:other}}},
  {programId:tokenProgram,parsed:{type:'transfer',info:{source:tokenA,destination:tokenC,amount:'1000000',authority:address}}}
 ];
 const result=await lookupDetail(data);assert.deepEqual(result.body.transfers.map(({direction,amount})=>({direction,amount})),[{direction:'received',amount:'0.000042'},{direction:'self',amount:'1'}]);
});

test('token balance changes aggregate wallet-owned accounts exactly, including opened and closed accounts',async()=>{
 const data=tokenDetail();
 data.meta.preTokenBalances=[tokenBalance(2,address,'18446744073709551615',mintA,9),tokenBalance(3,other,'999',mintA,9),tokenBalance(4,address,'1000000000',mintA,9)];
 data.meta.postTokenBalances=[tokenBalance(2,address,'18446744073709551614',mintA,9),tokenBalance(3,other,'999',mintA,9)];
 let result=await lookupDetail(data);assert.deepEqual(result.body.tokenChanges,[{mint:mintA,change:'-1.000000001'}]);
 data.meta.preTokenBalances=[];data.meta.postTokenBalances=[tokenBalance(4,address,'18446744073709551615',mintA,0)];
 result=await lookupDetail(data);assert.deepEqual(result.body.tokenChanges,[{mint:mintA,change:'+18446744073709551615'}]);
});

test('multiple token changes remain balance changes without invented swap, buy, sell or USD labels',async()=>{
 const data=tokenDetail();data.meta.preTokenBalances=[tokenBalance(2,address,'10000000'),tokenBalance(4,address,'0',mintB,9)];
 data.meta.postTokenBalances=[tokenBalance(2,address,'1000000'),tokenBalance(4,address,'1500000000',mintB,9)];
 data.transaction.message.instructions=[{programId:tokenProgram,accounts:[tokenA,tokenC],data:'unknown'}];
 const result=await lookupDetail(data);assert.deepEqual(result.body.tokenChanges,[{mint:mintA,change:'-9'},{mint:mintB,change:'+1.5'}]);assert.deepEqual(result.body.transfers,[]);assert.equal(result.body.detailsComplete,false);
 assert.equal(result.body.type,undefined);assert.equal(result.body.usdValue,undefined);assert.doesNotMatch(JSON.stringify(result.body),/swap|buy|sell|USD/);
});

test('unknown owners, malformed amounts, mixed decimals and conflicting balance metadata cannot fabricate token activity',async()=>{
 for(const mutate of [
  data=>{delete data.meta.preTokenBalances[0].owner;},
  data=>{data.meta.postTokenBalances[0].owner=other;},
  data=>{data.meta.postTokenBalances[0].uiTokenAmount.amount='1.5';},
  data=>{data.meta.postTokenBalances[0].uiTokenAmount.amount='01';},
  data=>{data.meta.postTokenBalances[0].uiTokenAmount.amount='18446744073709551616';},
  data=>{data.meta.postTokenBalances[0].uiTokenAmount.amount=1000000;},
  data=>{data.meta.postTokenBalances[0].uiTokenAmount.decimals=9;},
  data=>{data.meta.postTokenBalances.push(data.meta.postTokenBalances[0]);},
  data=>{data.meta.postTokenBalances[0].mint='invalid';},
  data=>{delete data.meta.preTokenBalances;},
 ]){
  const data=tokenDetail();data.transaction.message.instructions=[{programId:tokenProgram,parsed:{type:'transfer',info:{source:tokenA,destination:tokenB,amount:'1500001',authority:address}}}];mutate(data);
  const result=await lookupDetail(data);assert.equal(result.statusCode,200);assert.deepEqual(result.body.transfers,[]);assert.deepEqual(result.body.tokenChanges,[]);assert.equal(result.body.detailsComplete,false);
 }
});

test('checked token metadata must match balances and a signer cannot substitute for a missing token owner',async()=>{
 for(const patch of [{mint:mintB},{tokenAmount:{amount:'1500001',decimals:9}},{tokenAmount:{amount:'-1',decimals:6}}]){
  const data=tokenDetail();data.transaction.message.instructions=[{programId:tokenProgram,parsed:{type:'transferChecked',info:{source:tokenA,destination:tokenB,mint:mintA,tokenAmount:{amount:'1500001',decimals:6},...patch}}}];
  const result=await lookupDetail(data);assert.deepEqual(result.body.transfers,[]);assert.equal(result.body.detailsComplete,false);assert.deepEqual(result.body.tokenChanges,[{mint:mintA,change:'-1.500001'}]);
 }
 const data=tokenDetail();data.meta.preTokenBalances[0].owner=other;data.meta.postTokenBalances[0].owner=other;
 data.transaction.message.instructions=[{programId:tokenProgram,parsed:{type:'transfer',info:{source:tokenA,destination:tokenB,amount:'1500001',authority:address}}}];
 assert.deepEqual((await lookupDetail(data)).body.transfers,[],'authority is not evidence that the wallet owns either account');
});

test('failed instructions are not presented as completed transfers, and missing activity metadata stays partial',async()=>{
 const data=detail();data.transaction.message.instructions=[parsedTransfer(address,other,1000000000)];data.meta.err={InstructionError:[0,'Custom']};
 let result=await lookupDetail(data);assert.deepEqual(result.body.transfers,[]);assert.equal(result.body.transactionStatus,'failed');assert.equal(result.body.solChange,0.5);assert.equal(result.body.detailsComplete,false);assert.match(result.body.detailsNote,/failed/);
 const missing=detail();delete missing.transaction.message.instructions;delete missing.meta.innerInstructions;delete missing.meta.preTokenBalances;
 result=await lookupDetail(missing);assert.deepEqual(result.body.transfers,[]);assert.deepEqual(result.body.tokenChanges,[]);assert.equal(result.body.detailsComplete,false);
});

test('a caught failed inner call does not turn its attempted transfers into completed activity',async()=>{
 const data=detail();data.transaction.message.instructions=[{programId:tokenProgram,data:'unsupported'}];
 data.meta.innerInstructions=[{index:0,instructions:[parsedTransfer(address,other,1000000000)]}];
 data.meta.logMessages=['Program '+tokenProgram+' invoke [1]','Program '+other+' failed: insufficient funds','Program '+tokenProgram+' success'];
 const result=await lookupDetail(data);assert.equal(result.body.transactionStatus,'succeeded');assert.deepEqual(result.body.transfers,[]);assert.equal(result.body.solChange,0.5);assert.equal(result.body.detailsComplete,false);
});

test('malformed transfers and oversized activity lists remain bounded without discarding verified basic details',async()=>{
 for(const bad of [parsedTransfer(address,other,-1),parsedTransfer(address,other,Number.MAX_SAFE_INTEGER+1),parsedTransfer(address,other,'1'),parsedTransfer(address,pubkey(10),1),{...parsedTransfer(address,other,1),programId:pubkey(8)}]){
  const data=detail();data.transaction.message.instructions=[bad];const result=await lookupDetail(data);assert.equal(result.statusCode,200);assert.deepEqual(result.body.transfers,[]);assert.equal(result.body.detailsComplete,false);
 }
 const data=detail();data.transaction.message.instructions=Array.from({length:31},()=>parsedTransfer(address,other,1));
 const result=await lookupDetail(data);assert.equal(result.body.transfers.length,30);assert.equal(result.body.detailsComplete,false);
 const extreme=tokenDetail();extreme.meta.preTokenBalances=[];extreme.meta.postTokenBalances=[tokenBalance(2,address,'1',mintA,255)];
 const small=await lookupDetail(extreme);assert.deepEqual(small.body.tokenChanges,[]);assert.equal(small.body.detailsComplete,false);
});
