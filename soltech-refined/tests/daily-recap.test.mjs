import test from 'node:test';
import assert from 'node:assert/strict';
import {groupRecapFinds,partitionRecapFinds,formatFoundTime,exampleFinds} from '../dist/daily-recap.js';
import {coins} from '../dist/data.js';

test('recap combines the same coin across scanners, retaining match reasons and times',()=>{
  const groups=groupRecapFinds([...exampleFinds,exampleFinds[0]],coins);
  assert.equal(groups.length,4);
  const cove=groups.find(group=>group.coin.id==='cove');
  assert.equal(cove.matches.length,2);
  assert.deepEqual(cove.matches.map(match=>match.scannerId),['balanced','momentum']);
  assert.equal(cove.latestAt,'2026-09-24T14:42:00.000Z');
  assert.equal(groups[0].coin.id,'luma');
  assert.equal(groups[0].coin.risk,'unknown');
});

test('missing evidence stays missing and unknown coin IDs do not produce invented summaries',()=>{
  const groups=groupRecapFinds([{coinId:'luma',foundAt:'bad date'},{coinId:'missing',foundAt:'2026-09-24T14:42:00Z'}],coins);
  assert.equal(groups.length,1);
  assert.deepEqual(groups[0].matches,[{scannerId:null,foundAt:null,reason:null}]);
  assert.equal(formatFoundTime(groups[0].latestAt),'Time unavailable');
  assert.deepEqual(groupRecapFinds([],coins),[]);
});

test('coins with the same symbol stay separate when their identities differ',()=>{
  const catalog=[{id:'a',symbol:'SAME'},{id:'b',symbol:'SAME'}];
  assert.equal(groupRecapFinds([{coinId:'a'},{coinId:'b'}],catalog).length,2);
});

test('high-risk coins are excluded once while missing data keeps its separate visible label',()=>{
  const {visible,excluded}=partitionRecapFinds([...exampleFinds,exampleFinds.find(find=>find.coinId==='pico')],coins);
  assert.deepEqual(excluded.map(group=>group.coin.id),['pico']);
  assert.equal(visible.length,3);
  assert.ok(visible.every(group=>group.coin.risk!=='high'));
  assert.equal(visible.find(group=>group.coin.id==='luma').coin.risk,'unknown');
});
