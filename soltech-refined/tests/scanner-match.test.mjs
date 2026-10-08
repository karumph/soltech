import test from 'node:test';
import assert from 'node:assert/strict';
import {matchCoin,matchScan,scannerLimits} from '../dist/scanner-match.js';
import {defaultPersonalScanner} from '../dist/personal-scanner-store.js';

const hour=36e5;
const coin=(extra={})=>({id:'solana:A',chain:'solana',risk:'lower',liquidity:50000,marketCap:200000,volume24h:90000,pairCreatedAt:Date.now()-2*hour,...extra});

test('default scanner keeps coins under a day old and leaves high risk out',()=>{
 const config=defaultPersonalScanner();
 assert.equal(matchCoin(coin(),config).match,true);
 assert.equal(matchCoin(coin({risk:'high'}),config).match,false);
 assert.match(matchCoin(coin({risk:'high'}),config).reason,/High risk/);
 assert.equal(matchCoin(coin({pairCreatedAt:Date.now()-30*hour}),config).match,false);
 assert.equal(matchCoin(coin({risk:'unknown'}),config).match,true);
});

test('coin preferences apply and missing data is never a pass',()=>{
 const config=defaultPersonalScanner();
 config.resultFilters.liquidityMin='10000';config.resultFilters.capMax='500000';config.resultFilters.volumeMin='1000';
 assert.equal(matchCoin(coin(),config).match,true);
 assert.equal(matchCoin(coin({liquidity:2000}),config).reason,'Liquidity $2K, under $10K');
 assert.equal(matchCoin(coin({liquidity:null}),config).reason,'Liquidity not reported');
 assert.equal(matchCoin(coin({marketCap:900000}),config).match,false);
 assert.equal(matchCoin(coin({marketCap:null,fdv:300000}),config).match,true,'FDV stands in for a missing market cap');
 assert.equal(matchCoin(coin({volume24h:null}),config).match,false);
});

test('networks, turning New coins off, and settings the scan cannot read',()=>{
 const config=defaultPersonalScanner();
 config.networks=['base'];
 assert.equal(matchCoin(coin(),config).match,false);
 assert.equal(matchCoin(coin({chain:'base'}),config).match,true);
 config.sources.projects.enabled=false;
 assert.equal(matchCoin(coin({chain:'base'}),config).match,false);
 const other=defaultPersonalScanner();other.sources.projects.settings.holdersMin='100';
 assert.deepEqual(scannerLimits(other).unsupported,['Holders']);
 assert.equal(matchCoin(coin(),other).match,true,'an unreadable limit is reported, not silently enforced');
});

test('matchScan splits a scan and counts agree',()=>{
 const config=defaultPersonalScanner();
 const result=matchScan([coin({id:'a'}),coin({id:'b',risk:'high'}),coin({id:'c'})],config);
 assert.deepEqual(result.matched.map(item=>item.coin.id),['a','c']);
 assert.deepEqual(result.skipped.map(item=>item.coin.id),['b']);
 assert.equal(result.projectsOn,true);
});
