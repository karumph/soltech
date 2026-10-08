import test from 'node:test';
import assert from 'node:assert/strict';
import {coinFeedLiveHTML,coinFeedLoadingHTML,coinFeedErrorHTML} from '../dist/coin-feed-live.js';

const now=Date.parse('2026-10-05T12:00:00Z');
const scan={updatedAt:'2026-10-05T11:58:00Z',coins:[
 {id:'solana:OlderAddr1111111111111111111111111111111111',name:'Older',symbol:'OLD',chain:'solana',risk:'caution',reason:'Liquidity is present.',marketCap:310000,url:'https://dexscreener.com/solana/abc',firstSeenAt:'2026-10-05T09:00:00Z'},
 {id:'base:0xNewerAddr',name:'<Newer>',symbol:'NEW',category:'base',risk:'high',reason:'Too thin.',url:'javascript:alert(1)',firstSeenAt:'2026-10-05T11:58:00Z'}
]};

test('live Feed lists scan coins newest first with real values only',()=>{
 const html=coinFeedLiveHTML(scan,now),cards=[...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(match=>match[0]);
 assert.equal(cards.length,2);
 assert.match(cards[0],/&lt;Newer&gt;/);assert.match(cards[0],/High risk/);assert.match(cards[0],/Base/);
 assert.match(cards[0],/Not reported/,'a missing market cap is never invented');
 assert.doesNotMatch(cards[0],/href="(?!#check\/)/,'only Dexscreener https links and in-app check links are rendered');
 assert.doesNotMatch(cards[0],/javascript:/);
 assert.match(cards[0],/href="#check\/base\/0xNewerAddr"/);
 assert.match(cards[1],/data-feed-copy-address="OlderAddr1111111111111111111111111111111111"/);
 assert.match(cards[1],/\$310(\.0)?K/);assert.match(cards[1],/href="https:\/\/dexscreener\.com\/solana\/abc"/);assert.match(cards[1],/3h ago/);
 assert.match(html,/Scanned 2m ago/);
 assert.doesNotMatch(html,/Sample feed|Fictional/);
});

test('live Feed states keep the slot the loader replaces',()=>{
 for(const html of [coinFeedLoadingHTML(),coinFeedErrorHTML(),coinFeedLiveHTML({coins:[]},now)])assert.match(html,/id="live-feed"/);
 assert.match(coinFeedLiveHTML({coins:[]},now),/has not returned coins/);
});
