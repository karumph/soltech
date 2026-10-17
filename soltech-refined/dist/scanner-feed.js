import {validMint,safeImageUrl} from './coin-checker-data.js';

const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(value,max=300)=>typeof value==='string'?value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,'').trim().slice(0,max):'';
const money=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
const date=value=>typeof value==='string'&&value.length<50&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const choice=(value,options,fallback)=>options.includes(value)?value:fallback;
const imageHosts=/(^|\.)(dexscreener\.com|geckoterminal\.com|coingecko\.com|ipfs\.io|pump\.fun|arweave\.net|twimg\.com)$/i;
const imageUrl=value=>{const url=safeImageUrl(value);return url&&imageHosts.test(new URL(url).hostname)?url:'';};
// Source media is restricted separately from token logos. The exact local asset
// route supports the isolated UI fixture without allowing arbitrary local URLs.
const postMediaUrl=(value,type='photo')=>{
 if(typeof value==='string'&&/^\/original\/assets\/[A-Za-z0-9_-]+\.(?:png|jpe?g|webp|gif|mp4|webm)$/i.test(value))return value;
 const safe=safeImageUrl(value);if(!safe)return '';
 const url=new URL(safe),host=type==='photo'?'pbs.twimg.com':'video.twimg.com';
 return url.hostname===host&&(!url.port||url.port==='443')?safe:'';
};
const sourceText=value=>typeof value==='string'?value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,'').slice(0,50000):'';
function postMedia(value,legacy){
 const source=Array.isArray(value)&&value.length?value:[{type:'photo',url:legacy}],media=[],seen=new Set();
 for(const item of source.slice(0,4)){
  if(!record(item)||!['photo','video','animated_gif'].includes(item.type))continue;
  const url=postMediaUrl(item.url,item.type),previewUrl=postMediaUrl(item.previewUrl),key=item.type+':'+(url||previewUrl);
  if((!url&&!previewUrl)||seen.has(key))continue;seen.add(key);
  const dimension=value=>Number.isInteger(value)&&value>0&&value<=20000?value:null;
  media.push({type:item.type,url,previewUrl,alt:text(item.alt,2000),width:dimension(item.width),height:dimension(item.height)});
 }
 return media;
}
const shortAddress=value=>value.slice(0,4)+'…'+value.slice(-4);
const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1});
const timeFormat=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const formatTime=value=>value?timeFormat.format(new Date(value)):'Time unavailable';
const formatMoney=value=>value===null?'—':usd.format(value);
const list=value=>(Array.isArray(value)?value:[]).slice(0,30).map(item=>typeof item==='string'?text(item,500):record(item)?[text(item.label,160),text(item.detail||item.text||item.value||item.message,500)||text(item.status,80)].filter(Boolean).join(': '):'').filter(Boolean);

export function scannerPostUrl(value,id){
 if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\u007f]/.test(value))return '';
 try{
  const url=new URL(value),match=url.pathname.match(/^\/(?:[A-Za-z0-9_]{1,15}|i\/web)\/status\/(\d{1,25})\/?$/);
  if(url.protocol!=='https:'||url.username||url.password||!['x.com','www.x.com','twitter.com','www.twitter.com'].includes(url.hostname)||!match||match[1]!==id)return '';
  return 'https://x.com'+url.pathname.replace(/\/$/,'');
 }catch{return '';}
}

function contextPostUrl(value,id){
 if(typeof value!=='string'||!/^[0-9]{1,25}$/.test(id||''))return '';
 return value==='https://x.com/i/status/'+id?value:scannerPostUrl(value,id);
}

function normalizeCoin(value){
 if(!record(value)||value.chain!=='solana'||!validMint(value.address))return null;
 const items=Array.isArray(value.checks?.items)?value.checks.items:[];
 const checkTone=items.some(item=>item?.status==='flag')||value.checks?.tone==='warning'?'warning':items.some(item=>item?.status==='unknown')||value.checks?.status==='unavailable'||value.checks?.tone==='incomplete'?'incomplete':'neutral';
 return {id:text(value.id,180)||value.address,chain:'solana',address:value.address,name:text(value.name,160)||'Unnamed coin',symbol:text(value.symbol,40),imageUrl:imageUrl(value.imageUrl),
  discoveredAt:date(value.discoveredAt),marketCap:money(value.marketCap),liquidity:money(value.liquidity),volume24h:money(value.volume24h),poolCreatedAt:date(value.poolCreatedAt),marketCheckedAt:date(value.marketCheckedAt),
  stage:choice(value.stage,['discovered','checking','ready','unavailable'],'discovered'),
  match:{kind:choice(value.match?.kind,['address','link','possible','unresolved','launch'],'unresolved'),label:text(value.match?.label,180),evidence:list(value.match?.evidence)},
  checks:{status:choice(value.checks?.status,['pending','complete','unavailable'],'pending'),label:text(value.checks?.label,180),tone:checkTone,items:list(value.checks?.items)},
  filter:{status:choice(value.filter?.status,['pass','pending','excluded'],'pending'),reason:text(value.filter?.reason,500)}};
}

export function normalizeScannerFeedSnapshot(value){
 if(!record(value)||value.version!==1||!Array.isArray(value.groups)||value.groups.length>200)throw new Error('These feed results could not be read. Try refreshing.');
 const seen=new Set(),groups=[];let omitted=0;
 for(const entry of value.groups){
  if(!record(entry)||!text(entry.id,180)||seen.has(text(entry.id,180))||!['post','launch'].includes(entry.kind)||!Array.isArray(entry.coins)||entry.coins.length>500){omitted++;continue;}
  const id=text(entry.id,180);seen.add(id);
  const post=record(entry.post)?{id:text(entry.post.id,25),author:text(entry.post.author,160),handle:text(entry.post.handle,80),text:sourceText(entry.post.text),displayText:sourceText(entry.post.displayText??entry.post.text),textIncomplete:entry.post.textIncomplete===true||(entry.post.displayText??entry.post.text)?.length>50000,mediaUnavailable:entry.post.mediaUnavailable===true,publishedAt:date(entry.post.publishedAt),avatarUrl:postMediaUrl(entry.post.avatarUrl),imageUrl:postMediaUrl(entry.post.imageUrl),media:postMedia(entry.post.media,entry.post.imageUrl)}:null;
  if(post){post.url=scannerPostUrl(entry.post.url,post.id);const context=entry.post.context;post.context={kind:choice(context?.kind,['original','reply','quote','repost'],'original'),referencedPostId:text(context?.referencedPostId,25),url:contextPostUrl(context?.url,context?.referencedPostId)};}
  const coins=[],coinIds=new Set();
  for(const item of entry.coins){const coin=normalizeCoin(item);if(!coin||coinIds.has(coin.address)){omitted++;continue;}coinIds.add(coin.address);coins.push(coin);}
  groups.push({id,kind:entry.kind,createdAt:date(entry.createdAt),updatedAt:date(entry.updatedAt),post,summary:text(entry.summary,2000),summaryStatus:choice(entry.summaryStatus,['excerpt','unavailable'],'unavailable'),coins});
 }
 const source=(key,statuses,fallback)=>({status:choice(value.sources?.[key]?.status,statuses,fallback),message:text(value.sources?.[key]?.message,500)});
 return {version:1,revision:Number.isSafeInteger(value.revision)?value.revision:0,status:choice(value.status,['paused','running'],'paused'),updatedAt:date(value.updatedAt),message:text(value.message,500),persistent:value.persistent!==false,persistenceError:text(value.persistenceError,500),groups,omitted,
  sources:{posts:source('posts',['disconnected','ready','running','error'],'disconnected'),projects:source('projects',['idle','running','error'],'idle')},
  connection:{status:choice(value.connection?.status,['connecting','connected','offline'],'connected'),message:text(value.connection?.message,500)}};
}

export function scannerFeedHTML(){
 return `<section class="scanner-feed" aria-labelledby="scanner-feed-title">
  <header class="scanner-feed-heading"><h2 id="scanner-feed-title">Scanner feed</h2><button class="scanner-feed-refresh" type="button" data-scanner-feed-refresh>Refresh</button></header>
  <p class="scanner-feed-status" role="status" aria-live="polite" data-scanner-feed-status>Connecting to your scanner…</p>
  <p class="scanner-feed-error" role="alert" data-scanner-feed-error hidden></p>
  <div class="scanner-feed-empty" data-scanner-feed-empty><h3 data-scanner-feed-empty-title>Loading your feed</h3><p data-scanner-feed-empty-copy>Waiting for your scanner’s saved results.</p><a href="#scanner">Open Scanner</a></div>
  <ol class="scanner-feed-groups" aria-label="Posts and discovered markets" data-scanner-feed-groups></ol>
  <footer class="scanner-feed-sources" aria-label="Source availability"><span data-scanner-feed-posts>X posts · Not connected</span><span data-scanner-feed-projects>New projects · Waiting</span><time data-scanner-feed-updated></time></footer>
  <p class="scanner-feed-copy-status sr-only" role="status" aria-live="polite" data-scanner-feed-copy-status></p>
 </section>`;
}

// New groups/coins get nodes once. Subsequent snapshots patch fields in place so
// native details, text selection, keyboard focus, and existing rows survive.
export function mountScannerFeed(root,{client,toast=()=>{},clipboard}={}){
 const feed=root?.querySelector?.('.scanner-feed');
 if(!feed||typeof client?.subscribe!=='function')return ()=>{};
 const doc=feed.ownerDocument,groups=new Map();let disposed=false,busy=false,last=null,refreshError='';
 const at=name=>feed.querySelector(`[data-scanner-feed-${name}]`);
 const refs={list:at('groups'),status:at('status'),error:at('error'),empty:at('empty'),emptyTitle:at('empty-title'),emptyCopy:at('empty-copy'),posts:at('posts'),projects:at('projects'),updated:at('updated'),refresh:at('refresh'),copyStatus:at('copy-status')};
 if(Object.values(refs).some(node=>!node))return ()=>{};
 const setText=(node,value)=>{if(node.textContent!==String(value))node.textContent=String(value);};
 const attr=(node,key,value)=>{if(value===null||value==='')node.removeAttribute(key);else if(node.getAttribute(key)!==String(value))node.setAttribute(key,String(value));};
 const make=(tag,className,parent,content)=>{const node=doc.createElement(tag);node.className=className||'';if(content!==undefined)node.textContent=content;if(parent)parent.append(node);return node;};
 const external=(node,url)=>{attr(node,'href',url);attr(node,'target',url?'_blank':null);attr(node,'rel',url?'noopener noreferrer':null);};
 const setTime=(node,value)=>{setText(node,formatTime(value));attr(node,'datetime',value);attr(node,'title',value?new Date(value).toLocaleString():null);};
 const setImage=(node,url)=>{if(node.getAttribute('src')!==url){node.hidden=!url;attr(node,'src',url);}else if(!url)node.hidden=true;};
 const syncList=(node,values)=>{while(node.children.length>values.length)node.lastElementChild.remove();values.forEach((value,index)=>setText(node.children[index]||make('li','',node),value));};

 function createMedia(item,parent){
  const node=make('figure','scanner-feed-media-item',parent),video=item.type!=='photo',player=make(video?'video':'img',video?'scanner-feed-post-video':'scanner-feed-post-image',node);
  attr(node,'data-media-type',item.type);
  if(video){attr(player,'controls','');player.controls=true;attr(player,'playsinline','');player.playsInline=true;attr(player,'preload','metadata');attr(player,'aria-label',item.alt||'Video attached to the source post');if(item.previewUrl)attr(player,'poster',item.previewUrl);}
  else{player.alt=item.alt||'Image attached to the source post';player.loading='lazy';player.referrerPolicy='no-referrer';}
  if(item.width&&item.height){attr(player,'width',item.width);attr(player,'height',item.height);}
  const fallback=make('div','scanner-feed-media-fallback',node,video?'Video unavailable. You can view the original post on X.':'Image unavailable. You can view the original post on X.');fallback.hidden=!!item.url;
  player.hidden=!item.url;if(item.url)attr(player,'src',item.url);
  return {node,player,fallback};
 }
 function updateMedia(row,items){
  const keep=new Set(items.map(item=>item.type+':'+(item.url||item.previewUrl)));
  for(const [key,media] of row.media)if(!keep.has(key)){media.player.pause?.();removeNode(media.node);row.media.delete(key);}
  for(const item of items){const key=item.type+':'+(item.url||item.previewUrl);if(!row.media.has(key))row.media.set(key,createMedia(item,row.gallery));const media=row.media.get(key);if(item.type==='photo')media.player.alt=item.alt||'Image attached to the source post';else attr(media.player,'aria-label',item.alt||'Video attached to the source post');}
  row.gallery.hidden=!items.length;attr(row.gallery,'data-count',items.length);
 }
 function stopMedia(row){for(const media of row.media.values())media.player.pause?.();}

 function createCoin(coin,parent){
  const node=make('li','scanner-feed-coin',parent),top=make('div','scanner-feed-coin-top',node);
  const identity=make('div','scanner-feed-identity',top),logo=make('span','scanner-feed-logo',identity),initial=make('span','',logo),image=make('img','',logo);
  image.alt='';image.width=36;image.height=36;image.loading='lazy';image.referrerPolicy='no-referrer';
  const nameBlock=make('div','scanner-feed-name',identity),name=make('h3','',nameBlock),symbol=make('span','scanner-feed-symbol',nameBlock);
  const checks=make('span','scanner-feed-checks',top);
  const bottom=make('div','scanner-feed-coin-bottom',node),addressBlock=make('div','scanner-feed-address',bottom);
  make('span','scanner-feed-address-label',addressBlock,'CA');
  const address=make('code','',addressBlock),copy=make('button','scanner-feed-copy',addressBlock,'Copy');copy.type='button';copy.dataset.scannerFeedCopy=coin.address;
  const cap=make('dl','scanner-feed-cap',bottom);make('dt','',cap,'Market cap');const capValue=make('dd','',cap);
  const excluded=make('p','scanner-feed-excluded',node);
  const details=make('details','scanner-feed-details',node),summary=make('summary','',details,'Details'),body=make('div','scanner-feed-detail-body',details);
  const match=make('p','scanner-feed-match',body),evidence=make('ul','scanner-feed-evidence',body),marketNote=make('p','scanner-feed-market-note',body,'An indexed pool does not confirm a new project or a recent token launch.'),filter=make('p','scanner-feed-filter',body),checkList=make('ul','scanner-feed-check-list',body);
  const metrics=make('dl','scanner-feed-metrics',body),metricValues={};
  for(const [key,label] of [['liquidity','Liquidity'],['volume','24h volume'],['pool','Pool created'],['found','Discovered'],['asOf','Market data updated']]){const item=make('div','',metrics);make('dt','',item,label);metricValues[key]=make('dd','',item);}
  const checkLink=make('a','scanner-feed-report',body,'Open coin report');
  return {node,initial,image,name,symbol,checks,address,copy,capValue,excluded,details,summary,match,evidence,marketNote,filter,checkList,metricValues,checkLink,addressExpanded:false,copying:false,coin};
 }
 function updateCoin(row,coin){
  row.coin=coin;
  setText(row.name,coin.name);setText(row.symbol,coin.symbol||'Solana');attr(row.name,'title',coin.name);setText(row.initial,Array.from(coin.symbol||coin.name)[0]||'?');setImage(row.image,coin.imageUrl);
  const checkStatus=coin.stage==='checking'?'pending':coin.checks.status;
  const checkLabel=checkStatus==='pending'?(coin.stage==='checking'?'Checking…':'Checks pending'):coin.checks.label||(checkStatus==='complete'?'Checks complete':'Checks unavailable');
  setText(row.checks,checkLabel);attr(row.checks,'data-status',checkStatus);attr(row.checks,'data-tone',coin.checks.tone);
  setText(row.address,row.addressExpanded?coin.address:shortAddress(coin.address));attr(row.address,'title',coin.address);
  attr(row.copy,'aria-label',`Copy ${coin.name} address, ${coin.address}`);attr(row.summary,'aria-label',`Details for ${coin.name}`);
  setText(row.capValue,formatMoney(coin.marketCap));attr(row.capValue,'title',coin.marketCap===null?'Market cap unavailable':coin.marketCap.toLocaleString('en-US',{style:'currency',currency:'USD'}));
  const matchLabel=coin.match.label||({address:'Address found in the post',link:'Trading link identifies this coin',possible:'Possible connection',unresolved:'Connection not confirmed',launch:'New market discovered'}[coin.match.kind]);
  setText(row.match,matchLabel);syncList(row.evidence,coin.match.evidence);row.evidence.hidden=!coin.match.evidence.length;
  row.marketNote.hidden=coin.match.kind!=='launch';
  row.excluded.hidden=coin.filter.status!=='excluded';setText(row.excluded,'Outside your filters'+(coin.filter.reason?': '+coin.filter.reason:'.'));
  setText(row.filter,coin.filter.status==='pending'?'Filter checks pending.':coin.filter.status==='pass'?coin.filter.reason:'');row.filter.hidden=!row.filter.textContent;
  syncList(row.checkList,coin.checks.items);row.checkList.hidden=!coin.checks.items.length;
  setText(row.metricValues.liquidity,formatMoney(coin.liquidity));setText(row.metricValues.volume,formatMoney(coin.volume24h));setText(row.metricValues.pool,formatTime(coin.poolCreatedAt));setText(row.metricValues.found,formatTime(coin.discoveredAt));setText(row.metricValues.asOf,formatTime(coin.marketCheckedAt));
  attr(row.checkLink,'href','#check/solana/'+coin.address);attr(row.checkLink,'aria-label',`Open ${coin.name} coin report`);
 }
 function createGroup(group){
  const node=make('li','scanner-feed-group'),article=make('article','',node),head=make('div','scanner-feed-group-head',article);
  const source=make('div','scanner-feed-source',head),sourceLabel=make('span','scanner-feed-source-label',source),identity=make('div','scanner-feed-post-identity',source),avatar=make('span','scanner-feed-avatar',identity),avatarInitial=make('span','',avatar),avatarImage=make('img','',avatar),authorInfo=make('div','scanner-feed-author-info',identity),author=make('a','scanner-feed-author',authorInfo),handle=make('span','scanner-feed-handle',authorInfo);
  avatarImage.alt='';avatarImage.width=40;avatarImage.height=40;avatarImage.loading='lazy';avatarImage.referrerPolicy='no-referrer';
  const postText=make('p','scanner-feed-post-text',source),sourceNotice=make('p','scanner-feed-source-notice',source),gallery=make('div','scanner-feed-media',source),media=new Map();
  const postMeta=make('div','scanner-feed-post-meta',source),postTime=make('time','',postMeta),postLink=make('a','',postMeta,'View on X');
  const contextLink=make('a','scanner-feed-context-link',postMeta);
  const overview=make('div','scanner-feed-overview',head),summaryLabel=make('span','scanner-feed-summary-label',overview,'Post in brief'),summary=make('p','',overview),summaryHint=make('small','scanner-feed-summary-hint',overview);
  const count=make('p','scanner-feed-group-count',article),list=make('ol','scanner-feed-coins',article),waiting=make('p','scanner-feed-waiting',article),coins=new Map();
  return {node,createdAt:group.createdAt,sourceLabel,identity,avatarInitial,avatarImage,author,handle,postText,sourceNotice,gallery,media,postTime,postLink,contextLink,overview,summaryLabel,summary,summaryHint,count,list,waiting,coins};
 }
 function updateGroup(row,group){
  const post=group.kind==='post'?group.post:null;
  attr(row.node,'data-kind',group.kind);setText(row.sourceLabel,group.kind==='post'?({reply:'Reply on X',quote:'Quote post on X',repost:'Reposted on X'}[post?.context.kind]||'X post'):'New markets');
  const handle=post?.handle?.replace(/^@/,'')||'';
  setText(row.author,post?.author||handle||(group.kind==='post'?'Source unavailable':'Market discovery'));
  row.author.hidden=group.kind==='launch';row.identity.hidden=group.kind==='launch';row.overview.hidden=group.kind==='launch';
  setText(row.avatarInitial,Array.from(post?.author||handle||'?')[0]);setImage(row.avatarImage,post?.avatarUrl||'');
  external(row.author,post&&/^[A-Za-z0-9_]{1,15}$/.test(handle)?'https://x.com/'+handle:'');
  setText(row.handle,handle?'@'+handle:'');row.handle.hidden=!handle;
  setText(row.postText,post?.displayText||(group.kind==='post'?(post?'No post text is available.':'This post is no longer available.'):'Newly indexed Solana pools'));
  row.postText.hidden=!!post&&!post.displayText&&post.media.length>0;
  const sourceNotice=[post?.textIncomplete?'Only part of the post text is available here. View on X for the original.':'',post?.mediaUnavailable?(post.media.length?'Some attached media is unavailable.':'Attached media is unavailable.'):''].filter(Boolean).join(' ');
  setText(row.sourceNotice,sourceNotice);row.sourceNotice.hidden=!sourceNotice;
  updateMedia(row,post?.media||[]);setTime(row.postTime,post?.publishedAt||group.createdAt);
  external(row.postLink,post?.url||'');row.postLink.hidden=!post?.url;
  external(row.contextLink,post?.context.url||'');row.contextLink.hidden=!post?.context.url;setText(row.contextLink,({reply:'View replied-to post',quote:'View quoted post',repost:'View original post'}[post?.context.kind]||'View related post'));
  const excerpt=group.summaryStatus==='excerpt'&&!!group.summary&&!!post?.text&&post.context.kind!=='repost';
  setText(row.summary,excerpt?group.summary:'Text summary unavailable for this post.');
  setText(row.summaryHint,excerpt?'Short excerpt from the original post.':'');row.summaryHint.hidden=!excerpt;
  const passed=group.coins.filter(coin=>coin.filter.status==='pass').length,pending=group.coins.filter(coin=>coin.filter.status==='pending').length,excluded=group.coins.length-passed-pending;
  setText(row.count,[`${passed} ${passed===1?'coin matches':'coins match'} your filters`,pending?`${pending} pending`:null,excluded?`${excluded} outside filters`:null].filter(Boolean).join(' · '));row.count.hidden=!group.coins.length;
  const keep=new Set(group.coins.map(coin=>coin.address));
  for(const [key,coinRow] of row.coins)if(!keep.has(key)){removeNode(coinRow.node);row.coins.delete(key);}
  for(const coin of group.coins){if(!row.coins.has(coin.address))row.coins.set(coin.address,createCoin(coin,row.list));updateCoin(row.coins.get(coin.address),coin);}
  row.waiting.hidden=!!group.coins.length;setText(row.waiting,group.kind==='post'?'Watching for related coins. None have been matched yet.':'No coin details are available yet.');
 }
 function removeNode(node){
  if(node.contains(doc.activeElement)){refs.refresh.focus({preventScroll:true});}
  node.remove();
 }
 function sourceLabel(source,label){return label+' · '+({disconnected:'Not connected',ready:'Ready',running:'Scanning',error:'Unavailable',idle:'Waiting'}[source.status]);}
 function show(snapshot){
  if(disposed)return;
  let state;
  try{state=normalizeScannerFeedSnapshot(snapshot);}catch{refreshError='These feed results could not be read. Try refreshing.';setText(refs.error,refreshError);refs.error.hidden=false;return;}
  last=state;
  const view=doc.defaultView,anchors=[...groups.values()].flatMap(group=>[group.node,...[...group.coins.values()].map(coin=>coin.node)]);
  const anchor=view?.scrollY>0?anchors.find(node=>{const box=node.getBoundingClientRect();return box.top>=0&&box.top<view.innerHeight;}):null;
  const before=anchor?.getBoundingClientRect().top;
  const keep=new Set(state.groups.map(group=>group.id));
  for(const [id,row] of groups)if(!keep.has(id)){stopMedia(row);removeNode(row.node);groups.delete(id);}
  for(const group of state.groups){
   if(!groups.has(group.id)){
    const row=createGroup(group),created=Date.parse(group.createdAt)||0;
    const next=[...groups.values()].filter(item=>(Date.parse(item.createdAt)||0)<created).sort((a,b)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0))[0];
    refs.list.insertBefore(row.node,next?.node||null);groups.set(group.id,row);
   }
   updateGroup(groups.get(group.id),group);
  }
  const offline=state.connection.status==='offline',connecting=state.connection.status==='connecting';
  const sourceErrors=Object.entries(state.sources).filter(([,source])=>source.status==='error').map(([key,source])=>(key==='posts'?'X posts':'New projects')+': '+(source.message||'This source is temporarily unavailable.'));
  const status=offline?(state.groups.length?'Connection lost · Showing saved results.':'Cannot reach your scanner.'):connecting?'Connecting to your scanner…':state.status==='running'?(sourceErrors.length?'Scanner waiting · Some sources are unavailable.':'Scanner running · Results appear as they are found.'):'Scanner paused · Existing results stay here.';
  setText(refs.status,status);
  const persistence=state.persistenceError||(!state.persistent?'Scanner results could not be saved. Open Scanner to retry.':'');
  const error=[refreshError,offline?state.connection.message||'Select Refresh to try again.':'',persistence,...sourceErrors,state.omitted?'Some entries could not be shown because their data was incomplete.':''].filter(Boolean).join(' ');
  setText(refs.error,error);refs.error.hidden=!error;
  refs.empty.hidden=!!state.groups.length;
  setText(refs.emptyTitle,offline?'Feed unavailable':connecting?'Loading your feed':state.status==='running'?'Waiting for discoveries':'Your feed is ready');
  setText(refs.emptyCopy,offline?'Your saved results will return when the connection is restored.':connecting?'Waiting for your scanner’s saved results.':state.status==='running'?'Coins will appear here as enabled sources find them.':'Start your scanner to find coins. Results will appear here as information arrives.');
  setText(refs.posts,sourceLabel(state.sources.posts,'X posts')+(offline&&state.sources.posts.status==='running'?' (last update)':''));attr(refs.posts,'title',state.sources.posts.message);
  setText(refs.projects,sourceLabel(state.sources.projects,'New projects')+(offline&&state.sources.projects.status==='running'?' (last update)':''));attr(refs.projects,'title',state.sources.projects.message);
  setText(refs.updated,state.updatedAt?'Updated '+formatTime(state.updatedAt):'');attr(refs.updated,'datetime',state.updatedAt);
  if(anchor?.isConnected&&before!==undefined){const delta=anchor.getBoundingClientRect().top-before;if(Math.abs(delta)>1)view.scrollBy(0,delta);}
 }
 function announce(message){setText(refs.copyStatus,message);toast(message);}
 async function click(event){
  const refresh=event.target?.closest?.('[data-scanner-feed-refresh]');
  if(refresh&&feed.contains(refresh)){
   if(disposed||busy)return;busy=true;refreshError='';refs.refresh.disabled=true;attr(refs.refresh,'aria-busy','true');setText(refs.refresh,'Refreshing…');
   try{await client.refresh();}catch(error){refreshError=text(error?.message,500)||'The feed could not be refreshed. Try again.';}
   finally{if(!disposed){busy=false;refs.refresh.disabled=false;attr(refs.refresh,'aria-busy',null);setText(refs.refresh,'Refresh');if(last)show(last);else if(refreshError){setText(refs.error,refreshError);refs.error.hidden=false;}}}
   return;
  }
  const button=event.target?.closest?.('[data-scanner-feed-copy]');
  if(disposed||!button||!feed.contains(button))return;
  const row=[...groups.values()].flatMap(group=>[...group.coins.values()]).find(item=>item.copy===button);
  if(!row||row.copying)return;
  row.copying=true;button.disabled=true;attr(button,'aria-busy','true');setText(refs.copyStatus,'');
  try{
   const target=clipboard===undefined?globalThis.navigator?.clipboard:clipboard;
   if(typeof target?.writeText!=='function')throw new Error('unavailable');
   await target.writeText(row.coin.address);
   if(!disposed&&feed.contains(button))announce(`${row.coin.name} address copied.`);
  }catch{
   if(!disposed&&feed.contains(button)){row.addressExpanded=true;setText(row.address,row.coin.address);row.address.parentElement.classList.add('is-expanded');announce('Couldn’t copy the address. Select the full address to copy it manually.');}
  }finally{row.copying=false;if(!disposed){button.disabled=false;attr(button,'aria-busy',null);}}
 }
 const imageError=event=>{if(['IMG','VIDEO'].includes(event.target?.tagName)&&feed.contains(event.target)){event.target.hidden=true;const media=event.target.closest('.scanner-feed-media-item');if(media)media.querySelector('.scanner-feed-media-fallback').hidden=false;}};
 feed.addEventListener('click',click);feed.addEventListener('error',imageError,true);
 const unsubscribe=client.subscribe(snapshot=>{refreshError='';show(snapshot);});
 return ()=>{if(disposed)return;disposed=true;unsubscribe?.();feed.removeEventListener('click',click);feed.removeEventListener('error',imageError,true);for(const row of groups.values())stopMedia(row);groups.clear();};
}
