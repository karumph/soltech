// A disclosure uses ordinary links and native Tab order, without trapping focus.
export function createProfileMenu({trigger,panel,eventTarget=globalThis.document,windowTarget=globalThis.window}={}){
 if(!trigger||!panel)throw new TypeError('A profile trigger and panel are required.');
 let disposed=false;
 const contains=(target)=>Boolean(target&&(trigger.contains(target)||panel.contains(target)));
 function close({restoreFocus=false}={}){
  panel.hidden=true;
  trigger.setAttribute('aria-expanded','false');
  if(restoreFocus&&!disposed)trigger.focus({preventScroll:true});
 }
 function open(){
  if(disposed)return;
  panel.hidden=false;
  trigger.setAttribute('aria-expanded','true');
 }
 function toggle(){if(disposed)return;panel.hidden?open():close();}
 function triggerKeydown(event){
  if(event.altKey||event.ctrlKey||event.metaKey||!['ArrowDown','ArrowUp'].includes(event.key))return;
  event.preventDefault();open();
  const items=Array.from(panel.querySelectorAll('a[href],button:not([disabled])')).filter(item=>!item.hidden&&item.getAttribute('aria-hidden')!=='true'&&item.getAttribute('aria-disabled')!=='true');
  (event.key==='ArrowDown'?items[0]:items.at(-1))?.focus({preventScroll:true});
 }
 function dismissOutside(event){if(!panel.hidden&&!contains(event.target))close();}
 function escape(event){
  if(event.key!=='Escape'||panel.hidden)return;
  event.preventDefault();close({restoreFocus:true});
 }
 function select(event){
  const item=event.target?.closest?.('a[href],button[data-action="about"]');
  if(!item||!panel.contains(item))return;
  // Same-route links do not fire hashchange, so leave focus on a visible control.
  // This also gives the document-level About dialog a visible return target.
  close({restoreFocus:true});
 }
 const registrations=[
  [trigger,'click',toggle],[trigger,'keydown',triggerKeydown],[panel,'click',select],
  [eventTarget,'click',dismissOutside],[eventTarget,'focusin',dismissOutside],[eventTarget,'keydown',escape],
  [windowTarget,'hashchange',close]
 ];
 close();
 for(const [target,type,listener]of registrations)target?.addEventListener(type,listener);
 return {
  close,
  dispose(){
   if(disposed)return;
   disposed=true;close();
   for(const [target,type,listener]of registrations)target?.removeEventListener(type,listener);
  }
 };
}
