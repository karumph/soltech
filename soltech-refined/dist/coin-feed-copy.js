export function mountCoinFeedCopy(root,{
 toast=()=>{},clipboard,
 setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout
}={}){
 let disposed=false;
 const states=new Map();
 const restoreAttribute=(button,name,value)=>value===null?button.removeAttribute(name):button.setAttribute(name,value);
 function stateFor(button){
  if(!states.has(button)){
   const defaultIcon=button.querySelector('.feed-copy-default'),successIcon=button.querySelector('.feed-copy-success');
   states.set(button,{defaultIcon,successIcon,defaultHidden:defaultIcon?.hidden,successHidden:successIcon?.hidden,
    label:button.getAttribute('aria-label'),busy:button.getAttribute('aria-busy'),disabled:button.disabled,timer:null});
  }
  return states.get(button);
 }
 function resetFeedback(button,state){
  if(state.timer!==null){clearTimer(state.timer);state.timer=null;}
  if(state.defaultIcon)state.defaultIcon.hidden=state.defaultHidden;
  if(state.successIcon)state.successIcon.hidden=state.successHidden;
  restoreAttribute(button,'aria-label',state.label);
 }
 function resetControl(button,state){
  button.disabled=state.disabled;
  restoreAttribute(button,'aria-busy',state.busy);
 }
 function revealFullAddress(button,address){
  const row=button.closest('.feed-address'),text=row?.querySelector('.feed-address-text');
  if(!text)return;
  text.textContent=address;text.title=address;row.classList.add('feed-address-full');
 }
 async function copy(event){
  const button=event.target?.closest?.('.feed-copy-button[data-feed-copy-address]');
  if(disposed||!button||!root.contains(button)||button.disabled)return;
  event.preventDefault();
  const address=button.dataset.feedCopyAddress,name=button.dataset.coinName||'Coin';
  if(!address){toast('This coin address is unavailable.');return;}
  const state=stateFor(button);resetFeedback(button,state);
  button.disabled=true;button.setAttribute('aria-busy','true');
  let copied=false,unavailable=false;
  try{
   const client=clipboard===undefined?globalThis.navigator?.clipboard:clipboard;
   unavailable=typeof client?.writeText!=='function';
   if(!unavailable){await client.writeText(address);copied=true;}
  }catch{
   // A denied or failed write must never show the copied state.
  }finally{
   if(!disposed)resetControl(button,state);
  }
  if(disposed)return;
  if(!copied){
   revealFullAddress(button,address);
   toast(unavailable?'Clipboard access isn’t available here. Select the full address to copy it manually.':`Couldn’t copy ${name}’s address. Select the full address to copy it manually.`);
   return;
  }
  if(state.defaultIcon)state.defaultIcon.hidden=true;
  if(state.successIcon)state.successIcon.hidden=false;
  button.setAttribute('aria-label',`${name} coin address copied`);
  toast(`${name} coin address copied.`);
  state.timer=setTimer(()=>{state.timer=null;if(!disposed)resetFeedback(button,state);},1800);
 }
 root.addEventListener('click',copy);
 return ()=>{
  if(disposed)return;
  disposed=true;root.removeEventListener('click',copy);
  for(const [button,state] of states){resetFeedback(button,state);resetControl(button,state);}
  states.clear();
 };
}
