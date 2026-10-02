import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverNetwork} from '../dist/coin-network-discovery.js';
import {LookupError} from '../dist/coin-checker-data.js';

const address='0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const otherAddress='0x1111111111111111111111111111111111111111';
const pool='0x2222222222222222222222222222222222222222';
const supported=['ethereum','base','bsc','polygon','arbitrum','avalanche','optimism'];
const pair=(chainId,overrides={})=>({chainId,baseToken:{address,name:'Example',symbol:'EX'},pairAddress:pool,liquidity:{usd:500},...overrides});
const requestFor=responses=>async url=>responses[new URL(url).pathname.split('/')[3]]??[];

test('checks every supported EVM network with the supplied signal and bounded timeout',async()=>{
 const calls=[],controller=new AbortController();
 const result=await discoverNetwork(address,{signal:controller.signal,request:async(url,options)=>{calls.push({url,options});return [];}});
 assert.deepEqual(result,{status:'not-found',chainIds:[]});
 assert.deepEqual(calls.map(call=>call.url).sort(),supported.map(chain=>'https://api.dexscreener.com/token-pairs/v1/'+chain+'/'+address).sort());
 for(const {options} of calls){assert.equal(options.signal,controller.signal);assert.equal(options.timeout,10000);}
});

test('one network resolves despite mixed-case addresses and several pools',async()=>{
 const mixed='0x'+address.slice(2).toUpperCase();
 const result=await discoverNetwork(mixed,{request:requestFor({base:[pair('base'),pair('base',{baseToken:{address:mixed},pairAddress:otherAddress,liquidity:{usd:10000}})]})});
 assert.deepEqual(result,{status:'resolved',chainIds:['base']});
});

test('the same contract on two networks stays ambiguous despite different liquidity',async()=>{
 const result=await discoverNetwork(address,{request:requestFor({base:[pair('base',{liquidity:{usd:1}})],optimism:[pair('optimism',{liquidity:{usd:1e12}})]})});
 assert.deepEqual(result,{status:'ambiguous',chainIds:['base','optimism']});
});

test('only exact base-token identities count, not quote-token matches',async()=>{
 const result=await discoverNetwork(address,{request:requestFor({base:[pair('base',{baseToken:{address:otherAddress},quoteToken:{address}})]})});
 assert.deepEqual(result,{status:'not-found',chainIds:[]});
});

test('unsupported chains, wrong endpoint chains, and malformed pool IDs cannot resolve',async()=>{
 const result=await discoverNetwork(address,{request:requestFor({base:[
  pair('unsupported'),pair('optimism'),pair('base',{pairAddress:pool+'/../../other'}),
  pair('base',{pairAddress:'https://example.test/pool'}),pair('base',{pairAddress:pool+'?address='+address}),
  pair('base',{pairAddress:null}),null,{},
 ]})});
 assert.deepEqual(result,{status:'not-found',chainIds:[]});
});

test('valid v4 and Curve pool identifiers remain eligible',async()=>{
 for(const pairAddress of ['0x'+'a'.repeat(64),pool+'-'+address+'-'+otherAddress]){
  const result=await discoverNetwork(address,{request:requestFor({base:[pair('base',{pairAddress})]})});
  assert.deepEqual(result,{status:'resolved',chainIds:['base']});
 }
});

test('a failed network blocks automatic selection but preserves any matches',async()=>{
 const result=await discoverNetwork(address,{request:async url=>{
  const chain=new URL(url).pathname.split('/')[3];
  if(chain==='ethereum')throw new LookupError('rate');
  return chain==='base'?[pair('base')]:[];
 }});
 assert.deepEqual(result,{status:'incomplete',chainIds:['base']});
});

test('incomplete discovery is distinct from an authoritative empty result',async()=>{
 const result=await discoverNetwork(address,{request:async()=>{throw new LookupError('network');}});
 assert.deepEqual(result,{status:'incomplete',chainIds:[]});
});

test('invalid response bodies prevent resolution even when another network matches',async()=>{
 for(const malformed of [null,{},'[]',{pairs:[]}]){
  const result=await discoverNetwork(address,{request:async url=>{
   const chain=new URL(url).pathname.split('/')[3];
   return chain==='ethereum'?malformed:chain==='base'?[pair('base')]:[];
  }});
  assert.deepEqual(result,{status:'incomplete',chainIds:['base']});
 }
});

test('invalid token addresses do not make requests',async()=>{
 let calls=0;
 for(const invalid of ['',null,'0x123','So11111111111111111111111111111111111111112',address+' ']){
  await assert.rejects(discoverNetwork(invalid,{request:async()=>{calls++;return [];}}),error=>error.code==='address');
 }
 assert.equal(calls,0);
});

test('already-aborted discovery makes no requests',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 await assert.rejects(discoverNetwork(address,{signal:controller.signal,request:async()=>{calls++;return [];}}),error=>error.code==='cancelled');
 assert.equal(calls,0);
});

test('aborting pending discovery rejects even when its loader ignores abort',async()=>{
 const controller=new AbortController(),queued=[];
 const pending=discoverNetwork(address,{signal:controller.signal,request:async url=>new Promise(resolve=>queued.push({url,resolve}))});
 assert.equal(queued.length,supported.length);
 controller.abort();
 for(const {url,resolve} of queued)resolve(url.includes('/base/')?[pair('base')]:[]);
 await assert.rejects(pending,error=>error.code==='cancelled');
});
