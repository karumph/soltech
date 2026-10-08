import test from 'node:test';
import assert from 'node:assert/strict';
import {createWatchlist,networkOf,WATCHLIST_KEY} from '../dist/watchlist.js';
import {lookupCoins} from '../../soltech-api/scan.mjs';

const memory=()=>{const map=new Map();return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};
const SOL='DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',BASE='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

test('addresses decide the network',()=>{
 assert.equal(networkOf(SOL),'solana');
 assert.equal(networkOf(BASE),'base');
 assert.equal(networkOf('bonk'),null);
 assert.equal(networkOf('0x123'),null);
});

test('a guest watchlist lives in this browser, without duplicates',()=>{
 const storage=memory(),list=createWatchlist({storage,account:{signedIn:()=>false}});
 assert.equal(list.add({address:SOL,name:'Bonk'}),true);
 assert.equal(list.add({address:SOL,name:'Bonk again'}),true);
 assert.equal(list.add({address:'nope'}),false);
 assert.equal(list.list.length,1);
 assert.equal(JSON.parse(storage.getItem(WATCHLIST_KEY))[0].id,`solana:${SOL}`);
 assert.equal(list.toggle({address:SOL}),false);
 assert.equal(list.list.length,0);
 assert.equal(createWatchlist({storage}).list.length,0,'removal is saved');
});

test('signing in merges the browser list into the account and saves the union',async()=>{
 const storage=memory();
 storage.setItem(WATCHLIST_KEY,JSON.stringify([{address:SOL,addedAt:'2026-10-05T10:00:00Z'}]));
 const saved=[];
 const account={signedIn:()=>true,loadWatchlist:async()=>({coins:[{address:BASE,addedAt:'2026-10-05T11:00:00Z'}]}),saveWatchlist:async coins=>{saved.push(coins);return {coins};}};
 const list=createWatchlist({storage,account});
 await list.sync();
 assert.deepEqual(list.list.map(item=>item.chain),['base','solana'],'newest first');
 assert.equal(saved.at(-1).length,2);
});

test('lookup prices requested coins and reports ones no market has yet',async()=>{
 const fetchJson=async url=>{
  if(url.includes('tokens/v1/solana'))return [{chainId:'solana',dexId:'raydium',baseToken:{address:SOL,name:'Bonk',symbol:'Bonk'},liquidity:{usd:400000},marketCap:3e8,pairCreatedAt:Date.now()-1000*864e5}];
  if(url.includes('geckoterminal'))return {data:[]};
  if(url.includes('rugcheck'))return {risks:[],score_normalised:1,lpLockedPct:100};
  return [];
 };
 const coins=await lookupCoins({fetchJson,coins:[{address:SOL},{address:BASE},{address:'junk'}]});
 assert.equal(coins.length,2,'invalid addresses are dropped');
 const bonk=coins.find(coin=>coin.chain==='solana');
 assert.equal(bonk.found,true);assert.equal(bonk.risk,'lower','an old, checked coin is not mistaken for a copy');assert.equal(bonk.steps.length,4);
 assert.equal(coins.find(coin=>coin.chain==='base').found,false);
});
