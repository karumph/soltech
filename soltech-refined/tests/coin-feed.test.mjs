import test from 'node:test';
import assert from 'node:assert/strict';
import {coinFeedPreviewHTML} from '../dist/coin-feed.js';

test('each visual shortened address has full accessible text matching the copy address',()=>{
 const html=coinFeedPreviewHTML(),cards=[...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(match=>match[0]);
 assert.equal(cards.length,6);
 for(const card of cards){
  const full=card.match(/data-feed-copy-address="([^"]+)"/)[1],code=card.match(/<code\b[^>]*>[\s\S]*?<\/code>/)[0];
  assert.match(code,/aria-hidden="true"/);assert.doesNotMatch(code,/aria-label=/);
  assert.ok(code.includes(full.slice(0,4)+'…'+full.slice(-4)));
  assert.ok(card.includes('<span class="sr-only">Coin address '+full+'</span>'));
  assert.match(card,/class="feed-copy-button"[^>]*type="button"/);
 }
});
