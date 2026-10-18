import test from 'node:test';
import assert from 'node:assert/strict';
import {mountHistoryCopy} from '../dist/coin-history-copy.js';

const address='So11111111111111111111111111111111111111112';
const other='0x4200000000000000000000000000000000000006';
const settle=()=>Promise.resolve();
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function fixture(value=address){
 const button=new EventTarget(),fullAddress=new EventTarget(),attributes=new Map();
 const label={textContent:'Copy CA'},message={textContent:''};
 Object.assign(fullAddress,{hidden:true,textContent:''});
 Object.assign(button,{dataset:{historyCopyAddress:value},querySelector:selector=>selector==='.history-copy-label'?label:null,
  setAttribute:(key,value)=>attributes.set(key,value),getAttribute:key=>attributes.get(key)??null,removeAttribute:key=>attributes.delete(key)});
 const feedback={hidden:true,querySelector:selector=>selector==='.history-copy-message'?message:selector==='.history-copy-address'?fullAddress:null};
 const selections=[],root={isConnected:true,button,querySelector:selector=>selector==='.history-copy-ca'?root.button:selector==='.history-copy-feedback'?feedback:null,
  ownerDocument:{getSelection:()=>({removeAllRanges(){},addRange:range=>selections.push(range.node)}),createRange:()=>({selectNodeContents(node){this.node=node;}})}};
 const timers=new Map();let timerId=0;
 const options={setTimer:(callback,delay)=>{const id=++timerId;timers.set(id,{callback,delay});return id;},clearTimer:id=>timers.delete(id)};
 const runTimer=()=>{const [id,timer]=timers.entries().next().value;timers.delete(id);timer.callback();};
 const click=()=>{const event=new Event('click',{cancelable:true});button.dispatchEvent(event);return event;};
 return {root,button,label,message,feedback,fullAddress,selections,click,options,timers,runTimer};
}

test('header copy captures the full displayed address and confirms only after clipboard fulfillment',async()=>{
 const f=fixture(),pending=deferred(),writes=[];
 const dispose=mountHistoryCopy(f.root,{...f.options,clipboard:{writeText:value=>{writes.push(value);return pending.promise;}}});
 assert.deepEqual(writes,[]);
 f.button.dataset.historyCopyAddress=other;
 assert.equal(f.click().defaultPrevented,true);
 assert.deepEqual(writes,[address]);assert.equal(f.button.getAttribute('aria-busy'),'true');
 assert.equal(f.button.getAttribute('aria-disabled'),'true');assert.notEqual(f.button.disabled,true,'The focused button stays focusable');
 assert.equal(f.label.textContent,'Copy CA');assert.doesNotMatch(f.message.textContent,/copied/i);
 assert.equal(f.fullAddress.hidden,true);f.click();assert.equal(writes.length,1);
 pending.resolve();await settle();
 assert.equal(f.label.textContent,'Copied');assert.equal(f.message.textContent,'CA copied.');
 assert.equal(f.button.getAttribute('aria-busy'),null);assert.equal(f.button.getAttribute('aria-disabled'),null);
 assert.deepEqual(f.selections,[],'Copy does not move selection or focus');
 assert.equal(f.button.getAttribute('data-copied'),'true');assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].delay,1800);
 f.runTimer();assert.equal(f.button.getAttribute('data-copied'),null);assert.equal(f.label.textContent,'Copy CA');assert.equal(f.feedback.hidden,true);dispose();
});

test('unsupported, denied, and synchronously failing clipboard reveal a selectable full address without success',async t=>{
 for(const [name,clipboard] of [['unsupported',null],['denied',{writeText:()=>Promise.reject(Error('Denied'))}],['thrown',{writeText:()=>{throw Error('Unavailable');}}]]){
  await t.test(name,async()=>{
   const f=fixture(),dispose=mountHistoryCopy(f.root,{...f.options,clipboard});
   f.click();await settle();
   assert.equal(f.label.textContent,'Copy CA');assert.match(f.message.textContent,/Could not copy automatically/);assert.doesNotMatch(f.message.textContent,/copied/i);
   assert.equal(f.feedback.hidden,false);assert.equal(f.fullAddress.hidden,false);assert.equal(f.fullAddress.textContent,address);
   assert.deepEqual(f.selections,[],'Fallback does not automatically steal focus or selection');
   f.fullAddress.dispatchEvent(new Event('focus'));assert.deepEqual(f.selections,[f.fullAddress]);
   assert.equal(f.button.getAttribute('aria-busy'),null);dispose();
  });
 }
});

test('copy can retry after rejection and hides the manual fallback when the next write succeeds',async()=>{
 const f=fixture();let attempts=0;
 const dispose=mountHistoryCopy(f.root,{...f.options,clipboard:{writeText:async()=>{if(++attempts===1)throw Error('Denied');}}});
 f.click();await settle();assert.equal(f.fullAddress.hidden,false);
 f.click();await settle();assert.equal(attempts,2);assert.equal(f.fullAddress.hidden,true);assert.equal(f.fullAddress.textContent,'');
 assert.equal(f.label.textContent,'Copied');assert.equal(f.button.getAttribute('data-copied'),'true');dispose();assert.equal(f.timers.size,0);assert.equal(f.button.getAttribute('data-copied'),null);
});

test('new report, cleared report, and disposal suppress both stale success and failure feedback',async t=>{
 for(const action of ['replace','clear','dispose'])for(const outcome of ['resolve','reject']){
  await t.test(`${action} then ${outcome}`,async()=>{
   const f=fixture(),pending=deferred();let writes=0;
   const dispose=mountHistoryCopy(f.root,{...f.options,clipboard:{writeText:()=>{writes++;return pending.promise;}}});
   f.click();assert.equal(writes,1);
   if(action==='replace')f.root.button=fixture(other).button;
   if(action==='clear')f.root.isConnected=false;
   if(action==='dispose')dispose();
   pending[outcome](outcome==='reject'?Error('Denied'):undefined);await settle();
   assert.equal(f.label.textContent,'Copy CA');assert.equal(f.message.textContent,'Copying address…');assert.equal(f.fullAddress.hidden,true);
   f.click();assert.equal(writes,1,'Old controls no longer initiate copies');dispose();
  });
 }
});

test('cleanup and remount leave one handler and a fresh report copies its own exact address',async()=>{
 const f=fixture(),writes=[];const clipboard={writeText:async value=>writes.push(value)};
 const dispose=mountHistoryCopy(f.root,{...f.options,clipboard});dispose();dispose();f.click();assert.deepEqual(writes,[]);
 f.button.dataset.historyCopyAddress=other;
 const stop=mountHistoryCopy(f.root,{...f.options,clipboard});f.click();await settle();assert.deepEqual(writes,[other]);stop();
 for(const missing of ['',null,undefined,'   ']){
  const empty=fixture();empty.button.dataset.historyCopyAddress=missing;
  const end=mountHistoryCopy(empty.root,{...empty.options,clipboard});empty.click();await settle();end();
 }
 assert.deepEqual(writes,[other]);
});


test('a new copy cancels its previous success reset and replaced reports ignore late reset callbacks',async()=>{
 const f=fixture(),pending=deferred();let writes=0;
 const dispose=mountHistoryCopy(f.root,{...f.options,clipboard:{writeText:()=>++writes===1?Promise.resolve():pending.promise}});
 f.click();await settle();assert.equal(f.timers.size,1);
 f.click();assert.equal(f.timers.size,0);assert.equal(f.button.getAttribute('data-copied'),null);assert.equal(f.label.textContent,'Copy CA');
 pending.resolve();await settle();assert.equal(f.timers.size,1);
 const replacement=fixture(other);f.root.button=replacement.button;f.runTimer();
 assert.equal(replacement.label.textContent,'Copy CA');assert.equal(replacement.feedback.hidden,true);assert.equal(replacement.button.getAttribute('data-copied'),null);
 dispose();assert.equal(f.timers.size,0);
});
