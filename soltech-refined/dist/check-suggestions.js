// Hosted Check page: a short row of the newest coins from your scanner, each one tap away from a full check.
import {subscribeLiveScan,liveScanAvailable} from './live-scan.js';
import {matchScan} from './scanner-match.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const logoHosts=/(^|\.)(dexscreener\.com|geckoterminal\.com|coingecko\.com|ipfs\.io|pump\.fun|arweave\.net)$/i;
const safeLogo=url=>{try{const link=new URL(url);return link.protocol==='https:'&&logoHosts.test(link.hostname)?link.href:'';}catch{return '';}};
const compact=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1});

export function mountCheckSuggestions(main,{getConfig}){
 if(!liveScanAvailable())return ()=>{};
 const checker=main.querySelector('.checker');if(!checker)return ()=>{};
 const host=document.createElement('section');
 host.className='check-suggestions';host.setAttribute('aria-labelledby','check-suggestions-title');host.hidden=true;
 checker.append(host);
 // Wide screens: what a check covers, under the form, so the page explains itself before the first lookup.
 const explainer=document.createElement('section');
 explainer.className='check-explainer';explainer.setAttribute('aria-label','What a check covers');
 explainer.innerHTML=[['Market','Price, liquidity, volume and market cap from Dexscreener.'],['Risk','Rugcheck on Solana, GoPlus on other networks. Missing data is never counted as safe.'],['History','Price history from GeckoTerminal, with ranges from one hour to all time.']].map(([title,text])=>`<div><h2>${title}</h2><p>${text}</p></div>`).join('');
 checker.append(explainer);
 const unsubscribe=subscribeLiveScan(state=>{
  if(!state.scan)return;
  // Hide once a report is showing, so the result stays the focus.
  if(main.querySelector('#live-result')?.children.length){host.hidden=true;return;}
  const {matched}=matchScan(state.scan.coins,getConfig());
  const picks=matched.map(item=>item.coin).sort((a,b)=>(Date.parse(b.firstSeenAt)||0)-(Date.parse(a.firstSeenAt)||0)).slice(0,6);
  host.hidden=!picks.length;
  host.innerHTML=`<div class="check-suggestions-head"><h2 id="check-suggestions-title">Fresh from your scanner</h2><a href="#finds">Open Feed</a></div><ul>${picks.map(coin=>{const logo=safeLogo(coin.logo),initial=esc((String(coin.name||coin.symbol||'?').match(/[\p{L}\p{N}]/u)||['?'])[0].toUpperCase());return `<li><a href="#check/${esc(coin.chain)}/${esc(coin.address)}"><span class="check-suggestion-logo" aria-hidden="true">${initial}${logo?`<img src="${esc(logo)}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.remove()">`:''}</span><span class="check-suggestion-copy"><strong>${esc(coin.symbol||coin.name)}</strong><span>${coin.marketCap||coin.fdv?`MC ${esc(compact.format(coin.marketCap||coin.fdv))}`:'MC not reported'} · ${coin.chain==='base'?'Base':'Solana'}</span></span></a></li>`;}).join('')}</ul>`;
 });
 const observer=new MutationObserver(()=>{const busy=!!main.querySelector('#live-result')?.children.length;if(busy)host.hidden=true;explainer.hidden=busy;});
 const result=main.querySelector('#live-result');if(result)observer.observe(result,{childList:true});
 return ()=>{unsubscribe();observer.disconnect();host.remove();explainer.remove();};
}
