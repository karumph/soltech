import test from 'node:test';
import assert from 'node:assert/strict';
import {createBundlerAPI,localBundlerRequestAllowed} from '../bundler-api.mjs';
import {normalizeBundles,loadBundlers,createLookupSession} from '../dist/coin-checker-data.js';
import {resultHTML} from '../dist/coin-checker.js';
const mint='So11111111111111111111111111111111111111112',other='FLUXBmPhT3Fd1EDVFdg46YREqHBeNypn1h4EbnTzWERX';
const raw=()=>({total:140,percentage:3.24,initialPercentage:0,wallets:[{wallet:other,percentage:1.6}]});
const response=data=>({ok:true,text:async()=>JSON.stringify(data)});

test('bundler aggregates are not inferred from a capped list or missing fields',()=>{
 const data=normalizeBundles(raw(),mint);assert.equal(data.total,140);assert.equal(data.percentage,3.24);assert.equal(data.wallets.length,1);
 const missing=normalizeBundles({total:10,wallets:[]},mint);assert.equal(missing.percentage,null);assert.equal(missing.initialPercentage,null);
 assert.equal(normalizeBundles({total:0,percentage:0,wallets:[]},mint).percentage,0);
 for(const input of [{},{...raw(),total:null},{...raw(),total:-1},{...raw(),total:0},{...raw(),wallets:Array(501).fill(raw().wallets[0])}])assert.throws(()=>normalizeBundles(input,mint),/format/);
 for(const percentage of [-1,101,'6',null])assert.equal(normalizeBundles({...raw(),percentage},mint).percentage,null);
 const malformed=normalizeBundles({...raw(),wallets:[{wallet:'<script>',percentage:20}]},mint);assert.equal(malformed.walletsIncomplete,true);assert.equal(malformed.wallets.length,0);
});

test('an absent server key makes no upstream request; configured requests keep secrets server-side and reuse cache',async()=>{
 let calls=0,clock=1800000000000;
 const disconnected=createBundlerAPI({getKey:()=>'',fetcher:()=>{calls++;}});
 assert.deepEqual(await disconnected(mint),{status:'not-connected'});assert.equal(calls,0);
 const key='test-secret-not-a-real-key';
 const api=createBundlerAPI({getKey:()=>key,now:()=>clock,fetcher:async(url,options)=>{
  calls++;assert.equal(url,'https://data.solanatracker.io/tokens/'+mint+'/bundlers');assert.equal(options.headers['x-api-key'],key);assert.equal(options.redirect,'error');
  return response({...raw(),ignoredSecret:key});
 }});
 const result=await api(mint);clock+=500;const cached=await api(mint);
 assert.equal(calls,1);assert.deepEqual(cached,result);assert.equal(cached.data.retrievedAt,1800000000000);assert.ok(!JSON.stringify(result).includes(key));
 assert.equal((await api('https://evil.example')).status,'error');assert.equal(calls,1);
});

test('upstream failures never become empty results or expose provider messages',async()=>{
 for(const status of [401,403,404,429,500]){
  const api=createBundlerAPI({getKey:()=> 'test',fetcher:async()=>({ok:false,status,text:async()=> 'private upstream detail'})});
  const result=await api(mint);assert.equal(result.status,'error');assert.ok(!JSON.stringify(result).includes('private upstream detail'));assert.equal(result.data,undefined);
 }
 const bad=createBundlerAPI({getKey:()=> 'test',fetcher:async()=>response({error:'private'})});assert.equal((await bad(mint)).status,'error');
 const timed=createBundlerAPI({getKey:()=> 'test',timeoutMs:5,fetcher:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('private'))))});
 assert.match((await timed(mint)).message,/timed out/);
});

test('duplicate requests coalesce and cross-origin or unexpected hosts are rejected',async()=>{
 let finish,calls=0;
 const api=createBundlerAPI({getKey:()=> 'test',fetcher:()=>{calls++;return new Promise(resolve=>finish=resolve);}});
 const a=api(mint),b=api(mint);assert.equal(calls,1);finish(response(raw()));assert.deepEqual(await a,await b);
 const request=headers=>({headers});
 assert.equal(localBundlerRequestAllowed(request({host:'127.0.0.1:4175','sec-fetch-site':'same-origin'}),4175),true);
 for(const headers of [{host:'evil.example'},{host:'127.0.0.1:4175',origin:'https://evil.example'},{host:'127.0.0.1:4175','sec-fetch-site':'cross-site'}])assert.equal(localBundlerRequestAllowed(request(headers),4175),false);
});

test('client preserves server retrieval time, identity and unavailable states',async()=>{
 const data=normalizeBundles(raw(),mint,Date.now()-1000);
 const result=await loadBundlers(mint,null,'solana',async()=>({status:'ready',data}));assert.equal(result.data.retrievedAt,data.retrievedAt);
 await assert.rejects(loadBundlers(other,null,'solana',async()=>({status:'ready',data})),/format/);
 assert.deepEqual(await loadBundlers(mint,null,'solana',async()=>({status:'not-connected'})),{status:'not-connected'});
 assert.deepEqual(await loadBundlers('0x4200000000000000000000000000000000000006',null,'base',()=>{throw new Error('must not request');}),{status:'unsupported'});
});

test('slow bundler data cannot delay market or risk output and cancelled results are suppressed',async()=>{
 let finish;const updates=[];
 const session=createLookupSession(s=>updates.push(s),{loadMarket:async()=>null,loadRisk:async()=>({level:'lower'}),loadListing:async()=>null,loadHistory:async()=>null,loadBundles:()=>new Promise(resolve=>finish=resolve)});
 const pending=session.lookup(mint);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(updates.at(-1).risk.status,'ready');assert.equal(updates.at(-1).market.status,'empty');assert.equal(updates.at(-1).bundles.status,'loading');
 session.cancel();const length=updates.length;finish({status:'ready',data:normalizeBundles(raw(),mint)});await pending;assert.equal(updates.length,length);
});

test('bundler presentation separates missing, zero, and positive signals from risk',()=>{
 const state={mint,chainId:'solana',market:{status:'empty'},risk:{status:'error'},listing:{status:'empty'}};
 let html=resultHTML({...state,bundles:{status:'not-connected'}},'details');assert.match(html,/Bundled buys/);assert.match(html,/Not connected/);assert.doesNotMatch(html,/0% held/);
 html=resultHTML({...state,bundles:{status:'ready',data:normalizeBundles(raw(),mint)}},'details');assert.match(html,/3.24% held/);assert.match(html,/140/);assert.match(html,/not proof of common ownership or a scam/);assert.match(html,/Not assessed/);
 html=resultHTML({...state,bundles:{status:'ready',data:normalizeBundles({total:0,percentage:0,wallets:[]},mint)}},'details');assert.match(html,/0% held/);assert.match(html,/does not rule out undetected bundles/);
 html=resultHTML({...state,risk:{status:'loading'},bundles:{status:'ready',data:normalizeBundles({...raw(),percentage:.0089,wallets:[{wallet:other,percentage:.0002}]},mint)}},'details');
 assert.match(html,/&lt;0\.01% held/);assert.match(html,/<strong>&lt;0\.01%<\/strong>/);assert.doesNotMatch(html,/&amp;lt;|<strong>0%<\/strong>/);
});
