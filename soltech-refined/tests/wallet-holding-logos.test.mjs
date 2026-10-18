import test from 'node:test';
import assert from 'node:assert/strict';
import {mountWalletHoldingLogos} from '../dist/wallet-holding-logos.js';

const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const mint=index=>{
 let number=index+1,encoded='';
 while(number){encoded=alphabet[number%58]+encoded;number=Math.floor(number/58);}
 return '1'.repeat(31)+encoded;
};
const logo=address=>`https://cdn.example.com/${address}.png`;
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const noNetwork=()=>{throw Error('Unexpected live request');};

function fixture(count,{images=new Map()}={}){
 const holdings=Array.from({length:count},(_,index)=>({address:mint(index),name:`Coin ${index}`,symbol:`C${index}`,amount:index+1,valueUsd:index+2,logo:images.get(mint(index))?.src||null}));
 const mutations=[],listeners=new Map(),slots=new Map();
 class Image{
  constructor(src='',{complete=false,naturalWidth=0}={}){
   this.tagName='IMG';this.src=src;this.complete=complete;this.naturalWidth=naturalWidth;this.parent=null;
   const classes=new Set();this.classList={add:value=>classes.add(value),contains:value=>classes.has(value)};
  }
  getAttribute(name){return name==='src'?this.src:null;}
  closest(selector){assert.equal(selector,'[data-wallet-token-logo]');return this.parent;}
  remove(){if(this.parent){mutations.push(['remove',this.parent.dataset.walletTokenLogo]);this.parent.image=null;this.parent=null;}}
 }
 for(const coin of holdings){
  const slot={dataset:{walletTokenLogo:coin.address},image:null,initial:coin.symbol[0],
   querySelector(selector){assert.equal(selector,'img');return this.image;},
   append(image){assert.equal(this.image,null);assert.equal(image.tagName,'IMG');image.parent=this;this.image=image;mutations.push(['append',coin.address]);},
   set innerHTML(value){assert.fail('Logo enrichment must not replace holding content');}
  };
  const initial=images.get(coin.address);
  if(initial){slot.image=new Image(initial.src,initial);slot.image.parent=slot;}
  slots.set(coin.address,slot);
 }
 const reportState={holdingsTab:'open',transactionDetails:'expanded',focusedControl:{id:'copy-wallet'},balance:'unchanged'};
 const root={
  ownerDocument:{createElement(tag){assert.equal(tag,'img');return new Image();}},
  querySelectorAll(selector){assert.equal(selector,'[data-wallet-token-logo]');return [...slots.values()];},
  addEventListener(type,listener,capture){assert.ok(['error','load'].includes(type));assert.equal(capture,true);listeners.set(type,listener);},
  removeEventListener(type,listener,capture){assert.equal(capture,true);assert.equal(listeners.get(type),listener);listeners.delete(type);},
  set innerHTML(value){assert.fail('Logo enrichment must not redraw the report');},
  replaceChildren(){assert.fail('Logo enrichment must not redraw the report');}
 };
 return {root,holdings,slots,mutations,reportState,listeners,
  error(image){listeners.get('error')?.({target:image});},
  load(image){listeners.get('load')?.({target:image});},
  image(address){return slots.get(address).image;}
 };
}

test('150 missing logos are fetched in five sequential batches of thirty with exact slot updates',async t=>{
 const f=fixture(150),calls=[];
 const dispose=mountWalletHoldingLogos(f.root,f.holdings,{fetcher:noNetwork,
  metadataFetcher:(addresses,options)=>{const pending=deferred();calls.push({addresses:[...addresses],options,...pending});return pending.promise;},
  logoFetcher:()=>assert.fail('Successful market logos must not use the fallback')});
 t.after(dispose);
 await tick();assert.equal(calls.length,1);
 for(let batch=0;batch<5;batch++){
  assert.equal(calls.length,batch+1,'A second metadata batch started before the previous one finished');
  const call=calls[batch],expected=f.holdings.slice(batch*30,batch*30+30).map(coin=>coin.address);
  assert.deepEqual(call.addresses,expected);assert.equal(call.options.fetcher,noNetwork);assert.equal(call.options.signal.aborted,false);
  call.resolve(call.addresses.map(address=>({address,logo:logo(address)})));
  await tick();
 }
 assert.equal(calls.length,5);assert.equal(f.mutations.length,150);
 for(const coin of f.holdings){assert.equal(f.image(coin.address).src,logo(coin.address));assert.equal(coin.logo,logo(coin.address));}
});

test('working and still-loading images remain untouched and only image children change',async t=>{
 const images=new Map([[mint(0),{src:logo(mint(0)),complete:true,naturalWidth:32}],[mint(1),{src:logo(mint(1)),complete:false}]]);
 const f=fixture(3,{images}),working=f.image(mint(0)),loading=f.image(mint(1)),state=f.reportState,focus=state.focusedControl;
 const before=f.holdings.map(({logo,...coin})=>coin),calls=[];
 t.after(mountWalletHoldingLogos(f.root,f.holdings,{fetcher:noNetwork,
  metadataFetcher:async addresses=>{calls.push(addresses);return [{address:mint(2),name:'Must not replace name',symbol:'WRONG',valueUsd:99999,logo:logo(mint(2))}];},
  logoFetcher:()=>assert.fail('Fallback should not run')}));
 await tick();assert.deepEqual(calls,[[mint(2)]]);
 assert.equal(f.image(mint(0)),working);assert.equal(f.image(mint(1)),loading);
 assert.equal(working.classList.contains('is-loaded'),true);assert.equal(loading.classList.contains('is-loaded'),false);
 assert.deepEqual(f.holdings.map(({logo,...coin})=>coin),before);assert.equal(f.reportState,state);assert.equal(state.focusedControl,focus);
 assert.deepEqual(f.mutations,[['append',mint(2)]]);
 const image=f.image(mint(2));assert.equal(image.alt,'');assert.equal(image.referrerPolicy,'no-referrer');assert.equal(image.loading,'lazy');assert.equal(image.width,32);assert.equal(image.height,32);
 assert.equal(f.slots.get(mint(2)).initial,'C');
});

test('new images preserve the initial until load and failures retain it after the one fallback',async t=>{
 const f=fixture(1),address=mint(0),initial=f.slots.get(address).initial;
 t.after(mountWalletHoldingLogos(f.root,f.holdings,{fetcher:noNetwork,
  metadataFetcher:async()=>[{address,logo:logo(address)}],logoFetcher:async()=>null}));
 await tick();const image=f.image(address);assert.equal(image.classList.contains('is-loaded'),false);assert.equal(f.slots.get(address).initial,initial);
 image.complete=true;image.naturalWidth=32;f.load(image);assert.equal(image.classList.contains('is-loaded'),true);
 f.error(image);await tick();assert.equal(f.image(address),null);assert.equal(f.slots.get(address).initial,initial);
});

test('wrong identities and unsafe metadata or fallback URLs never become images',async t=>{
 const unsafe=['javascript:alert(1)','data:image/svg+xml,test','http://cdn.example.com/a.png','https://127.0.0.1/a.png','https://user:secret@cdn.example.com/a.png'];
 const f=fixture(unsafe.length),fallback=[];
 t.after(mountWalletHoldingLogos(f.root,f.holdings,{fetcher:noNetwork,
  metadataFetcher:async addresses=>[{address:mint(100),logo:'https://cdn.example.com/wrong-mint.png'},...addresses.map((address,index)=>({address,logo:unsafe[index]}))],
  logoFetcher:async address=>{fallback.push(address);return unsafe[f.holdings.findIndex(coin=>coin.address===address)];}}));
 await tick();assert.deepEqual(fallback,f.holdings.map(coin=>coin.address));assert.deepEqual(f.mutations,[]);
 assert.ok(f.holdings.every(coin=>coin.logo===null));assert.ok([...f.slots.values()].every(slot=>slot.image===null));
});

test('secondary requests never exceed two concurrent lookups and each mint is attempted once',async t=>{
 const f=fixture(7),calls=[];let active=0,maximum=0;
 t.after(mountWalletHoldingLogos(f.root,f.holdings,{fetcher:noNetwork,metadataFetcher:async()=>[],
  logoFetcher:(address,options)=>{const pending=deferred();active++;maximum=Math.max(maximum,active);calls.push({address,options,...pending});return pending.promise.finally(()=>{active--;});}}));
 await tick();assert.equal(calls.length,2);
 for(let index=0;index<f.holdings.length;index++){
  const call=calls[index];assert.ok(call);assert.equal(call.options.fetcher,noNetwork);assert.equal(call.options.signal.aborted,false);
  call.resolve(logo(call.address));await tick();assert.ok(active<=2);
 }
 assert.equal(maximum,2);assert.equal(active,0);assert.equal(calls.length,7);assert.equal(new Set(calls.map(call=>call.address)).size,7);
 assert.ok(f.holdings.every(coin=>f.image(coin.address)?.src===logo(coin.address)));
});

test('a broken existing image tries metadata and one different fallback without retry loops',async t=>{
 const address=mint(0),broken='https://cdn.example.com/broken.png',replacement='https://cdn.example.com/replacement.png';
 const f=fixture(1,{images:new Map([[address,{src:broken,complete:true,naturalWidth:0}]])}),calls=[],fallback=[];
 t.after(mountWalletHoldingLogos(f.root,f.holdings,{fetcher:noNetwork,
  metadataFetcher:async addresses=>{calls.push(addresses);return [{address,logo:broken}];},
  logoFetcher:async mint=>{fallback.push(mint);return replacement;}}));
 await tick();assert.deepEqual(calls,[[address]]);assert.deepEqual(fallback,[address]);assert.equal(f.image(address).src,replacement);
 const image=f.image(address);f.error(image);f.error(image);await tick();
 assert.equal(f.image(address),null);assert.equal(f.holdings[0].logo,null);assert.equal(calls.length,1);assert.equal(fallback.length,1);
 assert.deepEqual(f.mutations,[['remove',address],['append',address],['remove',address]]);
});

test('a newly fetched image that fails receives one fallback and never re-fetches metadata',async t=>{
 const f=fixture(1),address=mint(0);let metadataCalls=0,fallbackCalls=0;
 t.after(mountWalletHoldingLogos(f.root,f.holdings,{fetcher:noNetwork,
  metadataFetcher:async()=>{metadataCalls++;return [{address,logo:logo(address)}];},
  logoFetcher:async()=>{fallbackCalls++;return logo(address);}}));
 await tick();assert.equal(fallbackCalls,0);
 f.error(f.image(address));await tick();
 assert.equal(f.image(address),null,'A URL that already failed must not be appended again');
 assert.equal(metadataCalls,1);assert.equal(fallbackCalls,1);assert.equal(f.holdings[0].logo,null);
});

test('metadata outage falls back once per mint and ordinary fallback errors remain isolated',async t=>{
 const f=fixture(35),fallback=[];let metadataCalls=0;
 t.after(mountWalletHoldingLogos(f.root,f.holdings,{fetcher:noNetwork,
  metadataFetcher:async()=>{metadataCalls++;throw Error('Metadata unavailable');},
  logoFetcher:async address=>{fallback.push(address);if(address===mint(0))throw Error('Optional image unavailable');return logo(address);}}));
 await tick();assert.equal(metadataCalls,1);assert.equal(fallback.length,35);assert.equal(new Set(fallback).size,35);
 assert.equal(f.image(mint(0)),null);assert.ok(f.holdings.slice(1).every(coin=>f.image(coin.address)?.src===logo(coin.address)));
});

test('a fallback rate limit stops queued requests while already-started work can finish',async t=>{
 const f=fixture(8),calls=[];
 t.after(mountWalletHoldingLogos(f.root,f.holdings,{fetcher:noNetwork,metadataFetcher:async()=>[],
  logoFetcher:address=>{const pending=deferred();calls.push({address,...pending});return pending.promise;}}));
 await tick();assert.equal(calls.length,2);
 calls[0].reject(Object.assign(Error('Rate limited'),{code:'rate'}));await tick();assert.equal(calls.length,2);
 calls[1].resolve(logo(calls[1].address));await tick();assert.equal(calls.length,2);assert.equal(f.mutations.length,1);
});

test('disposing before scheduled work starts makes no request and removes its error listener',async()=>{
 const f=fixture(3);let calls=0;
 const dispose=mountWalletHoldingLogos(f.root,f.holdings,{fetcher:noNetwork,metadataFetcher:async()=>{calls++;return [];},logoFetcher:async()=>{calls++;return null;}});
 assert.equal(f.listeners.size,2);dispose();await tick();assert.equal(calls,0);assert.equal(f.listeners.size,0);assert.deepEqual(f.mutations,[]);
});

test('late metadata completions after disposal cannot repaint or launch fallback work',async()=>{
 for(const reject of [false,true]){
  const f=fixture(35),pending=deferred();let metadataCalls=0,fallbackCalls=0,signal;
  const dispose=mountWalletHoldingLogos(f.root,f.holdings,{fetcher:noNetwork,
   metadataFetcher:(addresses,options)=>{metadataCalls++;signal=options.signal;return pending.promise;},
   logoFetcher:async()=>{fallbackCalls++;return logo(mint(0));}});
  await tick();dispose();assert.equal(signal.aborted,true);assert.equal(f.listeners.size,0);
  if(reject)pending.reject(Error('Late metadata failure'));else pending.resolve([{address:mint(0),logo:logo(mint(0))}]);
  await tick();assert.equal(metadataCalls,1);assert.equal(fallbackCalls,0);assert.deepEqual(f.mutations,[]);assert.ok(f.holdings.every(coin=>coin.logo===null));
 }
});

test('late fallback completions after disposal cannot repaint or drain queued requests',async()=>{
 const f=fixture(6),calls=[];
 const dispose=mountWalletHoldingLogos(f.root,f.holdings,{fetcher:noNetwork,metadataFetcher:async()=>[],
  logoFetcher:(address,options)=>{const pending=deferred();calls.push({address,options,...pending});return pending.promise;}});
 await tick();assert.equal(calls.length,2);dispose();assert.ok(calls.every(call=>call.options.signal.aborted));
 calls[0].resolve(logo(calls[0].address));calls[1].reject(Error('Late image failure'));await tick();
 assert.equal(calls.length,2);assert.deepEqual(f.mutations,[]);assert.equal(f.listeners.size,0);assert.ok(f.holdings.every(coin=>coin.logo===null));
});
