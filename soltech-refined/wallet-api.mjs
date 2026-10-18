import {validMint} from './dist/coin-checker-data.js';
import {localBundlerRequestAllowed} from './bundler-api.mjs';

const WALLET_ENDPOINT='https://soltech.d3ilz6ab0hx4y4.amplifyapp.com/api/wallet';
const ACCOUNT_ENDPOINT='https://solana-rpc.publicnode.com';
const SYSTEM_PROGRAM='11111111111111111111111111111111';
const TOKEN_PROGRAMS=new Map([
 ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','spl-token'],
 ['TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb','spl-token-2022'],
]);
const SOL_MINT='So11111111111111111111111111111111111111112';
const SOL_PRICE_ENDPOINT='https://api.dexscreener.com/tokens/v1/solana/'+SOL_MINT;
const unavailableSOLPrice=()=>({solPriceUsd:null,solPriceCheckedAt:null,solPriceSource:null});
const MAX_REQUEST_BYTES=1024;
const failure=(statusCode,error)=>({statusCode,body:{status:'error',error}});
const invalidAddress=()=>failure(400,'Paste a complete Solana wallet address.');
export const validWalletAddress=validMint;

async function readResponse(response,maxBytes,signal){
 if(Number(response.headers.get('content-length'))>maxBytes){response.body?.cancel().catch(()=>{});throw new Error('response size');}
 if(!response.body)throw new Error('missing response');
 const reader=response.body.getReader(),chunks=[];let bytes=0;
 const cancel=()=>{reader.cancel().catch(()=>{});};
 signal.addEventListener('abort',cancel,{once:true});
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   bytes+=value.byteLength;
   if(bytes>maxBytes)throw new Error('response size');
   chunks.push(Buffer.from(value));
  }
 }catch(error){reader.cancel().catch(()=>{});throw error;}
 finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
 if(signal.aborted)throw new Error('cancelled');
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function accountTypeFailure(body){
 if(!object(body)||body.jsonrpc!=='2.0'||body.id!==1||Object.hasOwn(body,'error')
  ||!object(body.result)||!Number.isSafeInteger(body.result.context?.slot)||body.result.context.slot<0
  ||!Object.hasOwn(body.result,'value'))throw new Error('invalid account response');
 const account=body.result.value;
 // An unfunded address can still own token accounts. A valid null RPC value
 // must not be confused with a missing or malformed account response.
 if(account===null)return null;
 if(!object(account)||!validMint(account.owner)||typeof account.executable!=='boolean'
  ||!Number.isInteger(account.lamports)||account.lamports<0
  ||!Number.isSafeInteger(account.space)||account.space<0)throw new Error('invalid account');
 const data=account.data;
 if(Array.isArray(data)){
  if(data.length!==2||data[1]!=='base64'||typeof data[0]!=='string'
   ||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data[0])
   ||Buffer.from(data[0],'base64').length!==account.space)throw new Error('invalid account data');
 }else if(!object(data)||typeof data.program!=='string'||!object(data.parsed)
  ||typeof data.parsed.type!=='string'||!data.parsed.type||!object(data.parsed.info)
  ||(Object.hasOwn(data,'space')&&data.space!==account.space))throw new Error('invalid parsed account');
 if(account.executable)return failure(400,'This is a program address. Paste a wallet address instead.');
 const tokenProgram=TOKEN_PROGRAMS.get(account.owner);
 if(tokenProgram){
  if(!Array.isArray(data)&&data.program!==tokenProgram)throw new Error('mismatched token program');
  if(data.parsed?.type==='mint')return failure(400,'This is a coin address. Paste a wallet address instead.');
  if(data.parsed?.type==='account')return failure(400,'This is a token account address. Paste your wallet address instead.');
  return failure(400,'This is a token program account. Paste a wallet address instead.');
 }
 if(account.owner===SYSTEM_PROGRAM&&account.space===0&&Array.isArray(data)&&data[0]==='')return null;
 return failure(400,'This account type is not supported. Paste a regular Solana wallet address.');
}

async function checkWalletAccount(address,{fetcher,signal,timeoutMs,maxResponseBytes}){
 const controller=new AbortController();let timer,rejectAbort;
 const cancelled=new Promise((_,reject)=>{rejectAbort=reject;});
 const abort=()=>{controller.abort();rejectAbort(new Error('cancelled'));};
 signal.addEventListener('abort',abort,{once:true});
 if(signal.aborted)abort();
 try{
  const request=(async()=>{
   if(controller.signal.aborted)throw new Error('cancelled');
   const response=await fetcher(ACCOUNT_ENDPOINT,{
    method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getAccountInfo',params:[address,{encoding:'jsonParsed',commitment:'confirmed'}]}),
    signal:controller.signal,redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'
   });
   if(controller.signal.aborted){response.body?.cancel().catch(()=>{});throw new Error('cancelled');}
   if(!response.ok){
    response.body?.cancel().catch(()=>{});
    if(response.status===429)return failure(429,'Wallet address verification is busy. Try again shortly.');
    return failure(response.status===504?504:503,'Wallet address verification is unavailable. Try again.');
   }
   return accountTypeFailure(await readResponse(response,maxResponseBytes,controller.signal));
  })();
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('account timeout'));},timeoutMs);});
  return await Promise.race([request,deadline,cancelled]);
 }catch{
  const timedOut=controller.signal.aborted;controller.abort();
  return failure(timedOut?504:503,timedOut?'Wallet address verification timed out. Try again.':'Wallet address verification is unavailable. Try again.');
 }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
}

function solPrice(body){
 if(!Array.isArray(body))return null;
 let best=null;
 for(const pair of body){
  if(pair?.chainId!=='solana'||pair.baseToken?.address!==SOL_MINT||!validMint(pair.pairAddress))continue;
  const raw=pair.priceUsd;
  const price=typeof raw==='number'?raw:typeof raw==='string'&&/^\d+(\.\d+)?$/.test(raw)?Number(raw):NaN;
  const liquidity=pair.liquidity?.usd;
  if(!Number.isFinite(price)||price<=0||typeof liquidity!=='number'||!Number.isFinite(liquidity)||liquidity<=0)continue;
  if(!best||liquidity>best.liquidity)best={price,liquidity};
 }
 return best?.price??null;
}

// One public mint quote is shared by all wallets in this API instance. Wallet
// addresses never enter this request, and an expired quote is never a fallback.
function createSOLPriceLookup({fetcher,timeoutMs,maxResponseBytes,cacheMs,now}){
 let cached=null,pending=null;
 return ()=>{
  const age=cached?now()-cached.receivedAt:Infinity;
  if(cached&&age>=0&&age<cacheMs)return Promise.resolve(cached.quote);
  if(pending)return pending;
  cached=null;
  const controller=new AbortController();let timer;
  const request=(async()=>{
   const response=await fetcher(SOL_PRICE_ENDPOINT,{
    method:'GET',headers:{Accept:'application/json'},signal:controller.signal,
    redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'
   });
   if(controller.signal.aborted||!response.ok){response.body?.cancel().catch(()=>{});throw new Error('quote unavailable');}
   const price=solPrice(await readResponse(response,maxResponseBytes,controller.signal));
   if(price===null)throw new Error('quote unavailable');
   return price;
  })();
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('quote timeout'));},timeoutMs);});
  pending=Promise.race([request,deadline]).then(price=>{
   const receivedAt=now(),quote={solPriceUsd:price,solPriceCheckedAt:new Date(receivedAt).toISOString(),solPriceSource:'dexscreener'};
   cached={receivedAt,quote};return quote;
  }).catch(()=>{controller.abort();return unavailableSOLPrice();}).finally(()=>{clearTimeout(timer);pending=null;});
  return pending;
 };
}

function validResult(body,address){
 const count=value=>Number.isSafeInteger(value)&&value>=0;
 const amount=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
 const risks=['high','caution','lower','unknown'];
 if(!(body?.address===address&&body.chain==='solana'&&body.supported===true&&!Object.hasOwn(body,'error')
  &&typeof body.checkedAt==='string'&&body.checkedAt.length<=40&&/^\d{4}-\d{2}-\d{2}T/.test(body.checkedAt)&&Date.parse(body.checkedAt)>0
  &&Array.isArray(body.holdings)&&body.holdings.length<=150
  &&count(body.tokens)&&body.shown===body.holdings.length&&body.shown<=body.tokens
  &&count(body.noMarket)&&body.noMarket<=body.shown&&amount(body.sol)&&amount(body.totalValue)
  &&risks.every(key=>count(body.risk?.[key]))
  &&body.holdings.every(holding=>holding&&validMint(holding.address)&&typeof holding.found==='boolean'&&amount(holding.amount)
   &&(holding.valueUsd===null||amount(holding.valueUsd))&&(!holding.found||risks.includes(holding.risk)))))return false;
 if(new Set(body.holdings.map(holding=>holding.address)).size!==body.shown
  ||body.noMarket!==body.holdings.filter(holding=>!holding.found).length
  ||!risks.every(key=>body.risk[key]===body.holdings.filter(holding=>holding.found&&holding.risk===key).length))return false;
 const total=body.holdings.reduce((sum,holding)=>sum+(holding.valueUsd??0),0);
 const tolerance=Number.EPSILON*Math.max(1,total,body.totalValue)*Math.max(1,body.shown)*8;
 return amount(total)&&Math.abs(body.totalValue-total)<=tolerance;
}

// Shared preview/production bridge to fixed read-only services. No credentials, arbitrary URLs,
// account state, or wallet addresses are saved by this process.
export function createWalletAPI({fetcher=fetch,timeoutMs=30000,maxResponseBytes=2000000,
 accountFetcher=fetcher,accountTimeoutMs=8000,accountMaxResponseBytes=65536,
 solPriceFetcher=fetcher,solPriceTimeoutMs=2000,solPriceMaxResponseBytes=1000000,solPriceCacheMs=30000,now=Date.now}={}){
 const pending=new Map();
 const lookupSOLPrice=createSOLPriceLookup({fetcher:solPriceFetcher,timeoutMs:solPriceTimeoutMs,maxResponseBytes:solPriceMaxResponseBytes,cacheMs:solPriceCacheMs,now});
 return async value=>{
  const address=typeof value==='string'?value.trim():'';
  if(!validWalletAddress(address))return invalidAddress();
  if(pending.has(address))return pending.get(address);
  if(pending.size>=2)return failure(429,'Wallet checks are busy. Try again shortly.');
  const controller=new AbortController();let timer;
  const request=(async()=>{
   const rejected=await checkWalletAccount(address,{fetcher:accountFetcher,signal:controller.signal,timeoutMs:accountTimeoutMs,maxResponseBytes:accountMaxResponseBytes});
   if(controller.signal.aborted)throw new Error('cancelled');
   if(rejected)return rejected;
   const response=await fetcher(WALLET_ENDPOINT,{
    method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({address}),signal:controller.signal,redirect:'error',credentials:'omit',referrerPolicy:'no-referrer'
   });
   if(controller.signal.aborted)throw new Error('cancelled');
   if(!response.ok){
    response.body?.cancel().catch(()=>{});
    if(response.status===429)return failure(429,'Wallet checks are busy. Try again shortly.');
    if(response.status===400||response.status===422)return failure(400,'The wallet service could not read this address. Check it and try again.');
    if(response.status===401||response.status===403)return failure(503,'The wallet service is not accepting requests right now. Try again later.');
    if(response.status===504)return failure(504,'The wallet service timed out. Try again.');
    return failure(502,'The wallet service is temporarily unavailable. Try again later.');
   }
   const body=await readResponse(response,maxResponseBytes,controller.signal);
   if(!validResult(body,address))throw new Error('invalid response');
   return {statusCode:200,body:{...body,status:'ready'}};
  })();
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('timeout'));},timeoutMs);});
  const upstream=Promise.race([request,deadline]).catch(()=>{
   const timedOut=controller.signal.aborted;controller.abort();
   return failure(timedOut?504:502,timedOut?'Wallet check timed out. Try again.':'The wallet service is unavailable or returned an unreadable response. Try again later.');
  }).finally(()=>{clearTimeout(timer);});
  // Pricing has its own deadline: it can add at most two seconds by default,
  // cannot invalidate holdings, and never delays an upstream error.
  const result=upstream.then(async report=>{
   if(report.statusCode!==200)return report;
   const quote=report.body.sol>0?await lookupSOLPrice():unavailableSOLPrice();
   return {...report,body:{...report.body,...quote}};
  }).finally(()=>{pending.delete(address);});
  pending.set(address,result);return result;
 };
}

export function localWalletRequestAllowed(req,port){
 return localBundlerRequestAllowed(req,port)
  &&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress);
}

function send(res,result,headers={}){
 res.writeHead(result.statusCode,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
 res.end(JSON.stringify(result.body));
}

// Returns false for unrelated paths so it can precede any local static server.
export function createWalletHandler({port,...options}={}){
 const lookup=createWalletAPI(options);
 return async(req,res,pathname)=>{
  if(pathname!=='/api/wallet')return false;
  if(!localWalletRequestAllowed(req,port)){send(res,failure(403,'Open wallet checks from the local Solventir preview.'));return true;}
  if(req.method!=='POST'){send(res,failure(405,'Use POST to check a wallet.'),{Allow:'POST'});return true;}
  if(String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json'){
   send(res,failure(415,'Send the wallet address as JSON.'));return true;
  }
  if(Number(req.headers['content-length'])>MAX_REQUEST_BYTES){send(res,failure(413,'The wallet request is too large.'));req.resume?.();return true;}
  let body;
  try{
   const chunks=[];let bytes=0;
   // Keep the response socket usable when rejecting an oversized streamed body.
   for await(const chunk of req.iterator?.({destroyOnReturn:false})||req){
    bytes+=Buffer.byteLength(chunk);
    if(bytes>MAX_REQUEST_BYTES){send(res,failure(413,'The wallet request is too large.'));req.resume?.();return true;}
    chunks.push(Buffer.from(chunk));
   }
   body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }catch{send(res,failure(400,'Unable to read the wallet address.'));return true;}
  send(res,await lookup(body?.address));return true;
 };
}
