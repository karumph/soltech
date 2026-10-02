import test from 'node:test';
import assert from 'node:assert/strict';
import {validMint,validTokenAddress,normalizeMarket,normalizeRisk,normalizeEvmRisk,normalizeListing,normalizeHistory,loadPriceHistory,normalizeSupply,safeExternalUrl,requestJSON,LookupError,createLookupSession,formatMoney} from '../dist/coin-checker-data.js';
import {NETWORKS} from '../dist/coin-networks.js';
const mint='So11111111111111111111111111111111111111112';
const other='FLUXBmPhT3Fd1EDVFdg46YREqHBeNypn1h4EbnTzWERX';
const pair='58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2';
const market=overrides=>({chainId:'solana',baseToken:{address:mint,name:'Wrapped SOL',symbol:'SOL'},quoteToken:{symbol:'USDC'},pairAddress:pair,priceUsd:'0.0123',marketCap:1000000,fdv:2000000,liquidity:{usd:5000},volume:{h24:30},priceChange:{h24:-2},txns:{h24:{buys:0,sells:1}},pairCreatedAt:1688106058000,...overrides});
const report=overrides=>({mint,tokenProgram:other,risks:[],token:{mintAuthority:null,freezeAuthority:null},tokenMeta:{mutable:true},...overrides});

test('insider account counts preserve explicit zero and do not infer from networks or holders',()=>{
 for(const value of [0,6])assert.equal(normalizeRisk(report({graphInsidersDetected:value,insiderNetworks:null}),mint).insiderAccounts,value);
 for(const value of [undefined,null,-1,1.5,'6',Infinity,Number.MAX_SAFE_INTEGER+1])assert.equal(normalizeRisk(report({graphInsidersDetected:value,insiderNetworks:[{size:6,activeAccounts:6,tokenAmount:999}],topHolders:[{insider:true}]}),mint).insiderAccounts,null);
});
test('Solana address validation checks base58 byte length, not only characters',()=>{
 for(const v of [mint,other,pair,'11111111111111111111111111111111'])assert.equal(validMint(v),true);
 for(const v of ['',null,'0x'+'1'.repeat(40),'Solana','1'.repeat(31),'1'.repeat(33),'z'.repeat(44),mint+' ',mint.replace('S','0')])assert.equal(validMint(v),false);
});
const evm='0x4200000000000000000000000000000000000006',evmPair='0x1111111111111111111111111111111111111111';
test('EVM identity includes the chosen supported network and never borrows another chain or quote token',()=>{
 for(const chain of Object.keys(NETWORKS))assert.equal(validTokenAddress(chain==='solana'?mint:evm,chain),true);
 assert.equal(validTokenAddress(evm,'unknown'),false);assert.equal(validTokenAddress(mint,'base'),false);
 const p=market({chainId:'base',baseToken:{address:evm.toUpperCase().replace('0X','0x'),name:'Wrapped Ether'},pairAddress:evmPair});
 assert.equal(normalizeMarket([p,{...p,chainId:'optimism',liquidity:{usd:1e9}}],evm,Date.now(),'base').chainId,'base');
 assert.equal(normalizeMarket([{...p,chainId:'optimism'}],evm,Date.now(),'base'),null);
 assert.equal(normalizeMarket([{...p,baseToken:{address:evmPair},quoteToken:{address:evm}}],evm,Date.now(),'base'),null);
});
test('GoPlus exact identity, missing checks, supply units and capability flags stay distinct',()=>{
 const payload=r=>({code:1,result:{[evm]:r}});
 const report=normalizeEvmRisk(payload({token_name:'Token',is_honeypot:'0',total_supply:'123.456',holder_count:'20',buy_tax:'0.05'}),evm,'base');
 assert.equal(report.level,'unknown');assert.equal(report.supply.exact,'123.456');assert.equal(report.holders,20);
 assert.equal(report.controls.find(c=>c.label==='Buy tax').value,'5%');assert.equal(report.controls.find(c=>c.label==='Sell tax').value,'Unavailable');
 assert.equal(normalizeEvmRisk(payload({is_mintable:'1'}),evm,'base').level,'caution');
 assert.equal(normalizeEvmRisk(payload({can_take_back_ownership:'1'}),evm,'base').flags[0].name,'Ownership can be reclaimed');
 assert.equal(normalizeEvmRisk(payload({is_honeypot:'1',is_mintable:'1'}),evm,'base').level,'high');
 assert.equal(normalizeEvmRisk({code:1,result:{[evmPair]:{is_honeypot:'0'}}},evm,'base'),null);
 assert.equal(normalizeEvmRisk(payload({}),evm,'base'),null);
 assert.throws(()=>normalizeEvmRisk({code:0,result:{}},evm,'base'),/format/);
});
test('EVM pool identifiers can be v4 hashes or Curve pairs without losing their market data',()=>{
 const v4='0x'+'a'.repeat(64),curve=evmPair+'-'+evm+'-'+evmPair;
 for(const pool of [v4,curve]){
  const p=market({chainId:'base',baseToken:{address:evm},pairAddress:pool});
  assert.equal(normalizeMarket([p],evm,Date.now(),'base').pair,pool);
 }
 for(const pool of [evmPair+'/../../secret','https://evil.example/pool',evmPair+'?token=bad'])assert.equal(normalizeMarket([market({chainId:'base',baseToken:{address:evm},pairAddress:pool})],evm,Date.now(),'base'),null);
});
test('changing networks for the same contract suppresses the old lookup',async()=>{
 let release;const changes=[];
 const session=createLookupSession(s=>changes.push(s),{loadMarket:(address,signal,chain)=>chain==='base'?new Promise(resolve=>release=resolve):Promise.resolve({mint:address,pair:evmPair,chainId:chain}),loadRisk:()=>Promise.resolve(null),loadListing:()=>Promise.resolve(null),loadHistory:()=>Promise.resolve(null)});
 const first=session.lookup(evm,'base');await session.lookup(evm,'optimism');
 release({mint:evm,pair:evmPair,chainId:'base'});await first;
 assert.equal(changes.at(-1).chainId,'optimism');assert.equal(changes.at(-1).market.data.chainId,'optimism');session.dispose();
});
test('market selection requires exact chain/base token and chooses highest reported liquidity',()=>{
 const result=normalizeMarket([market({chainId:'ethereum',liquidity:{usd:1e12}}),market({baseToken:{address:other},quoteToken:{address:mint},liquidity:{usd:1e10}}),market({pairAddress:other,liquidity:{usd:80}}),market()],mint);
 assert.equal(result.pair,pair);assert.equal(result.pools,2);assert.equal(result.price,.0123);assert.equal(result.marketCap,1e6);assert.equal(result.fdv,2e6);assert.equal(result.buys,0);assert.equal(result.change,-2);
 assert.equal(normalizeMarket([market({baseToken:{address:other},quoteToken:{address:mint}})],mint),null);
});
test('absent or malformed market fields remain missing, never borrowed from FDV',()=>{
 const result=normalizeMarket([market({marketCap:null,liquidity:{usd:-3},priceUsd:'NaN',volume:{h24:'35'},txns:null,priceChange:{h24:Infinity},pairCreatedAt:1688106058})],mint);
 for(const key of ['marketCap','liquidity','price','volume','buys','sells','change','created'])assert.equal(result[key],null,key);
 assert.equal(result.fdv,2e6);
 assert.equal(normalizeMarket([market({pairCreatedAt:Date.now()+1e8})],mint).created,null);
 assert.equal(normalizeMarket([market({priceUsd:'0',marketCap:0})],mint).price,0);
 assert.throws(()=>normalizeMarket({error:'invalid'},mint),/format/);
});
test('one-hour activity is distinct from daily activity and transaction counts must be integers',()=>{
 const result=normalizeMarket([market({volume:{h24:500,h1:20},priceChange:{h24:25,h1:-17},txns:{h24:{buys:40,sells:50},h1:{buys:0,sells:4}}})],mint);
 assert.equal(result.volume,500);assert.equal(result.volume1h,20);assert.equal(result.change1h,-17);assert.equal(result.buys1h,0);assert.equal(result.sells1h,4);assert.equal(result.buys,40);
 const missing=normalizeMarket([market({txns:{h1:{buys:.5,sells:Number.MAX_SAFE_INTEGER+1}},priceChange:{h1:'-4'},volume:{h1:-2}})],mint);
 for(const key of ['buys1h','sells1h','change1h','volume1h'])assert.equal(missing[key],null,key);
});
test('project links accept supported provider links without trusting arbitrary social labels or URL schemes',()=>{
 const result=normalizeMarket([market({info:{websites:[{url:'https://coin.example/about',label:'<img src=x>'},{url:'javascript:alert(1)'},{url:'https://coin.example/about'}],socials:[{type:'twitter',url:'https://x.com/coin'},{type:'telegram',url:'https://t.me/coin'},{type:'twitter',url:'https://x.com.evil.example/coin'},{type:'twitter',url:'https://x.com@evil.example/coin'},{type:'discord',url:'https://discord.com/coin'}]}})],mint);
 assert.deepEqual(result.links,[{kind:'website',label:'Website',url:'https://coin.example/about'},{kind:'x',label:'X',url:'https://x.com/coin'},{kind:'telegram',label:'Telegram',url:'https://t.me/coin'}]);
 for(const input of [null,'//coin.example','javascript:alert(1)','data:text/html,test','https://user:password@coin.example','https://coin.example\n','https://localhost','http://127.0.0.1','http://[::1]'])assert.equal(safeExternalUrl(input),null,input);
 assert.equal(safeExternalUrl('http://coin.example'),'http://coin.example/');
 assert.deepEqual(normalizeMarket([market()],mint).links,[]);
});
test('token supply retains exact uint64 precision and never invents circulating supply',()=>{
 assert.deepEqual(normalizeSupply(973642865863266,6),{raw:'973642865863266',decimals:6,exact:'973642865.863266'});
 assert.equal(normalizeSupply('18446744073709551615',9).exact,'18446744073.709551615');
 assert.equal(normalizeSupply('1000000',6).exact,'1');assert.equal(normalizeSupply(1,9).exact,'0.000000001');assert.equal(normalizeSupply(0,6).exact,'0');
 for(const [value,decimals] of [[Number.MAX_SAFE_INTEGER+1,6],['18446744073709551616',6],['1e10',6],['1.0',6],[-1,6],[null,6],[1,-1],[1,256],[1,1.5]])assert.equal(normalizeSupply(value,decimals),null);
 const normalized=normalizeRisk(report({token:{supply:'1000000000',decimals:6}}),mint);assert.equal(normalized.supply.exact,'1000');assert.equal(Object.hasOwn(normalized,'circulatingSupply'),false);
});
test('coin logos come from the exact token pair image, not a banner or unsafe URL',()=>{
 const logo='https://cdn.dexscreener.com/cms/images/token-logo?width=64&height=64';
 assert.equal(normalizeMarket([market({baseToken:{address:other},info:{imageUrl:'https://wrong.example/logo'}}),market({info:{imageUrl:logo,header:'https://banner.example/banner'}})],mint).imageUrl,logo);
 for(const imageUrl of [null,'http://coin.example/logo','data:image/svg+xml,test','javascript:alert(1)','https://user:pass@coin.example/logo','https://127.0.0.1/logo'])assert.equal(normalizeMarket([market({info:{imageUrl}})],mint).imageUrl,null);
 assert.equal(normalizeMarket([market({info:{header:logo}})],mint).imageUrl,null);
});
test('missing essential risk checks stay gray unless a known caution or danger takes priority',()=>{
 const missing={mint,tokenProgram:'Token',risks:[]};
 assert.equal(normalizeRisk(missing,mint).level,'unknown');
 assert.equal(normalizeRisk(missing,mint).incomplete,true);
 assert.equal(normalizeRisk({...missing,risks:[{name:'Warn',level:'warn'}]},mint).level,'caution');
 assert.equal(normalizeRisk({...missing,risks:[{name:'Danger',level:'danger'}]},mint).level,'high');
});
test('holder counts reject zero, fractional and imprecise provider values',()=>{
 assert.equal(normalizeRisk(report({totalHolders:672}),mint).holders,672);
 for(const totalHolders of [0,-1,1.5,'672',null,Number.MAX_SAFE_INTEGER+1])assert.equal(normalizeRisk(report({totalHolders}),mint).holders,null);
});
const accountAt=index=>{let n=BigInt(index+1),encoded='';const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';while(n){encoded=alphabet[Number(n%58n)]+encoded;n/=58n;}return '1'.repeat(31)+encoded;};
test('concentration excludes identified pool accounts but retains lockers and does not claim distinct wallets',()=>{
 const addresses=Array.from({length:13},(_,i)=>accountAt(i));assert.ok(addresses.every(validMint));
 const data=report({topHolders:addresses.map((address,i)=>({address,owner:other,pct:i===0?30:1})),markets:[{liquidityA:addresses[0]}],knownAccounts:{[addresses[1]]:{type:'AMM'},[addresses[2]]:{type:'LOCKER'}}});
 const result=normalizeRisk(data,mint);assert.equal(result.top10Percent,10);assert.equal(result.excludedPoolAccounts,2);assert.equal(result.largestAccounts[0].kind,'pool');assert.equal(result.largestAccounts.find(a=>a.address===addresses[2]).kind,'locker');
 assert.equal(result.largestAccounts[0].owner,other);
 // Every account can share one owner: this is account concentration, never a count of people.
 assert.equal(result.largestAccounts.filter(a=>a.owner===other).length,13);
 assert.equal(normalizeRisk(report({topHolders:data.topHolders.slice(0,9)}),mint).top10Percent,null);
 assert.equal(normalizeRisk(report({topHolders:addresses.slice(0,10).map(address=>({address,pct:11}))}),mint).top10Percent,null);
 assert.equal(normalizeRisk(report({topHolders:[...data.topHolders,{address:other,pct:'3'}]}),mint).top10Percent,null);
 assert.equal(normalizeRisk(report({topHolders:[{address:mint,pct:2},{address:mint,pct:2},{address:other,pct:-1},{address:'bad',pct:50}]}),mint).largestAccounts.length,1);
});
test('only an approved token profile order establishes a paid profile; absence is not an endorsement',()=>{
 const now=1700000000000;
 assert.deepEqual(normalizeListing({orders:[{type:'tokenProfile',status:'approved'}],boosts:[]},now),{profilePaid:true,profileStatus:'paid',retrievedAt:now});
 assert.equal(normalizeListing([{type:'tokenProfile',status:'approved'}]).profilePaid,true);
 assert.equal(normalizeListing({orders:[],boosts:[{type:'tokenProfile',status:'approved'}]}).profilePaid,false);
 assert.equal(normalizeListing([{type:'tokenAd',status:'approved'}]).profilePaid,false);
 for(const order of [{type:'tokenProfile',status:'processing'},{type:'tokenProfile',status:'rejected'},null,{}])assert.equal(normalizeListing([order]).profilePaid,null);
 for(const value of [null,{},'approved',{orders:{type:'tokenProfile',status:'approved'}}])assert.throws(()=>normalizeListing(value),/format/);
});
test('active boosts use the exact base-token pair and do not infer counts from missing fields or past orders',()=>{
 assert.equal(normalizeMarket([market({boosts:{active:500}})],mint).boostsActive,500);
 assert.equal(normalizeMarket([market({boosts:{active:0}})],mint).boostsActive,0);
 for(const active of [undefined,null,-1,1.5,'50',Number.MAX_SAFE_INTEGER+1])assert.equal(normalizeMarket([market({boosts:{active}})],mint).boostsActive,null);
 const wrong=market({baseToken:{address:other},quoteToken:{address:mint},boosts:{active:5000},liquidity:{usd:1e9}});
 assert.equal(normalizeMarket([wrong,market({boosts:{active:50}})],mint).boostsActive,50);
 assert.equal(normalizeMarket([market({boosts:{amount:50,totalAmount:100}})],mint).boostsActive,null);
});
test('cancelled orders and omitted boost counts remain distinct from failed or malformed checks',()=>{
 assert.equal(normalizeListing([{type:'tokenProfile',status:'cancelled'}]).profileStatus,'cancelled');
 assert.equal(normalizeListing([{type:'tokenProfile',status:'processing'}]).profileStatus,'pending');
 assert.equal(normalizeListing([{type:'tokenProfile',status:'rejected'}]).profileStatus,'not-approved');
 assert.equal(normalizeListing([{type:'tokenProfile',status:'new-status'}]).profileStatus,'unavailable');
 assert.equal(normalizeListing([{type:'tokenProfile',status:'approved'},{type:'tokenProfile',status:'cancelled'}]).profileStatus,'paid');
 assert.equal(normalizeMarket([market()],mint).boostsStatus,'not-reported');
 assert.equal(normalizeMarket([market({boosts:{active:'50'}})],mint).boostsStatus,'unavailable');
 assert.equal(normalizeMarket([market({boosts:{active:0}})],mint).boostsStatus,'reported');
});
const historyNow=1800000000000,latestHour=Math.floor(historyNow/3600000)*3600;
const historyReport=(candles,metadata={base:{address:mint},quote:{address:other}})=>({data:{id:'unrelated-request-id',type:'ohlcv_request_response',attributes:{ohlcv_list:candles}},meta:metadata});
test('history binds the requested token and pool and retains only observed hourly prices',()=>{
 const data=historyReport([[latestHour,4,7,3,6,50],[latestHour-3600,2,5,1,4,20]]),result=normalizeHistory(data,mint,pair,historyNow);
 assert.equal(result.mint,mint);assert.equal(result.pair,pair);assert.equal(result.currency,'usd');assert.equal(result.observedHigh,7);assert.equal(result.observedLow,1);assert.equal(result.from,(latestHour-3600)*1000);assert.equal(result.through,latestHour*1000);assert.equal(result.points[0].close,4);assert.equal(result.retrievedAt,historyNow);assert.equal(Object.hasOwn(result,'ath'),false);
 assert.equal(normalizeHistory(historyReport([], {base:{address:other},quote:{address:mint}}),mint,pair,historyNow),null);
 for(const [payload,address,pool] of [[historyReport([], {base:{address:other}}),mint,pair],[data,'bad',pair],[data,mint,'bad'],[{},mint,pair]])assert.throws(()=>normalizeHistory(payload,address,pool,historyNow),/format/);
});
test('invalid, duplicate, future and contradictory price candles cannot become a chart',()=>{
 const valid=[latestHour,4,7,3,6,50];
 for(const candles of [[valid,valid],[[latestHour+3600,4,7,3,6,50]],[[latestHour+1,4,7,3,6,50]],[[latestHour,4,3,2,6,50]],[[latestHour,4,7,5,6,50]],[[latestHour,4,7,3,6,-1]],[[latestHour,4,7,3,Infinity,50]],[[latestHour,'4',7,3,6,50]],[[latestHour,4,7,3,6]],Array.from({length:1001},()=>valid)])assert.throws(()=>normalizeHistory(historyReport(candles),mint,pair,historyNow),/format/);
});
test('the bounded history window never implies complete token history or fills missing hours',()=>{
 const within=[latestHour-999*3600,4,7,3,6,50],tooOld=[latestHour-1000*3600,4,99,3,6,50],latest=[latestHour,4,8,2,6,50];
 const result=normalizeHistory(historyReport([latest,tooOld,within]),mint,pair,historyNow);
 assert.equal(result.points.length,2);assert.equal(result.observedHigh,8);assert.equal(result.windowHours,1000);assert.equal(normalizeHistory(historyReport([tooOld]),mint,pair,historyNow),null);
});
test('minute history validates minute alignment and leaves missing intervals empty',()=>{
 const t=Math.floor(historyNow/60000)*60;
 const result=normalizeHistory(historyReport([[t,4,7,3,6,50],[t-180,2,5,1,4,20]]),mint,pair,historyNow,'solana','minute');
 assert.equal(result.intervalMs,60000);assert.equal(result.interval,'minute');assert.equal(result.points.length,2);
 assert.equal(result.points[1].timestamp-result.points[0].timestamp,180000);
 assert.throws(()=>normalizeHistory(historyReport([[t+1,4,7,3,6,50]]),mint,pair,historyNow,'solana','minute'),/format/);
});
test('history requests exact-token minute and hourly data and preserves either successful series',async()=>{
 const urls=[],signal=new AbortController().signal;
 const request=async(url,options)=>{urls.push(url);assert.equal(options.signal,signal);const step=url.includes('/minute?')?60:3600,t=Math.floor(Date.now()/1000/step)*step;return historyReport([[t,4,7,3,6,50]]);};
 const h=await loadPriceHistory(mint,{pair},signal,'solana',request);
 assert.equal(h.interval,'hour');assert.equal(h.recent.interval,'minute');
 assert.equal(urls.length,2);for(const url of urls){assert.ok(url.endsWith('token='+mint));assert.match(url,/include_empty_intervals=false/);}
 const hourly=await loadPriceHistory(mint,{pair},signal,'solana',(url,opts)=>url.includes('/minute?')?Promise.reject(new LookupError('rate')):request(url,opts));
 assert.equal(hourly.interval,'hour');assert.equal(hourly.recentStatus,'unavailable');
 const minute=await loadPriceHistory(mint,{pair},signal,'solana',(url,opts)=>url.includes('/hour?')?Promise.reject(new LookupError('rate')):request(url,opts));
 assert.equal(minute.interval,'minute');assert.equal(minute.hourlyStatus,'unavailable');
 await assert.rejects(loadPriceHistory(mint,{pair},signal,'solana',async()=>{throw new LookupError('rate');}),error=>error.code==='rate');
});
test('risk reports preserve missing controls and reject mismatched identity',()=>{
 let r=normalizeRisk(report(),mint);assert.equal(r.level,'lower');assert.equal(r.mintAuthority,'Disabled');assert.equal(r.mutable,'Changeable');assert.equal(r.holders,null);
 r=normalizeRisk(report({token:{},tokenMeta:{}}),mint);assert.equal(r.mintAuthority,'Unavailable');assert.equal(r.freezeAuthority,'Unavailable');assert.equal(r.mutable,'Unavailable');
 assert.equal(normalizeRisk(report({token:{mintAuthority:other}}),mint).mintAuthority,'Enabled');
 for(const d of [null,{},report({mint:other}),report({risks:null}),report({tokenProgram:''})])assert.throws(()=>normalizeRisk(d,mint),/format/);
});
test('unclassified risk never becomes a green result and danger remains visible with incomplete checks',()=>{
 assert.equal(normalizeRisk(report({risks:[null]}),mint).level,'unknown');
 assert.equal(normalizeRisk(report({risks:[{name:'X',level:'info'}]}),mint).level,'unknown');
 assert.equal(normalizeRisk(report({risks:[{name:'Mutable',level:'warn'}]}),mint).level,'caution');
 const r=normalizeRisk(report({risks:[{name:'Known concern',level:'danger'},{}]}),mint);assert.equal(r.level,'high');assert.equal(r.incomplete,true);
 const mixed=normalizeRisk(report({risks:[{name:'Mutable',level:'warn'},{name:'Major',description:'Major reason',level:'danger'}]}),mint);assert.equal(mixed.flags[0].description,'Major reason');
});
test('tiny positive prices are not rounded to zero',()=>{
 assert.equal(formatMoney(1e-12),'$0.000000000001');assert.notEqual(formatMoney(.000002),'$0.00');assert.equal(formatMoney(0),'$0');assert.equal(formatMoney(null),'Unavailable');
 for(const price of [1e-20,1e-9,.000000012345])assert.doesNotMatch(formatMoney(price),/e-|\$0\.00$/);
});
test('network failures, HTTP limits, and invalid JSON produce deliberate error types',async()=>{
 for(const [status,code] of [[429,'rate'],[404,'missing'],[503,'service']])await assert.rejects(requestJSON('https://example.test',{fetcher:async()=>({ok:false,status})}),e=>e.code===code);
 await assert.rejects(requestJSON('https://example.test',{fetcher:async()=>({ok:true,text:async()=>'<html>'})}),e=>e.code==='format');
 await assert.rejects(requestJSON('https://example.test',{fetcher:async()=>{throw new TypeError('offline');}}),e=>e.code==='network');
 await assert.rejects(requestJSON('https://example.test',{timeout:2,fetcher:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))))}),e=>e.code==='timeout');
 let options;assert.deepEqual(await requestJSON('https://example.test',{fetcher:async(url,o)=>{options=o;return {ok:true,text:async()=>'[]'};}}),[]);assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');
});
test('partial source failure keeps the successful source',async()=>{
 const changes=[],session=createLookupSession(s=>changes.push(s),{loadMarket:async()=>({name:'Real coin'}),loadRisk:async()=>{throw new LookupError('rate');},loadListing:async()=>null,loadHistory:async()=>null});
 await session.lookup(mint);const last=changes.at(-1);assert.equal(last.market.status,'ready');assert.equal(last.risk.status,'error');assert.match(last.risk.message,/Wait a minute/);
});
test('listing source errors never erase market or risk results',async()=>{
 const changes=[],session=createLookupSession(s=>changes.push(s),{loadMarket:async()=>({name:'Real coin'}),loadRisk:async()=>({level:'caution'}),loadListing:async()=>{throw new LookupError('network');},loadHistory:async()=>null});
 await session.lookup(mint);const last=changes.at(-1);assert.equal(last.market.status,'ready');assert.equal(last.risk.status,'ready');assert.equal(last.listing.status,'error');assert.match(last.listing.message,/reach/);
});
test('late responses from A cannot replace B even if the loader ignores abort',async()=>{
 const queued=[],changes=[];const loader=(mint,signal)=>new Promise(resolve=>queued.push({mint,resolve,signal}));
 const session=createLookupSession(s=>changes.push(s),{loadMarket:loader,loadRisk:loader,loadListing:loader,loadHistory:async()=>null});
 const a=session.lookup(mint),b=session.lookup(other);assert.equal(queued[0].signal.aborted,true);
 queued[3].resolve({name:'B market'});queued[4].resolve({name:'B risk'});queued[5].resolve({profilePaid:false});await b;
 const count=changes.length;queued[0].resolve({name:'A'});queued[1].resolve({name:'A'});queued[2].resolve({profilePaid:true});await a;
 assert.equal(changes.length,count);assert.equal(changes.at(-1).mint,other);assert.equal(changes.at(-1).market.data.name,'B market');assert.equal(changes.at(-1).listing.data.profilePaid,false);
});
test('leaving the checker suppresses every pending response',async()=>{
 let finish;const changes=[],session=createLookupSession(s=>changes.push(s),{loadMarket:()=>new Promise(resolve=>finish=resolve),loadRisk:async()=>null,loadListing:async()=>null,loadHistory:async()=>null});
 const pending=session.lookup(mint);session.dispose();const before=changes.length;finish({name:'Late'});await pending;assert.equal(changes.length,before);
});
test('invalid input cancels earlier work without starting network requests',async()=>{
 let finish,calls=0;const changes=[],session=createLookupSession(s=>changes.push(s),{loadMarket:()=>{calls++;return new Promise(resolve=>finish=resolve);},loadRisk:async()=>null,loadListing:async()=>null,loadHistory:async()=>null});
 const pending=session.lookup(mint);await assert.rejects(session.lookup('bad'),/address/);const before=changes.length;finish({name:'Stale'});await pending;assert.equal(calls,1);assert.equal(changes.length,before);
});
test('history starts after market identity resolves and cannot delay the other results',async()=>{
 let finishMarket,finishHistory,historyArgs;const changes=[];
 const session=createLookupSession(s=>changes.push(s),{loadMarket:()=>new Promise(resolve=>finishMarket=resolve),loadRisk:async()=>({level:'lower'}),loadListing:async()=>({profilePaid:false}),loadHistory:(...args)=>{historyArgs=args;return new Promise(resolve=>finishHistory=resolve);}});
 const pending=session.lookup(mint);assert.equal(changes[0].history.status,'waiting');assert.equal(historyArgs,undefined);
 finishMarket({mint,pair});await Promise.resolve();
 assert.equal(historyArgs[0],mint);assert.equal(historyArgs[1].pair,pair);assert.equal(changes.at(-1).market.status,'ready');assert.equal(changes.at(-1).risk.status,'ready');assert.equal(changes.at(-1).history.status,'loading');
 finishHistory({observedHigh:2});await pending;assert.equal(changes.at(-1).history.status,'ready');
});
test('a missing or failed market prevents a history request; invalid identity cannot be requested',async()=>{
 for(const loadMarket of [async()=>null,async()=>{throw new LookupError('service');},async()=>({mint:other,pair}),async()=>({mint,pair:'bad'})]){
  let calls=0;const changes=[],session=createLookupSession(s=>changes.push(s),{loadMarket,loadRisk:async()=>null,loadListing:async()=>null,loadHistory:async()=>{calls++;return null;}});
  await session.lookup(mint);assert.equal(calls,0);assert.notEqual(changes.at(-1).history.status,'waiting');assert.notEqual(changes.at(-1).history.status,'loading');
 }
});
test('history failure keeps completed market, risk and listing results',async()=>{
 const changes=[],session=createLookupSession(s=>changes.push(s),{loadMarket:async()=>({mint,pair}),loadRisk:async()=>({level:'lower'}),loadListing:async()=>({profilePaid:true}),loadHistory:async()=>{throw new LookupError('rate');}});
 await session.lookup(mint);const last=changes.at(-1);assert.equal(last.history.status,'error');assert.match(last.history.message,/Wait a minute/);for(const key of ['market','risk','listing'])assert.equal(last[key].status,'ready');
});
test('late dependent history cannot replace a newer coin even when it ignores abort',async()=>{
 const queued=[],changes=[],session=createLookupSession(s=>changes.push(s),{loadMarket:async value=>({mint:value,pair}),loadRisk:async()=>null,loadListing:async()=>null,loadHistory:(value,market,signal)=>new Promise(resolve=>queued.push({value,signal,resolve}))});
 const a=session.lookup(mint);await Promise.resolve();assert.equal(queued[0].value,mint);
 const b=session.lookup(other);await Promise.resolve();assert.equal(queued[0].signal.aborted,true);queued[1].resolve({observedHigh:2});await b;
 const before=changes.length;queued[0].resolve({observedHigh:99});await a;assert.equal(changes.length,before);assert.equal(changes.at(-1).history.data.observedHigh,2);assert.equal(changes.at(-1).mint,other);
});
test('leaving with pending history suppresses its response',async()=>{
 let finish;const changes=[],session=createLookupSession(s=>changes.push(s),{loadMarket:async()=>({mint,pair}),loadRisk:async()=>null,loadListing:async()=>null,loadHistory:()=>new Promise(resolve=>finish=resolve)});
 const pending=session.lookup(mint);await Promise.resolve();session.dispose();const before=changes.length;finish({observedHigh:99});await pending;assert.equal(changes.length,before);
});
