import test from 'node:test';
import assert from 'node:assert/strict';
import {mountCoinFeedCopy} from '../dist/coin-feed-copy.js';

const fullAddress='So11111111111111111111111111111111111111112';
const settle=()=>Promise.resolve();
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function fixture(){
 const root=new EventTarget(),defaultIcon={hidden:false},successIcon={hidden:true},classes=new Set();
 const addressText={textContent:'So11…1112',title:fullAddress};
 const row={querySelector:selector=>selector==='.feed-address-text'?addressText:null,classList:{add:value=>classes.add(value)}};
 const attributes=new Map([['aria-label','Copy Example coin address']]);
 const button={
  dataset:{feedCopyAddress:fullAddress,coinName:'Example'},disabled:false,
  getAttribute:name=>attributes.get(name)??null,setAttribute:(name,value)=>attributes.set(name,value),removeAttribute:name=>attributes.delete(name),
  querySelector:selector=>selector==='.feed-copy-default'?defaultIcon:selector==='.feed-copy-success'?successIcon:null,
  closest:selector=>selector==='.feed-address'?row:null
 };
 root.contains=node=>node===button;
 const target={closest:selector=>selector==='.feed-copy-button[data-feed-copy-address]'?button:null};
 const click=()=>{const event=new Event('click',{cancelable:true});Object.defineProperty(event,'target',{value:target});root.dispatchEvent(event);return event;};
 const messages=[],timers=new Map(),cleared=[];let serial=0;
 const options={toast:message=>messages.push(message),setTimer:(callback,delay)=>{const id=++serial;timers.set(id,{callback,delay});return id;},clearTimer:id=>{cleared.push(id);timers.delete(id);}};
 const runTimers=()=>{const queued=[...timers.values()];timers.clear();for(const timer of queued)timer.callback();};
 return {root,button,defaultIcon,successIcon,addressText,classes,messages,timers,cleared,options,click,runTimers};
}

test('copies the full address only on click and confirms only after clipboard fulfillment',async()=>{
 const f=fixture(),pending=deferred(),writes=[];
 const dispose=mountCoinFeedCopy(f.root,{...f.options,clipboard:{writeText:value=>{writes.push(value);return pending.promise;}}});
 assert.deepEqual(writes,[]);
 assert.equal(f.click().defaultPrevented,true);
 assert.deepEqual(writes,[fullAddress]);assert.notEqual(writes[0],f.addressText.textContent);
 assert.equal(f.button.disabled,true);assert.equal(f.successIcon.hidden,true);assert.deepEqual(f.messages,[]);
 f.click();assert.equal(writes.length,1);
 pending.resolve();await settle();
 assert.equal(f.button.disabled,false);assert.equal(f.button.getAttribute('aria-busy'),null);
 assert.equal(f.defaultIcon.hidden,true);assert.equal(f.successIcon.hidden,false);
 assert.deepEqual(f.messages,['Example coin address copied.']);assert.equal(f.timers.size,1);
 f.runTimers();assert.equal(f.defaultIcon.hidden,false);assert.equal(f.successIcon.hidden,true);
 assert.equal(f.button.getAttribute('aria-label'),'Copy Example coin address');
 dispose();
});

test('unavailable or rejected clipboard exposes full text without claiming success',async t=>{
 for(const [name,clipboard] of [['unavailable',null],['rejected',{writeText:()=>Promise.reject(new Error('Permission denied'))}]]){
  await t.test(name,async()=>{
   const f=fixture(),dispose=mountCoinFeedCopy(f.root,{...f.options,clipboard});
   f.click();await settle();
   assert.equal(f.defaultIcon.hidden,false);assert.equal(f.successIcon.hidden,true);assert.equal(f.timers.size,0);
   assert.equal(f.button.disabled,false);assert.equal(f.button.getAttribute('aria-busy'),null);
   assert.equal(f.messages.length,1);assert.doesNotMatch(f.messages[0],/copied/);assert.match(f.messages[0],/Select the full address/);
   assert.equal(f.addressText.textContent,fullAddress);assert.equal(f.addressText.title,fullAddress);assert.ok(f.classes.has('feed-address-full'));
   dispose();
  });
 }
});

test('disposing during a pending copy suppresses stale feedback and removes the listener',async()=>{
 const f=fixture(),pending=deferred();let writes=0;
 const dispose=mountCoinFeedCopy(f.root,{...f.options,clipboard:{writeText:()=>{writes++;return pending.promise;}}});
 f.click();assert.equal(writes,1);assert.equal(f.button.disabled,true);
 dispose();assert.equal(f.button.disabled,false);
 pending.resolve();await settle();
 assert.deepEqual(f.messages,[]);assert.equal(f.timers.size,0);assert.equal(f.successIcon.hidden,true);
 f.click();assert.equal(writes,1);
});

test('dispose clears confirmation timers and remount creates exactly one active listener',async()=>{
 const f=fixture();let writes=0;
 const options={...f.options,clipboard:{writeText:async()=>{writes++;}}};
 const dispose=mountCoinFeedCopy(f.root,options);
 f.click();await settle();assert.equal(f.timers.size,1);assert.equal(f.successIcon.hidden,false);
 dispose();dispose();assert.equal(f.timers.size,0);assert.equal(f.cleared.length,1);assert.equal(f.successIcon.hidden,true);
 f.click();assert.equal(writes,1);
 const disposeAgain=mountCoinFeedCopy(f.root,options);
 f.click();await settle();assert.equal(writes,2);assert.equal(f.timers.size,1);
 disposeAgain();assert.equal(f.timers.size,0);
});
