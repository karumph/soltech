// Real DEX Screener identities and market-cap snapshots retrieved October 3, 2026.
// Provenance: review/feed-dexscreener-snapshot-2026-10-03.json.
// Summaries and discovery ages are fictional layout examples, not verified posts.
// These preview records never enter scanner output or saved results.
const examples = [
 {id:'bonk',name:'Bonk',symbol:'BONK',address:'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',minutesAgo:1,marketCap:336030809,summary:'A dog meme is making the rounds.'},
 {id:'popcat',name:'Popcat',symbol:'POPCAT',address:'7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',minutesAgo:3,marketCap:52486674,summary:'The popping-cat meme is back.'},
 {id:'wif',name:'dogwifhat',symbol:'$WIF',address:'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',minutesAgo:7,marketCap:252558622,summary:'Someone posted a dog in a hat.'},
 {id:'pengu',name:'Pudgy Penguins',symbol:'PENGU',address:'2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv',minutesAgo:12,marketCap:580876361,summary:'A new penguin collectible reveal.'},
 {id:'jup',name:'Jupiter',symbol:'JUP',address:'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',minutesAgo:20,marketCap:1102471354,summary:'The team teased a new trading tool.'},
 {id:'ray',name:'Raydium',symbol:'RAY',address:'4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',minutesAgo:31,marketCap:1155549364,summary:'New tools for launching tokens.'}
];
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const capFormat=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1});

export function coinFeedPreviewHTML(){
 const ordered=[...examples].sort((a,b)=>a.minutesAgo-b.minutesAgo);
 return `<section class="coin-feed" aria-labelledby="coin-feed-label" aria-describedby="feed-preview-note">
  <div class="feed-grid-heading"><h2 id="coin-feed-label">Sample feed</h2><span>Newest first</span></div>
  <p class="feed-preview-note" id="feed-preview-note">Real coins · Oct 3 market-cap snapshot. Fictional summaries &amp; discovery times.</p>
  <ol class="feed-grid" aria-label="Example coins, newest to oldest">${ordered.map(coin=>{
   return `<li><article class="feed-card" aria-labelledby="feed-coin-${coin.id}">
    <div class="feed-card-top">
     <img class="feed-coin-logo" src="assets/feed-coin-${coin.id}.png" alt="" width="36" height="36">
     <h3 class="feed-coin-name" id="feed-coin-${coin.id}">${esc(coin.name)}</h3>
     <dl class="feed-market-cap" title="Market cap"><dt><span aria-hidden="true">MC</span><span class="sr-only">Market cap</span></dt><dd>${esc(capFormat.format(coin.marketCap))}</dd></dl>
     <div class="feed-coin-meta"><span class="feed-coin-symbol">${esc(coin.symbol)}</span><div class="feed-address"><span class="feed-address-label" aria-hidden="true">CA</span><span class="sr-only">Coin address ${esc(coin.address)}</span><code class="feed-address-text" title="${esc(coin.address)}" aria-hidden="true">${esc(coin.address.slice(0,4))}…${esc(coin.address.slice(-4))}</code><button class="feed-copy-button" type="button" data-feed-copy-address="${esc(coin.address)}" data-coin-name="${esc(coin.name)}" aria-label="Copy ${esc(coin.name)} coin address" title="Copy full coin address"><span class="feed-copy-default" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg></span><span class="feed-copy-success" aria-hidden="true" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m5 12 4 4L19 6"/></svg></span></button></div><span class="feed-found-age"><span class="sr-only">Found </span>${coin.minutesAgo}m ago<span class="sr-only"> in this example</span></span></div>
    </div>
    <div class="feed-card-bottom"><p class="feed-summary">${esc(coin.summary)}</p></div>
   </article></li>`;
  }).join('')}</ol>
 </section>`;
}
