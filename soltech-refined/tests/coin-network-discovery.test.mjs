import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverNetwork as discoverAcrossNetworks} from '../dist/coin-network-discovery.js';
import {LookupError} from '../dist/coin-checker-data.js';

const address='0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const otherAddress='0x1111111111111111111111111111111111111111';
const pool='0x2222222222222222222222222222222222222222';
const supported=['ethereum','base','bsc','polygon','arbitrum','avalanche','optimism'];
const pair=(chainId,overrides={})=>({chainId,baseToken:{address,name:'Example',symbol:'EX'},pairAddress:pool,liquidity:{usd:500},...overrides});
const requestFor=responses=>async url=>responses[new URL(url).pathname.split('/')[3]]??[];
const skipWait=async()=>{};
// Keep the original focused core-network cases independent of global search.
const discoverNetwork=(mint,options)=>discoverAcrossNetworks(mint,{...options,request:(url,settings)=>url.includes('/latest/dex/search?')?Promise.resolve({pairs:[]}):options.request(url,settings)});

test('checks every supported EVM network with the supplied signal and bounded timeout',async()=>{
 const calls=[],controller=new AbortController();
 const result=await discoverNetwork(address,{signal:controller.signal,wait:()=>assert.fail('Successful empty responses must not be retried'),onRetry:()=>assert.fail('No retry notification expected'),request:async(url,options)=>{calls.push({url,options});return [];}});
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

test('a persistently failed network is retried once and preserves successful matches',async()=>{
 const calls=[],notices=[],waits=[];
 const result=await discoverNetwork(address,{wait:async milliseconds=>waits.push(milliseconds),onRetry:notice=>notices.push(notice),request:async url=>{
  const chain=new URL(url).pathname.split('/')[3];
  calls.push(chain);
  if(chain==='ethereum')throw new LookupError('rate');
  return chain==='base'?[pair('base')]:[];
 }});
 assert.deepEqual(result,{status:'incomplete',chainIds:['base']});
 assert.deepEqual(calls,[...supported,'ethereum']);assert.deepEqual(waits,[400]);assert.deepEqual(notices,[{chainIds:['ethereum']}]);
});

test('incomplete discovery is distinct from an authoritative empty result',async()=>{
 let calls=0;
 const result=await discoverNetwork(address,{wait:skipWait,request:async()=>{calls++;throw new LookupError('network');}});
 assert.deepEqual(result,{status:'incomplete',chainIds:[]});
 assert.equal(calls,supported.length*2);
});

test('invalid response bodies prevent resolution even when another network matches',async()=>{
 for(const malformed of [null,{},'[]',{pairs:[]}]){
  const result=await discoverNetwork(address,{wait:skipWait,request:async url=>{
   const chain=new URL(url).pathname.split('/')[3];
   return chain==='ethereum'?malformed:chain==='base'?[pair('base')]:[];
  }});
  assert.deepEqual(result,{status:'incomplete',chainIds:['base']});
 }
});

test('transient failed chains recover once without refetching fulfilled results',async()=>{
 const controller=new AbortController(),calls=new Map(),notices=[],waits=[];
 const mixed='0x'+address.slice(2).toUpperCase();
 const result=await discoverNetwork(mixed,{signal:controller.signal,wait:async(milliseconds,options)=>waits.push({milliseconds,signal:options.signal}),onRetry:notice=>notices.push(notice),request:async(url,options)=>{
  const chain=new URL(url).pathname.split('/')[3],attempt=(calls.get(chain)||0)+1;calls.set(chain,attempt);
  assert.equal(options.signal,controller.signal);assert.equal(options.timeout,10000);
  if(['ethereum','bsc'].includes(chain)&&attempt===1)throw new LookupError('timeout');
  return chain==='ethereum'?[pair('ethereum')]:[];
 }});
 assert.deepEqual(result,{status:'resolved',chainIds:['ethereum']});
 assert.deepEqual(notices,[{chainIds:['ethereum','bsc']}]);assert.deepEqual(waits,[{milliseconds:400,signal:controller.signal}]);
 for(const chain of supported)assert.equal(calls.get(chain),['ethereum','bsc'].includes(chain)?2:1);
});

test('a recovered second-chain match remains ambiguous instead of selecting the first response',async()=>{
 let attempts=0;
 const result=await discoverNetwork(address,{wait:skipWait,request:async url=>{
  const chain=new URL(url).pathname.split('/')[3];
  if(chain==='ethereum'&&++attempts===1)throw new LookupError('service');
  return ['ethereum','base'].includes(chain)?[pair(chain)]:[];
 }});
 assert.deepEqual(result,{status:'ambiguous',chainIds:['ethereum','base']});
});

test('abort during the retry delay rejects before any retry starts',async()=>{
 const controller=new AbortController();let calls=0,notices=0;
 const pending=discoverNetwork(address,{signal:controller.signal,onRetry:()=>{notices++;queueMicrotask(()=>controller.abort());},request:async()=>{calls++;throw new LookupError('network');}});
 await assert.rejects(pending,error=>error.code==='cancelled');
 assert.equal(calls,supported.length);assert.equal(notices,1);
});

test('invalid token addresses do not make requests',async()=>{
 let calls=0;
 for(const invalid of ['',null,'0x123',address+' ']){
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

const requestAcross=(searchPairs,markets={},calls=[])=>async(url,options)=>{
 calls.push({url,options});
 if(url.includes('/latest/dex/search?'))return {pairs:searchPairs};
 return markets[new URL(url).pathname.split('/')[3]]??[];
};

for(const chain of ['robinhood','arc','unichain'])test('confirms a global '+chain+' match without a fixed-network gate',async()=>{
 const calls=[],candidate=pair(chain,{baseToken:{address:'0x'+address.slice(2).toUpperCase(),name:'Coin'}});
 const result=await discoverAcrossNetworks(address,{request:requestAcross([candidate],{[chain]:[candidate]},calls)});
 assert.deepEqual(result,{status:'resolved',chainIds:[chain]});
 assert.equal(calls.filter(call=>call.url.includes('/'+chain+'/')).length,1);
 assert.equal(calls.filter(call=>call.url.includes('/search?')).length,1);
 assert.ok(calls.every(call=>call.options.timeout===10000));
});

test('a global match is never accepted without exact chain and base-token confirmation',async()=>{
 const candidate=pair('robinhood');
 for(const confirmation of [[],[pair('arc')],[pair('robinhood',{baseToken:{address:otherAddress},quoteToken:{address}})]]){
  const result=await discoverAcrossNetworks(address,{request:requestAcross([candidate],{robinhood:confirmation})});
  assert.deepEqual(result,{status:'not-found',chainIds:[]});
 }
});

test('ranked search cannot substitute quote tokens, malformed chains, unsafe pools or unrelated names',async()=>{
 const calls=[],search=[pair('robinhood',{baseToken:{address:otherAddress,name:address},quoteToken:{address}}),pair('../robinhood'),pair('constructor'),pair('robinhood',{pairAddress:'https://example.test/pool'}),pair('robinhood',{pairAddress:'../other'})];
 const result=await discoverAcrossNetworks(address,{request:requestAcross(search,{},calls)});
 assert.deepEqual(result,{status:'not-found',chainIds:[]});
 assert.equal(calls.length,supported.length+1);
});

test('a new-chain match and a core-network match remain ambiguous regardless of liquidity',async()=>{
 const result=await discoverAcrossNetworks(address,{request:requestAcross([pair('robinhood'),pair('base')],{base:[pair('base',{liquidity:{usd:1e12}})],robinhood:[pair('robinhood',{liquidity:{usd:1}})]})});
 assert.deepEqual(result,{status:'ambiguous',chainIds:['base','robinhood']});
});

test('non-EVM token identifiers are encoded and checked only on discovered networks',async()=>{
 for(const [chain,mint,poolId] of [['sui','0x'+'a'.repeat(64)+'::coin::COIN','0x'+'b'.repeat(64)],['tron','T'+'A'.repeat(33),'T'+'B'.repeat(33)],['near','wrap.near','601']]){
  const calls=[],candidate=pair(chain,{baseToken:{address:mint},pairAddress:poolId});
  const result=await discoverAcrossNetworks(mint,{request:requestAcross([candidate],{[chain]:[candidate]},calls)});
  assert.deepEqual(result,{status:'resolved',chainIds:[chain]});
  assert.equal(calls.length,2);assert.ok(calls[0].url.endsWith('q='+encodeURIComponent(mint)));assert.ok(calls[1].url.endsWith('/'+encodeURIComponent(mint)));
 }
});

test('generic network token identity stays case-sensitive outside EVM address format',async()=>{
 const mint='ExampleToken123',candidate=pair('newchain',{baseToken:{address:mint.toLowerCase()},pairAddress:'pool-123'});
 assert.deepEqual(await discoverAcrossNetworks(mint,{request:requestAcross([candidate],{newchain:[candidate]})}),{status:'not-found',chainIds:[]});
});

test('failed global discovery retries once and preserves known matches as incomplete',async()=>{
 let searches=0;const calls=[];
 const result=await discoverAcrossNetworks(address,{wait:skipWait,request:async(url,options)=>{
  if(url.includes('/search?')){searches++;throw new LookupError('network');}
  return requestAcross([],{ethereum:[pair('ethereum')]},calls)(url,options);
 }});
 assert.deepEqual(result,{status:'incomplete',chainIds:['ethereum']});assert.equal(searches,2);assert.equal(calls.length,supported.length);
});

test('an additional chain confirmation retries without refetching successful discovery',async()=>{
 let attempts=0,searches=0;const calls=[];
 const result=await discoverAcrossNetworks(address,{wait:skipWait,request:async(url,options)=>{
  if(url.includes('/search?'))searches++;
  if(url.includes('/robinhood/')&&++attempts===1)throw new LookupError('timeout');
  return requestAcross([pair('robinhood')],{robinhood:[pair('robinhood')]},calls)(url,options);
 }});
 assert.deepEqual(result,{status:'resolved',chainIds:['robinhood']});assert.equal(attempts,2);assert.equal(searches,1);
});

test('a truncated candidate set is bounded and cannot imply unique network identity',async()=>{
 const candidates=Array.from({length:17},(_,i)=>pair('newchain'+i)),calls=[];
 const result=await discoverAcrossNetworks(address,{request:requestAcross(candidates,Object.fromEntries(candidates.map(p=>[p.chainId,[p]])),calls)});
 assert.equal(result.status,'incomplete');assert.equal(result.chainIds.length,16);assert.equal(calls.length,supported.length+1+16);
});

test('cancelled new-chain confirmation never resolves a stale coin',async()=>{
 const controller=new AbortController();let finish;
 const pending=discoverAcrossNetworks(address,{signal:controller.signal,request:async(url,options)=>{
  if(url.includes('/robinhood/'))return new Promise(resolve=>{finish=resolve;});
  return requestAcross([pair('robinhood')])(url,options);
 }});
 while(!finish)await new Promise(resolve=>setTimeout(resolve,0));
 controller.abort();finish([pair('robinhood')]);await assert.rejects(pending,error=>error.code==='cancelled');
});
