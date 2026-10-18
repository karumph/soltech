import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {scannerFeedHTML,scannerPostUrl,normalizeScannerFeedSnapshot,mountScannerFeed} from '../dist/scanner-feed.js';

const address='So11111111111111111111111111111111111111112',other='1'.repeat(31)+'2';
const time='2026-10-12T16:00:00.000Z';
const coin=(patch={})=>({id:address,chain:'solana',address,name:'First coin',symbol:'FIRST',imageUrl:'https://cdn.dexscreener.com/token.png',discoveredAt:time,marketCap:0,liquidity:null,volume24h:null,poolCreatedAt:null,stage:'discovered',match:{kind:'launch',label:'New market discovered',evidence:[]},checks:{status:'pending',label:'',items:[]},filter:{status:'pending',reason:''},...patch});
const group=(patch={})=>({id:'group-1',kind:'launch',createdAt:time,updatedAt:time,post:null,summary:'A trading pool appeared in the source.',coins:[coin()],...patch});
const snapshot=(patch={})=>({version:1,revision:1,status:'paused',updatedAt:time,message:'',sources:{posts:{status:'disconnected',message:'X is not connected.'},projects:{status:'idle',message:''}},counts:{discovered:0,matched:0,checked:0,finds:0},groups:[],connection:{status:'connected',message:''},...patch});
const post=(patch={})=>({id:'12345',author:'Post author',handle:'source',text:'A source post.',url:'https://x.com/source/status/12345',publishedAt:time,...patch});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

// A small DOM implements identity, parentage, focus and events rather than
// recreating nodes on query. Replacing a subtree clears focus like a browser.
class Node {
 constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.attrs=new Map();this.dataset={};this.className='';this.hidden=false;this.disabled=false;this.handlers=new Map();this._text='';this.classList={add:name=>{this.className+=' '+name;}};}
 get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
 set textContent(value){for(const child of [...this.children])child.remove();this._text=String(value);}
 get parentElement(){return this.parentNode;}
 get lastElementChild(){return this.children.at(-1);}
 get isConnected(){return this===this.ownerDocument.root||!!this.parentNode?.isConnected;}
 append(node){if(node.parentNode)node.remove();node.parentNode=this;this.children.push(node);}
 insertBefore(node,next){if(node.parentNode)node.remove();node.parentNode=this;const index=this.children.indexOf(next);if(index<0)this.children.push(node);else this.children.splice(index,0,node);}
 remove(){if(this.contains(this.ownerDocument.activeElement))this.ownerDocument.activeElement=null;if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null;}}
 contains(node){return node===this||this.children.some(child=>child.contains(node));}
 setAttribute(key,value){this.attrs.set(key,String(value));}
 getAttribute(key){return this.attrs.get(key)??null;}
 removeAttribute(key){this.attrs.delete(key);}
 matches(selector){if(selector.startsWith('.'))return this.className.split(' ').includes(selector.slice(1));const attr=selector.match(/^\[([^\]]+)\]$/)?.[1];return attr?this.attrs.has(attr)||attr.startsWith('data-')&&Object.hasOwn(this.dataset,attr.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())):false;}
 querySelector(selector){for(const node of this.children){if(node.matches(selector))return node;const found=node.querySelector(selector);if(found)return found;}return null;}
 closest(selector){return this.matches(selector)?this:this.parentNode?.closest(selector)||null;}
 focus(options){this.ownerDocument.activeElement=this;this.focusOptions=options;}
 addEventListener(type,callback){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(callback);}
 removeEventListener(type,callback){this.handlers.get(type)?.delete(callback);}
 dispatch(type,target=this){for(const callback of this.handlers.get(type)||[])callback({target,preventDefault(){}});}
 getBoundingClientRect(){return {top:0,bottom:100};}
 set innerHTML(value){throw new Error('Live feed updates must not replace HTML subtrees: '+value);}
}
function mounted(t,initial=snapshot(),options={}){
 const doc={activeElement:null,defaultView:{scrollY:0,innerHeight:844},createElement(tag){return new Node(tag,this);}},root=new Node('main',doc);doc.root=root;
 const feed=new Node('section',doc);feed.className='scanner-feed';root.append(feed);
 for(const [key,tag] of [['groups','ol'],['status','p'],['error','p'],['empty','div'],['empty-title','h3'],['empty-copy','p'],['posts','span'],['projects','span'],['updated','time'],['refresh','button'],['copy-status','p']]){const node=new Node(tag,doc);node.setAttribute('data-scanner-feed-'+key,'');feed.append(node);}
 let callback,unsubscribed=0,refreshes=0;
 const client={state:initial,subscribe(fn){callback=fn;fn(this.state);return ()=>{unsubscribed++;callback=null;};},refresh(){refreshes++;return options.refresh?.()??Promise.resolve();}};
 const messages=[],copies=[];
 const dispose=mountScannerFeed(root,{client,toast:message=>messages.push(message),clipboard:options.clipboard===null?null:{writeText:async value=>{copies.push(value);return options.copy?.(value);}}});t.after(dispose);
 const at=key=>feed.querySelector(`[data-scanner-feed-${key}]`),emit=next=>{client.state=next;callback?.(next);};
 return {root,feed,doc,client,messages,copies,dispose,at,emit,get unsubscribed(){return unsubscribed;},get refreshes(){return refreshes;},click:node=>feed.dispatch('click',node)};
}

test('feed shell has accessible status, refresh and an honest empty state without sample records',()=>{
 const html=scannerFeedHTML();assert.match(html,/role="status"/);assert.match(html,/role="alert"/);assert.match(html,/X posts · Not connected/);assert.match(html,/href="#scanner"/);assert.doesNotMatch(html,/Bonk|POPCAT|fictional|<li|onerror=/);assert.match(html,/data-scanner-feed-groups><\/ol>/);
});
test('normalization validates identities and bounds source text, metrics and duplicate coins',()=>{
 const result=normalizeScannerFeedSnapshot(snapshot({groups:[group({coins:[coin({name:'x'.repeat(1000),marketCap:NaN,liquidity:-1}),coin(),coin({address:'bad'}),coin({address:other,id:'other',chain:'ethereum'})]}),group()]}));
 assert.equal(result.groups.length,1);assert.equal(result.groups[0].coins.length,1);assert.equal(result.groups[0].coins[0].name.length,160);assert.equal(result.groups[0].coins[0].marketCap,null);assert.equal(result.groups[0].coins[0].liquidity,null);assert.equal(result.omitted,4);
 for(const value of [null,{},[],snapshot({version:2}),snapshot({groups:'wrong'})])assert.throws(()=>normalizeScannerFeedSnapshot(value),/could not be read/);
});
test('post links require the exact public source ID and images reject arbitrary hosts and schemes',()=>{
 assert.equal(scannerPostUrl('https://twitter.com/source/status/12345?tracking=1','12345'),'https://x.com/source/status/12345');
 for(const url of ['https://x.com/source/status/999','javascript:alert(1)','https://x.com.evil.test/source/status/12345','https://evil@x.com/source/status/12345','http://x.com/source/status/12345','https://x.com/source/status/12345/extra'])assert.equal(scannerPostUrl(url,'12345'),'');
 for(const imageUrl of ['data:image/svg+xml,<svg/>','https://localhost/x','https://evil.test/x','https://cdn.dexscreener.com.evil.test/x','https://a:b@cdn.dexscreener.com/x'])assert.equal(normalizeScannerFeedSnapshot(snapshot({groups:[group({coins:[coin({imageUrl})]})]})).groups[0].coins[0].imageUrl,'');
});
test('missing reports stay pending, zero market cap stays zero, and launch groups do not imply a new project',t=>{
 const f=mounted(t,snapshot({groups:[group()]}));assert.match(f.feed.textContent,/Checks pending/);assert.match(f.feed.textContent,/\$0/);assert.match(f.feed.textContent,/does not confirm a new project/);assert.match(f.feed.textContent,/Pool createdTime unavailable/);assert.match(f.feed.textContent,/X posts · Not connected/);
});
test('launch header is compact while the pool and project distinction remains inside Details',t=>{
 const f=mounted(t,snapshot({groups:[group()]}));assert.equal(f.feed.querySelector('.scanner-feed-source-label').textContent,'New markets');assert.equal(f.feed.querySelector('.scanner-feed-post-text').textContent,'Newly indexed Solana pools');assert.equal(f.feed.querySelector('.scanner-feed-author').hidden,true);assert.equal(f.feed.querySelector('.scanner-feed-overview').hidden,true);
 const details=f.feed.querySelector('.scanner-feed-details'),note=details.querySelector('.scanner-feed-market-note');assert.equal(note.hidden,false);assert.match(note.textContent,/does not confirm a new project/);
});
test('completed flagged checks retain their warning and the actual authority detail',t=>{
 const f=mounted(t,snapshot({groups:[group({coins:[coin({stage:'ready',marketCheckedAt:time,checks:{status:'complete',label:'Authority active',items:[{key:'mintAuthority',label:'Mint authority',status:'flag',detail:'More tokens can be minted.'}]}})]})]}));
 assert.equal(f.feed.querySelector('.scanner-feed-checks').getAttribute('data-tone'),'warning');assert.match(f.feed.querySelector('.scanner-feed-check-list').textContent,/More tokens can be minted/);assert.match(f.feed.querySelector('.scanner-feed-metrics').textContent,/Market data updated/);assert.doesNotMatch(f.feed.querySelector('.scanner-feed-metrics').children.at(-1).textContent,/unavailable/);
 f.click(f.at('refresh'));assert.equal(f.feed.querySelector('.scanner-feed-checks').getAttribute('data-tone'),'warning');
});
test('excluded coins show their reason without expanding details and group counts distinguish pending',t=>{
 const f=mounted(t,snapshot({groups:[group({coins:[coin({filter:{status:'excluded',reason:'Liquidity is below your minimum.'}}),coin({id:other,address:other})]})]}));
 const notice=f.feed.querySelector('.scanner-feed-excluded');assert.equal(notice.hidden,false);assert.match(notice.textContent,/Liquidity is below your minimum/);assert.equal(f.feed.querySelector('.scanner-feed-group-count').textContent,'0 coins match your filters · 1 pending · 1 outside filters');
});
test('trading-link matches do not claim the token publisher linked the post',t=>{
 const f=mounted(t,snapshot({groups:[group({coins:[coin({match:{kind:'link',label:'',evidence:[]}})]})]}));assert.equal(f.feed.querySelector('.scanner-feed-match').textContent,'Trading link identifies this coin');
});
test('post text and server summaries are plain text, with an exact source action',t=>{
 const f=mounted(t,snapshot({groups:[group({kind:'post',post:post({text:'<img src=x onerror=alert(1)>'}),summary:'<script>summary</script>',summaryStatus:'excerpt'})]}));
 assert.equal(f.feed.querySelector('.scanner-feed-post-text').textContent,'<img src=x onerror=alert(1)>');assert.match(f.feed.querySelector('.scanner-feed-overview').textContent,/<script>summary<\/script>/);assert.equal(f.feed.querySelector('.scanner-feed-post-meta').children[1].getAttribute('href'),'https://x.com/source/status/12345');
});
test('original long post text, avatar and ordered media are normalized without inventing missing media',()=>{
 const media=[{type:'photo',url:'https://pbs.twimg.com/media/one.jpg',alt:'Original caption',width:1200,height:800},{type:'video',url:'https://video.twimg.com/clip.mp4',previewUrl:'https://pbs.twimg.com/poster.jpg'},{type:'animated_gif',url:'https://video.twimg.com/animation.mp4'},{type:'photo',url:'https://pbs.twimg.com/media/four.jpg'},{type:'photo',url:'https://pbs.twimg.com/media/five.jpg'}];
 const normalized=normalizeScannerFeedSnapshot(snapshot({groups:[group({kind:'post',post:post({text:'x'.repeat(25000),avatarUrl:'https://pbs.twimg.com/profile_images/avatar.jpg',media}),summaryStatus:'excerpt'})]})).groups[0];
 assert.equal(normalized.post.text.length,25000);assert.equal(normalized.post.displayText.length,25000);assert.equal(normalized.post.avatarUrl,'https://pbs.twimg.com/profile_images/avatar.jpg');assert.equal(normalized.post.media.length,4);assert.deepEqual(normalized.post.media.map(item=>item.type),['photo','video','animated_gif','photo']);assert.equal(normalized.post.media[0].alt,'Original caption');assert.equal(normalized.summaryStatus,'excerpt');
});
test('post media and avatars accept only trusted source hosts or the exact isolated asset route',()=>{
 const bad=['https://pbs.twimg.com.evil.test/x.png','https://evil@pbs.twimg.com/x.png','http://pbs.twimg.com/x.png','https://cdn.dexscreener.com/x.png','data:image/png;base64,AAA','/original/assets/../private.png','/original/assets/a.png?path=x','/api/private.png'];
 for(const value of bad){const p=normalizeScannerFeedSnapshot(snapshot({groups:[group({kind:'post',post:post({avatarUrl:value,media:[{type:'photo',url:value}]})})]})).groups[0].post;assert.equal(p.avatarUrl,'');assert.equal(p.media.length,0);}
 const p=normalizeScannerFeedSnapshot(snapshot({groups:[group({kind:'post',post:post({imageUrl:'https://pbs.twimg.com/legacy.jpg'})})]})).groups[0].post;
 assert.equal(p.media[0].url,'https://pbs.twimg.com/legacy.jpg');
 const local=normalizeScannerFeedSnapshot(snapshot({groups:[group({kind:'post',post:post({media:[{type:'photo',url:'/original/assets/x-logo.png'}]})})]})).groups[0].post;assert.equal(local.media.length,1);
});
test('summary status distinguishes an excerpt from missing text and unmarked summaries',t=>{
 const f=mounted(t,snapshot({groups:[group({kind:'post',post:post(),summary:'A source post.',summaryStatus:'excerpt'})]}));
 assert.equal(f.feed.querySelector('.scanner-feed-summary-label').textContent,'Post in brief');assert.match(f.feed.querySelector('.scanner-feed-summary-hint').textContent,/Short excerpt/);
 f.emit(snapshot({groups:[group({kind:'post',post:post({text:'',media:[{type:'photo',url:'https://pbs.twimg.com/media/photo.jpg'}]}),summary:'Invented picture description',summaryStatus:'unavailable'})]}));
 assert.equal(f.feed.querySelector('.scanner-feed-post-text').hidden,true);assert.equal(f.feed.querySelector('.scanner-feed-summary-hint').hidden,true);assert.match(f.feed.querySelector('.scanner-feed-overview').textContent,/Text summary unavailable/);assert.doesNotMatch(f.feed.textContent,/Invented picture description|no longer available/);
 f.emit(snapshot({groups:[group({kind:'post',post:post(),summary:'Legacy inferred summary'})]}));assert.doesNotMatch(f.feed.textContent,/Legacy inferred summary/);
});
test('missing attachments and incomplete text have a visible notice even without media nodes',t=>{
 const f=mounted(t,snapshot({groups:[group({kind:'post',post:post({displayText:'Only the returned part…',textIncomplete:true,mediaUnavailable:true,media:[]})})]}));
 const notice=f.feed.querySelector('.scanner-feed-source-notice');assert.equal(notice.hidden,false);assert.match(notice.textContent,/Only part of the post text/);assert.match(notice.textContent,/Attached media is unavailable/);assert.equal(f.feed.querySelector('.scanner-feed-media').hidden,true);assert.equal(f.feed.querySelector('.scanner-feed-post-text').textContent,'Only the returned part…');
 f.emit(snapshot({groups:[group({kind:'post',post:post({text:'x'.repeat(50001)})})]}));assert.equal(f.feed.querySelector('.scanner-feed-post-text').textContent.length,50000);assert.match(notice.textContent,/Only part/);
 f.emit(snapshot({groups:[group({kind:'post',post:post()})]}));assert.equal(notice.hidden,true);
});
test('reposts retain displayed source wording but never claim a summary of the monitored author’s own text',t=>{
 const content=post({text:'',displayText:'RT @original: original post wording',context:{kind:'repost',referencedPostId:'98765',url:'https://x.com/i/status/98765'}});
 const f=mounted(t,snapshot({groups:[group({kind:'post',post:content,summary:'Wrong ownership claim',summaryStatus:'excerpt'})]}));
 assert.equal(f.feed.querySelector('.scanner-feed-source-label').textContent,'Reposted on X');assert.equal(f.feed.querySelector('.scanner-feed-post-text').textContent,content.displayText);assert.equal(f.feed.querySelector('.scanner-feed-author').textContent,'Post author');assert.doesNotMatch(f.feed.querySelector('.scanner-feed-overview').textContent,/Wrong ownership/);assert.equal(f.feed.querySelector('.scanner-feed-context-link').getAttribute('href'),'https://x.com/i/status/98765');
 f.click(f.at('refresh'));assert.equal(f.feed.querySelector('.scanner-feed-context-link').getAttribute('href'),'https://x.com/i/status/98765');
 for(const [kind,label] of [['reply','Reply on X'],['quote','Quote post on X'],['original','X post']]){f.emit(snapshot({groups:[group({kind:'post',post:post({context:{kind,referencedPostId:'98765',url:'https://x.com/i/status/11111'}})})]}));assert.equal(f.feed.querySelector('.scanner-feed-source-label').textContent,label);assert.equal(f.feed.querySelector('.scanner-feed-context-link').hidden,true);}
});
test('coin updates keep controlled video, gallery images, focus and open details in place',t=>{
 const source=post({avatarUrl:'https://pbs.twimg.com/avatar.jpg',media:[{type:'photo',url:'https://pbs.twimg.com/photo.jpg',alt:'A source illustration'},{type:'video',url:'https://video.twimg.com/clip.mp4',previewUrl:'https://pbs.twimg.com/poster.jpg',alt:'Source clip'}]});
 const f=mounted(t,snapshot({groups:[group({kind:'post',post:source})]})),video=f.feed.querySelector('.scanner-feed-post-video'),image=f.feed.querySelector('.scanner-feed-post-image'),details=f.feed.querySelector('.scanner-feed-details');
 assert.equal(video.controls,true);assert.equal(video.playsInline,true);assert.equal(video.getAttribute('autoplay'),null);assert.equal(video.getAttribute('loop'),null);assert.equal(video.getAttribute('preload'),'metadata');assert.equal(video.getAttribute('poster'),'https://pbs.twimg.com/poster.jpg');assert.equal(image.alt,'A source illustration');
 video.currentTime=12.5;video.paused=false;video.focus();details.open=true;let srcChanges=0;const setAttribute=video.setAttribute.bind(video);video.setAttribute=(key,value)=>{if(key==='src')srcChanges++;setAttribute(key,value);};
 f.emit(snapshot({revision:2,groups:[group({kind:'post',post:source,coins:[coin({stage:'ready'}),coin({address:other})]})]}));
 assert.equal(f.feed.querySelector('.scanner-feed-post-video'),video);assert.equal(f.feed.querySelector('.scanner-feed-post-image'),image);assert.equal(video.currentTime,12.5);assert.equal(video.paused,false);assert.equal(f.doc.activeElement,video);assert.equal(details.open,true);assert.equal(srcChanges,0);
});
test('animated media has manual controls and removed or disposed media is paused',t=>{
 const source=post({media:[{type:'animated_gif',url:'https://video.twimg.com/animation.mp4'}]});
 const f=mounted(t,snapshot({groups:[group({kind:'post',post:source})]})),video=f.feed.querySelector('.scanner-feed-post-video');let paused=0;video.pause=()=>paused++;
 assert.equal(video.controls,true);assert.equal(video.getAttribute('autoplay'),null);f.dispose();assert.equal(paused,1);
 const otherFeed=mounted(t,snapshot({groups:[group({kind:'post',post:source})]})),otherVideo=otherFeed.feed.querySelector('.scanner-feed-post-video');otherVideo.pause=()=>paused++;otherVideo.focus();otherFeed.emit(snapshot());assert.equal(paused,2);assert.equal(otherFeed.doc.activeElement,otherFeed.at('refresh'));
});
test('failed post media leaves an explanation and original source text without repeatedly reloading',t=>{
 const source=post({media:[{type:'video',url:'https://video.twimg.com/clip.mp4'}]});
 const f=mounted(t,snapshot({groups:[group({kind:'post',post:source})]})),video=f.feed.querySelector('.scanner-feed-post-video');f.feed.dispatch('error',video);
 assert.equal(video.hidden,true);assert.equal(f.feed.querySelector('.scanner-feed-media-fallback').hidden,false);assert.match(f.feed.querySelector('.scanner-feed-media-fallback').textContent,/Video unavailable/);assert.equal(f.feed.querySelector('.scanner-feed-post-text').textContent,'A source post.');f.emit(snapshot({revision:2,groups:[group({kind:'post',post:source})]}));assert.equal(f.feed.querySelector('.scanner-feed-post-video'),video);assert.equal(video.hidden,true);
});
test('progressive updates preserve focused copy button, open details and existing coin nodes',t=>{
 const f=mounted(t,snapshot({groups:[group()]})),first=f.feed.querySelector('.scanner-feed-coin'),details=first.querySelector('.scanner-feed-details'),copy=first.querySelector('.scanner-feed-copy');
 details.open=true;copy.focus();
 f.emit(snapshot({revision:2,status:'running',groups:[group({coins:[coin({stage:'ready',marketCap:12000,checks:{status:'complete',label:'Reported checks complete',items:[{label:'Minting',value:'Disabled'}]}}),coin({id:other,address:other,name:'Another coin'})]})]}));
 assert.equal(f.feed.querySelector('.scanner-feed-coin'),first);assert.equal(first.querySelector('.scanner-feed-details'),details);assert.equal(details.open,true);assert.equal(f.doc.activeElement,copy);assert.equal(f.feed.querySelector('.scanner-feed-coins').children.length,2);assert.match(first.textContent,/\$12K/);assert.match(first.textContent,/Minting: Disabled/);
 f.emit(snapshot({revision:3,groups:[group({coins:[coin({id:other,address:other,name:'Another coin'}),coin()]})]}));assert.equal(f.feed.querySelector('.scanner-feed-coin'),first,'existing visual order remains stable when a provider reorders its array');
});
test('removed focused rows move focus to Refresh without scrolling',t=>{
 const f=mounted(t,snapshot({groups:[group()]}));f.feed.querySelector('.scanner-feed-copy').focus();f.emit(snapshot());assert.equal(f.doc.activeElement,f.at('refresh'));assert.deepEqual(f.at('refresh').focusOptions,{preventScroll:true});assert.equal(f.at('groups').children.length,0);
});
test('newer groups are inserted above older groups without moving existing focused rows',t=>{
 const f=mounted(t,snapshot({groups:[group()]})),first=f.at('groups').children[0],button=first.querySelector('.scanner-feed-copy');button.focus();
 f.emit(snapshot({groups:[group(),group({id:'newer',createdAt:'2026-10-12T17:00:00.000Z',coins:[coin({name:'Newer coin'})]}),group({id:'oldest',createdAt:'2026-10-12T15:00:00.000Z',coins:[]})]}));
 assert.equal(f.at('groups').children[1],first);assert.match(f.at('groups').children[0].textContent,/Newer coin/);assert.equal(f.doc.activeElement,button);
});
test('persistence failure is visible even while the connection is also offline',t=>{
 const f=mounted(t,snapshot({persistent:false,persistenceError:'Results could not be saved on this device.',connection:{status:'offline',message:'Cannot reach the scanner.'}}));assert.equal(f.at('error').hidden,false);assert.match(f.at('error').textContent,/could not be saved/);assert.match(f.at('error').textContent,/Cannot reach/);
});
test('source failure details are visible on touch screens without relying on a title tooltip',t=>{
 const f=mounted(t,snapshot({status:'running',sources:{posts:{status:'disconnected'},projects:{status:'error',message:'The market provider did not respond. Try again later.'}}}));assert.match(f.at('status').textContent,/Some sources are unavailable/);assert.equal(f.at('error').hidden,false);assert.match(f.at('error').textContent,/market provider did not respond/);
});
test('offline snapshots retain existing results and distinguish connection failure from no matches',t=>{
 const f=mounted(t,snapshot({groups:[group()]})),row=f.feed.querySelector('.scanner-feed-coin');f.emit(snapshot({groups:[group()],connection:{status:'offline',message:'The scanner cannot be reached.'}}));assert.equal(f.feed.querySelector('.scanner-feed-coin'),row);assert.match(f.at('status').textContent,/Showing saved results/);assert.equal(f.at('error').hidden,false);assert.match(f.at('error').textContent,/cannot be reached/);assert.equal(f.at('empty').hidden,true);
});
test('copy writes the full known address and announces success only after completion',async t=>{
 const pending=deferred(),f=mounted(t,snapshot({groups:[group()]}),{copy:()=>pending.promise}),button=f.feed.querySelector('.scanner-feed-copy');f.click(button);f.click(button);assert.deepEqual(f.copies,[address]);assert.equal(button.disabled,true);assert.deepEqual(f.messages,[]);pending.resolve();await tick();assert.equal(button.disabled,false);assert.equal(f.at('copy-status').textContent,'First coin address copied.');assert.equal(f.messages.length,1);
});
test('failed and unsupported clipboard access reveal a selectable full address',async t=>{
 for(const options of [{clipboard:null},{copy:()=>Promise.reject(new Error('denied'))}]){
  const f=mounted(t,snapshot({groups:[group()]}),options),button=f.feed.querySelector('.scanner-feed-copy');f.click(button);await tick();assert.match(f.at('copy-status').textContent,/Couldn’t copy/);assert.equal(f.feed.querySelector('.scanner-feed-address').children[1].textContent,address);
  f.emit(snapshot({revision:2,groups:[group()]}));assert.equal(f.feed.querySelector('.scanner-feed-address').children[1].textContent,address,'refresh preserves manual-copy text');
 }
});
test('forged copy controls and results arriving after disposal cannot act',async t=>{
 const pending=deferred(),f=mounted(t,snapshot({groups:[group()]}),{copy:()=>pending.promise}),forged=new Node('button',f.doc);forged.dataset.scannerFeedCopy=other;f.feed.append(forged);f.click(forged);assert.deepEqual(f.copies,[]);
 f.click(f.feed.querySelector('.scanner-feed-copy'));f.dispose();pending.resolve();await tick();assert.deepEqual(f.messages,[]);assert.equal(f.unsubscribed,1);f.dispose();assert.equal(f.unsubscribed,1);
});
test('Refresh prevents overlapping requests, surfaces failure, and clears it on recovery',async t=>{
 const pending=deferred(),f=mounted(t,snapshot({groups:[group()]}),{refresh:()=>pending.promise});f.click(f.at('refresh'));f.click(f.at('refresh'));assert.equal(f.refreshes,1);assert.equal(f.at('refresh').disabled,true);pending.reject(new Error('Connection interrupted. Try again.'));await tick();assert.match(f.at('error').textContent,/Connection interrupted/);assert.equal(f.at('refresh').disabled,false);assert.match(f.feed.textContent,/First coin/);
 f.emit(snapshot({revision:2,groups:[group()]}));assert.equal(f.at('error').hidden,true);
});
test('unreadable updates do not erase previous results',t=>{
 const f=mounted(t,snapshot({groups:[group()]})),row=f.feed.querySelector('.scanner-feed-coin');f.emit({version:1,groups:'bad'});assert.equal(f.feed.querySelector('.scanner-feed-coin'),row);assert.match(f.at('error').textContent,/could not be read/);
});
test('failed images keep initials visible and missing wrappers are safe',t=>{
 const f=mounted(t,snapshot({groups:[group()]})),image=f.feed.querySelector('.scanner-feed-logo').children[1];f.feed.dispatch('error',image);assert.equal(image.hidden,true);f.emit(snapshot({groups:[group()]}));assert.equal(image.hidden,true);assert.equal(f.feed.querySelector('.scanner-feed-logo').children[0].textContent,'F');assert.doesNotThrow(()=>mountScannerFeed({querySelector:()=>null},{client:{}})());
});
test('phone layout has shrinking tracks, wrapped addresses and 44px controls without fixed content widths',async()=>{
 const css=await readFile(new URL('../dist/scanner-feed.css',import.meta.url),'utf8');assert.match(css,/@media\(max-width:560px\)/);assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);assert.match(css,/min-height:44px/);assert.match(css,/overflow-wrap:anywhere/);assert.match(css,/@media\(forced-colors:active\)/);assert.doesNotMatch(css,/animation:|min-width:(?:[3-9]\d{2}|\d{4})px/);
});
