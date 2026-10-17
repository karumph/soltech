import test from 'node:test';
import assert from 'node:assert/strict';
import {walletValuation,normalizeWalletReport,walletResultsHTML} from '../dist/wallet-check.js';

const address='So11111111111111111111111111111111111111112';
const report=(patch={})=>normalizeWalletReport({supported:true,chain:'solana',address,sol:2,solPriceUsd:100,tokens:1,shown:1,holdings:[{address,name:'Wrapped SOL',symbol:'SOL',amount:1,valueUsd:100}],...patch},address);

test('native SOL and separately held wrapped SOL both contribute exactly once',()=>{
 const data=report(),value=walletValuation(data);
 assert.equal(value.solValue,200);assert.equal(value.tokenValue,100);assert.equal(value.total,300);assert.equal(value.partial,false);
 const html=walletResultsHTML(data);
 assert.match(html,/Estimated wallet value \(USD\)<\/dt><dd>\$300\.00<\/dd>/);
 assert.match(html,/<dt>SOL<\/dt><dd>\$200\.00<small>2 SOL/);
 assert.match(html,/<dt>Tokens<\/dt><dd>\$100\.00<small>1 holding/);
 assert.doesNotMatch(html,/excludes SOL|Partial estimate/i);
});

test('missing or invalid SOL prices preserve tokens as an explicitly partial estimate',()=>{
 for(const solPriceUsd of [null,undefined,'100',0,-1,Infinity,NaN]){
  const data=report({solPriceUsd}),value=walletValuation(data);
  assert.equal(data.solPriceUsd,null);assert.equal(value.solValue,null);assert.equal(value.total,100);assert.equal(value.partial,true);
  const html=walletResultsHTML(data);assert.match(html,/Partial estimate/);assert.match(html,/SOL price unavailable; estimate excludes SOL/);
 }
});

test('zero balances are known zero but missing balances are never implied zero',()=>{
 const empty={holdings:[],shown:0,tokens:0,solPriceUsd:null};
 assert.equal(walletValuation(report({...empty,sol:0})).total,0);
 for(const sol of [null,1])assert.equal(walletValuation(report({...empty,sol})).total,null);
 assert.equal(walletValuation(report({sol:null})).total,100);
 assert.equal(walletValuation(report({sol:0,solPriceUsd:null})).total,100);
});

test('unpriced and omitted tokens do not block known SOL and remain partial',()=>{
 const unpriced=report({holdings:[{address,amount:1,valueUsd:null}]}),value=walletValuation(unpriced);
 assert.equal(value.tokenValue,null);assert.equal(value.solValue,200);assert.equal(value.total,200);assert.equal(value.partial,true);
 assert.match(walletResultsHTML(unpriced),/Excludes 1 holding without a price/);
 const omitted=report({holdings:[],shown:0,tokens:10});
 assert.equal(walletValuation(omitted).total,200);assert.equal(walletValuation(omitted).partial,true);
 assert.match(walletResultsHTML(omitted),/Showing 0 of 10 token holdings/);
});

test('overflow in a component or total cannot yield a misleading subtotal',()=>{
 const max=Number.MAX_VALUE;
 for(const data of [report({sol:max,solPriceUsd:2}),report({holdings:[{address,valueUsd:max},{address,valueUsd:max}],shown:2,tokens:2}),report({sol:max,solPriceUsd:1,holdings:[{address,valueUsd:max}]})]){
  assert.equal(walletValuation(data).total,null);assert.equal(walletValuation(data).overflow,true);
  assert.match(walletResultsHTML(data),/Combined wallet value is unavailable/);
  assert.doesNotMatch(walletResultsHTML(data),/Infinity|NaN|∞/);
 }
});

test('small native SOL values remain distinguishable from zero',()=>{
 const data=report({holdings:[],shown:0,tokens:0,sol:0.000001});
 assert.ok(Math.abs(walletValuation(data).total-0.0001)<Number.EPSILON);
 assert.match(walletResultsHTML(data),/Estimated wallet value \(USD\)<\/dt><dd>&lt;\$0\.01<\/dd>/);
});
