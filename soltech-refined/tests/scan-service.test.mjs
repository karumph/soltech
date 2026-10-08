import test from 'node:test';
import assert from 'node:assert/strict';
import {runScan,mergeFeed,fromDexPairs,FEED_MAX_COINS} from '../../soltech-api/scan.mjs';
import {assess,marketRisk,momentumScore} from '../../soltech-api/assess.mjs';
import {fromRugcheck,fromGoplusEvm,fromGoplusSolana,safetyQueue} from '../../soltech-api/safety.mjs';

const now=Date.parse('2026-10-05T12:00:00Z');
const pair=(address,extra={})=>({chainId:'solana',dexId:'raydium',pairAddress:'P'+address,baseToken:{address,name:'Coin '+address,symbol:address.slice(0,4)},liquidity:{usd:50000},marketCap:300000,fdv:300000,volume:{h24:1000,h1:100,m5:10},txns:{h1:{buys:20,sells:10}},priceChange:{h1:5},pairCreatedAt:now-4*36e5,info:{imageUrl:'https://dd.dexscreener.com/x.png',websites:[{url:'https://x.y'}],socials:[]},...extra});
const fake=routes=>async url=>{for(const [pattern,value] of routes)if(url.includes(pattern))return typeof value==='function'?value(url):value;throw new Error('404 '+url);};
const noSafety={rugcheck:0,goplus:0};

test('a scan merges profiles, boosts and new pools and reads every pair of a token',async()=>{
 const fetchJson=fake([
  ['token-profiles',[{chainId:'solana',tokenAddress:'AAA1'},{chainId:'ethereum',tokenAddress:'0xskip'}]],
  ['token-boosts',[{chainId:'solana',tokenAddress:'BBB2'}]],
  ['networks/solana/new_pools',{data:[{attributes:{address:'pool3',reserve_in_usd:'4000',fdv_usd:'9000',pool_created_at:'2026-10-05T11:58:00Z'},relationships:{base_token:{data:{id:'solana_CCC3'}},dex:{data:{id:'pump-fun'}}}},{attributes:{},relationships:{base_token:{data:{id:'solana_So11111111111111111111111111111111111111112'}}}}],included:[{id:'solana_CCC3',type:'token',attributes:{address:'CCC3',name:'Cee',symbol:'CEE',image_url:'missing.png'}}]}],
  ['networks/base/new_pools',{data:[]}],
  ['tokens/v1/solana',[pair('AAA1',{liquidity:{usd:1000},pairCreatedAt:now-30*36e5}),pair('AAA1'),pair('BBB2',{liquidity:{usd:12000}})]],
 ]);
 const scan=await runScan({fetchJson,now,safetyBudget:noSafety});
 const byId=Object.fromEntries(scan.coins.map(coin=>[coin.id,coin]));
 assert.deepEqual(Object.keys(byId).sort(),['solana:AAA1','solana:BBB2','solana:CCC3']);
 assert.equal(byId['solana:AAA1'].liquidity,51000,'liquidity is added up across pairs');
 assert.equal(byId['solana:AAA1'].pairCreatedAt,now-30*36e5,'age comes from the oldest pair');
 assert.equal(byId['solana:AAA1'].risk,'caution','unchecked contracts are never lower risk');
 assert.match(byId['solana:AAA1'].reason,/contract hasn.t been checked/);
 assert.equal(byId['solana:AAA1'].steps.length,4);
 assert.equal(byId['solana:BBB2'].risk,'caution');
 assert.equal(byId['solana:CCC3'].stage,'curve');
 assert.equal(byId['solana:CCC3'].logo,null,'placeholder images are dropped');
 assert.equal(byId['solana:CCC3'].risk,'high');
 assert.equal(scan.run.newCount,0,'nothing is new on the very first scan');
});

test('a later scan keeps first-seen times and safety results, flags new coins, and survives a failed source',async()=>{
 const safety={checkedAt:new Date(now-60000).toISOString(),source:'rugcheck',flags:[],mintable:false,freezable:false};
 const previous={coins:[{id:'solana:OLD1',chain:'solana',address:'OLD1',name:'Old',firstSeenAt:'2026-10-05T10:00:00Z',origins:['profile'],safety}]};
 const fetchJson=fake([
  ['token-profiles',[{chainId:'solana',tokenAddress:'NEW1'}]],
  ['tokens/v1/solana',url=>[pair('NEW1'),...(url.includes('OLD1')?[pair('OLD1')]:[])]],
 ]);
 const scan=await runScan({fetchJson,previous,now,safetyBudget:noSafety});
 const old=scan.coins.find(coin=>coin.id==='solana:OLD1');
 assert.equal(old.firstSeenAt,'2026-10-05T10:00:00Z');
 assert.equal(old.liquidity,50000,'coins already in the feed are re-priced');
 assert.equal(old.risk,'lower','a checked, clean coin with healthy market data reads lower risk');
 assert.deepEqual(scan.run.newIds,['solana:NEW1']);
 assert.equal(scan.run.sources.detail.boosts,'error');
});

test('safety checks run within budget, most promising first, and feed into the risk',async()=>{
 const calls=[];
 const fetchJson=fake([
  ['token-profiles',[{chainId:'solana',tokenAddress:'GOOD'},{chainId:'solana',tokenAddress:'BADD'},{chainId:'solana',tokenAddress:'DUST'}]],
  ['tokens/v1/solana',[pair('GOOD',{liquidity:{usd:90000}}),pair('BADD'),pair('DUST',{liquidity:{usd:2000}})]],
  ['rugcheck.xyz',url=>{calls.push(url);return url.includes('BADD')?{risks:[{name:'Freeze Authority still enabled',level:'danger'}],score_normalised:40}:{risks:[],score_normalised:1,lpLockedPct:100};}],
 ]);
 const scan=await runScan({fetchJson,now,safetyBudget:{rugcheck:2,goplus:0}});
 assert.equal(calls.length,2);
 assert.ok(!calls.some(url=>url.includes('DUST')),'a coin already ruled out on market data waits');
 const byId=Object.fromEntries(scan.coins.map(coin=>[coin.address,coin]));
 assert.equal(byId.GOOD.risk,'lower');
 assert.equal(byId.BADD.risk,'high');
 assert.equal(byId.BADD.steps[3].status,'fail');
 assert.match(byId.BADD.reason,/freeze/);
});

test('copies and fake market caps are caught',()=>{
 const counts=new Map([['loot',3]]);
 const fakeBtc=assess({name:'Bitcoin',symbol:'BTC',liquidity:60000,marketCap:5e9,pairCreatedAt:now-5*36e5},{now});
 assert.equal(fakeBtc.risk,'high');
 assert.ok(fakeBtc.flags.some(f=>f.key==='knownName'));
 assert.ok(fakeBtc.flags.some(f=>f.key==='inflatedCap'));
 const twin=assess({name:'Loot',symbol:'LOOT',liquidity:60000,marketCap:3e5,pairCreatedAt:now-5*36e5},{now,symbolCounts:counts});
 assert.ok(twin.flags.some(f=>f.key==='sameTicker'&&f.level==='warn'));
});

test('selling pressure, crashes and momentum',()=>{
 const dumping=assess({liquidity:60000,marketCap:3e5,pairCreatedAt:now-5*36e5,buys1h:10,sells1h:60,change1h:-70},{now});
 assert.ok(dumping.flags.some(f=>f.key==='selling'));
 assert.equal(dumping.risk,'high');
 const busy=momentumScore({liquidity:50000,volume1h:150000,volume5m:30000,buys1h:800,sells1h:200,change1h:80});
 const quiet=momentumScore({liquidity:50000,volume1h:500,volume5m:0,buys1h:3,sells1h:4,change1h:-5});
 assert.ok(busy>80&&quiet<30,`busy ${busy}, quiet ${quiet}`);
 assert.equal(momentumScore({}),null);
});

test('Rugcheck and GoPlus readings become plain flags',()=>{
 const rug=fromRugcheck({risks:[{name:'Mint Authority still enabled',level:'danger'},{name:'Something New',level:'warn'}],score_normalised:55,lpLockedPct:10},now);
 assert.equal(rug.mintable,true);
 assert.deepEqual(rug.flags.map(f=>f.level),['danger','warn']);
 assert.equal(rug.flags[1].text,'Something New');
 const evm=fromGoplusEvm({is_honeypot:'1',sell_tax:'0.25',holders:[{percent:'0.5'},{percent:'0.4',is_locked:'1'},{percent:'0.35'}],is_open_source:'1'},now);
 assert.ok(evm.honeypot);
 assert.ok(evm.flags.some(f=>f.key==='sellTax'&&f.level==='danger'));
 assert.equal(evm.top10Pct,85,'locked holdings are left out of the concentration');
 const sol=fromGoplusSolana({mintable:{status:'0'},freezable:{status:'1'}},now);
 assert.equal(sol.freezable,true);
 assert.equal(sol.flags[0].key,'freezable');
});

test('the safety queue skips fresh results and retries failures later',()=>{
 const coins=[
  {id:'a',firstSeenAt:new Date(now).toISOString(),liquidity:10,safety:{checkedAt:new Date(now-60000).toISOString(),flags:[]}},
  {id:'b',firstSeenAt:new Date(now).toISOString(),liquidity:10,safety:{failedAt:new Date(now-60000).toISOString(),flags:[]}},
  {id:'c',firstSeenAt:new Date(now).toISOString(),liquidity:10,safety:{failedAt:new Date(now-10*60000).toISOString(),flags:[]}},
  {id:'d',firstSeenAt:new Date(now).toISOString(),liquidity:10},
 ];
 assert.deepEqual(safetyQueue(coins,now).map(c=>c.id).sort(),['c','d']);
});

test('the feed drops coins older than a day and caps its size',()=>{
 const coins=Array.from({length:FEED_MAX_COINS+20},(_,i)=>({id:'c'+i,firstSeenAt:new Date(now-i*60000).toISOString()}));
 coins.push({id:'stale',firstSeenAt:new Date(now-25*36e5).toISOString()});
 const merged=mergeFeed(coins,now);
 assert.equal(merged.length,FEED_MAX_COINS);
 assert.equal(merged[0].id,'c0');
 assert.ok(!merged.some(coin=>coin.id==='stale'));
});

test('when the feed is full, older high-risk coins make room before anything else',()=>{
 const coins=Array.from({length:FEED_MAX_COINS+50},(_,i)=>({id:'c'+i,risk:i>=100&&i%2?'high':'lower',firstSeenAt:new Date(now-i*60000).toISOString()}));
 const merged=mergeFeed(coins,now);
 assert.equal(merged.length,FEED_MAX_COINS);
 assert.ok(merged.slice(0,60).every((coin,i)=>coin.id==='c'+i),'the newest coins always stay');
 assert.ok(merged.some(coin=>coin.id==='c198'),'an old lower-risk coin survives');
 assert.ok(!merged.some(coin=>coin.id==='c199'),'an old high-risk coin is dropped');
});

test('market-only risk keeps the original thresholds',()=>{
 assert.equal(marketRisk({liquidity:null,marketCap:null}),'unknown');
 assert.equal(marketRisk({liquidity:7000,marketCap:900000}),'high');
 assert.equal(marketRisk({liquidity:null,marketCap:20000}),'high');
 assert.equal(marketRisk({liquidity:50000,marketCap:900000}),'ok');
 assert.equal(fromDexPairs([]),null);
});
