import {safeImageUrl,validMint} from './coin-checker-data.js';
import {getRecentWalletStore,recentWalletsHTML} from './wallet-recent.js';
import {mountWalletTransactions} from './wallet-transactions.js';
import {mountWalletHoldingLogos} from './wallet-holding-logos.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
const compact=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1});
const quantity=new Intl.NumberFormat('en-US',{maximumSignificantDigits:6});
const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;

export const validWalletAddress=validMint;

export const checkTabsHTML=active=>`<nav class="check-tabs" data-active-index="${active==='wallet'?1:0}" aria-label="What to check"><span class="check-switch-glass" aria-hidden="true"></span><a href="#check" ${active==='coin'?'aria-current="page"':''}>Coin</a><a href="#wallet" ${active==='wallet'?'aria-current="page"':''}>Wallet</a></nav>`;

export function normalizeWalletReport(body,address){
 if(!validWalletAddress(address)||!body||body.supported!==true||body.chain!=='solana'||body.address!==address||!Array.isArray(body.holdings)||body.holdings.length>150||!Number.isInteger(body.tokens)||body.tokens<0||body.tokens<body.holdings.length||body.shown!==body.holdings.length)throw new Error('The wallet service returned an incomplete response. Try again.');
 const holdings=body.holdings.map(coin=>{
  if(!coin||!validWalletAddress(coin.address))throw new Error('The wallet service returned an incomplete response. Try again.');
  return {...coin,name:String(coin.name||coin.symbol||'Unknown coin'),symbol:String(coin.symbol||''),risk:['high','caution','lower','unknown'].includes(coin.risk)?coin.risk:'unknown',amount:finite(coin.amount)?coin.amount:null,valueUsd:finite(coin.valueUsd)?coin.valueUsd:null,found:coin.found===true,flags:Array.isArray(coin.flags)?coin.flags:[]};
 });
 return {...body,holdings,sol:finite(body.sol)?body.sol:null,solPriceUsd:finite(body.solPriceUsd)&&body.solPriceUsd>0?body.solPriceUsd:null};
}

const usd=value=>value===null?'—':value>0&&value<.01?'<$0.01':money.format(value);
export function walletValuation(data){
 const priced=data.holdings.filter(coin=>finite(coin.valueUsd));
 const tokenSum=priced.reduce((sum,coin)=>sum+coin.valueUsd,0);
 const tokenValue=finite(tokenSum)&&(priced.length||data.tokens===0)?tokenSum:null;
 const solKnown=finite(data.sol),priceKnown=finite(data.solPriceUsd)&&data.solPriceUsd>0;
 const solProduct=solKnown?(data.sol===0?0:priceKnown?data.sol*data.solPriceUsd:null):null;
 const solValue=finite(solProduct)?solProduct:null;
 const overflow=!finite(tokenSum)||(solProduct!==null&&!finite(solProduct));
 const sum=(tokenValue??0)+(solValue??0);
 const unpriced=data.holdings.length-priced.length;
 const partial=unpriced>0||data.tokens>data.holdings.length||solValue===null;
 const total=!overflow&&(tokenValue!==null||solValue!==null)&&finite(sum)&&(sum>0||!partial)?sum:null;
 return {total,tokenValue,solValue,unpriced,overflow:overflow||!finite(sum),partial};
}
async function copyToClipboard(value){
 if(!globalThis.navigator?.clipboard?.writeText)throw new Error('Clipboard unavailable');
 await globalThis.navigator.clipboard.writeText(value);
}
function walletIdentityHTML(address){
 if(!validWalletAddress(address))return '<p class="wallet-note">Wallet address unavailable.</p>';
 return `<div class="wallet-identity"><div class="wallet-identity-copy"><small>Solana wallet</small><code data-wallet-address title="${esc(address)}" aria-label="Public wallet address ${esc(address)}">${esc(address.slice(0,6)+'…'+address.slice(-6))}</code></div><button type="button" class="wallet-identity-action" data-copy-wallet-address>Copy address</button><p class="wallet-copy-status" data-wallet-copy-status role="status" aria-live="polite"></p></div>`;
}
function rowHTML(coin){
 const logo=safeImageUrl(coin.logo),name=coin.name||coin.symbol,amount=coin.amount===null?'Quantity unavailable':quantity.format(coin.amount);
 const initial=Array.from(name)[0]||'?';
 return `<li class="wallet-row"><span class="wallet-coin-logo" data-wallet-token-logo="${esc(coin.address)}" aria-hidden="true"><span>${esc(initial)}</span>${logo?`<img src="${esc(logo)}" alt="" width="32" height="32" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:''}</span><div class="wallet-coin"><strong title="${esc(name)}">${esc(name)}</strong><small>${esc(coin.symbol||coin.address.slice(0,4)+'…'+coin.address.slice(-4))}</small></div><div class="wallet-amount"><strong title="${esc(coin.valueUsd===null?'USD value unavailable':usd(coin.valueUsd))}">${esc(coin.valueUsd!==null&&coin.valueUsd>=10000?compact.format(coin.valueUsd):usd(coin.valueUsd))}</strong><small><span class="sr-only">Quantity: </span>${esc(amount)}</small></div><a class="wallet-check-link" href="#check/solana/${esc(coin.address)}" aria-label="Details for ${esc(name)}" title="Coin details"><span class="sr-only">Details</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></a></li>`;
}

export function walletResultsHTML(data){
 const list=[...data.holdings].sort((a,b)=>a.valueUsd===null?(b.valueUsd===null?0:1):b.valueUsd===null?-1:b.valueUsd-a.valueUsd);
 const value=walletValuation(data);
 const checkedAt=Date.parse(data.checkedAt),date=Number.isFinite(checkedAt)?new Date(checkedAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'';
 const partial=data.tokens>data.holdings.length;
 const notes=[];
 if(value.solValue===null&&!value.overflow)notes.push(finite(data.sol)?'SOL price unavailable; estimate excludes SOL.':'SOL balance unavailable; estimate excludes SOL.');
 if(value.unpriced)notes.push(`Excludes ${value.unpriced} ${value.unpriced===1?'holding':'holdings'} without a price.`);
 const estimateNote=value.total===null?'Value unavailable':value.partial?'Partial estimate':'';
 return `<div class="wallet-results-head"><h2>Wallet overview</h2>${date?`<span>Updated ${esc(date)}</span>`:''}</div>${walletIdentityHTML(data.address)}<dl class="wallet-summary"><div><dt>Estimated wallet value (USD)</dt><dd>${esc(usd(value.total))}${estimateNote?`<small>${estimateNote}</small>`:''}</dd></div><div><dt>SOL</dt><dd>${esc(usd(value.solValue))}<small>${finite(data.sol)?esc(quantity.format(data.sol))+' SOL':'Balance unavailable'}</small></dd></div><div><dt>Tokens</dt><dd>${esc(usd(value.tokenValue))}<small>${data.holdings.length}${partial?` of ${data.tokens}`:''} ${data.tokens===1?'holding':'holdings'}</small></dd></div></dl>
 ${partial?`<p class="wallet-warning">Showing ${data.holdings.length} of ${data.tokens} token holdings. Token value covers only the priced holdings shown.</p>`:''}
 ${value.overflow?'<p class="wallet-warning">Combined wallet value is unavailable.</p>':''}
 <div class="wallet-result-tabs" data-active-index="0" role="group" aria-label="Wallet view"><span class="check-switch-glass" aria-hidden="true"></span><button type="button" data-wallet-view="holdings" aria-pressed="true" aria-controls="wallet-holdings">Holdings</button><button type="button" data-wallet-view="transactions" aria-pressed="false" aria-controls="wallet-transactions">Transactions</button></div><section id="wallet-holdings" aria-label="Wallet holdings">${list.length?`<div class="wallet-list-head" aria-hidden="true"><span>Coin</span><span>Value / quantity</span></div><ol class="wallet-list">${list.map(rowHTML).join('')}</ol>`:data.tokens?'<p class="wallet-empty">Token holdings are unavailable for this wallet.</p>':'<div class="wallet-empty"><h3>No token holdings found</h3><p>Any available SOL balance is shown above.</p></div>'}<p class="wallet-footnote">${esc(notes.length?notes.join(' '):'Values are estimates based on available prices.')}</p></section><section id="wallet-transactions" class="wallet-transactions-panel" aria-label="Wallet transactions" hidden></section>`;
}

// A single cancellable lookup; report data stays in memory on this page.
export function createWalletLookup({fetcher=globalThis.fetch,endpoint='/api/wallet',onChange=()=>{},timeoutMs=55000}={}){
 let serial=0,controller=null,disposed=false;
 const cancel=()=>{serial++;controller?.abort();controller=null;};
 return {
  cancel,
  dispose(){disposed=true;cancel();},
  async lookup(address){
   cancel();if(disposed)return;
   if(!validWalletAddress(address)){onChange({status:'error',message:/^0x/i.test(address)?'Wallet checks support Solana for now.':'Paste a full Solana wallet address.'});return;}
   const id=serial;controller=new AbortController();const requestController=controller,signal=requestController.signal;let timedOut=false;
   const timeout=setTimeout(()=>{timedOut=true;requestController.abort();},timeoutMs);
   onChange({status:'loading',address});
   try{
    const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',signal,body:JSON.stringify({address})});
    const body=await response.json().catch(()=>null);
    if(id!==serial||disposed)return;
    if(timedOut)throw new Error('The wallet check took too long. Please try again.');
    if(!response.ok)throw new Error(response.status===429?'The wallet service is busy. Try again in a moment.':typeof body?.error==='string'?body.error.slice(0,240):'The wallet could not be checked. Try again.');
    onChange({status:'ready',address,data:normalizeWalletReport(body,address)});
   }catch(error){if(id===serial&&!disposed)onChange({status:'error',address,message:timedOut?'The wallet check took too long. Please try again.':error.name==='TypeError'?'The wallet service could not be reached. Try again.':error.message||'The wallet could not be checked. Try again.'});}
   finally{clearTimeout(timeout);if(id===serial)controller=null;}
  }
 };
}

export function mountWalletCheck(main,{fetcher=globalThis.fetch,endpoint=globalThis.window?.SOLTECH_API?`${window.SOLTECH_API.replace(/\/$/,'')}/wallet`:'/api/wallet',historyStore=getRecentWalletStore(),copyText=copyToClipboard,mountTransactions=mountWalletTransactions,mountLogos=mountWalletHoldingLogos}={}){
 document.title='Check a wallet · Solventir';
 let data=null,busy=false,disposed=false,copySerial=0,transactionsMounted=false,disposeTransactions=null,disposeLogos=null,historyToken;
 main.innerHTML=`<section class="checker wallet-check"><div class="checker-intro">${checkTabsHTML('wallet')}<h1>Check a wallet<span class="accent">.</span></h1><p>A closer look at a wallet.</p></div><form class="coin-check-form wallet-form" novalidate><div class="check-label"><label for="wallet-address">Solana wallet address</label></div><div class="check-input-row"><div class="check-address-input"><input id="wallet-address" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="64" placeholder="Paste a public wallet address" aria-describedby="wallet-error"><button type="button" class="button clear-address" data-wallet-clear disabled>Clear</button></div><button type="submit" class="button glass" data-wallet-submit>Check wallet</button></div><p id="wallet-error" class="field-error" role="alert" hidden></p><details class="check-privacy"><summary>Read-only · What gets shared?</summary><p>Shows up to 150 token holdings in a Solana wallet. No wallet connection, keys, or signatures are needed.</p><p>The public address is sent to Solventir’s wallet service for blockchain and market data. SOL pricing uses public market data from DEX Screener without sending your wallet address. Opening Transactions sends the public wallet address and transaction IDs through Solventir to Solana’s public data service to load transaction records. Missing token names and logos are requested from DEX Screener using token addresses. Rugcheck supplies a fallback logo when available. Token images load from their image providers. Recent public wallet addresses and check times are saved on this device. Holdings, balances and transaction reports are not saved. Clear history removes these recent addresses. This page does not run continuous tracking.</p></details></form><div class="wallet-progress"><p class="lookup-status" role="status" aria-live="polite"></p><button type="button" class="wallet-cancel button secondary" hidden>Cancel</button></div><div id="wallet-result" aria-busy="false"></div><div id="recent-wallets"></div></section>`;
 const form=main.querySelector('.wallet-form'),input=main.querySelector('#wallet-address'),error=main.querySelector('#wallet-error'),status=main.querySelector('.lookup-status'),out=main.querySelector('#wallet-result'),submit=main.querySelector('[data-wallet-submit]'),clear=main.querySelector('[data-wallet-clear]'),cancel=main.querySelector('.wallet-cancel'),recent=main.querySelector('#recent-wallets');
 const syncHistoryVisibility=()=>{recent.hidden=Boolean(input.value.trim()||busy||data);};
 const renderHistory=(message='')=>{
  if(disposed)return;
  const active=recent.contains?.(document.activeElement)?document.activeElement:null,address=active?.dataset.recentWallet,wasClear=active?.hasAttribute('data-clear-wallet-history');
  recent.innerHTML=recentWalletsHTML(historyStore.entries,{issue:historyStore.issue,message});syncHistoryVisibility();
  if(active&&!recent.hidden){const target=wasClear?recent.querySelector('[data-clear-wallet-history]'):[...recent.querySelectorAll('[data-recent-wallet]')].find(row=>row.dataset.recentWallet===address);(target||recent.querySelector('#recent-wallets-title'))?.focus({preventScroll:true});}
 };
 const unsubscribeHistory=historyStore.subscribe?.(()=>renderHistory());
 renderHistory();
 function releaseResults(){copySerial++;disposeTransactions?.();disposeTransactions=null;transactionsMounted=false;disposeLogos?.();disposeLogos=null;}
 function setBusy(value){busy=value;submit.disabled=value;submit.textContent=value?'Checking…':'Check wallet';cancel.hidden=!value;form.setAttribute('aria-busy',String(value));out.setAttribute('aria-busy',String(value));}
 const session=createWalletLookup({fetcher,endpoint,onChange:state=>{
  releaseResults();
  setBusy(state.status==='loading');error.hidden=true;input.removeAttribute('aria-invalid');status.setAttribute('data-state',state.status);
  if(state.status==='loading'){historyToken=historyStore.beginCheck?.();data=null;status.textContent='Reading wallet holdings and available prices…';out.innerHTML='<p class="wallet-loading">Checking wallet…</p>';}
  else if(state.status==='ready'){data=state.data;status.textContent=`Loaded ${data.holdings.length} token ${data.holdings.length===1?'holding':'holdings'}.`;out.innerHTML=walletResultsHTML(data);disposeLogos=mountLogos(out,data.holdings,{fetcher});historyStore.add(state.address,{clearToken:historyToken});renderHistory();}
  else{data=null;out.innerHTML='';status.textContent='';error.textContent=state.message;error.hidden=false;}
  syncHistoryVisibility();
 }});
 function reset(message=''){session.cancel();releaseResults();setBusy(false);data=null;out.innerHTML='';status.removeAttribute('data-state');status.textContent=message;error.hidden=true;input.removeAttribute('aria-invalid');syncHistoryVisibility();}
 function onSubmit(event){
  event.preventDefault();if(busy)return;
  input.value=input.value.trim();clear.disabled=!input.value;
  if(!validWalletAddress(input.value)){reset();error.textContent=/^0x/i.test(input.value)?'Wallet checks support Solana for now.':'Paste a full Solana wallet address.';error.hidden=false;input.setAttribute('aria-invalid','true');input.focus();return;}
  session.lookup(input.value);
 }
 const onInput=()=>{reset();clear.disabled=!input.value;};
 const onClear=()=>{input.value='';clear.disabled=true;reset('Address cleared.');input.focus();};
 const onCancel=()=>{reset('Wallet check cancelled.');input.focus();};
 async function copyAddress(button){
  const current=data;if(button.disabled||!current||!validWalletAddress(current.address))return;
  const serial=++copySerial,feedback=out.querySelector('[data-wallet-copy-status]');button.disabled=true;feedback.textContent='Copying address…';
  try{await copyText(current.address);if(!disposed&&data===current&&serial===copySerial)feedback.textContent='Wallet address copied.';}
  catch{if(!disposed&&data===current&&serial===copySerial){out.querySelector('[data-wallet-address]').textContent=current.address;feedback.textContent='Couldn’t copy. Select the full address above to copy it manually.';}}
  finally{if(!disposed&&data===current&&serial===copySerial)button.disabled=false;}
 }
 const onClick=event=>{
  const copy=event.target.closest('[data-copy-wallet-address]');if(copy){void copyAddress(copy);return;}
  const view=event.target.closest('[data-wallet-view]')?.dataset.walletView;if(!data||!['holdings','transactions'].includes(view))return;
  const holdings=out.querySelector('#wallet-holdings'),transactions=out.querySelector('#wallet-transactions');
  holdings.hidden=view!=='holdings';transactions.hidden=view!=='transactions';
  out.querySelector('.wallet-result-tabs')?.setAttribute('data-active-index',view==='transactions'?'1':'0');
  out.querySelectorAll('[data-wallet-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.walletView===view)));
  if(view==='transactions'&&!transactionsMounted){transactionsMounted=true;disposeTransactions=mountTransactions(transactions,{address:data.address,fetcher,endpoint:`${endpoint.replace(/\/$/,'')}/transactions`,tokenMetadata:data.holdings.map(({address,name,symbol,logo})=>({address,name,symbol,logo}))});}
 };
 const onRecentClick=event=>{
  if(event.target.closest('[data-clear-wallet-history]')){
   const result=historyStore.clear();renderHistory(result.ok?'Wallet history cleared.':'');recent.querySelector('#recent-wallets-title')?.focus({preventScroll:true});return;
  }
  const button=event.target.closest('[data-recent-wallet]'),address=button?.dataset.recentWallet;
  if(!validWalletAddress(address)||!historyStore.entries.some(entry=>entry.address===address))return;
  reset();input.value=address;clear.disabled=false;input.focus({preventScroll:true});form.scrollIntoView({block:'start',behavior:'auto'});session.lookup(address);
 };
 form.addEventListener('submit',onSubmit);input.addEventListener('input',onInput);clear.addEventListener('click',onClear);cancel.addEventListener('click',onCancel);out.addEventListener('click',onClick);recent.addEventListener('click',onRecentClick);
 return ()=>{disposed=true;unsubscribeHistory?.();session.dispose();releaseResults();form.removeEventListener('submit',onSubmit);input.removeEventListener('input',onInput);clear.removeEventListener('click',onClear);cancel.removeEventListener('click',onCancel);out.removeEventListener('click',onClick);recent.removeEventListener('click',onRecentClick);};
}
