import test from 'node:test';
import assert from 'node:assert/strict';
import {createSignalsAPI,createSignalsHandler} from '../signals-api.mjs';

const scan=(overrides={})=>({id:'latest',version:2,updatedAt:'2026-10-12T05:37:10.324Z',coins:[{id:'solana:example',chain:'solana',address:'example',momentum:80,momentumPrev:null,flags:[]}],run:{every:60,sources:{projects:'ok',posts:'not-connected',detail:{profiles:'ok','pools-solana':'error'}},safety:{holders:'off'}},...overrides});
const response=body=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});

test('reads only the fixed shared endpoint and preserves scan timestamps and source coverage without credentials',async()=>{
 let sent;const original=scan();const api=createSignalsAPI({fetcher:async(url,options)=>{sent={url,options};return response(original);}});
 const result=await api({url:'https://evil.example',since:'do-not-forward',token:'private'});
 assert.equal(sent.url,'https://soltech.d3ilz6ab0hx4y4.amplifyapp.com/api/finds');assert.equal(sent.options.method,'GET');assert.equal(sent.options.body,undefined);assert.equal(sent.options.credentials,'omit');assert.equal(sent.options.redirect,'error');assert.equal(sent.options.referrerPolicy,'no-referrer');assert.equal(sent.options.cache,'no-store');assert.deepEqual(sent.options.headers,{Accept:'application/json'});
 assert.deepEqual(result,{statusCode:200,body:original});assert.equal(result.body.run.sources.detail['pools-solana'],'error');assert.equal(result.body.updatedAt,original.updatedAt);
});

test('concurrent readers coalesce and the same full scan remains cached for sixty seconds',async()=>{
 let now=0,calls=0,resolve;const api=createSignalsAPI({now:()=>now,fetcher:()=>{calls++;return new Promise(done=>{resolve=done;});}});
 const one=api(),two=api();assert.equal(calls,1);resolve(response(scan()));assert.deepEqual(await one,await two);
 now=59999;assert.equal((await api()).statusCode,200);assert.equal(calls,1);
 now=60000;const fresh=api();assert.equal(calls,2);resolve(response(scan({updatedAt:'2026-10-12T05:38:10.324Z'})));assert.equal((await fresh).body.updatedAt,'2026-10-12T05:38:10.324Z');
});

test('service failures never become an empty or fresh successful scan and retries are briefly cached',async()=>{
 for(const [status,expected] of [[401,503],[403,503],[404,502],[408,504],[429,429],[500,502],[503,503],[504,504]]){
  const result=await createSignalsAPI({fetcher:async()=>new Response('private upstream detail',{status})})();assert.equal(result.statusCode,expected);assert.equal(result.body.status,'error');assert.equal(result.body.coins,undefined);assert.doesNotMatch(JSON.stringify(result),/private/);
 }
 let now=0,calls=0;const api=createSignalsAPI({now:()=>now,fetcher:async()=>{calls++;if(calls===1)return response(scan());throw Error('private network detail');}});
 assert.equal((await api()).statusCode,200);now=60000;const failure=await api();assert.equal(failure.statusCode,502);assert.equal(failure.body.coins,undefined);assert.doesNotMatch(JSON.stringify(failure),/private/);
 now=64999;assert.deepEqual(await api(),failure);assert.equal(calls,2);now=65000;await api();assert.equal(calls,3);
});

test('malformed full-scan responses are errors while a genuine empty scan is supported',async()=>{
 for(const body of [null,[],{},scan({coins:null}),scan({coins:[null]}),scan({coins:Array.from({length:151},()=>({}))}),scan({updatedAt:null}),scan({updatedAt:'bad'}),scan({run:[]}),scan({error:'private'}),scan({unchanged:true})]){
  const result=await createSignalsAPI({fetcher:async()=>response(body)})();assert.equal(result.statusCode,502);assert.equal(result.body.status,'error');assert.equal(result.body.coins,undefined);
 }
 assert.equal((await createSignalsAPI({fetcher:async()=>new Response('<html>private</html>')})()).statusCode,502);
 const empty=scan({coins:[]});assert.deepEqual((await createSignalsAPI({fetcher:async()=>response(empty)})()).body,empty);
});

test('announced and streamed response sizes are bounded',async()=>{
 for(const headers of [{},{'Content-Length':'1025'}]){
  const result=await createSignalsAPI({maxResponseBytes:1024,fetcher:async()=>new Response('x'.repeat(1025),{headers})})();assert.equal(result.statusCode,502);
 }
 assert.equal((await createSignalsAPI({fetcher:async()=>new Response(null)})()).statusCode,502);
});

test('timeouts abort stalled headers and bodies without accepting late data into cache',async()=>{
 let signal,resolve,now=0,calls=0;const api=createSignalsAPI({now:()=>now,timeoutMs:10,fetcher:(url,options)=>{signal=options.signal;calls++;return calls===1?new Promise(done=>{resolve=done;}):Promise.resolve(response(scan({updatedAt:'2026-10-12T05:38:10.324Z'})));}});
 assert.equal((await api()).statusCode,504);assert.equal(signal.aborted,true);resolve(response(scan()));await new Promise(done=>setImmediate(done));assert.equal((await api()).statusCode,504);
 now=5000;assert.equal((await api()).body.updatedAt,'2026-10-12T05:38:10.324Z');
 let cancelled=false;const body=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{'));},cancel(){cancelled=true;}});
 const stalled=createSignalsAPI({timeoutMs:10,fetcher:async()=>new Response(body)});assert.equal((await stalled()).statusCode,504);assert.equal(cancelled,true);
});

const port=4185,host='127.0.0.1:'+port,origin='http://'+host;
async function invoke(handler,{method='GET',headers={},remoteAddress='127.0.0.1',url='/api/signals?u=https://evil.example'}={},pathname='/api/signals'){
 const result={};result.handled=await handler({url,method,headers:{host,origin,...headers},socket:{remoteAddress}},{writeHead(statusCode,headers){result.statusCode=statusCode;result.headers=headers;},end(body){result.body=JSON.parse(body);}},pathname);return result;
}

test('local route rejects cross-origin and mutation methods and forwards no request parameters',async()=>{
 let calls=0;const handler=createSignalsHandler({port,fetcher:async url=>{calls++;assert.equal(url,'https://soltech.d3ilz6ab0hx4y4.amplifyapp.com/api/finds');return response(scan());}});
 for(const input of [{headers:{host:'evil.example'}},{headers:{host:'127.0.0.1:9999'}},{headers:{origin:'https://evil.example'}},{headers:{origin:'null'}},{headers:{'sec-fetch-site':'cross-site'}},{remoteAddress:'192.168.1.1'}])assert.equal((await invoke(handler,input)).statusCode,403);
 for(const method of ['POST','PUT','DELETE','OPTIONS']){const result=await invoke(handler,{method});assert.equal(result.statusCode,405);assert.equal(result.headers.Allow,'GET');}
 assert.equal(calls,0);const result=await invoke(handler);assert.equal(result.statusCode,200);assert.equal(result.headers['Cache-Control'],'no-store');assert.equal(result.headers['X-Content-Type-Options'],'nosniff');assert.equal(calls,1);
 const unrelated=await invoke(handler,{},'/api/wallet');assert.equal(unrelated.handled,false);assert.equal(unrelated.statusCode,undefined);
});
