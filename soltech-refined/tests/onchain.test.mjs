import test from 'node:test';
import assert from 'node:assert/strict';
import {fromMintAccount,readMints,holderShare,holderFlags,rpcClient} from '../../soltech-api/onchain.mjs';
import {runScan} from '../../soltech-api/scan.mjs';

const now=Date.parse('2026-10-05T12:00:00Z');
const TOKEN_2022='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

test('mint accounts become plain flags, including Token-2022 extensions',()=>{
 const clean=fromMintAccount({mintAuthority:null,freezeAuthority:null,supply:'1000000000',decimals:6},'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',now);
 assert.deepEqual(clean.flags,[]);
 assert.equal(clean.supply,1000);
 const risky=fromMintAccount({mintAuthority:'Creator',freezeAuthority:'Creator',supply:'1',decimals:0,extensions:[
  {extension:'transferFeeConfig',state:{newerTransferFee:{transferFeeBasisPoints:800}}},
  {extension:'permanentDelegate',state:{delegate:'Someone'}},
  {extension:'transferHook',state:{programId:'Hook'}},
  {extension:'tokenMetadata',state:{updateAuthority:'Creator'}},
 ]},TOKEN_2022,now);
 assert.equal(risky.program,'token-2022');
 assert.deepEqual(risky.flags.map(f=>`${f.key}:${f.level}`),['mintable:danger','freezable:danger','transferFee:danger','transferHook:warn','permanentDelegate:danger','mutableMetadata:info']);
 assert.match(risky.flags[2].text,/8% fee/);
});

test('one RPC call reads up to 100 mints and skips accounts that are not mints',async()=>{
 const calls=[];
 const rpc=rpcClient(async(url,body)=>{calls.push(body.params[0].length);return {result:{value:body.params[0].map((mint,i)=>i===1?null:{owner:TOKEN_2022,data:{parsed:{type:'mint',info:{mintAuthority:null,freezeAuthority:null,supply:'5',decimals:0}}}})}};});
 const mints=Array.from({length:150},(_,i)=>'M'+i);
 const read=await readMints(rpc,mints,now);
 assert.deepEqual(calls,[100,50]);
 assert.equal(read.size,148);
});

test('RPC errors carry the 429 code so callers can stop',async()=>{
 const rpc=rpcClient(async()=>({error:{code:429,message:'Too many requests'}}));
 await assert.rejects(rpc('getTokenLargestAccounts',['x']),/^Error: 429/);
});

test('holder share leaves out pools and launchpad curves',async()=>{
 const rpc=async(method,params)=>method==='getTokenLargestAccounts'
  ?{value:[{address:'A1',uiAmount:500},{address:'A2',uiAmount:200},{address:'A3',uiAmount:100}]}
  :{value:params[0].map(a=>({data:{parsed:{info:{owner:{A1:'PoolAddress',A2:'Whale',A3:'Someone'}[a]}}}}))};
 const share=await holderShare(rpc,'MINT',{supply:1000,pools:['PoolAddress']});
 assert.deepEqual(share,{top10Pct:30,largestPct:20});
 assert.deepEqual(holderFlags(share).map(f=>f.key),['singleHolder']);
});

test('the scan reads every Solana coin from the chain and saves third-party calls for history',async()=>{
 const pair=(address,liq)=>({chainId:'solana',dexId:'raydium',pairAddress:'P'+address,baseToken:{address,name:address,symbol:address},liquidity:{usd:liq},marketCap:400000,txns:{h1:{buys:10,sells:5}},pairCreatedAt:now-5*36e5});
 const fetched=[];
 const fetchJson=async url=>{fetched.push(url);
  if(url.includes('token-profiles'))return [{chainId:'solana',tokenAddress:'GOOD'},{chainId:'solana',tokenAddress:'MINTY'},{chainId:'solana',tokenAddress:'DUST'}];
  if(url.includes('tokens/v1/solana'))return [pair('GOOD',90000),pair('MINTY',80000),pair('DUST',1000)];
  if(url.includes('rugcheck'))return {risks:[{name:'Mint Authority still enabled',level:'danger'}],score_normalised:1,lpLockedPct:100};
  throw new Error('404 '+url);
 };
 const postJson=async(url,body)=>({result:{value:body.params[0].map(mint=>({owner:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',data:{parsed:{type:'mint',info:{mintAuthority:mint==='MINTY'?'Creator':null,freezeAuthority:null,supply:'1000',decimals:0}}}}))}});
 const scan=await runScan({fetchJson,postJson,now,safetyBudget:{rugcheck:1,goplus:0,holders:0}});
 const byId=Object.fromEntries(scan.coins.map(c=>[c.address,c]));
 assert.equal(scan.run.safety.onChain,3,'every coin, even ones ruled out on market data');
 assert.equal(byId.MINTY.risk,'high');
 assert.equal(byId.MINTY.steps[3].status,'fail');
 assert.equal(fetched.filter(u=>u.includes('rugcheck')).length,1,'Rugcheck only for the most promising coin');
 assert.ok(fetched.some(u=>u.includes('rugcheck')&&u.includes('GOOD')));
 assert.equal(byId.GOOD.safety.mintable,false,'the chain read wins over an older third-party reading');
 assert.equal(byId.GOOD.risk,'lower','chain plus history check makes a clean coin lower risk');
 assert.equal(byId.DUST.risk,'high');
});
