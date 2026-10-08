import test from 'node:test';
import assert from 'node:assert/strict';
import {checkWallet} from '../../soltech-api/wallet.mjs';
import {assess,isEstablished} from '../../soltech-api/assess.mjs';

const now=Date.parse('2026-10-05T12:00:00Z');
const day=864e5;

test('a wallet lists every token, prices it, checks it, and adds up what it holds',async()=>{
 const tokenAccount=(mint,amount)=>({account:{data:{parsed:{info:{mint,tokenAmount:{uiAmount:amount}}}}}});
 const postJson=async(url,body)=>{
  if(body.method==='getBalance')return {result:{value:2_500_000_000}};
  if(body.method==='getTokenAccountsByOwner')return {result:{value:body.params[1].programId.startsWith('Tokenkeg')?[tokenAccount('GoodMint11111111111111111111111111',100),tokenAccount('GoodMint11111111111111111111111111',50),tokenAccount('SPAMMint11111111111111111111111111',1e9),tokenAccount('ZEROMint11111111111111111111111111',0)]:[tokenAccount('RUGMint111111111111111111111111111',10)]}};
  if(body.method==='getMultipleAccounts')return {result:{value:body.params[0].map(m=>({owner:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',data:{parsed:{type:'mint',info:{mintAuthority:m.startsWith('RUG')?'Dev':null,freezeAuthority:null,supply:'1',decimals:0}}}}))}};
  throw new Error('unexpected '+body.method);
 };
 const pair=(address,price)=>({chainId:'solana',dexId:'raydium',pairAddress:'P'+address,baseToken:{address,symbol:address.slice(0,4)},priceUsd:String(price),liquidity:{usd:90000},marketCap:900000,pairCreatedAt:now-10*day});
 const fetchJson=async url=>{
  if(url.includes('tokens/v1/solana'))return [pair('GoodMint11111111111111111111111111',2),pair('RUGMint111111111111111111111111111',1)];
  if(url.includes('geckoterminal'))return {data:[]};
  if(url.includes('rugcheck'))return {risks:[]};
  throw new Error('404');
 };
 const w=await checkWallet({fetchJson,postJson,address:'5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9',now});
 assert.equal(w.supported,true);
 assert.equal(w.sol,2.5);
 assert.equal(w.tokens,3,'zero balances are left out');
 assert.equal(w.holdings[0].symbol,'Good','sorted by value');
 assert.equal(w.holdings[0].amount,150,'two accounts for one token add up');
 assert.equal(w.totalValue,310);
 assert.equal(w.noMarket,1);
 assert.deepEqual(w.flagged,{mintable:1});
 assert.equal(w.risk.high,1);
 const base=await checkWallet({fetchJson,postJson,address:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',now});
 assert.equal(base.supported,false);
});

test('established coins: issuer controls and hidden liquidity are notes, not alarms',()=>{
 const staked={pairCreatedAt:now-700*day,marketCap:1.2e9,liquidity:750,safety:{checkedAt:new Date(now).toISOString(),chainAt:new Date(now).toISOString(),flags:[{key:'mintable',level:'danger',text:'x'}]}};
 assert.equal(isEstablished(staked,now),true);
 const read=assess(staked,{now});
 assert.equal(read.risk,'lower');
 assert.ok(read.flags.every(f=>f.level==='info'));
 const fresh=assess({...staked,pairCreatedAt:now-2*day},{now});
 assert.equal(fresh.risk,'high','the same controls on a new coin are a red flag');
});
