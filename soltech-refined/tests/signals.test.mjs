import test from 'node:test';
import assert from 'node:assert/strict';
import {signalBoards,readSignals,signalModules,SIGNALS_KEY} from '../dist/signals.js';
import {readCurve} from '../../soltech-api/onchain.mjs';

const now=Date.parse('2026-10-05T12:00:00Z');
const coin=(id,extra={})=>({id,risk:'caution',firstSeenAt:new Date(now).toISOString(),pairCreatedAt:now-36e5,flags:[],...extra});

test('boards pick the right coins in the right order',()=>{
 const boards=signalBoards([
  coin('near',{curve:{progress:91,sol:77,targetSol:85,complete:false}}),
  coin('half',{curve:{progress:55,sol:47,targetSol:85,complete:false}}),
  coin('early',{curve:{progress:20,sol:17,targetSol:85,complete:false}}),
  coin('done',{curve:{progress:100,complete:true}}),
  coin('jump',{momentum:70,momentumPrev:30}),
  coin('busy',{momentum:88,momentumPrev:85}),
  coin('busyBad',{momentum:95,momentumPrev:20,risk:'high'}),
  coin('clean',{risk:'lower',momentum:40}),
  coin('oldClean',{risk:'lower',pairCreatedAt:now-30*36e5}),
  coin('minty',{risk:'high',flags:[{key:'mintable',level:'danger'}]}),
  coin('copy',{flags:[{key:'knownName',level:'danger'}]}),
  coin('twin',{flags:[{key:'sameTicker',level:'info'}]}),
 ],now);
 assert.deepEqual(boards.graduating.map(c=>c.id),['near','half']);
 assert.deepEqual(boards.surges.map(c=>c.id),['jump','busy'],'high-risk coins stay off the discovery boards');
 assert.deepEqual(boards.clean.map(c=>c.id),['clean']);
 assert.deepEqual(boards.contract.map(c=>c.id),['minty']);
 assert.deepEqual(boards.copycats.map(c=>c.id),['copy'],'one other coin sharing a ticker is only a note');
});

test('switches default sensibly and keep what the person chose',()=>{
 const mem=new Map();const storage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v)};
 const defaults=readSignals(storage);
 assert.equal(defaults.graduating,true);
 assert.equal(defaults.influencers,false);
 mem.set(SIGNALS_KEY,JSON.stringify({graduating:false,influencers:true,bogus:true}));
 const saved=readSignals(storage);
 assert.equal(saved.graduating,false);assert.equal(saved.influencers,true);
 assert.deepEqual(Object.keys(saved),signalModules.map(m=>m.key));
});

test('launchpad progress is worked out from the curve itself',()=>{
 const b=Buffer.alloc(49);
 // Standard pump.fun start: 1,073,000,000 virtual tokens and 30 virtual SOL; real tokens 793,100,000.
 const vt0=1073000000000000n,vs0=30000000000n,offset=vt0-793100000000000n;
 const half=offset+396550000000000n; // half the real tokens sold
 b.writeBigUInt64LE(half,8);b.writeBigUInt64LE(vt0*vs0/half,16);b.writeBigUInt64LE(396550000000000n,24);b.writeBigUInt64LE(vt0*vs0/half-vs0,32);b[48]=0;
 const curve=readCurve(b.toString('base64'));
 assert.ok(Math.abs(curve.targetSol-85)<1,`target ${curve.targetSol}`);
 assert.ok(curve.progress>20&&curve.progress<40,`progress ${curve.progress}`);
 b[48]=1;assert.equal(readCurve(b.toString('base64')).progress,100);
});
