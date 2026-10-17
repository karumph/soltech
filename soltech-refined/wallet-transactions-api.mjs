import {validMint} from './dist/coin-checker-data.js';
import {localWalletRequestAllowed} from './wallet-api.mjs';

const RPC_ENDPOINT='https://api.mainnet-beta.solana.com';
const RPC_ID=1;
const PAGE_SIZE=20;
const MAX_TRANSACTION_VERSION=1;
const MAX_REQUEST_BYTES=1024;
const failure=(statusCode,error)=>({statusCode,body:{status:'error',error}});
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
const count=value=>Number.isSafeInteger(value)&&value>=0;
const blockTime=value=>value===null||(count(value)&&value<=8640000000000);
const transactionError=value=>value===null||(typeof value==='string'&&value.length>0&&value.length<=200)||(record(value)&&Object.keys(value).length>0);

export function validTransactionSignature(value){
 if(typeof value!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value))return false;
 const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
 let number=0n;for(const char of value)number=number*58n+BigInt(alphabet.indexOf(char));
 let bytes=0;while(number>0n){bytes++;number>>=8n;}
 return bytes+(value.match(/^1*/)?.[0].length||0)===64;
}

async function readResponse(response,maxBytes,signal){
 if(Number(response.headers.get('content-length'))>maxBytes){response.body?.cancel().catch(()=>{});throw Error('response size');}
 if(!response.body)throw Error('missing response');
 const reader=response.body.getReader(),chunks=[];let bytes=0;
 const cancel=()=>{reader.cancel().catch(()=>{});};
 signal.addEventListener('abort',cancel,{once:true});
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   bytes+=value.byteLength;if(bytes>maxBytes)throw Error('response size');
   chunks.push(Buffer.from(value));
  }
 }catch(error){reader.cancel().catch(()=>{});throw error;}
 finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function normalizeTransactions(body,before){
 if(!record(body)||body.jsonrpc!=='2.0'||body.id!==RPC_ID||Object.hasOwn(body,'error')||!Array.isArray(body.result)||body.result.length>PAGE_SIZE)throw Error('invalid response');
 const seen=new Set();
 return body.result.map(item=>{
  if(!record(item)||!validTransactionSignature(item.signature)||seen.has(item.signature)||item.signature===before
   ||!count(item.slot)||!blockTime(item.blockTime)
   ||![null,'processed','confirmed','finalized'].includes(item.confirmationStatus)
   ||!transactionError(item.err))throw Error('invalid transaction');
  seen.add(item.signature);
  return {signature:item.signature,slot:item.slot,blockTime:item.blockTime,status:item.err===null?'succeeded':'failed',confirmationStatus:item.confirmationStatus};
 });
}

// Requests are held only while pending. Both handler routes share this bounded pool.
function createRPCQuery({fetcher=fetch,timeoutMs=20000,pending=new Map(),cooldown={until:0},clock=Date.now}={}){
 const busy=(retryAfterMs,message='The public Solana service is busy. Try again shortly.')=>({statusCode:429,body:{status:'error',error:message,retryAfterMs:Math.max(1000,Math.min(60000,Math.ceil(retryAfterMs)))}});
 const limited=response=>{
  const header=response.headers.get('retry-after'),seconds=header!==null&&/^\d+(?:\.\d+)?$/.test(header.trim())?Number(header):NaN;
  const date=header!==null?Date.parse(header):NaN;
  const delay=Number.isFinite(seconds)?seconds*1000:Number.isFinite(date)?date-clock():10000;
  // Keep the provider's full deadline. The UI receives at most a minute per
  // countdown, but another local retry cannot call upstream before this time.
  const wait=Math.max(1000,Math.min(Number.MAX_SAFE_INTEGER-clock(),delay));cooldown.until=Math.max(cooldown.until,clock()+wait);
  return busy(cooldown.until-clock());
 };
 return async({key,method,params,maxResponseBytes,convert})=>{
  if(pending.has(key))return pending.get(key);
  if(cooldown.until>clock())return busy(cooldown.until-clock());
  if(pending.size>=2)return busy(1000,'Wallet transactions are busy. Try again shortly.');
  const controller=new AbortController();let timer,timedOut=false;
  const request=(async()=>{
   const response=await fetcher(RPC_ENDPOINT,{
    method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:RPC_ID,method,params}),
    signal:controller.signal,redirect:'error',credentials:'omit',referrerPolicy:'no-referrer'
   });
   if(controller.signal.aborted)throw Error('cancelled');
   if(!response.ok){
    response.body?.cancel().catch(()=>{});
    if(response.status===429)return limited(response);
    if(response.status===401||response.status===403)return failure(503,'The public Solana service is not accepting requests right now. Try again later.');
    if(response.status===408||response.status===504)return failure(504,'The transaction check timed out. Try again.');
    return failure(502,'The public Solana service is temporarily unavailable. Try again later.');
   }
   const body=await readResponse(response,maxResponseBytes,controller.signal);
   if(record(body)&&body.jsonrpc==='2.0'&&body.id===RPC_ID&&record(body.error)){
    if(body.error.code===429)return limited(response);
    if(body.error.code===-32005)return failure(503,'The public Solana service is temporarily unavailable. Try again later.');
    if(body.error.code===-32015)return failure(422,'This transaction uses a newer format that this app cannot read yet.');
    return failure(502,'The public Solana service could not load transactions. Try again later.');
   }
   return convert(body);
  })();
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true;controller.abort();reject(Error('timeout'));},timeoutMs);});
  const result=Promise.race([request,deadline]).catch(()=>{
   controller.abort();
   return failure(timedOut?504:502,timedOut?'The transaction check timed out. Try again.':'The public Solana service is unavailable or returned an unreadable response. Try again later.');
  }).finally(()=>{clearTimeout(timer);pending.delete(key);});
  pending.set(key,result);return result;
 };
}

// Public, read-only RPC. No addresses, signatures, or results are stored persistently.
export function createWalletTransactionsAPI({maxResponseBytes=262144,now=Date.now,...options}={}){
 const query=createRPCQuery(options);
 return async value=>{
  const address=typeof value?.address==='string'?value.address.trim():'';
  if(!record(value)||!validMint(address))return failure(400,'Paste a complete Solana wallet address.');
  const before=value.before??null;
  if(before!==null&&!validTransactionSignature(before))return failure(400,'The transaction page could not be read. Start a new wallet check.');
  return query({key:'history:'+address+':'+(before||''),method:'getSignaturesForAddress',params:[address,{limit:PAGE_SIZE,commitment:'confirmed',...(before?{before}:{})}],maxResponseBytes,convert:body=>{
   const transactions=normalizeTransactions(body,before);
   return {statusCode:200,body:{status:'ready',address,transactions,nextBefore:transactions.length===PAGE_SIZE?transactions.at(-1).signature:null,checkedAt:new Date(now()).toISOString()}};
  }});
 };
}

const SYSTEM_PROGRAM='11111111111111111111111111111111';
const TOKEN_PROGRAMS=new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
const MAX_ACTIVITY=30;
const rawAmount=value=>typeof value==='string'&&/^(0|[1-9]\d{0,19})$/.test(value)&&BigInt(value)<=18446744073709551615n;
const tokenDecimals=value=>Number.isInteger(value)&&value>=0&&value<=255;

// Keep token quantities exact, including amounts larger than Number.MAX_SAFE_INTEGER.
function decimalAmount(value,decimals){
 const digits=value.toString().padStart(decimals+1,'0');
 return decimals?(digits.slice(0,-decimals)+'.'+digits.slice(-decimals)).replace(/\.?0+$/,''):digits;
}

function tokenBalanceDetails(meta,addresses,wallet){
 const accounts=new Map(),tokenChanges=[],invalidMints=new Set(),snapshots=[];
 let complete=true,unidentified=false;
 for(const field of ['preTokenBalances','postTokenBalances']){
  const rows=meta[field],snapshot=new Map();snapshots.push(snapshot);
  if(!Array.isArray(rows)||rows.length>256)return {accounts,tokenChanges,complete:false};
  for(const row of rows){
   const amount=row?.uiTokenAmount;
   if(!record(row)||!count(row.accountIndex)||row.accountIndex>=addresses.length||!validMint(row.mint)
    ||!record(amount)||!rawAmount(amount.amount)||!tokenDecimals(amount.decimals)
    ||(row.programId!==undefined&&!TOKEN_PROGRAMS.has(row.programId))){
    complete=false;
    if(validMint(row?.mint))invalidMints.add(row.mint);else unidentified=true;
    continue;
   }
   const entry={mint:row.mint,owner:validMint(row.owner)?row.owner:null,decimals:amount.decimals,amount:BigInt(amount.amount)};
   if(!entry.owner){complete=false;invalidMints.add(entry.mint);}
   if(snapshot.has(row.accountIndex)){
    complete=false;invalidMints.add(snapshot.get(row.accountIndex).mint);invalidMints.add(entry.mint);
   }
   snapshot.set(row.accountIndex,entry);
  }
 }
 // Unidentified corrupt rows could belong to any mint: do not imply missing balances are zero.
 if(unidentified)return {accounts,tokenChanges,complete:false};
 const [pre,post]=snapshots,totals=new Map();
 for(const index of new Set([...pre.keys(),...post.keys()])){
  const before=pre.get(index),after=post.get(index),entry=before||after;
  if(before&&after&&(before.mint!==after.mint||before.decimals!==after.decimals||before.owner!==after.owner)){
   invalidMints.add(before.mint);invalidMints.add(after.mint);complete=false;continue;
  }
  const total=totals.get(entry.mint)||{decimals:entry.decimals,change:0n};
  if(total.decimals!==entry.decimals){invalidMints.add(entry.mint);complete=false;continue;}
  if(entry.owner===wallet)total.change+=(after?.amount||0n)-(before?.amount||0n);
  totals.set(entry.mint,total);accounts.set(addresses[index],entry);
 }
 for(const [key,entry] of accounts)if(invalidMints.has(entry.mint))accounts.delete(key);
 for(const [mint,total] of totals){
  if(invalidMints.has(mint)||total.change===0n)continue;
  const change=(total.change<0n?'-':'+')+decimalAmount(total.change<0n?-total.change:total.change,total.decimals);
  if(change.length>120||tokenChanges.length>=MAX_ACTIVITY){complete=false;continue;}
  tokenChanges.push({mint,change});
 }
 return {accounts,tokenChanges,complete};
}

function transactionActivity(transaction,meta,addresses,wallet){
 const balances=tokenBalanceDetails(meta,addresses,wallet),transfers=[];
 let complete=balances.complete;
 const outer=transaction.message.instructions,instructions=[];
 if(Array.isArray(outer)&&outer.length<=1024)instructions.push(...outer);else complete=false;
 // A program can catch a failed inner call. Its attempted transfers may have rolled back
 // even when the overall transaction succeeded; keep the actual balance changes instead.
 const innerFailure=Array.isArray(meta.logMessages)&&meta.logMessages.some(line=>typeof line==='string'&&/^Program \S+ failed:/.test(line));
 if(innerFailure)complete=false;
 else if(Array.isArray(meta.innerInstructions)&&meta.innerInstructions.length<=256){
  const seen=new Set();
  for(const group of meta.innerInstructions){
   if(!record(group)||!count(group.index)||!Array.isArray(outer)||group.index>=outer.length||seen.has(group.index)
    ||!Array.isArray(group.instructions)||group.instructions.length>1024||instructions.length+group.instructions.length>4096){complete=false;continue;}
   seen.add(group.index);instructions.push(...group.instructions);
  }
 }else complete=false;
 const participants=new Set(addresses);
 if(meta.err!==null)complete=false;
 else for(const instruction of instructions){
  const parsed=instruction?.parsed,info=parsed?.info,program=instruction?.programId;
  if(!record(parsed)||!record(info)||!['transfer','transferWithSeed','transferChecked'].includes(parsed.type)
   ||(program!==SYSTEM_PROGRAM&&!TOKEN_PROGRAMS.has(program))){complete=false;continue;}
  const {source,destination}=info;
  if(!validMint(source)||!validMint(destination)||!participants.has(source)||!participants.has(destination)){complete=false;continue;}
  let asset,amount,fromWallet,toWallet;
  if(program===SYSTEM_PROGRAM){
   if(!['transfer','transferWithSeed'].includes(parsed.type)||!count(info.lamports)){complete=false;continue;}
   asset='SOL';amount=decimalAmount(BigInt(info.lamports),9);fromWallet=source===wallet;toWallet=destination===wallet;
  }else{
   if(!['transfer','transferChecked'].includes(parsed.type)){complete=false;continue;}
   const from=balances.accounts.get(source),to=balances.accounts.get(destination);
   // Authority/signers do not establish token ownership. Both owners must be known.
   if(!from?.owner||!to?.owner||from.mint!==to.mint||from.decimals!==to.decimals){complete=false;continue;}
   const quantity=parsed.type==='transferChecked'?info.tokenAmount?.amount:info.amount;
   if(!rawAmount(quantity)||(parsed.type==='transferChecked'&&(info.mint!==from.mint||info.tokenAmount?.decimals!==from.decimals))){complete=false;continue;}
   asset=from.mint;amount=decimalAmount(BigInt(quantity),from.decimals);fromWallet=from.owner===wallet;toWallet=to.owner===wallet;
  }
  if(!fromWallet&&!toWallet)continue;
  if(amount.length>120||transfers.length>=MAX_ACTIVITY){complete=false;continue;}
  transfers.push({asset,amount,direction:fromWallet?(toWallet?'self':'sent'):'received',source,destination});
 }
 return {transfers,tokenChanges:balances.tokenChanges,detailsComplete:complete,detailsNote:complete?null:meta.err!==null
  ?'This transaction failed. Its instructions are not shown as completed transfers; verified balance changes are shown when available.'
  :'Some transaction activity could not be verified. Only verified transfers and balance changes are shown.'};
}

function transactionDetails(body,address,signature){
 if(!record(body)||body.jsonrpc!=='2.0'||body.id!==RPC_ID||Object.hasOwn(body,'error'))throw Error('invalid response');
 const result=body.result;
 if(result===null)return failure(404,'Transaction details are unavailable from the public Solana service.');
 const meta=result?.meta,transaction=result?.transaction,keys=transaction?.message?.accountKeys;
 if(!record(result)||!count(result.slot)||!blockTime(result.blockTime)||!record(meta)||!transactionError(meta.err)||!count(meta.fee)
  ||!record(transaction)||!Array.isArray(transaction.signatures)||transaction.signatures[0]!==signature||!transaction.signatures.every(validTransactionSignature)
  ||!Array.isArray(keys)||keys.length===0||keys.length>256
  ||!Array.isArray(meta.preBalances)||!Array.isArray(meta.postBalances)||meta.preBalances.length!==keys.length||meta.postBalances.length!==keys.length
  ||!meta.preBalances.every(count)||!meta.postBalances.every(count))throw Error('unavailable transaction details');
 const addresses=keys.map(key=>typeof key==='string'?key:record(key)?key.pubkey:null);
 if(!addresses.every(validMint)||new Set(addresses).size!==addresses.length||addresses.filter(key=>key===address).length!==1)throw Error('wallet is not in this transaction');
 const index=addresses.indexOf(address);
 return {statusCode:200,body:{status:'ready',address,signature,slot:result.slot,blockTime:result.blockTime,transactionStatus:meta.err===null?'succeeded':'failed',feeSol:meta.fee/1e9,solChange:(meta.postBalances[index]-meta.preBalances[index])/1e9,...transactionActivity(transaction,meta,addresses,address)}};
}

export function createWalletTransactionAPI({maxResponseBytes=2097152,...options}={}){
 const query=createRPCQuery(options);
 return async value=>{
  const address=typeof value?.address==='string'?value.address.trim():'';
  if(!record(value)||!validMint(address))return failure(400,'Paste a complete Solana wallet address.');
  if(!validTransactionSignature(value.signature))return failure(400,'The transaction could not be read. Refresh the wallet transactions and try again.');
  const signature=value.signature;
  return query({key:'detail:'+address+':'+signature,method:'getTransaction',params:[signature,{encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:MAX_TRANSACTION_VERSION}],maxResponseBytes,convert:body=>transactionDetails(body,address,signature)});
 };
}

function send(res,result,headers={}){
 res.writeHead(result.statusCode,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(result.statusCode===429?{'Retry-After':String(Math.ceil(result.body.retryAfterMs/1000))}:{}),...headers});
 res.end(JSON.stringify(result.body));
}

export function createWalletTransactionsHandler({port,...options}={}){
 const shared={...options,pending:new Map(),cooldown:{until:0}},lookup=createWalletTransactionsAPI(shared),details=createWalletTransactionAPI({...shared,maxResponseBytes:options.maxDetailResponseBytes??2097152});
 return async(req,res,pathname)=>{
  if(!['/api/wallet/transactions','/api/wallet/transaction'].includes(pathname))return false;
  if(!localWalletRequestAllowed(req,port)){send(res,failure(403,'Open wallet transactions from the local Solventir preview.'));return true;}
  if(req.method!=='POST'){send(res,failure(405,'Use POST to check wallet transactions.'),{Allow:'POST'});return true;}
  if(String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json'){
   send(res,failure(415,'Send the wallet address as JSON.'));return true;
  }
  if(Number(req.headers['content-length'])>MAX_REQUEST_BYTES){send(res,failure(413,'The transaction request is too large.'));req.resume?.();return true;}
  let body;
  try{
   const chunks=[];let bytes=0;
   for await(const chunk of req.iterator?.({destroyOnReturn:false})||req){
    bytes+=Buffer.byteLength(chunk);
    if(bytes>MAX_REQUEST_BYTES){send(res,failure(413,'The transaction request is too large.'));req.resume?.();return true;}
    chunks.push(Buffer.from(chunk));
   }
   body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }catch{send(res,failure(400,'Unable to read the wallet address.'));return true;}
  send(res,await (pathname==='/api/wallet/transaction'?details(body):lookup(body)));return true;
 };
}
