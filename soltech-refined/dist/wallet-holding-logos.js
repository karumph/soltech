import {safeImageUrl,validMint} from './coin-checker-data.js';
import {fetchWalletTokenMetadata} from './wallet-token-metadata.js';
import {fetchWalletTokenLogo} from './wallet-token-logo.js';

// Logos are optional enrichment: never delay balances or redraw an open report.
// Each exact mint gets one market lookup and at most one fallback per report.
// Market batches contain up to 30 mints; fallback concurrency is limited to two.
export function mountWalletHoldingLogos(root,holdings,{fetcher=globalThis.fetch,metadataFetcher=fetchWalletTokenMetadata,logoFetcher=fetchWalletTokenLogo}={}){
 const coins=new Map(holdings.slice(0,150).filter(coin=>validMint(coin?.address)).map(coin=>[coin.address,coin]));
 const slots=new Map([...root.querySelectorAll('[data-wallet-token-logo]')].filter(slot=>coins.has(slot.dataset.walletTokenLogo)).map(slot=>[slot.dataset.walletTokenLogo,slot]));
 const pending=new Set(),attempted=new Set(),failed=new Map(),controller=new AbortController();
 const fallbackPending=new Set(),fallbackTried=new Set();
 let active=false,scheduled=false,stopped=false,marketStopped=false,fallbackActive=0,fallbackStopped=false;
 const applyLogo=(address,value)=>{
  const logo=safeImageUrl(value),slot=slots.get(address);
  if(stopped||!logo||failed.get(address)?.has(logo)||!slot||slot.querySelector('img'))return;
  const image=root.ownerDocument.createElement('img');
  image.alt='';image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';
  image.width=32;image.height=32;image.src=logo;
  slot.append(image);coins.get(address).logo=logo;
 };
 const queueFallback=address=>{
  if(stopped||fallbackStopped||!slots.has(address)||slots.get(address).querySelector('img')||fallbackTried.has(address))return;
  fallbackPending.add(address);drainFallback();
 };
 function drainFallback(){
  while(!stopped&&!fallbackStopped&&fallbackActive<2&&fallbackPending.size){
   const address=fallbackPending.values().next().value;
   fallbackPending.delete(address);fallbackTried.add(address);fallbackActive++;
   Promise.resolve().then(()=>stopped?null:logoFetcher(address,{fetcher,signal:controller.signal}))
    .then(logo=>applyLogo(address,logo)).catch(error=>{
     if(error?.code==='rate'){fallbackStopped=true;fallbackPending.clear();}
    }).finally(()=>{fallbackActive--;drainFallback();});
  }
 }
 const enqueue=address=>{
  if(stopped||!slots.has(address)||attempted.has(address))return;
  if(marketStopped){queueFallback(address);return;}
  pending.add(address);
  if(!active&&!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;void drain();});}
 };
 async function drain(){
  if(stopped||active)return;
  active=true;
  try{
   while(pending.size&&!stopped){
    const addresses=[...pending].slice(0,30);
    for(const address of addresses){pending.delete(address);attempted.add(address);}
    let records;
    try{records=await metadataFetcher(addresses,{fetcher,signal:controller.signal});}
    catch{
     marketStopped=true;
     for(const address of [...addresses,...pending])queueFallback(address);
     pending.clear();return;
    }
    if(stopped||controller.signal.aborted)return;
    for(const record of Array.isArray(records)?records:[]){
     if(!addresses.includes(record?.address))continue;
     applyLogo(record.address,record.logo);
    }
    for(const address of addresses)queueFallback(address);
   }
  }finally{active=false;}
 }
 const onError=event=>{
  const image=event.target,slot=image.closest?.('[data-wallet-token-logo]');
  if(image.tagName!=='IMG'||!slot||slots.get(slot.dataset.walletTokenLogo)!==slot)return;
  const address=slot.dataset.walletTokenLogo,logo=safeImageUrl(image.getAttribute('src'));
  if(logo){if(!failed.has(address))failed.set(address,new Set());failed.get(address).add(logo);}
  image.remove();coins.get(address).logo=null;
  if(attempted.has(address))queueFallback(address);else enqueue(address);
 };
 const onLoad=event=>{
  const image=event.target,slot=image.closest?.('[data-wallet-token-logo]');
  if(image.tagName==='IMG'&&slot&&slots.get(slot.dataset.walletTokenLogo)===slot)image.classList.add('is-loaded');
 };
 root.addEventListener('error',onError,true);
 root.addEventListener('load',onLoad,true);
 for(const [address,slot] of slots){
  const image=slot.querySelector('img');
  if(!image)enqueue(address);
  else if(image.complete&&!image.naturalWidth)onError({target:image});
  else if(image.complete)onLoad({target:image});
 }
 return ()=>{stopped=true;pending.clear();fallbackPending.clear();controller.abort();root.removeEventListener('error',onError,true);root.removeEventListener('load',onLoad,true);};
}
