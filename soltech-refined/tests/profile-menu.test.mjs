import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileMenu} from '../dist/profile-menu.js';

class Target{
 constructor(){this.listeners=new Map();}
 addEventListener(type,listener){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(listener);}
 removeEventListener(type,listener){this.listeners.get(type)?.delete(listener);}
 dispatch(type,event){for(const listener of this.listeners.get(type)||[])listener(event);}
 get listenerCount(){return [...this.listeners.values()].reduce((total,listeners)=>total+listeners.size,0);}
}
class Element extends Target{
 constructor(document,{tag='div',href=null,action=null,parent=null}={}){
  super();Object.assign(this,{document,tag,href,parent,hidden:false,attributes:new Map(),dataset:action?{action}:{},children:[]});
  parent?.children.push(this);
 }
 contains(target){for(let item=target;item;item=item.parent)if(item===this)return true;return false;}
 setAttribute(name,value){this.attributes.set(name,String(value));}
 getAttribute(name){return this.attributes.get(name)??null;}
 focus(options){this.document.activeElement=this;this.lastFocusOptions=options;this.document.dispatch('focusin',{target:this});}
 closest(){for(let item=this;item;item=item.parent)if(item.tag==='a'&&item.href||item.tag==='button'&&item.dataset.action==='about')return item;return null;}
 querySelectorAll(){return this.children.filter(item=>item.tag==='a'&&item.href||item.tag==='button'&&!item.disabled);}
}
function fixture(){
 const document=new Target(),window=new Target();document.activeElement=null;
 const trigger=new Element(document,{tag:'button'}),triggerIcon=new Element(document,{parent:trigger}),panel=new Element(document);
 const profile=new Element(document,{tag:'a',href:'#profile',parent:panel}),notifications=new Element(document,{tag:'a',href:'#settings/notifications',parent:panel}),about=new Element(document,{tag:'button',action:'about',parent:panel});
 const aboutIcon=new Element(document,{parent:about}),input=new Element(document,{tag:'input'});input.value='keep this wallet address';
 const controller=createProfileMenu({trigger,panel,eventTarget:document,windowTarget:window});
 function event(type,target,extra={}){
  const value={type,target,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...extra};
  for(let current=target;current;current=current.parent)current.dispatch(type,value);
  document.dispatch(type,value);return value;
 }
 return {document,window,trigger,triggerIcon,panel,profile,notifications,about,aboutIcon,input,controller,event};
}

test('profile disclosure starts closed and nested trigger clicks toggle it without navigation',()=>{
 const f=fixture();assert.equal(f.panel.hidden,true);assert.equal(f.trigger.getAttribute('aria-expanded'),'false');
 assert.equal(f.event('click',f.triggerIcon).defaultPrevented,false);
 assert.equal(f.panel.hidden,false);assert.equal(f.trigger.getAttribute('aria-expanded'),'true');
 f.event('click',f.trigger);assert.equal(f.panel.hidden,true);assert.equal(f.trigger.getAttribute('aria-expanded'),'false');
});

test('Escape closes an open disclosure and restores its visible trigger without scrolling',()=>{
 const f=fixture();f.event('click',f.trigger);f.profile.focus();
 assert.equal(f.event('keydown',f.profile,{key:'Escape'}).defaultPrevented,true);
 assert.equal(f.panel.hidden,true);assert.equal(f.document.activeElement,f.trigger);assert.deepEqual(f.trigger.lastFocusOptions,{preventScroll:true});
 assert.equal(f.event('keydown',f.trigger,{key:'Escape'}).defaultPrevented,false);
});

test('outside clicks and focus changes dismiss without taking focus or changing the form',()=>{
 const f=fixture();f.event('click',f.trigger);f.document.activeElement=f.input;
 assert.equal(f.event('click',f.input).defaultPrevented,false);assert.equal(f.panel.hidden,true);assert.equal(f.document.activeElement,f.input);
 f.event('click',f.trigger);f.input.focus();assert.equal(f.panel.hidden,true);assert.equal(f.document.activeElement,f.input);assert.equal(f.input.value,'keep this wallet address');
});

test('focus inside the panel or on its trigger keeps it open, with ordinary Tab behavior',()=>{
 const f=fixture();f.event('click',f.trigger);f.profile.focus();assert.equal(f.panel.hidden,false);
 assert.equal(f.event('keydown',f.profile,{key:'Tab'}).defaultPrevented,false);f.notifications.focus();assert.equal(f.panel.hidden,false);
 assert.equal(f.event('keydown',f.notifications,{key:'Tab',shiftKey:true}).defaultPrevented,false);f.trigger.focus();assert.equal(f.panel.hidden,false);
});

test('selecting a route link closes the dropdown while preserving default navigation and bubbling',()=>{
 const f=fixture();let received;f.document.addEventListener('click',event=>{received=event;});
 f.event('click',f.trigger);f.profile.focus();const event=f.event('click',f.profile);
 assert.equal(f.panel.hidden,true);assert.equal(event.defaultPrevented,false);assert.equal(received,event);assert.equal(f.profile.href,'#profile');
 assert.equal(f.document.activeElement,f.trigger);
});

test('same-route and modified link selections leave focus visible without preventing navigation',()=>{
 const f=fixture();f.window.location={hash:'#profile'};
 for(const modifiers of [{},{ctrlKey:true},{metaKey:true},{shiftKey:true}]){
  f.event('click',f.trigger);f.profile.focus();const event=f.event('click',f.profile,modifiers);
  assert.equal(event.defaultPrevented,false);assert.equal(f.panel.hidden,true);assert.equal(f.document.activeElement,f.trigger);assert.equal(f.window.location.hash,'#profile');
 }
});

test('About returns focus before the existing document handler opens a dialog',()=>{
 const f=fixture();const dialog=new Element(f.document,{tag:'dialog'});let returnTarget=null;
 f.document.addEventListener('click',event=>{if(event.target.closest()?.dataset.action==='about'){returnTarget=f.document.activeElement;dialog.focus();}});
 f.event('click',f.trigger);f.about.focus();const event=f.event('click',f.aboutIcon);
 assert.equal(f.panel.hidden,true);assert.equal(returnTarget,f.trigger);assert.equal(f.document.activeElement,dialog);assert.equal(event.defaultPrevented,false);
});

test('ArrowDown and ArrowUp open at the first and last available controls',()=>{
 const f=fixture();
 assert.equal(f.event('keydown',f.trigger,{key:'ArrowDown'}).defaultPrevented,true);assert.equal(f.panel.hidden,false);assert.equal(f.document.activeElement,f.profile);
 f.controller.close();assert.equal(f.event('keydown',f.trigger,{key:'ArrowUp'}).defaultPrevented,true);assert.equal(f.document.activeElement,f.about);
 f.controller.close();f.profile.hidden=true;f.event('keydown',f.trigger,{key:'ArrowDown'});assert.equal(f.document.activeElement,f.notifications);
});

test('modified arrows and normal activation keys retain their native behavior',()=>{
 const f=fixture();
 for(const extra of [{key:'ArrowDown',altKey:true},{key:'ArrowDown',ctrlKey:true},{key:'ArrowUp',metaKey:true},{key:'Enter'},{key:' '},{key:'Tab'}]){
  assert.equal(f.event('keydown',f.trigger,extra).defaultPrevented,false);assert.equal(f.panel.hidden,true);
 }
});

test('a route change closes the menu without changing focus',()=>{
 const f=fixture();f.event('click',f.trigger);f.profile.focus();f.window.dispatch('hashchange',{});
 assert.equal(f.panel.hidden,true);assert.equal(f.trigger.getAttribute('aria-expanded'),'false');assert.equal(f.document.activeElement,f.profile);
});

test('explicit close and disposal are safe to repeat and release every listener',()=>{
 const f=fixture();f.event('click',f.trigger);f.controller.close();f.controller.close();assert.equal(f.panel.hidden,true);
 f.event('click',f.trigger);f.controller.dispose();f.controller.dispose();assert.equal(f.panel.hidden,true);assert.equal(f.trigger.getAttribute('aria-expanded'),'false');
 for(const target of [f.trigger,f.panel,f.document,f.window])assert.equal(target.listenerCount,0);
 f.event('click',f.trigger);f.event('keydown',f.trigger,{key:'ArrowDown'});assert.equal(f.panel.hidden,true);
});
