import {validMint,normalizeMarket,safeImageUrl,safeExternalUrl,textValue} from './dist/coin-checker-data.js';
import {accountHandles} from './dist/scanner-settings.js';

const GECKO='https://api.geckoterminal.com/api/v2/networks/solana/new_pools';
const DEX='https://api.dexscreener.com/tokens/v1/solana/';
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
const amount=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:typeof value==='string'&&/^\d+(\.\d+)?$/.test(value)&&Number.isFinite(Number(value))?Number(value):null;
const signed=value=>typeof value==='string'&&/^-?\d+(\.\d+)?$/.test(value)&&Number.isFinite(Number(value))?Number(value):null;
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const abortError=()=>Object.assign(new Error('Scanner request cancelled.'),{name:'AbortError'});
const X_ID=/^\d{1,30}$/;
const MEDIA_KEY=/^\d{1,3}_\d{1,30}$/;
const MAX_X_TEXT=50000; // Holds 25,000 Unicode characters without slicing UTF-16 pairs.

function xAssetUrl(value,host){
 if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\u007f\\]/.test(value))return null;
 try{const url=new URL(value);return url.protocol==='https:'&&url.hostname===host&&!url.port&&!url.username&&!url.password&&!url.hash&&url.pathname!=='/'?url.href:null;}catch{return null;}
}
const imageAsset=value=>xAssetUrl(value,'pbs.twimg.com');
const dimension=value=>Number.isInteger(value)&&value>0&&value<=20000?value:null;
function mediaIndex(includes){
 const index=new Map(),duplicates=new Set();
 if(!Array.isArray(includes?.media)||includes.media.length>400)return index;
 for(const item of includes.media){if(!record(item)||!MEDIA_KEY.test(item.media_key||''))continue;const key=item.media_key;if(index.has(key)||duplicates.has(key)){index.delete(key);duplicates.add(key);}else index.set(key,item);}
 return index;
}
function xMedia(post,includes){
 const raw=post.attachments?.media_keys;
 if(raw===undefined)return {media:[],mediaUnavailable:false};
 if(!Array.isArray(raw))return {media:[],mediaUnavailable:true};
 const index=mediaIndex(includes),media=[],seen=new Set();let mediaUnavailable=raw.length>4;
 for(const key of raw.slice(0,4)){
  if(typeof key!=='string'||!MEDIA_KEY.test(key)){mediaUnavailable=true;continue;}if(seen.has(key))continue;seen.add(key);
  const item=index.get(key);if(!item||!['photo','video','animated_gif'].includes(item.type)){mediaUnavailable=true;continue;}
  const type=item.type,previewUrl=type==='photo'?imageAsset(item.url):imageAsset(item.preview_image_url);let url=type==='photo'?previewUrl:null;
  if(type!=='photo'){
   const variants=(Array.isArray(item.variants)?item.variants:[]).slice(0,30).flatMap(variant=>{
    const url=variant?.content_type==='video/mp4'?xAssetUrl(variant.url,'video.twimg.com'):null;
    if(!url||!new URL(url).pathname.toLowerCase().endsWith('.mp4'))return [];
    // Prefer a supplied rendition up to 2 Mbps. No playlist fetching, guessed
    // rendition URLs, or giant fallback download is needed to show a preview.
    const bitRate=variant.bit_rate===undefined?0:variant.bit_rate;
    return Number.isSafeInteger(bitRate)&&bitRate>=0&&bitRate<=2000000?[{url,bitRate}]:[];
   }).sort((a,b)=>b.bitRate-a.bitRate||a.url.localeCompare(b.url));
   url=variants[0]?.url||null;
  }
  if(!url&&!previewUrl){mediaUnavailable=true;continue;}
  if(type!=='photo'&&!url)mediaUnavailable=true;
  media.push({type,url,previewUrl,alt:typeof item.alt_text==='string'?item.alt_text.slice(0,1000):'',width:dimension(item.width),height:dimension(item.height)});
 }
 return {media,mediaUnavailable};
}
function xContext(post){
 const references=[...(Array.isArray(post.referenced_tweets)?post.referenced_tweets:[]),...(Array.isArray(post.referenced_posts)?post.referenced_posts:[])].slice(0,20);
 for(const [type,kind] of [['retweeted','repost'],['quoted','quote'],['replied_to','reply']]){
  const reference=references.find(entry=>entry?.type===type);
  if(reference){const id=typeof reference.id==='string'&&X_ID.test(reference.id)?reference.id:null;return {kind,referencedPostId:id,url:id?'https://x.com/i/status/'+id:null};}
 }
 return {kind:'original',referencedPostId:null,url:null};
}

// Only the selected author's own Post object supplies matching text and links.
// Referenced posts in includes.tweets are never substituted into this object.
export function normalizeXPost(post,user,includes={}){
 if(!record(post)||!record(user)||typeof user.id!=='string'||!X_ID.test(user.id)||typeof user.username!=='string'||!/^\w{1,15}$/.test(user.username)
  ||typeof post.id!=='string'||!X_ID.test(post.id)||post.author_id!==user.id||!date(post.created_at))throw new ScannerProviderError('X returned an unverified post.');
 // X's dictionary and endpoint reference currently use different field names.
 // Accept either only on this verified primary post; never import reference text.
 const notes=['note_tweet','note_post'].filter(key=>record(post[key])&&typeof post[key].text==='string'&&post[key].text.trim());
 if(notes.length===2&&post.note_tweet.text!==post.note_post.text)throw new ScannerProviderError('X returned conflicting original post text.');
 const noteKey=notes[0],note=noteKey?post[noteKey]:null;
 for(const key of ['referenced_tweets','referenced_posts'])if(post[key]!==undefined&&(!Array.isArray(post[key])||post[key].length>10||post[key].some(entry=>!record(entry)||!['retweeted','quoted','replied_to'].includes(entry.type))))throw new ScannerProviderError('X returned unverified post context.');
 const text=note?note.text:typeof post.text==='string'?post.text:'';
 if(text.length>MAX_X_TEXT)throw new ScannerProviderError('X returned a post larger than this scanner can display.');
 const context=xContext(post),repost=context.kind==='repost';
 const sourceEntities=note?.entities??post.entities;
 const links=repost?[]:[...new Set((Array.isArray(sourceEntities?.urls)?sourceEntities.urls:[]).slice(0,20).flatMap(entry=>[safeExternalUrl(entry?.expanded_url),safeExternalUrl(entry?.unwound_url)]).filter(Boolean))].slice(0,20);
 const {media,mediaUnavailable}=xMedia(post,includes);
 const authors=Array.isArray(includes?.users)?includes.users.slice(0,100).filter(entry=>entry?.id===user.id&&typeof entry.username==='string'&&entry.username.toLowerCase()===user.username.toLowerCase()):[];
 const avatarUrl=authors.length===1?imageAsset(authors[0].profile_image_url)||imageAsset(user.profile_image_url):imageAsset(user.profile_image_url);
 return {id:post.id,author:textValue(user.name,user.username),handle:user.username,avatarUrl,text:repost?'':text,...(repost?{displayText:text}:{}),textSource:noteKey||'text',textIncomplete:(post.note_tweet!==undefined||post.note_post!==undefined)&&!note,
  url:'https://x.com/'+user.username+'/status/'+post.id,publishedAt:date(post.created_at),links,entities:{urls:links.map(expanded_url=>({expanded_url}))},context,media,mediaUnavailable};
}
export class ScannerProviderError extends Error{
 constructor(message,{retryAfterMs=0,code='unavailable'}={}){super(message);this.name='ScannerProviderError';this.code=code;this.retryAfterMs=retryAfterMs;}
}
export function waitForScanner(ms,signal){
 if(signal?.aborted)return Promise.reject(abortError());
 return new Promise((resolve,reject)=>{let timer;const abort=()=>{clearTimeout(timer);reject(abortError());};timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},Math.max(0,ms));signal?.addEventListener('abort',abort,{once:true});});
}
async function readJSON(response,maxBytes,signal){
 if(Number(response.headers?.get('content-length'))>maxBytes)throw new ScannerProviderError('The data provider returned too much data.');
 if(!response.body)throw new ScannerProviderError('The data provider returned an unreadable response.');
 const reader=response.body.getReader(),chunks=[];let bytes=0;
 const cancel=()=>{reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes)throw new ScannerProviderError('The data provider returned too much data.');chunks.push(Buffer.from(value));}if(signal.aborted)throw abortError();return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
 catch(error){cancel();throw error;}finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
}

// The relationships, not pool names or URL substrings, establish mint identity.
export function normalizeNewPools(body,now=Date.now()){
 if(!record(body)||!Array.isArray(body.data)||body.data.length>100||!Array.isArray(body.included)||body.included.length>400||body.errors)throw new ScannerProviderError('New-market data could not be read.');
 const tokens=new Map(body.included.filter(item=>item?.type==='token').map(item=>[item.id,item]));
 const rows=[];let malformed=0;
 for(const pool of body.data){
  const a=pool?.attributes,baseId=pool?.relationships?.base_token?.data?.id,base=tokens.get(baseId)?.attributes;
  const created=date(a?.pool_created_at);
  if(pool?.type!=='pool'||!validMint(a?.address)||pool.id!=='solana_'+a.address||!validMint(base?.address)||baseId!=='solana_'+base.address||!created||Date.parse(created)>now+60000){malformed++;continue;}
  rows.push({id:'solana:'+base.address,chain:'solana',address:base.address,name:textValue(base.name,'Unnamed coin'),symbol:textValue(base.symbol,'—'),imageUrl:safeImageUrl(base.image_url),poolAddress:a.address,poolCreatedAt:created,
   marketCap:amount(a.market_cap_usd),fdv:amount(a.fdv_usd),liquidity:amount(a.reserve_in_usd),volume24h:amount(a.volume_usd?.h24),volume1h:amount(a.volume_usd?.h1),priceChange1h:signed(a.price_change_percentage?.h1),priceChange24h:signed(a.price_change_percentage?.h24),
   dex:textValue(pool.relationships?.dex?.data?.id),marketCheckedAt:new Date(now).toISOString(),marketProvider:'GeckoTerminal',providerUrl:'https://www.geckoterminal.com/solana/pools/'+a.address});
 }
 if(body.data.length&&!rows.length)throw new ScannerProviderError('New-market data did not contain valid Solana token identities.');
 return {coins:rows,skipped:malformed};
}

export function createScannerProviders({fetchImpl=fetch,now=Date.now,timeoutMs=12000,maxBytes=2000000,pages=2,minSpacingMs=2100,xEnabled=process.env.SCANNER_X_ENABLED==='true',xBearerToken=process.env.X_BEARER_TOKEN||''}={}){
 const nextRequest=new Map(),cooldowns=new Map(),users=new Map();let xFieldStyle='tweet';
 async function request(url,{signal,headers={},service='market'}={}){
  if(signal?.aborted)throw abortError();
  const host=new URL(url).hostname,wait=Math.max(0,(nextRequest.get(host)||0)-now());
  if((cooldowns.get(host)||0)>now())throw new ScannerProviderError('The '+service+' provider is busy. The scanner will retry later.',{code:'rate-limit',retryAfterMs:cooldowns.get(host)-now()});
  nextRequest.set(host,now()+wait+minSpacingMs);if(wait)await waitForScanner(wait,signal);
  const controller=new AbortController();let timer;
  const cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});
  const task=(async()=>{
   const response=await fetchImpl(url,{method:'GET',headers:{Accept:'application/json',...headers},signal:controller.signal,redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});
   if(controller.signal.aborted){response.body?.cancel().catch(()=>{});throw abortError();}
   if(!response.ok){
    response.body?.cancel().catch(()=>{});
    if(response.status===429){const raw=response.headers?.get('retry-after'),seconds=raw&&/^\d+(\.\d+)?$/.test(raw)?Number(raw):null,until=seconds!==null?now()+seconds*1000:Date.parse(raw||'');const retryAfterMs=Number.isFinite(until)?Math.max(60000,until-now()):60000;cooldowns.set(host,now()+retryAfterMs);throw new ScannerProviderError('The '+service+' provider is busy. The scanner will retry later.',{code:'rate-limit',retryAfterMs});}
    throw new ScannerProviderError('The '+service+' provider is unavailable. The scanner will retry later.',{code:response.status===400?'invalid-request':'unavailable'});
   }
   return readJSON(response,maxBytes,controller.signal);
  })();
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new ScannerProviderError('The '+service+' request timed out.'));},timeoutMs);});
  const aborted=new Promise((_,reject)=>{if(signal?.aborted)reject(abortError());else controller.signal.addEventListener('abort',()=>reject(signal?.aborted?abortError():new ScannerProviderError('The '+service+' request timed out.')),{once:true});});
  try{return await Promise.race([task,deadline,aborted]);}catch(error){controller.abort();if(signal?.aborted)throw abortError();if(error instanceof ScannerProviderError)throw error;throw new ScannerProviderError('The '+service+' provider returned an unreadable response.');}finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 }
 async function readXTimeline(url,options){
  const fields=style=>{
   url.searchParams.delete('tweet.fields');url.searchParams.delete('post.fields');
   url.searchParams.set(style+'.fields',style==='tweet'?'created_at,author_id,entities,referenced_tweets,attachments,note_tweet':'created_at,entities,attachments,note_post');
   url.searchParams.set('expansions',style==='tweet'?'author_id,attachments.media_keys':'author_id,attachments.media_keys,referenced_posts');
  };
  fields(xFieldStyle);
  try{return await request(url.href,options);}catch(error){
   // One alternate spelling only for a rejected parameter set. Never retry
   // auth failures or rate limits, and never remove requested attribution fields.
   if(error.code!=='invalid-request')throw error;
   const alternate=xFieldStyle==='tweet'?'post':'tweet';fields(alternate);
   const body=await request(url.href,options);xFieldStyle=alternate;return body;
  }
 }
 return {
  async discover({signal}={}){
   const coins=[],seen=new Set();let skipped=0,readPages=0;
   for(let page=1;page<=Math.max(1,Math.min(3,pages));page++){
    const body=await request(GECKO+'?include=base_token%2Cquote_token%2Cdex&page='+page,{signal,service:'new-market'}),normalized=normalizeNewPools(body,now());readPages++;skipped+=normalized.skipped;
    for(const coin of normalized.coins)if(!seen.has(coin.id)){seen.add(coin.id);coins.push(coin);}if(body.data.length<20)break;
   }
   return {coins,message:`Watching ${readPages} recent page${readPages===1?'':'s'} of indexed Solana pools. Coverage is limited; a new pool does not prove a new project.${skipped?' Some malformed records were skipped.':''}`,checkedAt:new Date(now()).toISOString()};
  },
  async enrich(addresses,{signal}={}){
   const mints=[...new Set(addresses)];if(mints.length>30||mints.some(mint=>!validMint(mint)))throw new ScannerProviderError('Invalid coin identities.');
   if(!mints.length)return new Map();
   const body=await request(DEX+mints.join(','),{signal,service:'market'});if(!Array.isArray(body)||body.length>1000)throw new ScannerProviderError('Market data could not be read.');
   return new Map(mints.map(mint=>[mint,normalizeMarket(body,mint,now(),'solana')]));
  },
  postsStatus(config){
   if(!config?.sources?.public?.enabled)return {status:'disconnected',message:'Posts on X are turned off.'};
   if(!xEnabled||!xBearerToken)return {status:'disconnected',message:'X is not connected. New-market discovery works independently.'};
   if(config.sources.public.settings?.accountScope!=='custom'||!accountHandles(config.sources.public.settings?.accounts||'').length)return {status:'disconnected',message:'Choose explicit X accounts before connecting posts.'};
   return {status:'ready',message:'Official X API configured for selected accounts.'};
  },
  async posts(config,{signal,cursors={}}={}){
   const status=this.postsStatus(config);if(status.status==='disconnected')return {...status,posts:[],cursors};
   const settings=config.sources.public.settings,handles=accountHandles(settings.accounts||'');
   if(handles.length>5||handles.some(handle=>!/^\w{1,15}$/.test(handle)))throw new ScannerProviderError('Choose up to five valid X handles for this local scanner.');
   const posts=[],nextCursors={...cursors};let incomplete=false;
   for(const handle of handles){
    let user=users.get(handle.toLowerCase());
    if(!user){const body=await request('https://api.x.com/2/users/by/username/'+encodeURIComponent(handle)+'?user.fields=profile_image_url',{signal,headers:{Authorization:'Bearer '+xBearerToken},service:'X'});user=body?.data;if(typeof user?.id!=='string'||!X_ID.test(user.id)||typeof user.username!=='string'||user.username.toLowerCase()!==handle.toLowerCase())throw new ScannerProviderError('The selected X account could not be verified.');users.set(handle.toLowerCase(),{id:user.id,username:user.username,name:textValue(user.name,handle),profile_image_url:imageAsset(user.profile_image_url)});user=users.get(handle.toLowerCase());}
    let paginationToken,newest=null;
    for(let page=0;page<2;page++){
     const url=new URL('https://api.x.com/2/users/'+user.id+'/tweets');url.searchParams.set('max_results','20');url.searchParams.set('tweet.fields','created_at,author_id,entities,referenced_tweets,attachments,note_tweet');url.searchParams.set('expansions','author_id,attachments.media_keys');url.searchParams.set('user.fields','profile_image_url');url.searchParams.set('media.fields','media_key,type,url,preview_image_url,variants,alt_text,width,height');
     if(/^\d+$/.test(cursors[user.id]||''))url.searchParams.set('since_id',cursors[user.id]);else url.searchParams.set('start_time',new Date(now()-24*3600000).toISOString());
     if(paginationToken)url.searchParams.set('pagination_token',paginationToken);
     const body=await readXTimeline(url,{signal,headers:{Authorization:'Bearer '+xBearerToken},service:'X'});
     if(!record(body)||body.errors||!record(body.meta)||!Array.isArray(body.data)&&body.meta.result_count!==0)throw new ScannerProviderError('X posts could not be read.');
     for(const post of body.data||[]){
      const normalized=normalizeXPost(post,user,body.includes);
      if(!newest||BigInt(post.id)>BigInt(newest))newest=post.id;
      posts.push(normalized);
     }
     paginationToken=body.meta.next_token;if(!paginationToken)break;
    }
    if(paginationToken)incomplete=true;else if(newest)nextCursors[user.id]=newest;
   }
   return {status:'ready',message:incomplete?'X returned more posts than this bounded pass could read; the last cursor was retained.':'Monitoring selected accounts through the official X API.',posts,cursors:nextCursors};
  }
 };
}
