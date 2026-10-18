import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {createWalletAPI as walletAPI,createWalletHandler as walletHandler,localWalletRequestAllowed,validWalletAddress} from '../wallet-api.mjs';

const address='So11111111111111111111111111111111111111112';
const other='FLUXBmPhT3Fd1EDVFdg46YREqHBeNypn1h4EbnTzWERX';
const result=(wallet=address)=>({address:wallet,chain:'solana',supported:true,checkedAt:'2026-10-11T12:00:00.000Z',sol:1.5,tokens:0,shown:0,noMarket:0,totalValue:0,risk:{high:0,caution:0,lower:0,unknown:0},flagged:{},holdings:[]});
const response=body=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
const systemProgram='11111111111111111111111111111111';
const tokenPrograms=['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'];
const regularAccount=()=>({owner:systemProgram,executable:false,lamports:0,data:['','base64'],space:0});
const accountReply=(value=regularAccount())=>({jsonrpc:'2.0',id:1,result:{context:{slot:123},value}});
const tokenAccount=(type,index=0)=>({...regularAccount(),owner:tokenPrograms[index],space:type==='mint'?82:165,
 data:{program:index?'spl-token-2022':'spl-token',parsed:{type,info:{owner:other}},space:type==='mint'?82:165}});
const noPrice={solPriceUsd:null,solPriceCheckedAt:null,solPriceSource:null};
// Every service is isolated, including cases which only exercise the wallet bridge.
const createWalletAPI=options=>walletAPI({accountFetcher:async()=>response(accountReply()),solPriceFetcher:async()=>response([]),...options});
const createWalletHandler=options=>walletHandler({accountFetcher:async()=>response(accountReply()),solPriceFetcher:async()=>response([]),...options});
const pair=(patch={})=>({chainId:'solana',pairAddress:other,baseToken:{address},priceUsd:'150.25',liquidity:{usd:1000000},...patch});

test('wallet addresses must decode to exactly 32 bytes before any service call',async()=>{
 let calls=0;const api=createWalletAPI({fetcher:async()=>{calls++;return response(result());}});
 for(const value of [undefined,null,{},42,'','https://evil.example',address+'1','1'.repeat(33),'z'.repeat(44),'0x'+'a'.repeat(40),'O'.repeat(32)]){
  assert.equal(validWalletAddress(value),false);assert.equal((await api(value)).statusCode,400);
 }
 assert.equal(validWalletAddress('1'.repeat(32)),true);
 assert.equal(calls,0);assert.equal((await api(' '+address+' ')).statusCode,200);assert.equal(calls,1);
});

test('only the public address goes to the fixed endpoint, with no credentials or redirects',async()=>{
 let calls=0;const api=createWalletAPI({fetcher:async(url,options)=>{
  calls++;assert.equal(url,'https://soltech.d3ilz6ab0hx4y4.amplifyapp.com/api/wallet');
  assert.deepEqual(JSON.parse(options.body),{address});assert.equal(options.method,'POST');
  assert.deepEqual(options.headers,{'Content-Type':'application/json',Accept:'application/json'});
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.referrerPolicy,'no-referrer');
  return response(result());
 }});
 assert.deepEqual(await api(address),{statusCode:200,body:{...result(),...noPrice,status:'ready'}});assert.equal(calls,1);
});

test('account verification uses the exact address and fixed RPC before holdings and quotes',async()=>{
 const wallet='4cwfMFnNjgvriwf4UEEKPYzWP1923TEXfXVRQmaQSX8Z',calls=[];
 // Without a separate accountFetcher, production's shared fetch scheduler is reused.
 const api=walletAPI({fetcher:async(url,options)=>{
  calls.push(url);
  if(calls.length===1){
   assert.equal(url,'https://solana-rpc.publicnode.com');
   assert.deepEqual(JSON.parse(options.body),{jsonrpc:'2.0',id:1,method:'getAccountInfo',params:[wallet,{encoding:'jsonParsed',commitment:'confirmed'}]});
   assert.equal(options.method,'POST');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
   assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.cache,'no-store');assert.ok(options.signal instanceof AbortSignal);
   return response(accountReply({...regularAccount(),lamports:1500000000}));
  }
  assert.equal(url,'https://soltech.d3ilz6ab0hx4y4.amplifyapp.com/api/wallet');
  assert.deepEqual(JSON.parse(options.body),{address:wallet});return response(result(wallet));
 },solPriceFetcher:async()=>{calls.push('quote');return response([pair()]);}});
 const got=await api(' '+wallet+' ');
 assert.equal(got.statusCode,200);assert.equal(got.body.address,wallet);assert.equal(got.body.solPriceUsd,150.25);
 assert.deepEqual(calls,['https://solana-rpc.publicnode.com','https://soltech.d3ilz6ab0hx4y4.amplifyapp.com/api/wallet','quote']);
});

test('legacy and Token-2022 coin addresses fail before holdings or pricing',async()=>{
 const mint='3NxfWMHmfQg8NJFW5AG1ti2xACdczWz24e9SKyk1pump';let holdings=0,quotes=0;
 for(const index of [0,1]){
  const account=tokenAccount('mint',index);if(index){account.space=410;account.data.space=410;}
  const api=createWalletAPI({accountFetcher:async()=>response(accountReply(account)),fetcher:async()=>{holdings++;return response(result(mint));},solPriceFetcher:async()=>{quotes++;return response([pair()]);}});
  assert.deepEqual(await api(mint),{statusCode:400,body:{status:'error',error:'This is a coin address. Paste a wallet address instead.'}});
 }
 assert.equal(holdings,0);assert.equal(quotes,0);
});

test('token accounts, executable programs and data accounts cannot become wallet reports or redirect to owners',async()=>{
 const cases=[
  [tokenAccount('account',0),/token account address/],[tokenAccount('account',1),/token account address/],
  [tokenAccount('multisig'),/token program account/],
  [{...regularAccount(),executable:true},/program address/],
  [{...regularAccount(),space:1,data:['AA==','base64']},/account type is not supported/],
  [{...regularAccount(),owner:other},/account type is not supported/],
  [{...regularAccount(),space:80,data:{program:'system',parsed:{type:'nonce',info:{authority:other}}}},/account type is not supported/],
 ];
 for(const [account,message] of cases){
  let calls=0;
  const api=createWalletAPI({accountFetcher:async()=>response(accountReply(account)),fetcher:async()=>{calls++;return response(result(other));},solPriceFetcher:async()=>{calls++;return response([pair()]);}});
  const got=await api(address);assert.equal(got.statusCode,400);assert.match(got.body.error,message);
  assert.equal(got.body.holdings,undefined);assert.equal(got.body.address,undefined);assert.equal(calls,0);
 }
});

test('regular empty wallets and null unfunded accounts retain genuine empty or token-only holdings',async()=>{
 for(const account of [regularAccount(),null])for(const tokenOnly of [false,true]){
  const wallet={...result(),sol:0,...(tokenOnly?{tokens:1,shown:1,noMarket:1,holdings:[{address:other,found:false,amount:2,valueUsd:null,risk:'unknown'}]}:{})};
  const api=createWalletAPI({accountFetcher:async()=>response(accountReply(account)),fetcher:async()=>response(wallet)});
  assert.deepEqual(await api(address),{statusCode:200,body:{...wallet,status:'ready',...noPrice}});
 }
});

test('malformed account envelopes and contradictory account data fail closed without service details',async()=>{
 const badAccounts=[{},[],{...regularAccount(),owner:'invalid'},{...regularAccount(),executable:undefined},
  {...regularAccount(),lamports:null},{...regularAccount(),space:undefined},{...regularAccount(),space:-1},
  {...regularAccount(),data:undefined},{...regularAccount(),data:['','base58']},{...regularAccount(),data:['AA==','base64']},
  {...regularAccount(),data:['!','base64']},{...regularAccount(),space:1},{...regularAccount(),data:{program:'system',parsed:{type:'nonce'}}},
  {...tokenAccount('mint'),data:{...tokenAccount('mint').data,program:'spl-token-2022'}},
  {...tokenAccount('mint'),data:{...tokenAccount('mint').data,space:99}}];
 const malformed=[null,{},[],{...accountReply(),id:2},{...accountReply(),jsonrpc:'1.0'},
  {...accountReply(),error:{message:'private provider data'}},{...accountReply(),result:{value:null}},
  {...accountReply(),result:{context:{slot:1}}},{...accountReply(),result:{context:{slot:-1},value:null}},
  ...badAccounts.map(accountReply)];
 for(const body of malformed){
  let calls=0;const api=createWalletAPI({accountFetcher:async()=>response(body),fetcher:async()=>{calls++;return response(result());},solPriceFetcher:async()=>{calls++;return response([pair()]);}});
  const got=await api(address);assert.equal(got.statusCode,503);assert.match(got.body.error,/verification is unavailable.*Try again/);
  assert.doesNotMatch(JSON.stringify(got),/private/);assert.equal(got.body.holdings,undefined);assert.equal(calls,0);
 }
});

test('account verification errors, bad JSON and bounded bodies never fall through to holdings',async()=>{
 const failures=[
  ...[[401,503],[403,503],[429,429],[500,503],[504,504]].map(([status,expected])=>[()=>new Response('private provider data',{status}),expected]),
  [()=>{throw new Error('private network data');},503],[()=>new Response('<html>'),503],
  [()=>new Response('x'.repeat(1025)),503],[()=>new Response('{}',{headers:{'Content-Length':'1025'}}),503],
 ];
 for(const [accountFetcher,expected] of failures){
  let calls=0;const api=createWalletAPI({accountFetcher,accountMaxResponseBytes:1024,fetcher:async()=>{calls++;return response(result());},solPriceFetcher:async()=>{calls++;return response([pair()]);}});
  const got=await api(address);assert.equal(got.statusCode,expected);assert.equal(got.body.status,'error');
  assert.match(got.body.error,/Try again/);assert.doesNotMatch(JSON.stringify(got),/private/);assert.equal(calls,0);
 }
});

test('account deadline aborts stalled fetches and bodies, ignores late replies and allows retry',async()=>{
 for(const stalledBody of [false,true]){
  let signal,finish,cancelled=false,checks=0,holdings=0;
  const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{'));},cancel(){cancelled=true;}});
  const api=createWalletAPI({accountTimeoutMs:10,timeoutMs:1000,accountFetcher:async(url,options)=>{
   signal=options.signal;checks++;if(checks>1)return response(accountReply());
   return stalledBody?new Response(stream):new Promise(done=>{finish=done;});
  },fetcher:async()=>{holdings++;return response(result());}});
  const got=await api(address);assert.equal(got.statusCode,504);assert.match(got.body.error,/verification timed out/);
  assert.equal(signal.aborted,true);assert.equal(holdings,0);if(stalledBody)assert.equal(cancelled,true);
  else{finish(response(accountReply()));await new Promise(done=>setImmediate(done));assert.equal(holdings,0);}
  assert.equal((await api(address)).statusCode,200);assert.equal(holdings,1);
 }
});

test('overall wallet deadline also cancels account verification before any downstream lookup',async()=>{
 let signal,finish,calls=0;
 const api=createWalletAPI({timeoutMs:10,accountTimeoutMs:1000,accountFetcher:async(url,options)=>{signal=options.signal;return new Promise(done=>{finish=done;});},fetcher:async()=>{calls++;return response(result());}});
 assert.equal((await api(address)).statusCode,504);assert.equal(signal.aborted,true);assert.equal(calls,0);
 finish(response(accountReply()));await new Promise(done=>setImmediate(done));assert.equal(calls,0);
});

test('pending account verification shares duplicate work and respects the two-wallet limit',async()=>{
 const checks=[],holdings=[];
 const api=createWalletAPI({accountFetcher:(url,options)=>new Promise(done=>{checks.push({address:JSON.parse(options.body).params[0],done});}),
  fetcher:async(url,options)=>{const wallet=JSON.parse(options.body).address;holdings.push(wallet);return response(result(wallet));}});
 const first=api(address),duplicate=api(address),second=api(other);
 assert.deepEqual(checks.map(check=>check.address),[address,other]);assert.equal(holdings.length,0);
 assert.equal((await api(systemProgram)).statusCode,429);
 checks.forEach(check=>check.done(response(accountReply())));
 assert.deepEqual(await first,await duplicate);assert.equal((await second).statusCode,200);assert.deepEqual(holdings,[address,other]);
});

test('SOL quote selects the most liquid valid base-mint pool without sharing the wallet address',async()=>{
 const checked=Date.parse('2026-10-16T12:00:00.000Z');let calls=0;
 const wallet={...result(other),tokens:1,shown:1,totalValue:12,risk:{high:0,caution:0,lower:0,unknown:1},holdings:[{address,found:true,amount:2,valueUsd:12,risk:'unknown'}],solPriceUsd:999,solPriceSource:'unverified'};
 const api=createWalletAPI({now:()=>checked,fetcher:async()=>response(wallet),solPriceFetcher:async(url,options)=>{
  calls++;assert.equal(url,'https://api.dexscreener.com/tokens/v1/solana/'+address);
  assert.equal(options.method,'GET');assert.deepEqual(options.headers,{Accept:'application/json'});
  assert.equal(options.body,undefined);assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
  assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.cache,'no-store');
  assert.ok(!JSON.stringify({url,options}).includes(other));
  return response([pair({priceUsd:'140',liquidity:{usd:10}}),pair({chainId:'ethereum',priceUsd:'900',liquidity:{usd:9000000}}),
   pair({baseToken:{address:other},quoteToken:{address},priceUsd:'800',liquidity:{usd:8000000}}),pair(),
   pair({priceUsd:'160',liquidity:{usd:1000}})]);
 }});
 const got=await api(other);assert.equal(got.statusCode,200);assert.equal(got.body.solPriceUsd,150.25);
 assert.equal(got.body.solPriceCheckedAt,new Date(checked).toISOString());assert.equal(got.body.solPriceSource,'dexscreener');
 assert.equal(got.body.totalValue,12);assert.equal(got.body.sol,1.5);assert.deepEqual(got.body.holdings,wallet.holdings);assert.equal(calls,1);
});

test('unverified, malformed and non-positive SOL prices remain unavailable with intact holdings',async()=>{
 const invalid=[null,{},[],[null],[pair({chainId:'base'})],[pair({baseToken:{address:other}})],[pair({pairAddress:'invalid'})],
  ...[null,undefined,{},[],true,'',' ','NaN','Infinity','0x10','1,234','-1','0','1e999',0,-1].map(priceUsd=>[pair({priceUsd})]),
  ...[undefined,null,0,-1,'1000'].map(usd=>[pair({liquidity:{usd}})])];
 for(const body of invalid){
  const api=createWalletAPI({fetcher:async()=>response(result()),solPriceFetcher:async()=>response(body)});
  const got=await api(address);assert.deepEqual(got,{statusCode:200,body:{...result(),status:'ready',...noPrice}});
 }
 const numeric=await createWalletAPI({fetcher:async()=>response(result()),solPriceFetcher:async()=>response([pair({priceUsd:151})])})(address);
 assert.equal(numeric.body.solPriceUsd,151);
});

test('zero SOL and upstream errors skip the price provider entirely',async()=>{
 let quotes=0;
 const solPriceFetcher=()=>{quotes++;return new Promise(()=>{});};
 const empty=await createWalletAPI({solPriceFetcher,fetcher:async()=>response({...result(),sol:0})})(address);
 assert.deepEqual(empty,{statusCode:200,body:{...result(),sol:0,status:'ready',...noPrice}});
 const failed=await createWalletAPI({solPriceFetcher,fetcher:async()=>new Response('private',{status:503})})(address);
 assert.equal(failed.statusCode,502);
 const invalid=await createWalletAPI({solPriceFetcher,fetcher:async()=>response({})})(address);assert.equal(invalid.statusCode,502);
 const stalled=await createWalletAPI({solPriceFetcher,timeoutMs:10,fetcher:()=>new Promise(()=>{})})(address);assert.equal(stalled.statusCode,504);
 assert.equal(quotes,0);
});

test('fresh SOL quotes are shared briefly and expired quotes never survive a failed refresh',async()=>{
 let clock=Date.parse('2026-10-16T12:00:00.000Z'),quotes=0;
 const api=createWalletAPI({now:()=>clock,solPriceCacheMs:30000,fetcher:async(url,options)=>response(result(JSON.parse(options.body).address)),
  solPriceFetcher:async()=>{quotes++;if(quotes===2)throw new Error('offline');return response([pair({priceUsd:quotes===1?'150':'160'})]);}});
 const first=await api(address);assert.equal(first.body.solPriceUsd,150);assert.equal(quotes,1);
 clock+=29999;const fresh=await api(other);assert.equal(fresh.body.solPriceUsd,150);assert.equal(fresh.body.solPriceCheckedAt,first.body.solPriceCheckedAt);assert.equal(quotes,1);
 clock++;const expired=await api(address);assert.equal(expired.statusCode,200);assert.equal(expired.body.solPriceUsd,null);assert.equal(expired.body.solPriceCheckedAt,null);assert.equal(expired.body.solPriceSource,null);assert.equal(quotes,2);
 clock++;const recovered=await api(other);assert.equal(recovered.body.solPriceUsd,160);assert.equal(recovered.body.solPriceCheckedAt,new Date(clock).toISOString());assert.equal(quotes,3);
});

test('different wallets share one in-flight SOL quote',async()=>{
 let completeQuote,startedQuote,quotes=0;const started=new Promise(done=>{startedQuote=done;});
 const api=createWalletAPI({fetcher:async(url,options)=>response(result(JSON.parse(options.body).address)),solPriceFetcher:()=>{
  quotes++;startedQuote();return new Promise(done=>{completeQuote=done;});
 }});
 const first=api(address),second=api(other);await started;
 completeQuote(response([pair()]));
 const reports=await Promise.all([first,second]);assert.equal(quotes,1);assert.ok(reports.every(report=>report.statusCode===200&&report.body.solPriceUsd===150.25));
});

test('SOL quote deadline covers stalled fetches and bodies without failing wallet reports',async()=>{
 for(const stalledBody of [false,true]){
  let signal,cancelled=false;
  const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('['));},cancel(){cancelled=true;}});
  const api=createWalletAPI({solPriceTimeoutMs:10,fetcher:async()=>response(result()),solPriceFetcher:async(url,options)=>{
   signal=options.signal;return stalledBody?new Response(stream):new Promise(()=>{});
  }});
  const got=await api(address);assert.deepEqual(got,{statusCode:200,body:{...result(),status:'ready',...noPrice}});
  assert.equal(signal.aborted,true);if(stalledBody)assert.equal(cancelled,true);
 }
});

test('wallet deadline ends before the independent optional SOL quote deadline',async()=>{
 let walletSignal;
 const api=createWalletAPI({timeoutMs:10,solPriceTimeoutMs:1000,fetcher:async(url,options)=>{walletSignal=options.signal;return response(result());},
  solPriceFetcher:async()=>{await new Promise(done=>setTimeout(done,30));return response([pair()]);}});
 const got=await api(address);assert.equal(got.statusCode,200);assert.equal(got.body.solPriceUsd,150.25);assert.equal(walletSignal.aborted,false);
});

test('a late SOL quote after timeout cannot populate the quote cache',async()=>{
 let complete,quotes=0;
 const api=createWalletAPI({solPriceTimeoutMs:10,fetcher:async()=>response(result()),solPriceFetcher:()=>{
  quotes++;return quotes===1?new Promise(done=>{complete=done;}):Promise.resolve(response([pair({priceUsd:'160'})]));
 }});
 assert.equal((await api(address)).body.solPriceUsd,null);
 complete(response([pair()]));await new Promise(done=>setImmediate(done));
 assert.equal((await api(address)).body.solPriceUsd,160);assert.equal(quotes,2);
});

test('failed, malformed and oversized quote responses degrade to unknown SOL pricing',async()=>{
 const failures=[()=>{throw new Error('private');},()=>new Response('private',{status:429}),()=>new Response('<html>'),
  ()=>new Response('x'.repeat(1025)),()=>new Response('[]',{headers:{'Content-Length':'1025'}})];
 for(const solPriceFetcher of failures){
  const api=createWalletAPI({solPriceMaxResponseBytes:1024,solPriceFetcher,fetcher:async()=>response(result())});
  assert.deepEqual(await api(address),{statusCode:200,body:{...result(),status:'ready',...noPrice}});
 }
});

test('a valid populated report retains incomplete coverage and unknown risk',async()=>{
 const wallet={...result(),tokens:160,shown:1,noMarket:1,holdings:[{address:other,found:false,amount:50,valueUsd:null,risk:'unknown'}]};
 const got=await createWalletAPI({fetcher:async()=>response(wallet)})(address);
 assert.equal(got.statusCode,200);assert.equal(got.body.tokens,160);assert.equal(got.body.shown,1);
 assert.equal(got.body.holdings[0].valueUsd,null);assert.equal(got.body.holdings[0].found,false);
});

test('valid empty wallets and explicitly unpriced holdings remain successful',async()=>{
 for(const wallet of [{...result(),sol:0},{...result(),tokens:1,shown:1,noMarket:1,holdings:[{address:other,found:false,amount:2,valueUsd:null,risk:'unknown'}]}]){
  const got=await createWalletAPI({fetcher:async()=>response(wallet)})(address);
  assert.equal(got.statusCode,200);assert.deepEqual(got.body.holdings,wallet.holdings);assert.equal(got.body.sol,wallet.sol);
 }
});

test('duplicate holdings, invalid reading times and malformed USD values are unreadable responses',async()=>{
 const coin={address:other,found:true,amount:2,valueUsd:12,risk:'unknown'};
 const wallet={...result(),tokens:1,shown:1,totalValue:12,risk:{high:0,caution:0,lower:0,unknown:1},holdings:[coin]};
 const invalid=[{...wallet,holdings:[coin,coin],tokens:2,shown:2,totalValue:24,risk:{high:0,caution:0,lower:0,unknown:2}},
  ...[undefined,null,'invalid','2026-10-11'].map(checkedAt=>({...wallet,checkedAt})),
  ...[undefined,'12',-1,Infinity].map(valueUsd=>({...wallet,holdings:[{...coin,valueUsd}]})),
  {...wallet,error:'private provider error'}];
 for(const body of invalid){const got=await createWalletAPI({fetcher:async()=>response(body)})(address);assert.equal(got.statusCode,502);assert.equal(got.body.holdings,undefined);assert.doesNotMatch(got.body.error,/private/);}
 assert.equal((await createWalletAPI({fetcher:async()=>response(wallet)})(address)).statusCode,200);
});

test('counts and token totals must agree with the holdings that the provider actually returned',async()=>{
 const coin={address:other,found:true,amount:2,valueUsd:12,risk:'unknown'};
 const wallet={...result(),tokens:1,shown:1,totalValue:12,risk:{high:0,caution:0,lower:0,unknown:1},holdings:[coin]};
 for(const patch of [{noMarket:1},{risk:{high:0,caution:0,lower:0,unknown:0}},{risk:{high:1,caution:0,lower:0,unknown:1}},{totalValue:0},{holdings:[{...coin,risk:'invalid'}]}])assert.equal((await createWalletAPI({fetcher:async()=>response({...wallet,...patch})})(address)).statusCode,502);
 const rounded={...wallet,tokens:2,shown:2,totalValue:0.3,risk:{high:0,caution:0,lower:0,unknown:2},holdings:[{...coin,valueUsd:0.1},{...coin,address,valueUsd:0.2}]};
 assert.equal((await createWalletAPI({fetcher:async()=>response(rounded)})(address)).statusCode,200,'ordinary floating-point summation differences remain compatible');
});

test('upstream failures remain errors and do not expose service error bodies',async()=>{
 for(const [status,expected] of [[400,400],[401,503],[403,503],[404,502],[429,429],[500,502],[504,504]]){
  const api=createWalletAPI({fetcher:async()=>new Response('private upstream detail',{status})});
  const got=await api(address);assert.equal(got.statusCode,expected);assert.equal(got.body.status,'error');assert.ok(got.body.error);
  assert.ok(!JSON.stringify(got).includes('private'));assert.equal(got.body.holdings,undefined);
 }
 const network=createWalletAPI({fetcher:async()=>{throw new Error('private network detail');}});
 assert.equal((await network(address)).statusCode,502);
});

test('malformed, mismatched and oversized replies cannot look like a checked wallet',async()=>{
 const bad=[null,{},result(other),{...result(),chain:'base'},{...result(),supported:false},{...result(),tokens:-1},{...result(),shown:1},
  {...result(),sol:null},{...result(),risk:{}},{...result(),holdings:[{address:'invalid',found:true,amount:1}],shown:1,tokens:1}];
 for(const body of bad)assert.equal((await createWalletAPI({fetcher:async()=>response(body)})(address)).statusCode,502);
 const malformed=createWalletAPI({fetcher:async()=>new Response('<html>not JSON</html>')});assert.equal((await malformed(address)).statusCode,502);
 for(const headers of [{},{'Content-Length':'1025'}]){
  const api=createWalletAPI({maxResponseBytes:1024,fetcher:async()=>new Response('x'.repeat(1025),{headers})});
  assert.equal((await api(address)).statusCode,502);
 }
});

test('deadline covers both a stalled fetch and a stalled response body, and permits retry',async()=>{
 let signal,calls=0;
 const api=createWalletAPI({timeoutMs:10,fetcher:async(url,options)=>{
  signal=options.signal;calls++;return calls===1?new Promise(()=>{}):response(result());
 }});
 assert.equal((await api(address)).statusCode,504);assert.equal(signal.aborted,true);
 assert.equal((await api(address)).statusCode,200);
 const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{'));}});
 const slow=createWalletAPI({timeoutMs:10,fetcher:async()=>new Response(stream)});
 assert.equal((await slow(address)).statusCode,504);
});

test('duplicate checks share one request and simultaneous work is bounded',async()=>{
 const completions=[];const api=createWalletAPI({fetcher:()=>new Promise(done=>{completions.push(done);})});
 const first=api(address),second=api(address),third=api(other);
 await new Promise(done=>setImmediate(done));
 assert.equal(completions.length,2);
 assert.equal((await api('1'.repeat(32))).statusCode,429);
 completions[0](response(result()));completions[1](response(result(other)));
 assert.deepEqual(await first,await second);assert.equal((await third).statusCode,200);
});

const port=4183,host='127.0.0.1:'+port,origin='http://'+host;
function request({method='POST',headers={},chunks=[JSON.stringify({address})],remoteAddress='127.0.0.1'}={}){
 return {method,headers:{host,origin,'content-type':'application/json',...headers},socket:{remoteAddress},async *[Symbol.asyncIterator](){for(const chunk of chunks)yield Buffer.from(chunk);}};
}
async function invoke(handler,options={},pathname='/api/wallet'){
 const res={statusCode:null,headers:{},body:''};
 const handled=await handler(request(options),{writeHead(statusCode,headers){res.statusCode=statusCode;res.headers=headers;},end(body=''){res.body+=body;}},pathname);
 return {...res,handled};
}

test('handler enforces loopback, same-origin, JSON, method and bounded request bodies',async()=>{
 let calls=0;const handler=createWalletHandler({port,fetcher:async()=>{calls++;return response(result());}});
 for(const options of [{headers:{host:'evil.example'}},{headers:{host:'127.0.0.1:9999'}},{headers:{origin:'https://evil.example'}},
  {headers:{origin:'null'}},{headers:{'sec-fetch-site':'cross-site'}},{remoteAddress:'192.168.1.1'}])assert.equal((await invoke(handler,options)).statusCode,403);
 assert.equal(localWalletRequestAllowed(request({remoteAddress:'::ffff:127.0.0.1'}),port),true);
 const method=await invoke(handler,{method:'GET'});assert.equal(method.statusCode,405);assert.equal(method.headers.Allow,'POST');
 assert.equal((await invoke(handler,{headers:{'content-type':'text/plain'}})).statusCode,415);
 assert.equal((await invoke(handler,{headers:{'content-length':'1025'}})).statusCode,413);
 assert.equal((await invoke(handler,{chunks:['é'.repeat(513)]})).statusCode,413);
 for(const body of ['{bad','null','{}','[]',JSON.stringify({address:'invalid'})])assert.equal((await invoke(handler,{chunks:[body]})).statusCode,400);
 assert.equal(calls,0);
 const got=await invoke(handler,{chunks:['{"address":"',address,'","url":"https://evil.example","credentials":"ignore-me"}']});
 assert.equal(got.statusCode,200);assert.equal(JSON.parse(got.body).status,'ready');assert.equal(calls,1);
 assert.equal(got.headers['Cache-Control'],'no-store');assert.equal(got.headers['X-Content-Type-Options'],'nosniff');
 const unrelated=await invoke(handler,{},'/index.html');assert.equal(unrelated.handled,false);assert.equal(unrelated.statusCode,null);
});

test('streamed size rejection leaves the request stream available for error delivery',async t=>{
 const req=new PassThrough();t.after(()=>req.destroy());
 Object.assign(req,{method:'POST',headers:{host,origin,'content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'}});
 const handler=createWalletHandler({port,fetcher:()=>{throw new Error('must not call upstream');}});
 const res={statusCode:null,body:''};
 const pending=handler(req,{writeHead(statusCode){res.statusCode=statusCode;},end(body){res.body=body;}},'/api/wallet');
 req.write('x'.repeat(800));req.write('x'.repeat(800));
 assert.equal(await pending,true);assert.equal(res.statusCode,413);assert.equal(JSON.parse(res.body).status,'error');
 assert.equal(req.destroyed,false,'returning from the iterator must not tear down the response socket');
});
