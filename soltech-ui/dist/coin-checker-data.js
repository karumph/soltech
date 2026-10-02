// Public, read-only sources. No wallet, keys, or scanner workspace access.
import {NETWORKS,validEvmAddress,sameAddress} from './coin-networks.js';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function validMint(value){
 if(typeof value!=='string'||value.length<32||value.length>44)return false;
 let number=0n;
 for(const char of value){const digit=alphabet.indexOf(char);if(digit<0)return false;number=number*58n+BigInt(digit);}
 let bytes=0;while(number>0n){bytes++;number>>=8n;}
 const zeroes=value.match(/^1*/)[0].length;
 return bytes+zeroes===32;
}
export const textValue=(value,fallback='')=>typeof value==='string'?value.trim().slice(0,500)||fallback:fallback;
export const validTokenAddress=(value,chain='solana')=>NETWORKS[chain]?.kind==='solana'?validMint(value):NETWORKS[chain]?.kind==='evm'?validEvmAddress(value):false;
// DEX pool identifiers can be v4 IDs or Curve pool/token combinations, not just contract addresses.
export const validPairId=(value,chain='solana')=>chain==='solana'?validMint(value):NETWORKS[chain]?.kind==='evm'&&typeof value==='string'&&/^0x(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})(?:-0x[0-9a-fA-F]{40}){0,2}$/.test(value);
export const formatMoney=n=>typeof n!=='number'||!Number.isFinite(n)||n<0?'Unavailable':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:n>=10000?'compact':'standard',...(n>0&&n<.000001?{maximumSignificantDigits:5}:{maximumFractionDigits:n===0?0:n<.01?10:n<1?6:2})}).format(n);
const numeric=(value,signed=false)=>typeof value==='number'&&Number.isFinite(value)&&(signed||value>=0)?value:null;
const price=value=>typeof value==='string'&&/^\d+(\.\d+)?$/.test(value)?numeric(Number(value)):null;
const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
// Provider links remain untrusted. Do not turn arbitrary schemes or credentials into actions.
export function safeExternalUrl(value){
 if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\u007f]/.test(value))return null;
 try{const url=new URL(value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password||!url.hostname.includes('.')||/^[\d.]+$/.test(url.hostname)||url.hostname.startsWith('[')||url.hostname==='localhost'||url.hostname.endsWith('.localhost')||url.hostname.endsWith('.local'))return null;return url.href;}catch{return null;}
}
function socialLinks(info){
 const links=[],seen=new Set();
 const add=(kind,value)=>{const url=safeExternalUrl(value);if(!url||seen.has(url))return;const hostname=new URL(url).hostname.toLowerCase().replace(/^www\./,'');
  if((kind==='x'&&!['x.com','twitter.com'].includes(hostname))||(kind==='telegram'&&!['t.me','telegram.me'].includes(hostname)))return;
  seen.add(url);links.push({kind,label:{website:'Website',x:'X',telegram:'Telegram'}[kind],url});};
 for(const entry of Array.isArray(info?.websites)?info.websites.slice(0,10):[])add('website',entry?.url);
 for(const entry of Array.isArray(info?.socials)?info.socials.slice(0,20):[]){const type=textValue(entry?.type).toLowerCase();if(['twitter','x','telegram'].includes(type))add(type==='telegram'?'telegram':'x',entry?.url);}
 return links.slice(0,8);
}
export function safeImageUrl(value){
 const url=safeExternalUrl(value);
 return url?.startsWith('https:')?url:null;
}
// A JSON number that has already lost integer precision cannot be repaired. Accept uint64 strings too.
export function normalizeSupply(rawValue,decimals){
 if(!Number.isInteger(decimals)||decimals<0||decimals>255)return null;
 const raw=typeof rawValue==='number'?(Number.isSafeInteger(rawValue)&&rawValue>=0?String(rawValue):null):typeof rawValue==='string'&&/^\d{1,20}$/.test(rawValue)?rawValue:null;
 if(raw===null||BigInt(raw)>18446744073709551615n)return null;
 const digits=BigInt(raw).toString();
 const padded=digits.padStart(decimals+1,'0'),whole=decimals?padded.slice(0,-decimals):padded,fraction=decimals?padded.slice(-decimals).replace(/0+$/,''):'';
 return {raw:digits,decimals,exact:whole+(fraction?'.'+fraction:'')};
}
function ownership(data){
 const poolAddresses=new Set(),lockerAddresses=new Set();
 for(const market of Array.isArray(data.markets)?data.markets:[])for(const value of [market?.pubkey,market?.liquidityA,market?.liquidityB])if(validMint(value))poolAddresses.add(value);
 for(const [address,info] of Object.entries(data.knownAccounts&&typeof data.knownAccounts==='object'&&!Array.isArray(data.knownAccounts)?data.knownAccounts:{})){
  if(!validMint(address))continue;
  const type=textValue(info?.type).toUpperCase();if(type==='AMM')poolAddresses.add(address);if(type==='LOCKER')lockerAddresses.add(address);
 }
 const seen=new Set(),accounts=[];let incomplete=false;
 for(const entry of Array.isArray(data.topHolders)?data.topHolders.slice(0,100):[]){
  const percent=numeric(entry?.pct);if(!validMint(entry?.address)||percent===null||percent>100||seen.has(entry.address)){incomplete=true;continue;}
  seen.add(entry.address);const owner=validMint(entry.owner)?entry.owner:null;
  const kind=poolAddresses.has(entry.address)||poolAddresses.has(owner)?'pool':lockerAddresses.has(entry.address)||lockerAddresses.has(owner)?'locker':'account';
  accounts.push({address:entry.address,owner,percent,kind});
 }
 accounts.sort((a,b)=>b.percent-a.percent||a.address.localeCompare(b.address));
 const nonPool=accounts.filter(a=>a.kind!=='pool'),total=nonPool.slice(0,10).reduce((sum,a)=>sum+a.percent,0);
 return {largestAccounts:accounts,top10Percent:!incomplete&&nonPool.length>=10&&total<=100?total:null,excludedPoolAccounts:accounts.filter(a=>a.kind==='pool').length};
}
export class LookupError extends Error{constructor(code){super(code);this.code=code;}}
export function normalizeBundles(data,mint,now=Date.now()){
 if(!validMint(mint)||!data||Array.isArray(data)||count(data.total)===null||!Array.isArray(data.wallets)||data.wallets.length>500||data.wallets.length>data.total)throw new LookupError('format');
 const percentage=value=>numeric(value)!==null&&value<=100?value:null;
 const current=percentage(data.percentage),initial=percentage(data.initialPercentage);
 if(data.total===0&&(data.wallets.length||current>0||initial>0))throw new LookupError('format');
 const seen=new Set(),wallets=[];let incomplete=false;
 for(const wallet of data.wallets){
  if(!validMint(wallet?.wallet)||seen.has(wallet.wallet)){incomplete=true;continue;}
  seen.add(wallet.wallet);wallets.push({wallet:wallet.wallet,percentage:percentage(wallet.percentage)});
 }
 return {mint,provider:'Solana Tracker',total:data.total,percentage:current,initialPercentage:initial,wallets,walletsIncomplete:incomplete,retrievedAt:now};
}
export async function loadBundlers(mint,signal,chain='solana',request=requestJSON){
 if(chain!=='solana')return {status:'unsupported'};
 const result=await request('/api/bundlers?chain=solana&address='+mint,{signal,timeout:10000});
 if(result?.status==='not-connected'||result?.status==='unsupported')return {status:result.status};
 if(result?.status==='error')return {status:'error',message:textValue(result.message,'Bundler data is unavailable.')};
 if(result?.status!=='ready'||result.data?.mint!==mint||typeof result.data.retrievedAt!=='number'||!Number.isFinite(result.data.retrievedAt)||result.data.retrievedAt<1230768000000||result.data.retrievedAt>Date.now()+5000)throw new LookupError('format');
 const data=normalizeBundles(result.data,mint,result.data.retrievedAt);
 data.walletsIncomplete=data.walletsIncomplete||result.data.walletsIncomplete===true;
 return {status:'ready',data};
}
export function normalizeMarket(data,mint,now=Date.now(),chain='solana'){
 if(!Array.isArray(data))throw new LookupError('format');
 const pairs=data.filter(p=>p&&p.chainId===chain&&sameAddress(p.baseToken?.address,mint,chain)&&validPairId(p.pairAddress,chain));
 if(!pairs.length)return null;
 pairs.sort((a,b)=>(numeric(b.liquidity?.usd)??-1)-(numeric(a.liquidity?.usd)??-1)||String(a.pairAddress).localeCompare(String(b.pairAddress)));
 const p=pairs[0],created=numeric(p.pairCreatedAt);
 return {mint,chainId:chain,name:textValue(p.baseToken.name,'Unnamed coin'),symbol:textValue(p.baseToken.symbol,'—'),pair:p.pairAddress,
  dex:textValue(p.dexId,'Unknown exchange'),quote:textValue(p.quoteToken?.symbol,'Unknown quote'),imageUrl:safeImageUrl(p.info?.imageUrl),
  price:price(p.priceUsd),marketCap:numeric(p.marketCap),fdv:numeric(p.fdv),liquidity:numeric(p.liquidity?.usd),
  volume:numeric(p.volume?.h24),change:numeric(p.priceChange?.h24,true),buys:count(p.txns?.h24?.buys),sells:count(p.txns?.h24?.sells),
  volume1h:numeric(p.volume?.h1),change1h:numeric(p.priceChange?.h1,true),buys1h:count(p.txns?.h1?.buys),sells1h:count(p.txns?.h1?.sells),links:socialLinks(p.info),
  // Active promotion count for this exact base token, not spend or past boost purchases.
  boostsActive:count(p.boosts?.active),boostsStatus:p.boosts==null?'not-reported':count(p.boosts?.active)!==null?'reported':'unavailable',
  // DEX Screener live responses express pool creation in milliseconds. Never infer token age.
  created:created!==null&&created>=1230768000000&&created<=now?created:null,pools:pairs.length,retrievedAt:now};
}
const authority=(token,key)=>token&&Object.hasOwn(token,key)?token[key]===null?'Disabled':typeof token[key]==='string'&&validMint(token[key])?'Enabled':'Unavailable':'Unavailable';
export function normalizeRisk(data,mint,now=Date.now()){
 if(!data||Array.isArray(data)||data.mint!==mint||!Array.isArray(data.risks)||!textValue(data.tokenProgram))throw new LookupError('format');
 const flags=data.risks.map(r=>({name:textValue(r?.name,'Unclassified finding'),description:textValue(r?.description,'Rugcheck did not provide an explanation.'),level:r?.level==='danger'?'high':r?.level==='warn'?'caution':'unknown'}));
 flags.sort((a,b)=>({high:0,caution:1,unknown:2}[a.level])-({high:0,caution:1,unknown:2}[b.level]));
 const incomplete=data.risks.some(r=>!r||!textValue(r.name)||!['danger','warn'].includes(r.level))||authority(data.token,'mintAuthority')==='Unavailable'||authority(data.token,'freezeAuthority')==='Unavailable';
 const level=flags.some(f=>f.level==='high')?'high':flags.some(f=>f.level==='caution')?'caution':incomplete?'unknown':'lower';
 return {mint,chainId:'solana',provider:'Rugcheck',level,flags,incomplete,retrievedAt:now,name:textValue(data.tokenMeta?.name),symbol:textValue(data.tokenMeta?.symbol),
  description:textValue(data.fileMeta?.description),holders:count(data.totalHolders)>0?data.totalHolders:null,
  // Provider-reported graph signal; neither proven identities nor a bundled-supply percentage.
  insiderAccounts:count(data.graphInsidersDetected),
  supply:normalizeSupply(data.token?.supply,data.token?.decimals),...ownership(data),
  mintAuthority:authority(data.token,'mintAuthority'),freezeAuthority:authority(data.token,'freezeAuthority'),
  mutable:typeof data.tokenMeta?.mutable==='boolean'?(data.tokenMeta.mutable?'Changeable':'Fixed'):'Unavailable'};
}
export function normalizeEvmRisk(data,mint,chain,now=Date.now()){
 if(!NETWORKS[chain]?.securityId||!validEvmAddress(mint)||data?.code!==1||!data.result||typeof data.result!=='object')throw new LookupError('format');
 const entries=Object.entries(data.result).filter(([address])=>sameAddress(address,mint,chain));
 if(!entries.length)return null;
 const r=entries[0][1];if(!r||typeof r!=='object'||Array.isArray(r)||!Object.keys(r).length)return null;
 const flag=key=>r[key]==='1'?true:r[key]==='0'?false:null;
 const flags=[];
 const rules=[
  ['is_honeypot','high','Honeypot reported','GoPlus reports a honeypot risk.'],
  ['cannot_sell_all','caution','Selling restriction reported','GoPlus reports that the full token balance cannot be sold in one sale.'],
  ['owner_change_balance','caution','Owner can change balances','The contract owner can change token balances.'],
  ['selfdestruct','caution','Contract can self-destruct','GoPlus reports self-destruct functionality.'],
  ['is_mintable','caution','More tokens can be minted','The contract can create additional supply. This is a capability, not proof of fraud.'],
  ['transfer_pausable','caution','Transfers can be paused','The contract can pause token transfers.'],
  ['is_blacklisted','caution','Blacklist controls','The contract has blacklist functionality.'],
  ['hidden_owner','caution','Hidden owner reported','GoPlus reports hidden ownership controls.'],
  ['can_take_back_ownership','caution','Ownership can be reclaimed','GoPlus reports a way to take back contract ownership.'],
  ['is_proxy','caution','Proxy contract','This contract uses a proxy. Its logic may be changeable, and some checks may be unavailable.'],
  ['slippage_modifiable','caution','Trading tax can change','The contract can change buy or sell tax.']
 ];
 for(const [key,level,name,description] of rules)if(flag(key)===true)flags.push({level,name,description});
 if(flag('is_open_source')===false)flags.push({level:'caution',name:'Source code not verified',description:'GoPlus reports that the contract source is not open for inspection.'});
 const tax=key=>typeof r[key]==='string'&&/^\d+(\.\d+)?$/.test(r[key])&&Number(r[key])<=1?Number(r[key]):null;
 const incomplete=['is_open_source',...rules.map(([key])=>key)].some(key=>flag(key)===null);
 flags.sort((a,b)=>({high:0,caution:1}[a.level])-({high:0,caution:1}[b.level]));
 const level=flags.some(f=>f.level==='high')?'high':flags.length?'caution':incomplete?'unknown':'lower';
 const yesNo=key=>flag(key)===null?'Unavailable':flag(key)?'Yes':'No';
 const supply=typeof r.total_supply==='string'&&/^\d{1,80}(\.\d{1,80})?$/.test(r.total_supply)?{exact:r.total_supply}:null;
 const holders=typeof r.holder_count==='string'&&/^\d+$/.test(r.holder_count)?Number(r.holder_count):null;
 return {mint,chainId:chain,provider:'GoPlus',level,flags,incomplete,retrievedAt:now,name:textValue(r.token_name),symbol:textValue(r.token_symbol),description:'',supply,holders:count(holders)>0?holders:null,largestAccounts:[],top10Percent:null,excludedPoolAccounts:0,
  controls:[{label:'Source code verified',value:yesNo('is_open_source')},{label:'Honeypot reported',value:yesNo('is_honeypot')},{label:'Can mint more',value:yesNo('is_mintable')},{label:'Transfers can pause',value:yesNo('transfer_pausable')},{label:'Buy tax',value:tax('buy_tax')===null?'Unavailable':(tax('buy_tax')*100).toLocaleString('en-US',{maximumFractionDigits:2})+'%'},{label:'Sell tax',value:tax('sell_tax')===null?'Unavailable':(tax('sell_tax')*100).toLocaleString('en-US',{maximumFractionDigits:2})+'%'}]};
}
// An approved profile order describes a paid listing, never a security review or endorsement.
export function normalizeListing(data,now=Date.now()){
 const orders=Array.isArray(data)?data:data&&typeof data==='object'&&Array.isArray(data.orders)?data.orders:null;
 if(!orders)throw new LookupError('format');
 const approved=orders.some(order=>order?.type==='tokenProfile'&&order.status==='approved');
 const incomplete=orders.some(order=>!order||typeof order!=='object'||!textValue(order.type)||!textValue(order.status));
 const profilePending=orders.some(order=>order?.type==='tokenProfile'&&order.status!=='approved');
 const profiles=orders.filter(order=>order?.type==='tokenProfile');
 const knownProfiles=profiles.every(order=>['processing','cancelled','on-hold','approved','rejected'].includes(order.status));
 const profileStatus=approved?'paid':incomplete||!knownProfiles?'unavailable':!profiles.length?'not-reported':profiles.every(order=>order.status==='cancelled')?'cancelled':profiles.every(order=>['cancelled','rejected'].includes(order.status))?'not-approved':'pending';
 return {profilePaid:approved?true:incomplete||profilePending?null:false,profileStatus,retrievedAt:now};
}
// Each series is one pool's bounded observed window, never a token-wide all-time high.
export function normalizeHistory(data,mint,pair,now=Date.now(),chain='solana',interval='hour'){
 const candles=data?.data?.attributes?.ohlcv_list;
 if(!validTokenAddress(mint,chain)||!validPairId(pair,chain)||data?.data?.type!=='ohlcv_request_response'||!Array.isArray(candles)||candles.length>1000||![data?.meta?.base?.address,data?.meta?.quote?.address].some(address=>sameAddress(address,mint,chain)))throw new LookupError('format');
 if(!['hour','minute'].includes(interval))throw new LookupError('format');
 const intervalMs=interval==='minute'?60000:3600000,windowStart=Math.floor(now/intervalMs)*intervalMs-999*intervalMs,seen=new Set(),points=[];
 for(const candle of candles){
  if(!Array.isArray(candle)||candle.length!==6)throw new LookupError('format');
  const [seconds,open,high,low,close,volume]=candle,timestamp=seconds*1000;
  if(!Number.isSafeInteger(seconds)||seconds%(intervalMs/1000)!==0||timestamp<1230768000000||timestamp>now||seen.has(seconds)||[open,high,low,close,volume].some(value=>numeric(value)===null)||high<Math.max(open,low,close)||low>Math.min(open,high,close))throw new LookupError('format');
  seen.add(seconds);if(timestamp>=windowStart)points.push({timestamp,open,high,low,close,volume});
 }
 if(!points.length)return null;
 points.sort((a,b)=>a.timestamp-b.timestamp);
 return {mint,pair,chainId:chain,interval,intervalMs,currency:'usd',windowStart,rawCount:candles.length,windowHours:1000*intervalMs/3600000,points,observedHigh:Math.max(...points.map(p=>p.high)),observedLow:Math.min(...points.map(p=>p.low)),from:points[0].timestamp,through:points.at(-1).timestamp,retrievedAt:now};
}
export async function loadPriceHistory(mint,market,signal,chain='solana',request=requestJSON){
 const results=await Promise.allSettled(['hour','minute'].map(async interval=>{
  const url='https://api.geckoterminal.com/api/v2/networks/'+NETWORKS[chain].gecko+'/pools/'+market.pair+'/ohlcv/'+interval+'?aggregate=1&limit=1000&currency=usd&include_empty_intervals=false&token='+mint;
  return normalizeHistory(await request(url,{signal}),mint,market.pair,Date.now(),chain,interval);
 }));
 const [hourly,recent]=results.map(result=>result.status==='fulfilled'?result.value:null);
 if(!hourly&&!recent){const failed=results.find(result=>result.status==='rejected');if(failed)throw failed.reason;return null;}
 const series=[hourly,recent].filter(Boolean);
 return {...(hourly||recent),recent,retrievedAt:Math.max(...series.map(h=>h.retrievedAt)),observedHigh:Math.max(...series.map(h=>h.observedHigh)),observedLow:Math.min(...series.map(h=>h.observedLow)),recentStatus:results[1].status==='rejected'?'unavailable':recent?'ready':'empty',hourlyStatus:results[0].status==='rejected'?'unavailable':hourly?'ready':'empty'};
}
export async function requestJSON(url,{signal,fetcher=fetch,timeout=18000}={}){
 const controller=new AbortController();let timedOut=false;
 const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
 if(signal?.aborted)controller.abort();
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeout);
 try{
  const response=await fetcher(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw new LookupError(response.status===429?'rate':response.status===404?'missing':'service');
  const body=await response.text();if(body.length>3000000)throw new LookupError('format');
  try{return JSON.parse(body);}catch{throw new LookupError('format');}
 }catch(error){if(timedOut)throw new LookupError('timeout');if(signal?.aborted)throw error;if(error instanceof LookupError)throw error;throw new LookupError('network');}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export const errorText=error=>({rate:'This source is busy. Wait a minute, then try again.',missing:'No report is available from this source yet.',service:'This source is temporarily unavailable. Try again shortly.',format:'This source returned incomplete data. Try again later.',timeout:'This source took too long to respond. Try again.',network:'Couldn’t reach this source. Check your connection and try again.'}[error?.code]||'Couldn’t load this source. Try again.');
export function createLookupSession(onChange,{loadMarket,loadRisk,loadListing,loadHistory,loadBundles}={}){
 let serial=0,controller=null,disposed=false;
 const marketLoader=loadMarket||((mint,signal,chain)=>requestJSON('https://api.dexscreener.com/token-pairs/v1/'+chain+'/'+mint,{signal}).then(d=>normalizeMarket(d,mint,Date.now(),chain)));
 const riskLoader=loadRisk||((mint,signal,chain)=>chain==='solana'?requestJSON('https://api.rugcheck.xyz/v1/tokens/'+mint+'/report',{signal}).then(d=>normalizeRisk(d,mint)):requestJSON('https://api.gopluslabs.io/api/v1/token_security/'+NETWORKS[chain].securityId+'?contract_addresses='+mint,{signal}).then(d=>normalizeEvmRisk(d,mint,chain)));
 const listingLoader=loadListing||((mint,signal,chain)=>requestJSON('https://api.dexscreener.com/orders/v1/'+chain+'/'+mint,{signal}).then(d=>normalizeListing(d)));
 const historyLoader=loadHistory||loadPriceHistory;
 const bundleLoader=loadBundles||loadBundlers;
 return {
  async lookup(mint,chain='solana'){
   controller?.abort();const id=++serial;
   if(disposed)return;
   if(!validTokenAddress(mint,chain))throw new LookupError('address');
   controller=new AbortController();const signal=controller.signal;
   let state={mint,chainId:chain,market:{status:'loading'},risk:{status:'loading'},listing:{status:'loading'},history:{status:'waiting'},bundles:{status:chain==='solana'?'loading':'unsupported'}};
   const emit=()=>{if(!disposed&&id===serial)onChange(state);};emit();
   const history=async market=>{
    if(disposed||id!==serial||signal.aborted)return;
    if(!market){state={...state,history:{status:'empty',data:null}};emit();return;}
    if(!sameAddress(market.mint,mint,chain)||!validPairId(market.pair,chain)||(market.chainId&&market.chainId!==chain)){state={...state,history:{status:'error',message:errorText(new LookupError('format'))}};emit();return;}
    state={...state,history:{status:'loading'}};emit();
    try{const data=await historyLoader(mint,market,signal,chain);if(disposed||id!==serial||signal.aborted)return;state={...state,history:{status:data?'ready':'empty',data}};}
    catch(error){if(disposed||id!==serial||signal.aborted)return;state={...state,history:{status:'error',message:errorText(error)}};}
    emit();
   };
   const bundleTask=(async()=>{
    try{const result=await bundleLoader(mint,signal,chain);if(disposed||id!==serial||signal.aborted)return;state={...state,bundles:result};}
    catch{if(disposed||id!==serial||signal.aborted)return;state={...state,bundles:{status:'error',message:'Bundler data is unavailable. Try again later.'}};}
    emit();
   })();
   await Promise.allSettled([bundleTask,...[['market',marketLoader],['risk',riskLoader],['listing',listingLoader]].map(async([key,load])=>{
    try{const data=await load(mint,signal,chain);if(disposed||id!==serial||signal.aborted)return;state={...state,[key]:{status:data?'ready':'empty',data}};emit();if(key==='market')await history(data);return;}
    catch(error){if(disposed||id!==serial||signal.aborted)return;state={...state,[key]:{status:'error',message:errorText(error)}};}
    if(key==='market')state={...state,history:{status:'empty',data:null}};
    emit();
   })]);
  },
  cancel(){serial++;controller?.abort();},
  dispose(){disposed=true;serial++;controller?.abort();}
 };
}
