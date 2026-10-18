import {validMint} from './dist/coin-checker-data.js';

const TOKEN_PROGRAM='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const RPC_URL='https://api.mainnet-beta.solana.com';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const amount=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const result=(kind,label,evidence=[])=>({kind,label,evidence});
const unknownMatch=()=>result('unresolved','No verified coin connection');
const URL_TEXT=/\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const genericNames=new Set(['token','coin','crypto','cryptocurrency','solana','bitcoin','ethereum','dollar','usd coin','wrapped sol','wrapped solana']);
const genericSymbols=new Set(['SOL','WSOL','USD','USDC','USDT','BTC','ETH','WETH','BNB']);

function tradingURL(value){
 if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\u007f\\]/.test(value))return null;
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)return null;
  if(!['pump.fun','www.pump.fun','birdeye.so','www.birdeye.so','dexscreener.com','www.dexscreener.com'].includes(url.hostname))return null;
  return url;
 }catch{return null;}
}

function matchesTradingURL(url,coin){
 const host=url.hostname.replace(/^www\./,''),path=url.pathname.replace(/\/$/,'');
 if(host==='pump.fun')return path==='/coin/'+coin.address;
 if(host==='birdeye.so')return path==='/token/'+coin.address&&url.searchParams.getAll('chain').length===1&&url.searchParams.get('chain')==='solana';
 // A DEX Screener route identifies a pool. It is not itself proof of a mint.
 const market=coin.market;
 return host==='dexscreener.com'&&object(market)&&market.chainId==='solana'&&market.mint===coin.address
  &&validMint(market.pair)&&path==='/solana/'+market.pair;
}

function phraseIn(text,phrase){
 const escaped=phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
 return new RegExp('(?:^|[^\\p{L}\\p{N}_])'+escaped+'(?=$|[^\\p{L}\\p{N}_])','iu').test(text);
}

// Evidence belongs only to this post. Parent posts, replies, token social links,
// account biographies and model-generated context cannot become author evidence.
export function matchPostToCoin(post,coin){
 if(!object(post)||!object(coin)||coin.chain!=='solana'||!validMint(coin.address)
  ||typeof post.text!=='string'||post.text.length>25000)return unknownMatch();
 const text=post.text,plain=text.replace(URL_TEXT,' ');
 const addresses=[...plain.matchAll(/(?<![\p{L}\p{N}_])[1-9A-HJ-NP-Za-km-z]{32,44}(?![\p{L}\p{N}_])/gu)].map(match=>match[0]).filter(validMint);
 if(addresses.includes(coin.address))return result('address','Address in post',[
  'This post contains the exact Solana address; mint checks establish whether it is a token.',
  ...(new Set(addresses).size>1?['The post mentions more than one address.']:[])
 ]);
 const links=[...(text.match(URL_TEXT)||[]).slice(0,20),
  ...(Array.isArray(post.links)?post.links.slice(0,20):[]),
  ...(Array.isArray(post.entities?.urls)?post.entities.urls.slice(0,20).flatMap(entry=>[entry?.expanded_url,entry?.unwound_url]):[])];
 for(const value of links){
  const url=tradingURL(value);
  if(url&&matchesTradingURL(url,coin))return result('link','Trading link in post',['This post links to a trading page for this coin.','A link does not establish endorsement.']);
 }
 const name=typeof coin.name==='string'&&coin.name.length<=120?coin.name.trim().replace(/\s+/g,' '):'';
 const words=name.split(' '),distinctive=name.length>=6&&!genericNames.has(name.toLowerCase())&&/\p{L}/u.test(name)
  &&(words.length===1||words.every(word=>word.length>=3));
 if(distinctive&&phraseIn(plain,name))return result('possible','Possible name match',['The post includes this coin’s name; the connection is unverified.']);
 const symbol=typeof coin.symbol==='string'?coin.symbol:'';
 if(/^[A-Za-z][A-Za-z0-9]{2,11}$/.test(symbol)&&!genericSymbols.has(symbol.toUpperCase())&&phraseIn(plain,'$'+symbol))
  return result('possible','Possible symbol match',['The post includes this cashtag; symbols are not unique.']);
 return unknownMatch();
}

const FILTERS=[['capMin','marketCap','Market cap','min'],['capMax','marketCap','Market cap','max'],
 ['ageMin','age','Trading age','min'],['ageMax','age','Trading age','max'],
 ['liquidityMin','liquidity','Liquidity','min'],['volumeMin','volume24h','24-hour volume','min']];
function timestamp(value){
 if(typeof value==='number')return Number.isSafeInteger(value)&&value>=0?value:null;
 if(typeof value==='string'&&value.length<=40&&/^\d{4}-\d{2}-\d{2}T/.test(value)){
  const parsed=Date.parse(value);return Number.isFinite(parsed)&&parsed>=0?parsed:null;
 }
 return null;
}

// Only currently visible shared filters apply. Retained legacy source settings
// are compatibility data, not hidden restrictions on the current scanner.
export function evaluateScannerFilters(coin,config={},now=Date.now()){
 const filters=config?.resultFilters??{};
 if(!object(filters)||!object(coin))return {status:'pending',reason:'Filter data is unavailable.'};
 const active=[];
 for(const [key,field,label,direction] of FILTERS){
  const raw=filters[key];if(raw===undefined||raw==='')continue;
  if((typeof raw!=='string'&&typeof raw!=='number')||String(raw).length>40||!/^\d+(?:\.\d+)?$/.test(String(raw))||!amount(Number(raw)))
   return {status:'pending',reason:'Review the selected filters.'};
  active.push({key,field,label,direction,limit:Number(raw)});
 }
 for(const [min,max] of [['capMin','capMax'],['ageMin','ageMax']]){
  const lower=active.find(item=>item.key===min),upper=active.find(item=>item.key===max);
  if(lower&&upper&&lower.limit>upper.limit)return {status:'pending',reason:'Review the selected filter range.'};
 }
 let pending=null;
 for(const {field,label,direction,limit} of active){
  let value=coin[field];
  if(field==='age'){
   const created=timestamp(coin.poolCreatedAt);
   value=created!==null&&amount(now)&&created<=now?(now-created)/3600000:null;
  }
  if(!amount(value)){pending??=label+' is unavailable for this filter.';continue;}
  if(direction==='min'&&value<limit)return {status:'excluded',reason:label+' is below your minimum.'};
  if(direction==='max'&&value>limit)return {status:'excluded',reason:label+' is above your maximum.'};
 }
 return pending?{status:'pending',reason:pending}:{status:'pass',reason:active.length?'Matches your selected filters.':'No result filters selected.'};
}

const unknownItems=detail=>[
 {key:'mintAuthority',label:'Mint authority',status:'unknown',detail},
 {key:'freezeAuthority',label:'Freeze authority',status:'unknown',detail}
];
function mintResult(items){
 const complete=items.every(item=>item.status!=='unknown'),flagged=items.some(item=>item.status==='flag');
 return {status:complete?'complete':'unavailable',label:flagged?'Authority active':complete?'Basic checks clear':'Check incomplete',items,checkedAt:new Date().toISOString()};
}
const unavailable=detail=>mintResult(unknownItems(detail));
function rateLimited(response){
 const raw=response.headers?.get('retry-after')?.trim(),seconds=raw&&/^\d+(?:\.\d+)?$/.test(raw)?Number(raw):NaN;
 const now=Date.now(),wait=Number.isFinite(seconds)?seconds*1000:Date.parse(raw||'')-now;
 // This is the provider cooldown, not a capped display countdown. The runtime
 // must not retry upstream early when Retry-After asks for more than a minute.
 const retryAfterMs=Number.isFinite(wait)?Math.max(60000,Math.min(Number.MAX_SAFE_INTEGER-now,Math.ceil(wait))):60000;
 return {...unavailable('The public Solana service is busy.'),errorCode:'rate-limit',retryAfterMs};
}

function mintItems(body,address){
 if(!object(body)||body.jsonrpc!=='2.0'||body.id!==1||Object.hasOwn(body,'error')
  ||!Number.isSafeInteger(body.result?.context?.slot)||body.result.context.slot<0)throw Error('format');
 const account=body.result.value;
 if(account===null)return unknownItems('The mint account was not found.');
 const data=account?.data,parsed=data?.parsed,info=parsed?.info,owner=account?.owner;
 if(!object(account)||account.executable!==false||![TOKEN_PROGRAM,TOKEN_2022].includes(owner)
  ||data?.program!==(owner===TOKEN_PROGRAM?'spl-token':'spl-token-2022')||parsed?.type!=='mint'||!object(info)
  ||info.isInitialized!==true||!Number.isInteger(info.decimals)||info.decimals<0||info.decimals>255
  ||typeof info.supply!=='string'||!/^(0|[1-9]\d{0,19})$/.test(info.supply)||BigInt(info.supply)>18446744073709551615n
  ||(info.mint!==undefined&&info.mint!==address)||(account.pubkey!==undefined&&account.pubkey!==address))throw Error('format');
 const items=[['mintAuthority','Mint authority','More tokens can be minted.','No mint authority is set.'],
  ['freezeAuthority','Freeze authority','Token accounts can be frozen.','No freeze authority is set.']].map(([key,label,active,clear])=>{
   const value=info[key];
   return {key,label,status:value===null?'pass':validMint(value)?'flag':'unknown',detail:value===null?clear:validMint(value)?active:'The authority value could not be verified.'};
  });
 if(owner===TOKEN_2022||info.extensions!==undefined)items.push({key:'extensions',label:'Additional token controls',status:'unknown',detail:'Token extensions are not assessed by these basic checks.'});
 return items;
}

async function readJSON(response,signal){
 const maxBytes=65536;
 if(Number(response.headers?.get('content-length'))>maxBytes){response.body?.cancel().catch(()=>{});throw Error('size');}
 if(!response.body)throw Error('format');
 const reader=response.body.getReader(),chunks=[];let size=0;
 const cancel=()=>{reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;if(size>maxBytes)throw Error('size');chunks.push(Buffer.from(value));
  }
  if(signal.aborted)throw Error('cancelled');
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
 }catch(error){cancel();throw error;}
 finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
}

// rpcUrl is trusted server configuration, never a URL from a post or API body.
// This helper sends only a public address and never follows redirects.
export async function inspectMint(address,{fetchImpl=fetch,signal,rpcUrl=RPC_URL,timeoutMs=10000}={}){
 if(!validMint(address))return unavailable('A valid Solana mint address is required.');
 if(signal?.aborted)return unavailable('The check was cancelled.');
 let endpoint;
 try{
  endpoint=new URL(rpcUrl);
  if(typeof rpcUrl!=='string'||rpcUrl.length>2048||endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.hash
   ||!endpoint.hostname.includes('.')||/^[\d.]+$/.test(endpoint.hostname)||endpoint.hostname.startsWith('[')
   ||/(?:^|\.)(?:localhost|local|internal)$/.test(endpoint.hostname))throw Error('endpoint');
 }catch{return unavailable('The mint-check service is not configured.');}
 const controller=new AbortController();let timer,abortListener;
 const stopped=new Promise(resolve=>{
  abortListener=()=>{controller.abort();resolve(unavailable('The check was cancelled.'));};
  signal?.addEventListener('abort',abortListener,{once:true});
  timer=setTimeout(()=>{controller.abort();resolve(unavailable('The mint check timed out.'));},Number.isFinite(timeoutMs)?Math.max(1,Math.min(30000,timeoutMs)):10000);
 });
 const request=(async()=>{
  try{
   const response=await fetchImpl(endpoint.href,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getAccountInfo',params:[address,{encoding:'jsonParsed',commitment:'confirmed'}]}),
    signal:controller.signal,redirect:'error',credentials:'omit',referrerPolicy:'no-referrer'});
   if(controller.signal.aborted)return unavailable('The check was cancelled.');
   if(!response.ok){response.body?.cancel().catch(()=>{});return response.status===429?rateLimited(response):unavailable('The mint-check service is unavailable.');}
   const body=await readJSON(response,controller.signal);
   if(controller.signal.aborted)return unavailable('The check was cancelled.');
   if(body?.jsonrpc==='2.0'&&body.id===1&&body.error?.code===429)return rateLimited(response);
   const items=mintItems(body,address);
   // Identity verification is separate from coverage: a Token-2022 mint can
   // be a verified token while its additional controls remain unassessed.
   return {...mintResult(items),...(body.result.value!==null?{mintVerified:true}:{})};
  }catch{return unavailable('The mint data could not be verified.');}
 })();
 try{return await Promise.race([request,stopped]);}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abortListener);}
}
