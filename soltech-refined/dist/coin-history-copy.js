// Capture the rendered report's address once. Form edits never become copy targets.
export function mountHistoryCopy(root,{clipboard,setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout}={}){
 const button=root?.querySelector('.history-copy-ca'),feedback=root?.querySelector('.history-copy-feedback');
 const label=button?.querySelector('.history-copy-label'),message=feedback?.querySelector('.history-copy-message'),fullAddress=feedback?.querySelector('.history-copy-address');
 const address=button?.dataset.historyCopyAddress;
 if(!button||!label||!feedback||!message||!fullAddress||typeof address!=='string'||!address.trim())return ()=>{};
 let disposed=false,pending=false,successTimer=null;
 const current=()=>!disposed&&root.isConnected&&root.querySelector('.history-copy-ca')===button;
 const resetBusy=()=>{button.removeAttribute('aria-busy');button.removeAttribute('aria-disabled');};
 const resetCopied=()=>{if(successTimer!==null)clearTimer(successTimer);successTimer=null;button.removeAttribute('data-copied');label.textContent='Copy CA';};
 async function copy(event){
  event.preventDefault();
  if(!current()||pending)return;
  resetCopied();pending=true;button.setAttribute('aria-busy','true');button.setAttribute('aria-disabled','true');
  label.textContent='Copy CA';message.textContent='Copying address…';feedback.hidden=false;fullAddress.hidden=true;fullAddress.textContent='';
  try{
   const client=clipboard===undefined?globalThis.navigator?.clipboard:clipboard;
   if(typeof client?.writeText!=='function')throw new Error('Clipboard unavailable');
   await client.writeText(address);
   if(!current())return;
   label.textContent='Copied';message.textContent='CA copied.';button.setAttribute('data-copied','true');
   successTimer=setTimer(()=>{successTimer=null;if(!current())return;resetCopied();feedback.hidden=true;message.textContent='';},1800);
  }catch{
   if(!current())return;
   label.textContent='Copy CA';message.textContent='Could not copy automatically. Select the full CA below to copy it manually.';
   fullAddress.textContent=address;fullAddress.hidden=false;
  }finally{
   if(current()){pending=false;resetBusy();}
  }
 }
 function selectAddress(){
  if(!current()||fullAddress.hidden)return;
  const document=root.ownerDocument,selection=document?.getSelection?.(),range=document?.createRange?.();
  if(!selection||!range)return;
  range.selectNodeContents(fullAddress);selection.removeAllRanges();selection.addRange(range);
 }
 button.addEventListener('click',copy);
 fullAddress.addEventListener('focus',selectAddress);fullAddress.addEventListener('click',selectAddress);
 return ()=>{
  if(disposed)return;
  disposed=true;resetCopied();button.removeEventListener('click',copy);
  fullAddress.removeEventListener('focus',selectAddress);fullAddress.removeEventListener('click',selectAddress);resetBusy();
 };
}
