import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchWalletTokenMetadata} from '../dist/wallet-token-metadata.js';
import {LookupError} from '../dist/coin-checker-data.js';

const mint='So11111111111111111111111111111111111111112';
const other='11111111111111111111111111111111';
const third='1'.repeat(31)+'2';
const pair=(address=mint,patch={})=>({chainId:'solana',baseToken:{address,name:'Example coin',symbol:'EX'},pairAddress:third,liquidity:{usd:100},info:{imageUrl:'https://cdn.example.com/token.png'},priceUsd:'9000',...patch});
const response=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
const code=expected=>error=>error instanceof LookupError&&error.code===expected&&error.message===expected;

test('one fixed batch sends only distinct valid public mints and returns names and logos without market or price fields',async()=>{
 let calls=0;
 const result=await fetchWalletTokenMetadata([mint,null,'bad',mint,other,mint+' ',{address:third}],{fetcher:async(url,options)=>{
  calls++;assert.equal(url,'https://api.dexscreener.com/tokens/v1/solana/'+mint+','+other);
  assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.redirect,'error');assert.equal(options.body,undefined);
  return response([pair(mint),pair(other,{baseToken:{address:other,name:'Other coin',symbol:'OTHER'}})]);
 }});
 assert.equal(calls,1);assert.deepEqual(result,[{address:mint,name:'Example coin',symbol:'EX',logo:'https://cdn.example.com/token.png'},{address:other,name:'Other coin',symbol:'OTHER',logo:'https://cdn.example.com/token.png'}]);
 assert.doesNotMatch(JSON.stringify(result),/9000|price|liquidity/);
});

test('empty invalid input makes no request and batches never exceed thirty distinct mints',async()=>{
 let calls=0;const noNetwork=()=>{calls++;throw Error('unexpected request');};
 assert.deepEqual(await fetchWalletTokenMetadata(['bad',null,'1'.repeat(33)],{fetcher:noNetwork}),[]);assert.equal(calls,0);
 await assert.rejects(fetchWalletTokenMetadata(null,{fetcher:noNetwork}),code('format'));
 const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';const mints=Array.from({length:35},(_,i)=>'1'.repeat(31)+alphabet[i]);
 await fetchWalletTokenMetadata(mints,{fetcher:async url=>{assert.deepEqual(url.split('/').at(-1).split(','),mints.slice(0,30));return response([]);}});
});

test('only exact Solana base identities supply names and logos, selecting a valid liquid pair',async()=>{
 const result=await fetchWalletTokenMetadata([mint],{fetcher:async()=>response([
  pair(other,{quoteToken:{address:mint},liquidity:{usd:1e12},info:{imageUrl:'https://wrong.example.com/quote.png'}}),
  pair(mint,{chainId:'ethereum',liquidity:{usd:1e12}}),
  pair(mint,{pairAddress:'https://evil.example/path',liquidity:{usd:1e12}}),
  pair(mint,{liquidity:{usd:5},baseToken:{address:mint,name:'Wrong pair',symbol:'LOW'}}),pair(mint),
 ])});
 assert.deepEqual(result,[{address:mint,name:'Example coin',symbol:'EX',logo:'https://cdn.example.com/token.png'}]);
 const absent=await fetchWalletTokenMetadata([mint],{fetcher:async()=>response([pair(other,{quoteToken:{address:mint}})])});assert.deepEqual(absent,[]);
});

test('a missing or unsafe primary logo falls back to the most liquid verified pool with a safe image',async()=>{
 for(const info of [undefined,{}, {imageUrl:'javascript:alert(1)'}]){
  const result=await fetchWalletTokenMetadata([mint],{fetcher:async()=>response([
   pair(mint,{info}),
   pair(mint,{pairAddress:other,liquidity:{usd:40},info:{imageUrl:'https://cdn.example.com/lower.png'}}),
   pair(mint,{pairAddress:mint,baseToken:{address:mint,name:'Alternate pool label',symbol:'ALT'},liquidity:{usd:80},info:{imageUrl:'https://cdn.example.com/verified.png'}}),
  ])});
  assert.deepEqual(result,[{address:mint,name:'Example coin',symbol:'EX',logo:'https://cdn.example.com/verified.png'}]);
 }
});

test('alternate logos require the exact chain and base mint, never a matching quote token or name',async()=>{
 const result=await fetchWalletTokenMetadata([mint],{fetcher:async()=>response([
  pair(mint,{info:undefined}),
  pair(other,{quoteToken:{address:mint,name:'Example coin',symbol:'EX'},info:{imageUrl:'https://cdn.example.com/wrong-base.png'}}),
  pair(mint,{chainId:'ethereum',info:{imageUrl:'https://cdn.example.com/wrong-chain.png'}}),
  pair(mint,{pairAddress:'invalid',info:{imageUrl:'https://cdn.example.com/invalid-pool.png'}}),
  pair(mint,{liquidity:{usd:50},info:{imageUrl:'https://user:secret@cdn.example.com/unsafe.png'}}),
 ])});
 assert.deepEqual(result,[{address:mint,name:'Example coin',symbol:'EX',logo:null}]);
});

test('a safe primary pool logo remains preferred over alternate matching logos',async()=>{
 const result=await fetchWalletTokenMetadata([mint],{fetcher:async()=>response([
  pair(mint,{liquidity:{usd:90},info:{imageUrl:'https://cdn.example.com/alternate.png'}}),pair(mint),
 ])});
 assert.deepEqual(result,[{address:mint,name:'Example coin',symbol:'EX',logo:'https://cdn.example.com/token.png'}]);
});

test('labels are bounded and unsafe image URLs never become token logos',async()=>{
 for(const imageUrl of ['javascript:alert(1)','data:image/svg+xml,test','http://cdn.example.com/a','https://127.0.0.1/a','https://user:secret@cdn.example.com/a']){
  const result=await fetchWalletTokenMetadata([mint],{fetcher:async()=>response([pair(mint,{baseToken:{address:mint,name:'N'.repeat(150),symbol:'S'.repeat(40)},info:{imageUrl}})])});
  assert.equal(result[0].name.length,120);assert.equal(result[0].symbol.length,32);assert.equal(result[0].logo,null);
 }
 const missing=await fetchWalletTokenMetadata([mint],{fetcher:async()=>response([pair(mint,{baseToken:{address:mint}})])});assert.equal(missing[0].symbol,'');
});

test('provider, network and malformed-response errors are typed and contain no upstream details',async()=>{
 for(const [status,expected] of [[429,'rate'],[404,'missing'],[403,'service'],[500,'service']])await assert.rejects(fetchWalletTokenMetadata([mint],{fetcher:async()=>new Response('private provider detail',{status})}),code(expected));
 await assert.rejects(fetchWalletTokenMetadata([mint],{fetcher:async()=>{throw Error('private network detail');}}),code('network'));
 for(const value of [null,{},'[]',{pairs:[]},Array.from({length:1001},()=>pair())])await assert.rejects(fetchWalletTokenMetadata([mint],{fetcher:async()=>response(value)}),code('format'));
 await assert.rejects(fetchWalletTokenMetadata([mint],{fetcher:async()=>new Response('<html>private</html>')}),code('format'));
});

test('response size is bounded for announced, streamed and non-streaming responses',async()=>{
 for(const fetcher of [
  async()=>new Response('[]',{headers:{'Content-Length':'2000001'}}),
  async()=>new Response('x'.repeat(2000001)),
  async()=>({ok:true,headers:new Headers(),text:async()=>'é'.repeat(1000001)}),
 ])await assert.rejects(fetchWalletTokenMetadata([mint],{fetcher}),code('format'));
});

test('timeout aborts stalled headers and bodies even when fetch does not cooperate',async()=>{
 let signal;
 await assert.rejects(fetchWalletTokenMetadata([mint],{timeoutMs:10,fetcher:(url,options)=>{signal=options.signal;return new Promise(()=>{});}}),code('timeout'));assert.equal(signal.aborted,true);
 let cancelled=false;const body=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('['));},cancel(){cancelled=true;}});
 await assert.rejects(fetchWalletTokenMetadata([mint],{timeoutMs:10,fetcher:async()=>new Response(body)}),code('timeout'));assert.equal(cancelled,true);
});

test('external cancellation is immediate, aborts the request and ignores a late response',async()=>{
 const before=new AbortController();before.abort();let calls=0;
 await assert.rejects(fetchWalletTokenMetadata([mint],{signal:before.signal,fetcher:()=>{calls++;}}),code('cancelled'));assert.equal(calls,0);
 const controller=new AbortController();let resolve,fetchSignal;
 const pending=fetchWalletTokenMetadata([mint],{signal:controller.signal,fetcher:(url,options)=>{fetchSignal=options.signal;return new Promise(done=>{resolve=done;});}});
 controller.abort();await assert.rejects(pending,code('cancelled'));assert.equal(fetchSignal.aborted,true);
 resolve(response([pair()]));await new Promise(done=>setImmediate(done));
});
