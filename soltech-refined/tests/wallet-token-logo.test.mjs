import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchWalletTokenLogo} from '../dist/wallet-token-logo.js';
import {LookupError} from '../dist/coin-checker-data.js';

const mint='C23qdnvTaKetZV93qqfsvY5kXt7c27G5SjrYz69r6iV6';
const other='So11111111111111111111111111111111111111112';
const logo='https://gg.sc/images/example.webp';
const report=(patch={})=>({mint,fileMeta:{image:logo},...patch});
const response=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
const code=expected=>error=>error instanceof LookupError&&error.code===expected&&error.message===expected;

test('logo lookup sends only the exact public token mint to the fixed report endpoint',async()=>{
 let calls=0;
 const result=await fetchWalletTokenLogo(mint,{fetcher:async(url,options)=>{
  calls++;assert.equal(url,'https://api.rugcheck.xyz/v1/tokens/'+mint+'/report');
  assert.equal(options.method,'GET');assert.equal(options.body,undefined);assert.deepEqual(options.headers,{Accept:'application/json'});
  assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.redirect,'error');
  return response(report({risk:'ignored',price:999,name:'Ignored name',image:'https://cdn.example.com/wrong.png'}));
 }});
 assert.equal(calls,1);assert.equal(result,logo);
});

test('invalid token addresses are rejected before any network request',async()=>{
 let calls=0;
 for(const address of [undefined,null,{},42,'',mint+' ',mint+'1','1'.repeat(33),'https://evil.example','0x'+'a'.repeat(40)]){
  await assert.rejects(fetchWalletTokenLogo(address,{fetcher:()=>{calls++;}}),code('format'));
 }
 assert.equal(calls,0);
});

test('the report must contain an exact mint match regardless of matching names or image fields',async()=>{
 for(const body of [null,[],{},report({mint:other}),report({mint:mint.toLowerCase()}),report({mint:undefined,name:'Tesla Roadster'})]){
  await assert.rejects(fetchWalletTokenLogo(mint,{fetcher:async()=>response(body)}),code('format'));
 }
});

test('only fileMeta.image can supply the logo and absent images remain unknown',async()=>{
 for(const fileMeta of [undefined,null,{}, {image:null}, {image:''}]){
  const result=await fetchWalletTokenLogo(mint,{fetcher:async()=>response(report({fileMeta,image:logo,tokenMeta:{image:logo}}))});
  assert.equal(result,null);
 }
});

test('unsafe image URLs are rejected without fetching the image itself',async()=>{
 for(const image of ['javascript:alert(1)','data:image/svg+xml,test','http://cdn.example.com/a','https://127.0.0.1/a','https://localhost/a','https://user:secret@cdn.example.com/a',{},true]){
  let calls=0;
  const result=await fetchWalletTokenLogo(mint,{fetcher:async()=>{calls++;return response(report({fileMeta:{image}}));}});
  assert.equal(result,null);assert.equal(calls,1);
 }
});

test('provider, network and malformed responses produce typed errors without private details',async()=>{
 for(const [status,expected] of [[429,'rate'],[404,'missing'],[403,'service'],[500,'service']]){
  await assert.rejects(fetchWalletTokenLogo(mint,{fetcher:async()=>new Response('private provider detail',{status})}),code(expected));
 }
 await assert.rejects(fetchWalletTokenLogo(mint,{fetcher:async()=>{throw Error('private network detail');}}),code('network'));
 await assert.rejects(fetchWalletTokenLogo(mint,{fetcher:async()=>new Response('<html>private</html>')}),code('format'));
});

test('report sizes are bounded for announced, streamed and non-streaming responses',async()=>{
 for(const fetcher of [
  async()=>new Response('{}',{headers:{'Content-Length':'2000001'}}),
  async()=>new Response('x'.repeat(2000001)),
  async()=>({ok:true,headers:new Headers(),text:async()=>'é'.repeat(1000001)}),
 ])await assert.rejects(fetchWalletTokenLogo(mint,{fetcher}),code('format'));
});

test('deadline covers uncooperative fetches and both streaming and non-streaming bodies',async()=>{
 let signal;
 await assert.rejects(fetchWalletTokenLogo(mint,{timeoutMs:10,fetcher:(url,options)=>{signal=options.signal;return new Promise(()=>{});}}),code('timeout'));
 assert.equal(signal.aborted,true);
 let cancelled=false;const body=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{'));},cancel(){cancelled=true;}});
 await assert.rejects(fetchWalletTokenLogo(mint,{timeoutMs:10,fetcher:async()=>new Response(body)}),code('timeout'));assert.equal(cancelled,true);
 await assert.rejects(fetchWalletTokenLogo(mint,{timeoutMs:10,fetcher:async()=>({ok:true,headers:new Headers(),text:()=>new Promise(()=>{})})}),code('timeout'));
});

test('cancellation is immediate and a late uncooperative response is cancelled and ignored',async()=>{
 let calls=0;const before=new AbortController();before.abort();
 await assert.rejects(fetchWalletTokenLogo(mint,{signal:before.signal,fetcher:()=>{calls++;}}),code('cancelled'));assert.equal(calls,0);
 const controller=new AbortController();let complete,signal,cancelled=false;
 const pending=fetchWalletTokenLogo(mint,{signal:controller.signal,fetcher:(url,options)=>{signal=options.signal;return new Promise(done=>{complete=done;});}});
 controller.abort();await assert.rejects(pending,code('cancelled'));assert.equal(signal.aborted,true);
 complete(new Response(new ReadableStream({cancel(){cancelled=true;}})));
 await new Promise(done=>setImmediate(done));assert.equal(cancelled,true);
});

test('cancelling during report streaming cancels the reader without returning a partial image',async()=>{
 const controller=new AbortController();let started,cancelled=false;const reading=new Promise(done=>{started=done;});
 const body=new ReadableStream({pull(stream){stream.enqueue(new TextEncoder().encode('{"mint":"'+mint+'","fileMeta":'));started();},cancel(){cancelled=true;}});
 const pending=fetchWalletTokenLogo(mint,{signal:controller.signal,fetcher:async()=>new Response(body)});
 await reading;controller.abort();await assert.rejects(pending,code('cancelled'));assert.equal(cancelled,true);
});
