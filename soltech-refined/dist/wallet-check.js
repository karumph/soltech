// Check a wallet: every coin in a Solana wallet, run through Soltech's checks. Read-only, from the address alone.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usdFmt=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
const compact=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1});
const qty=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2});
const riskWord={lower:'Lower risk',caution:'Caution',high:'High risk',unknown:'Not assessed'};
const flagWord={mintable:'creator can still mint more',freezable:'creator can freeze holders’ tokens',permanentDelegate:'someone can move holders’ tokens',balanceMutable:'balances can be changed',honeypot:'selling may be blocked',nonTransferable:'can’t be transferred',defaultFrozen:'new holders start frozen',transferFee:'transfers carry a fee'};
const logoHosts=/(^|\.)(dexscreener\.com|geckoterminal\.com|coingecko\.com|ipfs\.io|pump\.fun|arweave\.net)$/i;
const safeLogo=url=>{try{const link=new URL(url);return link.protocol==='https:'&&logoHosts.test(link.hostname)?link.href:'';}catch{return '';}};
const KEY='soltech.wallet-last.v1';

export const checkTabsHTML=active=>`<nav class="check-tabs" aria-label="What to check"><a href="#check" ${active==='coin'?'aria-current="page"':''}>Coin</a><a href="#wallet" ${active==='wallet'?'aria-current="page"':''}>Wallet</a></nav>`;

function rowHTML(h){
 const logo=safeLogo(h.logo),initial=esc((String(h.name||h.symbol||'?').match(/[\p{L}\p{N}]/u)||['?'])[0].toUpperCase());
 const top=(h.flags||[]).find(f=>f.level==='danger')||(h.flags||[]).find(f=>f.level==='warn');
 return `<li class="wallet-row risk-${esc(h.found?h.risk:'none')}"><span class="signal-badge" aria-hidden="true">${initial}${logo?`<img src="${esc(logo)}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.remove()">`:''}</span>
  <span class="wallet-coin"><strong>${esc(h.symbol||h.name||h.address.slice(0,6)+'…')}</strong><span>${esc(h.found?(top?.text||(h.risk==='lower'?'No concerns found in Soltech’s checks':h.reason||'')):'No market has this coin. Often a spam airdrop.')}</span></span>
  <span class="wallet-amount"><strong>${h.valueUsd!=null?esc(h.valueUsd>=1000?compact.format(h.valueUsd):usdFmt.format(h.valueUsd)):'—'}</strong><span>${esc(qty.format(h.amount))} ${esc(h.symbol||'')}</span></span>
  <span class="wallet-side">${h.found?`<span class="risk ${esc(h.risk)}"><span class="risk-dot" aria-hidden="true"></span>${riskWord[h.risk]||riskWord.unknown}</span>`:'<span class="risk unknown"><span class="risk-dot" aria-hidden="true"></span>No market</span>'}<a class="feed-check-link" href="#check/solana/${esc(h.address)}">Check</a></span></li>`;
}

export function mountWalletCheck(main){
 document.title='Check a wallet · Soltech';
 let data=null,filter='all',busy=false,job=0;
 let last='';try{last=sessionStorage.getItem(KEY)||'';}catch{}
 main.innerHTML=`<section class="checker wallet-check"><div class="checker-intro">${checkTabsHTML('wallet')}<h1>Check a wallet<span class="accent">.</span></h1><p>Paste a Solana wallet address to run every coin in it through Soltech’s checks.</p></div>
  <form class="coin-check-form wallet-form" novalidate><div class="check-label"><label for="wallet-address">Wallet address</label></div><div class="check-input-row"><div class="check-address-input"><input id="wallet-address" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="64" placeholder="Paste a Solana wallet address" value="${esc(last)}" aria-describedby="wallet-error"></div><button type="submit" class="button glass">Check wallet</button></div><p id="wallet-error" class="field-error" role="alert" hidden></p><details class="check-privacy"><summary>What this can and can’t see</summary><p>Wallet addresses are public, so this only reads what anyone can see on the blockchain. You never connect a wallet or sign anything, and Soltech doesn’t save the address. Base wallets are coming later.</p></details></form>
  <p class="lookup-status" role="status" aria-live="polite"></p><div id="wallet-result"></div></section>`;
 const form=main.querySelector('.wallet-form'),input=main.querySelector('#wallet-address'),error=main.querySelector('#wallet-error'),status=main.querySelector('.lookup-status'),out=main.querySelector('#wallet-result');
 function render(){
  if(!data){out.innerHTML='';return;}
  const r=data.risk,flagged=Object.entries(data.flagged||{});
  const list=data.holdings.filter(h=>filter==='all'||(filter==='nomarket'?!h.found:h.found&&h.risk===filter));
  out.innerHTML=`<div class="wallet-summary">
    <div><span>Value of priced coins</span><strong>${esc(compact.format(data.totalValue||0))}</strong></div>
    <div><span>Coins</span><strong>${esc(data.tokens)}</strong>${data.shown<data.tokens?`<em>Checked the first ${esc(data.shown)}</em>`:''}</div>
    <div class="is-high"><span>High risk</span><strong>${esc(r.high)}</strong></div>
    <div><span>SOL</span><strong>${esc(qty.format(data.sol||0))}</strong></div>
   </div>
   ${flagged.length?`<p class="wallet-alert"><strong>Worth a look:</strong> ${flagged.map(([k,n])=>`${n} ${n===1?'coin':'coins'} where the ${esc(flagWord[k]||k)}`).join('; ')}.</p>`:data.tokens?'<p class="wallet-ok">No coin in this wallet lets its creator mint more, freeze holders or block selling.</p>':''}
   <div class="wallet-filters" role="group" aria-label="Show">${[['all','All',data.holdings.length],['high','High risk',r.high],['caution','Caution',r.caution],['lower','Lower risk',r.lower],['nomarket','No market',data.noMarket]].map(([k,l,n])=>`<button type="button" data-wallet-filter="${k}" aria-pressed="${filter===k}">${l} <span>${n}</span></button>`).join('')}</div>
   ${list.length?`<ol class="wallet-list">${list.map(rowHTML).join('')}</ol>`:'<p class="signal-empty">Nothing here.</p>'}
   <p class="feed-disclaimer">Values use each coin’s current DEX price. Coins with no market are usually worthless airdrops; don’t interact with links they carry.</p>`;
 }
 async function run(address){
  const id=++job;busy=true;error.hidden=true;status.textContent='Reading the wallet and checking every coin…';out.innerHTML='<ol class="feed-grid feed-skeleton" aria-hidden="true">'+'<li><div class="feed-card"></div></li>'.repeat(3)+'</ol>';
  try{
   const response=await fetch(`${window.SOLTECH_API||''}/wallet`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address})});
   const body=await response.json().catch(()=>({}));
   if(id!==job)return;
   if(!response.ok)throw new Error(body.error||'That wallet couldn’t be read. Try again in a minute.');
   data=body;filter='all';status.textContent=body.tokens?`Checked ${body.shown} ${body.shown===1?'coin':'coins'}.`:'This wallet holds no coins besides SOL.';render();
  }catch(err){if(id===job){data=null;out.innerHTML='';status.textContent='';error.textContent=err.message;error.hidden=false;}}
  finally{if(id===job)busy=false;}
 }
 const onSubmit=e=>{
  e.preventDefault();if(busy)return;
  const address=input.value.trim();
  if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)){error.textContent=/^0x/i.test(address)?'Wallet checks cover Solana for now. Base wallets are coming.':'Paste a full Solana wallet address.';error.hidden=false;input.focus();return;}
  try{sessionStorage.setItem(KEY,address);}catch{}
  run(address);
 };
 const onClick=e=>{const b=e.target.closest('[data-wallet-filter]');if(b){filter=b.dataset.walletFilter;render();main.querySelector(`[data-wallet-filter="${filter}"]`)?.focus({preventScroll:true});}};
 form.addEventListener('submit',onSubmit);main.addEventListener('click',onClick);
 return ()=>{job++;form.removeEventListener('submit',onSubmit);main.removeEventListener('click',onClick);};
}
