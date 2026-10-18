import test from 'node:test';
import assert from 'node:assert/strict';
import {createScannerProviders,normalizeNewPools,normalizeXPost} from '../scanner-providers.mjs';
import {defaultPersonalScanner} from '../dist/personal-scanner-store.js';

const mint='So11111111111111111111111111111111111111112',pool='Vote111111111111111111111111111111111111111',other='11111111111111111111111111111111';
const now=Date.parse('2026-10-12T12:00:00Z'),response=body=>new Response(JSON.stringify(body));
const payload=()=>({data:[{id:'solana_'+pool,type:'pool',attributes:{address:pool,pool_created_at:'2026-10-12T11:59:00Z',market_cap_usd:null,fdv_usd:'100000',reserve_in_usd:'12000',volume_usd:{h24:'2345'}},relationships:{base_token:{data:{id:'solana_'+mint}},dex:{data:{id:'pumpswap'}}}}],included:[{id:'solana_'+mint,type:'token',attributes:{address:mint,name:'Coin',symbol:'COIN',image_url:'javascript:alert(1)'}}]});
const options={now:()=>now,minSpacingMs:0,xEnabled:false};

test('new-pool identity uses exact Solana relationships and does not substitute FDV for missing market cap',()=>{
 const result=normalizeNewPools(payload(),now);assert.equal(result.coins.length,1);const coin=result.coins[0];assert.equal(coin.address,mint);assert.equal(coin.poolAddress,pool);assert.equal(coin.marketCap,null);assert.equal(coin.fdv,100000);assert.equal(coin.liquidity,12000);assert.equal(coin.imageUrl,null);assert.equal(coin.poolCreatedAt,'2026-10-12T11:59:00.000Z');
 const missing=payload();missing.data[0].attributes.reserve_in_usd=null;assert.equal(normalizeNewPools(missing,now).coins[0].liquidity,null);
});
test('malformed and wrong-identity pools never become a successful empty discovery',()=>{
 for(const body of [null,{},[],{data:[],included:null}])assert.throws(()=>normalizeNewPools(body,now));
 for(const edit of [b=>b.included[0].attributes.address=other,b=>b.data[0].id='ethereum_'+pool,b=>b.data[0].attributes.address='invalid',b=>b.data[0].attributes.pool_created_at='bad']){const body=payload();edit(body);assert.throws(()=>normalizeNewPools(body,now));}
 assert.deepEqual(normalizeNewPools({data:[],included:[]},now),{coins:[],skipped:0});
});
test('discovery fetches only fixed public pools endpoint and deduplicates base mints across pages',async()=>{
 let calls=0;const body=payload();body.data=Array.from({length:20},()=>body.data[0]);const providers=createScannerProviders({...options,fetchImpl:async(url,init)=>{calls++;assert.equal(new URL(url).hostname,'api.geckoterminal.com');assert.equal(new URL(url).searchParams.get('page'),String(calls));assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');return response(body);}});
 const result=await providers.discover();assert.equal(calls,2);assert.equal(result.coins.length,1);assert.match(result.message,/Coverage is limited/);
});
test('market enrichment accepts only exact base identities, keeps unknown fields null, and limits batch size',async()=>{
 const providers=createScannerProviders({...options,fetchImpl:async(url)=>{assert.equal(url,'https://api.dexscreener.com/tokens/v1/solana/'+mint);return response([{chainId:'solana',pairAddress:pool,baseToken:{address:other,name:'Wrong'},marketCap:999999},{chainId:'solana',pairAddress:pool,baseToken:{address:mint,name:'Correct'},fdv:1234,liquidity:{usd:5}}]);}});
 const market=(await providers.enrich([mint,mint])).get(mint);assert.equal(market.name,'Correct');assert.equal(market.marketCap,null);assert.equal(market.fdv,1234);
 await assert.rejects(providers.enrich(['invalid']));
 const malformed=createScannerProviders({...options,fetchImpl:async()=>response({pairs:[]})});await assert.rejects(malformed.enrich([mint]));
});
test('provider errors are sanitized, and a long rate-limit cooldown prevents new requests',async()=>{
 let calls=0,time=now;const providers=createScannerProviders({...options,now:()=>time,fetchImpl:async()=>{calls++;return new Response('private upstream detail',{status:429,headers:{'Retry-After':'120'}});}});
 await assert.rejects(providers.enrich([mint]),error=>error.code==='rate-limit'&&error.retryAfterMs===120000&&!error.message.includes('private'));
 time+=119000;await assert.rejects(providers.enrich([mint]),error=>error.code==='rate-limit');assert.equal(calls,1);
 time+=1000;await assert.rejects(providers.enrich([mint]));assert.equal(calls,2);
});
test('deadlines and cancellation settle noncooperative fetches and bound streamed responses',async()=>{
 let signal;const providers=createScannerProviders({...options,timeoutMs:10,fetchImpl:async(url,init)=>{signal=init.signal;return new Promise(()=>{});}});
 await assert.rejects(providers.enrich([mint]),/timed out/);assert.equal(signal.aborted,true);
 const controller=new AbortController(),waiting=createScannerProviders({...options,timeoutMs:10000,fetchImpl:()=>new Promise(()=>{})}).enrich([mint],{signal:controller.signal});controller.abort();await assert.rejects(waiting,error=>error.name==='AbortError');
 const huge=createScannerProviders({...options,maxBytes:50,fetchImpl:async()=>response(payload())});await assert.rejects(huge.discover());
 let cancelled=false;const stalled=createScannerProviders({...options,timeoutMs:10,fetchImpl:async()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));},cancel(){cancelled=true;}}))});await assert.rejects(stalled.discover());assert.equal(cancelled,true);
});
test('X makes no calls unless explicitly enabled, configured and given selected handles',async()=>{
 const config=defaultPersonalScanner();let calls=0;
 for(const settings of [{xEnabled:false,xBearerToken:'test-secret'},{xEnabled:true,xBearerToken:''},{xEnabled:true,xBearerToken:'test-secret'}]){
  const providers=createScannerProviders({...options,...settings,fetchImpl:async()=>{calls++;throw Error('should not call');}});const result=await providers.posts(config);assert.equal(result.status,'disconnected');assert.deepEqual(result.posts,[]);assert.doesNotMatch(JSON.stringify(result),/test-secret/);
 }assert.equal(calls,0);
});
test('configured X uses official fixed endpoints, verifies author and preserves a cursor only after the window is read',async()=>{
 const config=defaultPersonalScanner();config.sources.public.settings.accountScope='custom';config.sources.public.settings.accounts='@Example';config.sources.public.settings.postTypes=[];
 const seen=[];const providers=createScannerProviders({...options,xEnabled:true,xBearerToken:'test-secret',fetchImpl:async(url,init)=>{seen.push(url);assert.equal(new URL(url).hostname,'api.x.com');assert.equal(init.headers.Authorization,'Bearer test-secret');return url.includes('/by/username/')?response({data:{id:'123',username:'Example',name:'Example'}}):response({data:[{id:'456',author_id:'123',text:'A post '+mint,created_at:'2026-10-12T11:59:00Z'}],meta:{result_count:1}});}});
 const result=await providers.posts(config);assert.equal(result.posts[0].handle,'Example');assert.equal(result.cursors['123'],'456');assert.doesNotMatch(JSON.stringify(result),/test-secret/);assert.equal(seen.length,2);assert.equal(new URL(seen[1]).searchParams.get('start_time'),'2026-10-11T12:00:00.000Z');
 const lookup=new URL(seen[0]),timeline=new URL(seen[1]);assert.equal(lookup.searchParams.get('user.fields'),'profile_image_url');assert.equal(timeline.searchParams.get('max_results'),'20');assert.ok(timeline.searchParams.get('tweet.fields').split(',').includes('note_tweet'));assert.ok(timeline.searchParams.get('tweet.fields').split(',').includes('attachments'));assert.equal(timeline.searchParams.get('expansions'),'author_id,attachments.media_keys');assert.ok(timeline.searchParams.get('media.fields').split(',').includes('variants'));assert.equal(timeline.searchParams.get('user.fields'),'profile_image_url');
 const bad=createScannerProviders({...options,xEnabled:true,xBearerToken:'secret',fetchImpl:async url=>url.includes('/by/username/')?response({data:{id:'123',username:'Example'}}):response({data:[{id:'456',author_id:'999',text:'fake',created_at:'2026-10-12T11:59:00Z'}],meta:{result_count:1}})});await assert.rejects(bad.posts(config),/unverified/);
});

const xUser={id:'123',username:'Example',name:'Example Author',profile_image_url:'https://pbs.twimg.com/profile_images/123/avatar_normal.jpg'};
const xPost=(patch={})=>({id:'456',author_id:'123',text:'Original words',created_at:'2026-10-12T11:59:00Z',...patch});
const photo=(media_key,url='https://pbs.twimg.com/media/original.jpg')=>({media_key,type:'photo',url,alt_text:'Actual attached photo',width:1200,height:800});

test('long posts retain the full documented note_tweet text and its matching links without using quoted content',()=>{
 const long='A long original post. '.repeat(600)+mint,link='https://pump.fun/coin/'+mint;
 const post=normalizeXPost(xPost({text:'Truncated preview',note_tweet:{text:long,entities:{urls:[{expanded_url:link}]}},referenced_tweets:[{type:'quoted',id:'999'}]}),xUser,{tweets:[{id:'999',text:'Wrong author '+other}]});
 assert.equal(post.text,long);assert.equal(post.textSource,'note_tweet');assert.equal(post.textIncomplete,false);assert.deepEqual(post.links,[link]);assert.equal(post.context.kind,'quote');assert.equal(post.context.referencedPostId,'999');assert.doesNotMatch(post.text,/Wrong author/);
 const postAlias=normalizeXPost(xPost({note_post:{text:'Full endpoint-reference post text'}}),xUser);assert.equal(postAlias.text,'Full endpoint-reference post text');assert.equal(postAlias.textSource,'note_post');
 assert.throws(()=>normalizeXPost(xPost({note_tweet:{text:'One version'},note_post:{text:'Conflicting version'}}),xUser),/conflicting/);
 const malformed=normalizeXPost(xPost({note_tweet:{text:123}}),xUser);assert.equal(malformed.text,'Original words');assert.equal(malformed.textIncomplete,true);
 assert.throws(()=>normalizeXPost(xPost({note_tweet:{text:'x'.repeat(50001)}}),xUser),/larger/);
});

test('media-only posts retain only their own attached photos and verified author avatar',()=>{
 const post=normalizeXPost(xPost({text:null,attachments:{media_keys:['3_22']}}),xUser,{media:[photo('3_11','https://pbs.twimg.com/media/unrelated.jpg'),photo('3_22')],users:[{id:'999',username:'Other',profile_image_url:'https://pbs.twimg.com/profile_images/999/wrong.jpg'},{id:'123',username:'Example',profile_image_url:'https://pbs.twimg.com/profile_images/123/current.jpg'}]});
 assert.equal(post.text,'');assert.equal(post.media.length,1);assert.equal(post.media[0].url,'https://pbs.twimg.com/media/original.jpg');assert.equal(post.media[0].alt,'Actual attached photo');assert.equal(post.media[0].width,1200);assert.equal(post.mediaUnavailable,false);assert.equal(post.avatarUrl,'https://pbs.twimg.com/profile_images/123/current.jpg');
 const absent=normalizeXPost(xPost(),xUser,{media:[photo('3_22')]});assert.deepEqual(absent.media,[]);assert.equal(absent.avatarUrl,xUser.profile_image_url);
});

test('media association respects attachment order, deduplicates keys, and never borrows a quote’s attachments',()=>{
 const post=normalizeXPost(xPost({attachments:{media_keys:['3_2','3_1','3_2']},referenced_tweets:[{type:'quoted',id:'999'}]}),xUser,{media:[photo('3_1','https://pbs.twimg.com/media/first.png'),photo('3_2','https://pbs.twimg.com/media/second.png'),photo('3_3','https://pbs.twimg.com/media/quoted.png')],tweets:[{id:'999',attachments:{media_keys:['3_3']}}]});
 assert.deepEqual(post.media.map(item=>item.url),['https://pbs.twimg.com/media/second.png','https://pbs.twimg.com/media/first.png']);assert.equal(post.media.length,2);
 const capped=normalizeXPost(xPost({attachments:{media_keys:['3_1','3_2','3_3','3_4','3_5']}}),xUser,{media:[1,2,3,4,5].map(n=>photo('3_'+n))});assert.equal(capped.media.length,4);assert.equal(capped.mediaUnavailable,true);
});

test('missing, malformed and ambiguous media includes stay unavailable rather than fabricating content',()=>{
 for(const includes of [undefined,{},null,{media:{}},{media:[null,photo('3_2')]},{media:[photo('3_1'),photo('3_1','https://pbs.twimg.com/media/conflict.jpg')]}]){
  const post=normalizeXPost(xPost({attachments:{media_keys:['3_1']}}),xUser,includes);assert.deepEqual(post.media,[]);assert.equal(post.mediaUnavailable,true);assert.equal(post.text,'Original words');
 }
 const malformed=normalizeXPost(xPost({attachments:{media_keys:'3_1'}}),xUser);assert.equal(malformed.mediaUnavailable,true);assert.deepEqual(malformed.media,[]);
});

test('only exact trusted HTTPS image hosts are accepted for media and avatars',()=>{
 for(const url of ['https://pbs.twimg.com.evil.example/a.jpg','https://evil.example/pbs.twimg.com/a.jpg','https://user@pbs.twimg.com/a.jpg','http://pbs.twimg.com/a.jpg','https://pbs.twimg.com:444/a.jpg','https://pbs.twimg.com/a.jpg#frag','https://pbs.twimg.com\\@evil.example/a.jpg','javascript:alert(1)','data:image/png;base64,AAAA']){
  const post=normalizeXPost(xPost({attachments:{media_keys:['3_1']}}),{...xUser,profile_image_url:url},{media:[photo('3_1',url)]});assert.equal(post.avatarUrl,null,url);assert.deepEqual(post.media,[],url);assert.equal(post.mediaUnavailable,true,url);
 }
 const post=normalizeXPost(xPost({attachments:{media_keys:['3_1']}}),xUser,{media:[photo('3_1','https://pbs.twimg.com/media/original?format=jpg&name=small')]});assert.equal(post.media.length,1);
});

test('videos choose an actual bounded MP4 variant and keep a trusted preview and dimensions',()=>{
 const variants=[{content_type:'application/x-mpegURL',url:'https://video.twimg.com/master.m3u8'},{content_type:'video/mp4',bit_rate:8000000,url:'https://video.twimg.com/high.mp4'},{content_type:'video/mp4',bit_rate:320000,url:'https://video.twimg.com/low.mp4'},{content_type:'video/mp4',bit_rate:832000,url:'https://video.twimg.com/medium.mp4?tag=12'},{content_type:'video/mp4',bit_rate:1000000,url:'https://evil.example/evil.mp4'}];
 const item={media_key:'13_1',type:'video',preview_image_url:'https://pbs.twimg.com/ext_tw_video_thumb/1/preview.jpg',variants,width:1920,height:1080};
 const post=normalizeXPost(xPost({attachments:{media_keys:['13_1']}}),xUser,{media:[item]});assert.equal(post.media[0].url,'https://video.twimg.com/medium.mp4?tag=12');assert.equal(post.media[0].previewUrl,item.preview_image_url);assert.equal(post.media[0].type,'video');assert.equal(post.media[0].width,1920);assert.equal(post.mediaUnavailable,false);
 const previewOnly=normalizeXPost(xPost({attachments:{media_keys:['13_1']}}),xUser,{media:[{...item,variants:[variants[0],variants[1]]}]});assert.equal(previewOnly.media[0].url,null);assert.equal(previewOnly.media[0].previewUrl,item.preview_image_url);assert.equal(previewOnly.mediaUnavailable,true);
});

test('animated GIF variants remain GIF media and malformed optional fields cannot become data',()=>{
 const post=normalizeXPost(xPost({attachments:{media_keys:['16_1']}}),xUser,{media:[{media_key:'16_1',type:'animated_gif',preview_image_url:'https://pbs.twimg.com/tweet_video_thumb/1.jpg',variants:[{content_type:'video/mp4',url:'https://video.twimg.com/tweet_video/1.mp4'}],width:'800',height:-1,alt_text:{html:'bad'}}]});
 assert.equal(post.media[0].type,'animated_gif');assert.equal(post.media[0].url,'https://video.twimg.com/tweet_video/1.mp4');assert.equal(post.media[0].width,null);assert.equal(post.media[0].height,null);assert.equal(post.media[0].alt,'');
});

test('reposts keep observed display content but expose no original-author matching text or links',()=>{
 const displayed='RT @Original: Here is '+mint,post=normalizeXPost(xPost({text:displayed,entities:{urls:[{expanded_url:'https://pump.fun/coin/'+mint}]},referenced_tweets:[{type:'retweeted',id:'999'}]}),xUser,{tweets:[{id:'999',author_id:'987',text:'Included original content '+other}]});
 assert.equal(post.text,'');assert.equal(post.displayText,displayed);assert.deepEqual(post.links,[]);assert.deepEqual(post.entities.urls,[]);assert.equal(post.context.kind,'repost');assert.equal(post.context.url,'https://x.com/i/status/999');assert.equal(post.author,'Example Author');assert.doesNotMatch(JSON.stringify(post),/Included original content/);
 const malformedReference=normalizeXPost(xPost({text:displayed,referenced_tweets:[{type:'retweeted',id:'bad'}]}),xUser);assert.equal(malformedReference.text,'');assert.equal(malformedReference.context.kind,'repost');assert.equal(malformedReference.context.url,null);
 const renamedReference=normalizeXPost(xPost({text:displayed,referenced_posts:[{type:'retweeted',id:'999'}]}),xUser);assert.equal(renamedReference.text,'');assert.equal(renamedReference.context.kind,'repost');
 assert.throws(()=>normalizeXPost(xPost({referenced_posts:{id:'999',type:'retweeted'}}),xUser),/unverified/);
 assert.throws(()=>normalizeXPost(xPost({referenced_tweets:Array.from({length:20},()=>({type:'quoted',id:'998'})),referenced_posts:[{type:'retweeted',id:'999'}]}),xUser),/unverified/);
});

test('a rejected timeline field spelling gets one bounded alternate and keeps it for the next poll',async()=>{
 const config=defaultPersonalScanner();config.sources.public.settings.accountScope='custom';config.sources.public.settings.accounts='@Example';const seen=[];
 const provider=createScannerProviders({...options,xEnabled:true,xBearerToken:'test-secret',fetchImpl:async url=>{
  if(url.includes('/by/username/'))return response({data:xUser});
  const parsed=new URL(url);seen.push(parsed);
  if(parsed.searchParams.has('tweet.fields'))return new Response('{}',{status:400});
  assert.equal(parsed.searchParams.has('post.fields'),true);assert.equal(parsed.searchParams.get('post.fields'),'created_at,entities,attachments,note_post');assert.equal(parsed.searchParams.get('expansions'),'author_id,attachments.media_keys,referenced_posts');
  return response({data:[xPost({note_post:{text:'Actual long post text'}})],meta:{result_count:1}});
 }});
 assert.equal((await provider.posts(config)).posts[0].text,'Actual long post text');await provider.posts(config);
 assert.equal(seen.length,3);assert.equal(seen[2].searchParams.has('tweet.fields'),false);
});

test('timeline field fallback never retries authorization or rate limits and cannot recurse on repeated bad requests',async()=>{
 const config=defaultPersonalScanner();config.sources.public.settings.accountScope='custom';config.sources.public.settings.accounts='@Example';
 for(const status of [400,401,403,429]){let calls=0;
  const provider=createScannerProviders({...options,xEnabled:true,xBearerToken:'test-secret',fetchImpl:async url=>url.includes('/by/username/')?response({data:xUser}):(calls++,new Response('{}',{status}))});
  await assert.rejects(provider.posts(config));assert.equal(calls,status===400?2:1);
 }
});

test('reply and quote context never replaces the selected author or imports another post’s text, entities or avatar',()=>{
 const reply=normalizeXPost(xPost({text:'My own reply',referenced_tweets:[{type:'replied_to',id:'999'}]}),xUser,{tweets:[{id:'999',text:mint,entities:{urls:[{expanded_url:'https://pump.fun/coin/'+mint}]}}],users:[{id:'999',username:'Example',profile_image_url:'https://pbs.twimg.com/profile_images/999/wrong.jpg'}]});
 assert.equal(reply.text,'My own reply');assert.equal(reply.context.kind,'reply');assert.deepEqual(reply.links,[]);assert.equal(reply.avatarUrl,xUser.profile_image_url);
 assert.throws(()=>normalizeXPost(xPost({author_id:'999'}),xUser),/unverified/);
});
