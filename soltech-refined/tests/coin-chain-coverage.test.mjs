import test from 'node:test';
import assert from 'node:assert/strict';
import {NETWORKS,getNetwork,canonicalAddress,validLookupAddress,sameAddress} from '../dist/coin-networks.js';
import {validMint,validTokenAddress,validPairId,normalizeMarket,normalizeEvmRisk,loadPriceHistory,createLookupSession} from '../dist/coin-checker-data.js';

const sol='So11111111111111111111111111111111111111112';
const evm='0x2a13008cc2f5a853f6fb21cbd90841806c64b247';
const evmMixed='0x2A13008CC2F5A853F6FB21CBD90841806C64B247';
const pool='0xe519f39c1f867539983be78a1ed036097a545f4379b08203f6e592e153f52c90';
const sui='0x'+'a'.repeat(64)+'::blue_dog::BLUE_DOG';
const ibc='ibc/'+'A1'.repeat(32);
const creator='osmo1c584m4lq25h83yp6ag8hh4htjr92d954vklzja';
const factory='factory/'+creator+'/ufoo';
const genericPool='0x'+'b'.repeat(64);
const dexPair=(chain,address,pair=genericPool,extra={})=>({chainId:chain,pairAddress:pair,baseToken:{address,name:'Exact token',symbol:'EXACT'},quoteToken:{address:'quote-token',symbol:'QUOTE'},priceUsd:'0.0123',marketCap:12345,liquidity:{usd:100},...extra});
const normalized=(chain,address,pair=genericPool)=>normalizeMarket([dexPair(chain,address,pair)],address,Date.now(),chain);
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
const response=value=>({ok:true,status:200,text:async()=>JSON.stringify(value)});

test('the original eight networks retain their explicit provider capabilities',()=>{
 const original={solana:['Solana','solana','https://solscan.io','solana',undefined],ethereum:['Ethereum','eth','https://etherscan.io','evm','1'],base:['Base','base','https://basescan.org','evm','8453'],bsc:['BNB Chain','bsc','https://bscscan.com','evm','56'],polygon:['Polygon','polygon_pos','https://polygonscan.com','evm','137'],arbitrum:['Arbitrum','arbitrum','https://arbiscan.io','evm','42161'],avalanche:['Avalanche','avax','https://snowtrace.io','evm','43114'],optimism:['Optimism','optimism','https://optimistic.etherscan.io','evm','10']};
 for(const [chain,expected] of Object.entries(original)){
  const n=getNetwork(chain);assert.equal(n,NETWORKS[chain]);assert.deepEqual([n.name,n.gecko,n.explorer,n.kind,n.securityId],expected);
  assert.equal(validTokenAddress(chain==='solana'?sol:evm,chain),true);
 }
 assert.equal(validTokenAddress('z'.repeat(44),'solana'),false);
 assert.equal(validTokenAddress(sol,'base'),false);
});

test('Robinhood and Arc use independently verified provider IDs without guessed explorers',()=>{
 assert.deepEqual(getNetwork('robinhood'),{name:'Robinhood',gecko:'robinhood',explorer:null,kind:'evm',securityId:'4663'});
 assert.deepEqual(getNetwork('arc'),{name:'Arc',gecko:'arc',explorer:null,kind:'evm',securityId:'5042'});
 assert.equal(validTokenAddress(evm,'robinhood'),true);assert.equal(validPairId(pool,'robinhood'),true);
 assert.equal(validTokenAddress(sui,'arc'),false);
});

test('unknown DEX networks have stable market-only metadata across a module reload',async()=>{
 const chain='future-chain',expected={name:'Future Chain',kind:'generic',gecko:null,securityId:null,explorer:null};
 assert.deepEqual(getNetwork(chain),expected);assert.equal(Object.hasOwn(NETWORKS,chain),false);
 const fresh=await import('../dist/coin-networks.js?chain-coverage-reload');
 assert.deepEqual(fresh.getNetwork(chain),expected);assert.equal(Object.hasOwn(fresh.NETWORKS,chain),false);
 assert.equal(Object.isFrozen(getNetwork(chain)),true);
});

test('chain validation rejects prototype names, URLs, escapes and unbounded IDs',()=>{
 for(const value of [null,undefined,{},[],42,'','a','BASE','__proto__','constructor','prototype','toString','../base','base/other','base?x=1','base#x','base%2feth','base_chain','base--chain','base-','a'.repeat(65)])assert.equal(getNetwork(value),null,String(value));
 assert.equal(getNetwork('a'.repeat(64)).kind,'generic');
 assert.equal(getNetwork('chain-2026').kind,'generic');
});

test('bounded cross-network input accepts common non-EVM identifiers',()=>{
 for(const address of [sol,evm,genericPool,sui,'0x2::coin::COIN','TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t','EQ'+'A'.repeat(46),'0:'+'a'.repeat(64),'-1:'+'a'.repeat(64),'wrap.near','0.0.456858','31566704','ryjl3-tyaaa-aaaaa-aaaba-cai','A'.repeat(256)]){
  assert.equal(validLookupAddress(address),true,address);
  assert.equal(validTokenAddress(address,'future-chain'),true,address);
 }
 assert.equal(validMint(sol),true);
 for(const address of [null,{},'',evm+' ',sui+'?token=bad','https://evil.example/token','javascript:alert(1)','token/path','token\\path','factory/issuer/coin','../token','wrap..near','.wrap.near','wrap.near.','token%2fsecret','token#x','token\nname','__proto__','constructor','prototype','0x1234','0X'+'a'.repeat(40),'A'.repeat(257)])assert.equal(validLookupAddress(address),false,String(address));
});

test('identity lowercases only 40-hex addresses and retains non-EVM case exactly',()=>{
 assert.equal(canonicalAddress(evmMixed),evm);assert.equal(canonicalAddress(evmMixed,'future-chain'),evm);
 for(const address of [sui,'wrap.near','AbCDefgh123456789','0x'+'A'.repeat(64)])assert.equal(canonicalAddress(address,'future-chain'),address);
 assert.equal(sameAddress(sui,sui.replace('BLUE_DOG','blue_dog'),'sui'),false);
 assert.equal(sameAddress(genericPool,genericPool.toUpperCase().replace('0X','0x'),'sui'),false);
 assert.equal(sameAddress(evm,evmMixed,'future-chain'),true);
 assert.equal(sameAddress(null,null,'future-chain'),false);assert.equal(sameAddress('constructor','constructor','future-chain'),false);
 assert.equal(canonicalAddress(evm,'../ethereum'),null);assert.equal(canonicalAddress('bad?value'),null);
});

test('IBC, tokenfactory and spot-index formats remain narrow, bounded and exact',()=>{
 for(const address of [ibc,factory,'factory/'+creator+'/alloyed/allBTC','factory/'+creator+'/Blue-Dog_v2.coin','@0','@107']){
  assert.equal(validLookupAddress(address),true,address);assert.equal(validTokenAddress(address,'future-chain'),true);assert.equal(canonicalAddress(address),address);
 }
 assert.equal(sameAddress(ibc,ibc.toLowerCase(),'osmosis'),false);
 assert.equal(sameAddress(factory,factory.replace('ufoo','UFOO'),'osmosis'),false);
 for(const address of ['ibc/','ibc/'+'A'.repeat(63),'ibc/'+'A'.repeat(65),ibc+'/extra',ibc+'?x=1',ibc+'#x','ibc/%2e%2e',factory+'/../secret','factory/'+creator+'/..','factory/'+creator+'/coin%2fsecret','factory/'+creator+'/coin?x=1','factory/'+creator+'/coin#x','factory/'+creator+'//coin','factory/https://evil.example/coin','factory/'+creator+'/coin//other','factory/'+creator+'/'+'A'.repeat(129),'@','@-1','@01','@1.5','@107/other','@107?x=1','@107#x','@'+'9'.repeat(21)])assert.equal(validLookupAddress(address),false,address);
});

test('short NEAR account IDs require exact base addresses, never matching ticker or name alone',()=>{
 for(const address of ['aa','a.near','doge','ab_cd'])assert.equal(validLookupAddress(address),true,address);
 for(const address of ['a','DOGE','a..near','a.-near','a_.near'])assert.equal(validLookupAddress(address),false,address);
 const nameOnly=dexPair('near','different.near','1234',{baseToken:{address:'different.near',name:'doge',symbol:'doge'},quoteToken:{address:'doge'},liquidity:{usd:1e12}});
 assert.equal(normalizeMarket([nameOnly],'doge',Date.now(),'near'),null);
 assert.equal(normalizeMarket([nameOnly,dexPair('near','doge','1234')],'doge',Date.now(),'near').mint,'doge');
});

test('generic market matching binds chain, base token and valid pool before sorting liquidity',()=>{
 const exact=dexPair('sui',sui),wrongToken=dexPair('sui',sui.replace('BLUE_DOG','blue_dog'),genericPool,{liquidity:{usd:1e12}}),wrongChain={...exact,chainId:'aptos',liquidity:{usd:1e13}},quoteOnly={...exact,baseToken:{address:'DifferentCoinAddress'},quoteToken:{address:sui},liquidity:{usd:1e14}};
 const result=normalizeMarket([wrongToken,wrongChain,quoteOnly,exact],sui,Date.now(),'sui');
 assert.equal(result.chainId,'sui');assert.equal(result.mint,sui);assert.equal(result.pools,1);assert.equal(result.pair,genericPool);
 assert.equal(normalizeMarket([wrongToken,wrongChain,quoteOnly],sui,Date.now(),'sui'),null);
 assert.throws(()=>normalizeMarket([exact],sui,Date.now(),'constructor'),error=>error.code==='format');
});

test('hostile pool IDs cannot win market selection or enter request paths',()=>{
 const exact=dexPair('future-chain',evm);
 for(const id of ['https://evil.example/pool','../secret','pool/../../secret','pool?token=bad','pool#bad','pool%2fsecret','pool\\secret','pool\nsecret','__proto__','constructor','x'.repeat(257)]){
  assert.equal(validPairId(id,'future-chain'),false,id);
  assert.equal(normalizeMarket([{...exact,pairAddress:id,liquidity:{usd:1e12}},exact],evm,Date.now(),'future-chain').pair,genericPool);
 }
 assert.equal(validPairId(pool,'future-chain'),true);
 assert.equal(validPairId(evm+'-'+evmMixed,'future-chain'),true);
});

test('a generic lookup requests only the exact encoded DEX market and listing paths',async t=>{
 const urls=[],states=[];
 t.mock.method(globalThis,'fetch',async url=>{urls.push(String(url));if(String(url).includes('/token-pairs/'))return response([dexPair('sui',sui)]);if(String(url).includes('/orders/'))return response([]);throw Error('Unexpected provider request: '+url);});
 const session=createLookupSession(state=>states.push(state));await session.lookup(sui,'sui');session.dispose();
 assert.equal(urls.length,2);assert.ok(urls.includes('https://api.dexscreener.com/token-pairs/v1/sui/'+encodeURIComponent(sui)));assert.ok(urls.includes('https://api.dexscreener.com/orders/v1/sui/'+encodeURIComponent(sui)));
 assert.ok(urls.every(url=>!url.includes('undefined')&&!url.includes('goplus')&&!url.includes('gecko')&&!url.includes('rugcheck')));
 const last=states.at(-1);assert.equal(last.market.status,'ready');assert.equal(last.market.data.mint,sui);assert.equal(last.listing.status,'ready');
 assert.equal(last.risk.status,'unsupported');assert.match(last.risk.message,/not available/);assert.equal(last.history.status,'unsupported');assert.match(last.history.message,/not available/);assert.equal(last.bundles.status,'unsupported');
 assert.ok(states.every(state=>state.risk.status==='unsupported'&&state.history.status==='unsupported'));
});

test('unsupported providers are skipped even when custom loaders were supplied',async()=>{
 const calls=[],states=[],unsupported=name=>async()=>{calls.push(name);return {level:'lower'};};
 const session=createLookupSession(s=>states.push(s),{loadMarket:async()=>normalized('near','wrap.near'),loadListing:async()=>({profilePaid:false}),loadRisk:unsupported('risk'),loadHistory:unsupported('history'),loadBundles:unsupported('bundles')});
 await session.lookup('wrap.near','near');session.dispose();
 assert.deepEqual(calls,[]);assert.equal(states.at(-1).market.status,'ready');assert.equal(states.at(-1).risk.status,'unsupported');
});

test('structured token IDs are encoded as one DEX URL component and preserve exact identity',async t=>{
 const requests=[],cases=[['osmosis',ibc],['osmosis',factory],['osmosis','factory/'+creator+'/alloyed/allBTC'],['hyperliquid','@107'],['near','a.near'],['near','doge']];
 let expected;
 t.mock.method(globalThis,'fetch',async url=>{
  const parsed=new URL(url);requests.push(parsed);
  const parts=parsed.pathname.split('/');assert.equal(parts.length,5,'Structured identity escaped its path component');
  assert.equal(parts[3],expected.chain);assert.equal(decodeURIComponent(parts[4]),expected.address);
  if(parts[1]==='token-pairs')return response([dexPair(expected.chain,expected.address,'1234')]);
  if(parts[1]==='orders')return response([]);
  throw Error('Unexpected provider URL');
 });
 for(const [chain,address] of cases){
  expected={chain,address};const states=[],session=createLookupSession(s=>states.push(s));await session.lookup(address,chain);session.dispose();
  assert.equal(states.at(-1).market.status,'ready');assert.equal(states.at(-1).market.data.mint,address);assert.equal(states.at(-1).market.data.chainId,chain);
  const urls=requests.slice(-2);assert.ok(urls.every(url=>url.pathname.endsWith('/'+encodeURIComponent(address))&&url.search===''&&url.hash===''));
 }
 assert.equal(requests.length,cases.length*2);
});

test('unsupported capabilities remain explicit when the market is empty or fails',async()=>{
 for(const loadMarket of [async()=>null,async()=>{throw Error('offline');}]){
  const states=[],session=createLookupSession(s=>states.push(s),{loadMarket,loadListing:async()=>null});await session.lookup(evm,'future-chain');session.dispose();
  assert.equal(states.at(-1).risk.status,'unsupported');assert.equal(states.at(-1).history.status,'unsupported');assert.ok(['empty','error'].includes(states.at(-1).market.status));
 }
});

test('generic custom market results cannot bypass exact identity validation',async()=>{
 const good=normalized('future-chain',evm);
 for(const bad of [{...good,mint:'DifferentTokenAddress'},{...good,chainId:'different-chain'},{...good,chainId:undefined},{...good,pair:'https://evil.example/pool'}]){
  const states=[],session=createLookupSession(s=>states.push(s),{loadMarket:async()=>bad,loadListing:async()=>null});await session.lookup(evm,'future-chain');session.dispose();
  assert.equal(states.at(-1).market.status,'error');assert.equal(states.at(-1).market.data,undefined);assert.equal(states.at(-1).history.status,'unsupported');
 }
});

test('market-only history cannot generate a guessed provider URL',async()=>{
 let calls=0;const request=async()=>{calls++;return {};};
 await assert.rejects(loadPriceHistory(sui,normalized('sui',sui),undefined,'sui',request),error=>error.code==='unsupported');
 await assert.rejects(loadPriceHistory(sui,{...normalized('sui',sui),pair:'../pool'},undefined,'sui',request),error=>error.code==='format');
 await assert.rejects(loadPriceHistory(evm,{pair:pool},undefined,'constructor',request),error=>error.code==='format');
 assert.equal(calls,0);
 assert.throws(()=>normalizeEvmRisk({code:1,result:{[evm]:{is_honeypot:'0'}}},evm,'future-chain'),error=>error.code==='format');
});

test('Robinhood and Arc use verified history and security endpoints with exact identities',async t=>{
 const urls=[],states=[];
 t.mock.method(globalThis,'fetch',async url=>{
  const parsed=new URL(url);urls.push(parsed);
  if(parsed.pathname.includes('/token-pairs/')){const chain=parsed.pathname.split('/')[3];return response([dexPair(chain,evm,pool)]);}
  if(parsed.pathname.includes('/orders/'))return response([]);
  if(parsed.pathname.includes('/token_security/'))return response({code:1,result:{[evmMixed]:{token_name:'Exact token',is_honeypot:'0'}}});
  if(parsed.hostname==='api.geckoterminal.com'){const interval=parsed.pathname.endsWith('/minute')?60000:3600000,seconds=Math.floor(Date.now()/interval)*interval/1000;return response({data:{type:'ohlcv_request_response',attributes:{ohlcv_list:[[seconds,1,2,1,2,3]]}},meta:{base:{address:evmMixed}}});}
  throw Error('Unexpected URL: '+url);
 });
 for(const chain of ['robinhood','arc']){
  const session=createLookupSession(s=>states.push(s));await session.lookup(evm,chain);session.dispose();
  assert.equal(states.at(-1).market.status,'ready');assert.equal(states.at(-1).risk.status,'ready');assert.equal(states.at(-1).risk.data.level,'unknown');assert.equal(states.at(-1).history.status,'ready');
  assert.ok(urls.some(url=>url.pathname==='/api/v1/token_security/'+getNetwork(chain).securityId&&url.searchParams.get('contract_addresses')===evm));
  for(const interval of ['hour','minute'])assert.ok(urls.some(url=>url.pathname==='/api/v2/networks/'+chain+'/pools/'+pool+'/ohlcv/'+interval&&url.searchParams.get('token')===evm));
 }
 assert.ok(urls.every(url=>!url.href.includes('undefined')));
});

test('switching generic networks aborts and suppresses a late market response',async()=>{
 const states=[];let release,oldSignal;
 const session=createLookupSession(s=>states.push(s),{loadMarket:(address,signal,chain)=>chain==='first-chain'?(oldSignal=signal,new Promise(resolve=>release=resolve)):Promise.resolve(normalized(chain,address)),loadListing:async()=>null});
 const first=session.lookup(evm,'first-chain');await flush();const boundary=states.length;await session.lookup(evm,'second-chain');assert.equal(oldSignal.aborted,true);release(normalized('first-chain',evm));await first;session.dispose();
 assert.ok(states.slice(boundary).every(state=>state.chainId==='second-chain'));assert.equal(states.at(-1).market.data.chainId,'second-chain');
});

test('cancel and disposal suppress pending generic results even if a provider ignores abort',async()=>{
 for(const action of ['cancel','dispose']){
  const states=[];let release,signal;
  const session=createLookupSession(s=>states.push(s),{loadMarket:(address,nextSignal)=>(signal=nextSignal,new Promise(resolve=>release=resolve)),loadListing:async()=>null});
  const pending=session.lookup(evm,'future-chain');await flush();session[action]();assert.equal(signal.aborted,true);const count=states.length;release(normalized('future-chain',evm));await pending;assert.equal(states.length,count);session.dispose();
 }
});

test('invalid cross-network input cancels the prior request without starting another one',async()=>{
 const states=[];let release,signal,calls=0;
 const session=createLookupSession(s=>states.push(s),{loadMarket:(address,nextSignal)=>{calls++;signal=nextSignal;return new Promise(resolve=>release=resolve);},loadListing:async()=>null});
 const pending=session.lookup(evm,'future-chain');await flush();await assert.rejects(session.lookup('token?secret','future-chain'),error=>error.code==='address');assert.equal(signal.aborted,true);const count=states.length;release(normalized('future-chain',evm));await pending;session.dispose();assert.equal(calls,1);assert.equal(states.length,count);
});
