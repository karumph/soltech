import {validMint} from './coin-checker-data.js';
import {fetchWalletTokenMetadata} from './wallet-token-metadata.js';

const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const invalidMessage='Transactions could not be verified. Try again.';
const invalid=()=>new Error(invalidMessage);

export function validTransactionSignature(value){
 if(typeof value!=='string'||value.length<64||value.length>88)return false;
 let number=0n;
 for(const char of value){const digit=alphabet.indexOf(char);if(digit<0)return false;number=number*58n+BigInt(digit);}
 let bytes=0;while(number>0n){bytes++;number>>=8n;}
 return bytes+value.match(/^1*/)[0].length===64;
}

export function normalizeTransactionsPage(body,address,{before=null,seenSignatures=[],seenCursors=[]}={}){
 if(!validMint(address)||body?.status!=='ready'||body.address!==address||!Array.isArray(body.transactions)||body.transactions.length>20
  ||typeof body.checkedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(body.checkedAt)||!Number.isFinite(Date.parse(body.checkedAt)))throw invalid();
 const seen=new Set(seenSignatures);
 const transactions=body.transactions.map(transaction=>{
  if(!transaction||!validTransactionSignature(transaction.signature)||transaction.signature===before||seen.has(transaction.signature)
   ||!Number.isSafeInteger(transaction.slot)||transaction.slot<0||!['succeeded','failed'].includes(transaction.status)
   ||(transaction.blockTime!==null&&(!Number.isSafeInteger(transaction.blockTime)||transaction.blockTime<0||!Number.isFinite(new Date(transaction.blockTime*1000).getTime())))
   ||![null,'processed','confirmed','finalized'].includes(transaction.confirmationStatus))throw invalid();
  seen.add(transaction.signature);
  return {signature:transaction.signature,slot:transaction.slot,blockTime:transaction.blockTime,status:transaction.status,confirmationStatus:transaction.confirmationStatus};
 });
 const nextBefore=body.nextBefore;
 if(nextBefore!==null&&(!validTransactionSignature(nextBefore)||transactions.length!==20||nextBefore!==transactions.at(-1)?.signature||nextBefore===before||seenCursors.includes(nextBefore)))throw invalid();
 return {address,transactions,nextBefore,checkedAt:body.checkedAt};
}

export function normalizeTransactionDetails(body,address,signature){
 if(!validMint(address)||!validTransactionSignature(signature)||body?.status!=='ready'||body.address!==address||body.signature!==signature
  ||!Number.isSafeInteger(body.slot)||body.slot<0||!['succeeded','failed'].includes(body.transactionStatus)
  ||(body.blockTime!==null&&(!Number.isSafeInteger(body.blockTime)||body.blockTime<0||!Number.isFinite(new Date(body.blockTime*1000).getTime())))
  ||typeof body.feeSol!=='number'||!Number.isFinite(body.feeSol)||body.feeSol<0
  ||(body.solChange!==null&&(typeof body.solChange!=='number'||!Number.isFinite(body.solChange)))
  ||!Array.isArray(body.transfers)||body.transfers.length>1000||!Array.isArray(body.tokenChanges)||body.tokenChanges.length>1000
  ||typeof body.detailsComplete!=='boolean'||(body.detailsNote!==null&&(typeof body.detailsNote!=='string'||body.detailsNote.length>500)))throw invalid();
 const decimal=value=>typeof value==='string'&&value.length<=120&&/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value);
 const transfers=body.transfers.map(transfer=>{
  if(!transfer||!(transfer.asset==='SOL'||validMint(transfer.asset))||!decimal(transfer.amount)||!['sent','received','self'].includes(transfer.direction)||!validMint(transfer.source)||!validMint(transfer.destination))throw invalid();
  return {asset:transfer.asset,amount:transfer.amount,direction:transfer.direction,source:transfer.source,destination:transfer.destination};
 });
 if(body.transactionStatus==='failed'&&transfers.length)throw invalid();
 const seen=new Set(),tokenChanges=body.tokenChanges.map(change=>{
  if(!change||!validMint(change.mint)||seen.has(change.mint)||typeof change.change!=='string'||!['+','-'].includes(change.change[0])||!decimal(change.change.slice(1))||!/[1-9]/.test(change.change))throw invalid();
  seen.add(change.mint);return {mint:change.mint,change:change.change};
 });
 return {address,signature,slot:body.slot,blockTime:body.blockTime,transactionStatus:body.transactionStatus,feeSol:body.feeSol,solChange:body.solChange,transfers,tokenChanges,detailsComplete:body.detailsComplete,detailsNote:body.detailsNote};
}

export function createWalletTransactionDetails({address,signature,fetcher=globalThis.fetch,endpoint='/api/wallet/transaction',onChange=()=>{},timeoutMs=30000}={}){
 let serial=0,controller=null,disposed=false;
 const cancel=()=>{serial++;controller?.abort();controller=null;};
 return {
  cancel,
  dispose(){disposed=true;cancel();},
  async load(){
   cancel();if(disposed)return;
   if(!validMint(address)||!validTransactionSignature(signature)){onChange({status:'error',message:'Transaction details could not be verified.'});return;}
   const id=serial,requestController=new AbortController();controller=requestController;
   let timedOut=false,rejectAbort,rateLimited=false,httpStatus=null,retryAfterMs=0;
   const cancelled=new Promise((_,reject)=>{rejectAbort=()=>reject(new Error('cancelled'));requestController.signal.addEventListener('abort',rejectAbort,{once:true});});
   const timer=setTimeout(()=>{timedOut=true;requestController.abort();},timeoutMs);
   onChange({status:'loading'});
   try{
    const request=(async()=>{
     const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',redirect:'error',signal:requestController.signal,body:JSON.stringify({address,signature})});
     if(!response.ok){
      httpStatus=response.status;rateLimited=response.status===429;
      if(rateLimited){
       const body=await response.json().catch(()=>null),header=Number(response.headers?.get?.('Retry-After'));
       const suggested=Number.isFinite(body?.retryAfterMs)?body.retryAfterMs:header>0?header*1000:10000;
       retryAfterMs=Math.min(60000,Math.max(1000,suggested));
      }
      throw new Error('unavailable');
     }
     return normalizeTransactionDetails(await response.json(),address,signature);
    })();
    const data=await Promise.race([request,cancelled]);
    if(id===serial&&!disposed)onChange({status:'ready',data});
   }catch{if(id===serial&&!disposed)onChange({status:'error',message:timedOut?'Details took too long. Try again.':rateLimited?'The public Solana service is busy. Try again shortly.':httpStatus===422?'This transaction uses a newer format that this app cannot read yet.':httpStatus===404?'The public service has not returned details for this transaction. Try again later.':'Transaction details are unavailable. Try again.',rateLimited,retryAfterMs});}
   finally{clearTimeout(timer);requestController.signal.removeEventListener('abort',rejectAbort);if(id===serial)controller=null;}
  }
 };
}

// Only the displayed pages live in memory. Refresh starts again at the newest
// page; each older page must advance without repeating transaction identities.
export function createWalletTransactions({address,fetcher=globalThis.fetch,endpoint='/api/wallet/transactions',onChange=()=>{},timeoutMs=30000}={}){
 let state={status:'idle',transactions:[],nextBefore:null,checkedAt:null,mode:'initial',message:''};
 let serial=0,controller=null,disposed=false,initialized=false,cursors=[];
 const snapshot=()=>({...state,transactions:state.transactions.map(transaction=>({...transaction}))});
 const publish=changes=>{state={...state,...changes};onChange(snapshot());};
 async function load(mode){
  if(disposed)return;
  if(mode==='more'&&(state.status==='loading'||!state.nextBefore))return;
  const id=++serial;controller?.abort();
  if(!validMint(address)){publish({status:'error',mode,message:'Enter a full Solana wallet address.'});return;}
  const requestController=new AbortController();controller=requestController;
  const before=mode==='more'?state.nextBefore:null;
  let timedOut=false,rejectAbort;
  const cancelled=new Promise((_,reject)=>{rejectAbort=()=>reject(new Error('cancelled'));requestController.signal.addEventListener('abort',rejectAbort,{once:true});});
  const timer=setTimeout(()=>{timedOut=true;requestController.abort();},timeoutMs);
  publish({status:'loading',mode,message:''});
  try{
   const operation=(async()=>{
    const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',redirect:'error',signal:requestController.signal,body:JSON.stringify(before?{address,before}:{address})});
    if(!response.ok)throw new Error(response.status===429?'Transactions are busy. Try again shortly.':'Transactions are unavailable. Try again.');
    const body=await response.json();
    return normalizeTransactionsPage(body,address,{before,seenSignatures:before?state.transactions.map(transaction=>transaction.signature):[],seenCursors:before?cursors:[]});
   })();
   const page=await Promise.race([operation,cancelled]);
   if(disposed||id!==serial)return;
   initialized=true;cursors=before?[...cursors]:[];if(page.nextBefore)cursors.push(page.nextBefore);
   publish({status:'ready',transactions:before?[...state.transactions,...page.transactions]:page.transactions,nextBefore:page.nextBefore,checkedAt:page.checkedAt,message:''});
  }catch(error){
   const safeMessage=[invalidMessage,'Transactions are busy. Try again shortly.','Transactions are unavailable. Try again.'].includes(error?.message)?error.message:'Transactions are unavailable. Try again.';
   if(!disposed&&id===serial)publish({status:'error',mode,message:timedOut?'Transactions took too long. Try again.':safeMessage});
  }finally{
   clearTimeout(timer);requestController.signal.removeEventListener('abort',rejectAbort);if(id===serial)controller=null;
  }
 }
 return {
  getSnapshot:snapshot,
  refresh:()=>load(initialized?'refresh':'initial'),
  more:()=>state.status==='ready'?load('more'):Promise.resolve(),
  retry:()=>state.status==='error'?load(state.mode):Promise.resolve(),
  dispose(){disposed=true;serial++;controller?.abort();controller=null;}
 };
}

const solNumber=new Intl.NumberFormat(undefined,{maximumFractionDigits:9});
const displayDate=value=>value===null?'Time unavailable':new Date(value*1000).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit'});
function displayRowDate(value){
 const date=new Date(value*1000);
 return date.toLocaleString(undefined,{month:'short',day:'numeric',...(date.getFullYear()!==new Date().getFullYear()?{year:'numeric'}:{}),hour:'numeric',minute:'2-digit'});
}
const compactSolNumber=new Intl.NumberFormat(undefined,{maximumSignificantDigits:5});
function metadataMap(values){
 const entries=new Map();
 for(const value of Array.isArray(values)?values:[]){if(validMint(value?.address))entries.set(value.address,{symbol:typeof value.symbol==='string'?value.symbol.trim().slice(0,32):'',name:typeof value.name==='string'?value.name.trim().slice(0,120):''});}
 return entries;
}
const assetLabel=(asset,metadata)=>asset==='SOL'?'SOL':metadata.get(asset)?.symbol||'Token';
const assetName=(asset,metadata)=>asset==='SOL'?'SOL':metadata.get(asset)?.name||metadata.get(asset)?.symbol||'Token '+asset.slice(0,4)+'…'+asset.slice(-4);
function compactAmount(value){
 const numeric=Number(value);
 if(!Number.isFinite(numeric)||numeric===0&&/[1-9]/.test(value))return value;
 return new Intl.NumberFormat(undefined,numeric>=1000000?{notation:'compact',maximumFractionDigits:2}:{maximumSignificantDigits:7}).format(numeric);
}
const decimal=value=>{const negative=value[0]==='-',unsigned=value.replace(/^[+-]/,''),[whole,fraction='']=unsigned.split('.');return {units:BigInt(whole+fraction)*(negative?-1n:1n),scale:fraction.length};};
function addDecimal(a,b){const scale=Math.max(a.scale,b.scale);return {units:a.units*10n**BigInt(scale-a.scale)+b.units*10n**BigInt(scale-b.scale),scale};}
function decimalText(value){
 const digits=(value.units<0n?-value.units:value.units).toString().padStart(value.scale+1,'0');
 const fraction=value.scale?digits.slice(-value.scale).replace(/0+$/,''):'';
 return (value.scale?digits.slice(0,-value.scale):digits)+(fraction?'.'+fraction:'');
}
// A row describes the wallet's net coin outcome, not every instruction leg.
// Verified account balance changes take precedence over parsed transfer sums.
export function summarizeWalletTransaction(data,tokenMetadata=[]){
 const metadata=metadataMap(tokenMetadata),groups=new Map(),items=[];
 const solSecondary=data.solChange!==null&&data.solChange!==0?'SOL change '+(data.solChange>0?'+':'')+compactSolNumber.format(data.solChange):'';
 if(data.transactionStatus==='failed')return {description:'Failed transaction',amount:'',direction:'',changes:[],secondary:solSecondary};
 for(const transfer of data.transfers){
  if(!groups.has(transfer.asset))groups.set(transfer.asset,{sent:{units:0n,scale:0},received:{units:0n,scale:0},self:{units:0n,scale:0}});
  const group=groups.get(transfer.asset);group[transfer.direction]=addDecimal(group[transfer.direction],decimal(transfer.amount));
 }
 for(const change of data.tokenChanges){
  const value=decimal(change.change),direction=value.units>0n?'received':'sent',group=groups.get(change.mint);
  const transferNet=group?addDecimal(group.received,{...group.sent,units:-group.sent.units}):null;
  const backed=transferNet!==null&&addDecimal(transferNet,{...value,units:-value.units}).units===0n;
  items.push({asset:change.mint,amount:decimalText(value),direction:backed?direction:'change',sign:value.units>0n?'+':'−',action:backed?(direction==='received'?'Received':'Sent'):'Balance change'});
 }
 function transferItem(asset,group){
  const net=addDecimal(group.received,{...group.sent,units:-group.sent.units});
  if(net.units!==0n){const direction=net.units>0n?'received':'sent';return {asset,amount:decimalText(net),direction,sign:net.units>0n?'+':'−',action:direction==='received'?'Received':'Sent'};}
  if(group.sent.units>0n||group.received.units>0n)return {asset,amount:decimalText(group.received),direction:'mixed',sign:'',action:'Sent & received',suffix:' each way'};
  if(group.self.units>0n)return {asset,amount:decimalText(group.self),direction:'self',sign:'',action:'Self transfer'};
  return null;
 }
 if(!data.tokenChanges.length)for(const [asset,group] of groups)if(asset!=='SOL'){const item=transferItem(asset,group);if(item)items.push(item);}
 const tokenOutcome=items.length>0;
 if(!tokenOutcome&&groups.has('SOL')){const item=transferItem('SOL',groups.get('SOL'));if(item)items.push(item);}
 if(!items.length&&data.solChange!==null&&data.solChange!==0)items.push({asset:'SOL',amount:solNumber.format(Math.abs(data.solChange)),direction:'change',sign:data.solChange>0?'+':'−',action:'Balance change',formatted:true});
 if(!items.length)return {description:'Transaction',amount:'',direction:'',changes:[],secondary:''};
 const changes=items.map(item=>({...item,name:assetName(item.asset,metadata),amountText:item.sign+(item.formatted?item.amount:compactAmount(item.amount))+' '+assetLabel(item.asset,metadata)+(item.suffix||'')}));
 const first=changes[0],single=changes.length===1;
 const description=single?first.action+' '+first.name:changes.every(item=>item.direction==='received')?'Received '+changes.length+' coins':changes.every(item=>item.direction==='sent')?'Sent '+changes.length+' coins':'Coin activity';
 return {description,amount:single?first.amountText:'',direction:single?first.direction:'',changes,secondary:tokenOutcome?solSecondary:''};
}
function transactionSummary(transaction,detail,metadata){
 const state=detail?.state,data=state?.data;
 if(!data)return {description:state?.status==='loading'||state?.status==='queued'?'Loading details…':'Transaction',amount:'',direction:'',changes:[],secondary:''};
 return summarizeWalletTransaction(data,[...metadata].map(([address,value])=>({address,...value})));
}
function detailsHTML(transaction,detail,metadata){
 const signature=transaction.signature,state=detail?.state||{status:'idle'},data=state.data;
 const change=data?.solChange===null?'Unavailable':data?(data.solChange>0?'+':'')+solNumber.format(data.solChange)+' SOL':'';
 const transfers=data?.transfers.length?`<ol class="wallet-transaction-transfers">${data.transfers.map(transfer=>`<li><strong class="is-${transfer.direction}">${{sent:'Sent',received:'Received',self:'Self transfer'}[transfer.direction]} ${esc(transfer.amount)} ${esc(assetLabel(transfer.asset,metadata))}</strong>${transfer.asset!=='SOL'?`<small>Token address <code>${esc(transfer.asset)}</code></small>`:''}<div class="wallet-transaction-participants"><span>From${transfer.asset==='SOL'?'':' token account'} <code>${esc(transfer.source)}</code></span><span>To${transfer.asset==='SOL'?'':' token account'} <code>${esc(transfer.destination)}</code></span></div></li>`).join('')}</ol>`:'';
 const tokenChanges=data?.tokenChanges.length?`<div class="wallet-transaction-token-changes"><h4>Token balance changes</h4><ul>${data.tokenChanges.map(item=>`<li><span class="is-${item.change[0]==='+'?'received':'sent'}">${esc(item.change)} ${esc(assetLabel(item.mint,metadata))}</span><small>Token address <code>${esc(item.mint)}</code></small></li>`).join('')}</ul></div>`:'';
 return `<div class="wallet-transaction-details" id="wallet-transaction-details-${signature}" ${detail?.open?'':'hidden'}><p class="wallet-transaction-details-status" role="status" aria-live="polite">${['loading','queued'].includes(state.status)?'Loading transaction details…':''}</p>${state.status==='error'?`<div class="wallet-transaction-details-error" role="alert"><p>${esc(state.message)}</p><button type="button" class="wallet-transaction-details-retry" data-wallet-transaction-retry="${signature}">Retry details</button></div>`:''}${state.status==='ready'?`${transfers}${tokenChanges}<dl class="wallet-transaction-metrics"><div><dt>SOL balance change</dt><dd>${esc(change)}</dd></div><div><dt>Network fee</dt><dd>${esc(solNumber.format(data.feeSol))} SOL</dd></div><div><dt>Status</dt><dd>${data.transactionStatus==='succeeded'?'Succeeded':'Failed'}</dd></div><div><dt>Date</dt><dd>${esc(displayDate(data.blockTime))}</dd></div></dl>${!data.detailsComplete?`<p class="wallet-transaction-details-note">${esc(data.detailsNote||'Some transaction details are unavailable.')}</p>`:''}<p class="wallet-transaction-details-note">Balance changes may include fees and other activity. The network fee covers the whole transaction.</p>`:''}<code class="wallet-transaction-id">${signature}</code><button type="button" class="wallet-transaction-copy" data-wallet-transaction-copy="${signature}">Copy ID</button></div>`;
}
function transactionHTML(transaction,detail,metadata){
 const blockTime=detail?.state.data?.blockTime??transaction.blockTime,date=blockTime===null?null:new Date(blockTime*1000);
 const signature=transaction.signature;
 const summary=transactionSummary(transaction,detail,metadata);
 const amounts=summary.changes.length>1?summary.changes.slice(0,2).map(change=>`<span class="wallet-transaction-change${['sent','received'].includes(change.direction)?' is-'+change.direction:''}">${esc(change.action)} ${esc(change.amountText)}</span>`).join('')+(summary.changes.length>2?`<small class="wallet-transaction-extra">+${summary.changes.length-2} more in Details</small>`:''):esc(summary.amount);
 return `<li class="wallet-transaction"><strong class="wallet-transaction-description">${esc(summary.description)}</strong><span class="wallet-transaction-amount${['sent','received'].includes(summary.direction)?' is-'+summary.direction:''}">${amounts}</span>${date?`<time class="wallet-transaction-time" datetime="${date.toISOString()}">${esc(displayRowDate(blockTime))}</time>`:'<span class="wallet-transaction-time">Time unavailable</span>'}${summary.secondary?`<span class="wallet-transaction-secondary">${esc(summary.secondary)}</span>`:''}<span class="wallet-transaction-status is-${transaction.status}">${transaction.status==='succeeded'?'Succeeded':'Failed'}</span><button type="button" class="wallet-transaction-toggle" data-wallet-transaction-toggle="${signature}" aria-expanded="${detail?.open===true}" aria-controls="wallet-transaction-details-${signature}"><span>Details</span><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m5 7.5 5 5 5-5"/></svg></button>${detailsHTML(transaction,detail,metadata)}</li>`;
}

export function walletTransactionsHTML(state,details=new Map(),{tokenMetadata=[],detailsPaused=false}={}){
 const metadata=metadataMap(tokenMetadata);
 const busy=state.status==='loading',count=state.transactions.length;
 const message=busy?state.mode==='more'?'Loading older transactions…':state.mode==='refresh'?'Refreshing transactions…':'Loading transactions…':state.status==='ready'?`${count} ${count===1?'transaction':'transactions'} shown.`:'';
 return `<section class="wallet-transactions" aria-label="Wallet transactions" aria-busy="${busy}"><div class="wallet-transactions-head"><h3 tabindex="-1">Transactions</h3><button type="button" class="wallet-transactions-refresh" data-wallet-transactions-action="refresh" ${busy&&state.mode!=='more'?'disabled':''}>Refresh</button></div><p class="wallet-transactions-status" role="status" aria-live="polite">${message}</p>${state.status==='error'?`<div class="wallet-transactions-error" role="alert"><p>${esc(state.message)}</p><button type="button" class="wallet-transactions-retry" data-wallet-transactions-action="retry">Retry</button></div>`:''}${detailsPaused?'<div class="wallet-transactions-detail-warning" role="status"><p>Solana’s public data service is busy. Try loading the details again shortly.</p><button type="button" class="wallet-transactions-retry" data-wallet-transactions-action="retry-details">Retry details</button></div>':''}${count?`<ol class="wallet-transactions-list">${state.transactions.map(transaction=>transactionHTML(transaction,details.get(transaction.signature),metadata)).join('')}</ol>`:state.status==='ready'?'<p class="wallet-transactions-empty">No recent transactions found.</p>':''}${state.nextBefore?`<button type="button" class="wallet-transactions-more" data-wallet-transactions-action="more" ${busy||state.status==='error'?'disabled':''}>Load more</button>`:''}<p class="wallet-transactions-copy-status" role="status" aria-live="polite"></p><p class="wallet-transactions-note">Recent activity referencing this wallet address.</p></section>`;
}

export function mountWalletTransactions(container,{address,fetcher=globalThis.fetch,endpoint='/api/wallet/transactions',detailsEndpoint=endpoint.replace(/transactions$/,'transaction'),timeoutMs=30000,clipboard=globalThis.navigator?.clipboard,tokenMetadata=[],metadataFetcher=fetchWalletTokenMetadata,autoDetails=true}={}){
 let disposed=false,focusSelector=null,listState;
 const details=new Map(),detailCache=new Map();
 let queue=[],inFlight=0,lastDetailStart=-Infinity,queueTimer=null,detailsPaused=false,detailRetryAt=0;
 const metadataRecords=new Map([...metadataMap(tokenMetadata)].map(([address,values])=>[address,{address,...values}])),missingMetadata=new Set(),attemptedMetadata=new Set();
 let metadataTimer=null,metadataController=null;
 const document=container.ownerDocument||globalThis.document;
 function render(){
  const state=listState;
  const active=document?.activeElement;
  if(container.contains?.(active))for(const attribute of ['data-wallet-transactions-action','data-wallet-transaction-toggle','data-wallet-transaction-retry','data-wallet-transaction-copy']){
   const target=active?.closest?.('['+attribute+']');if(target){focusSelector=`[${attribute}="${target.getAttribute(attribute)}"]`;break;}
  }
  const mayRestore=focusSelector&&(!active||active===document?.body||container.contains?.(active));
  container.innerHTML=walletTransactionsHTML(state,details,{tokenMetadata:[...metadataRecords.values()],detailsPaused:detailsPaused||detailRetryAt>Date.now()});
  if(mayRestore){const target=container.querySelector(focusSelector);if(target&&!target.disabled)target.focus({preventScroll:true});else if(state.status!=='loading')container.querySelector('.wallet-transactions-head h3')?.focus({preventScroll:true});}
  if(state.status!=='loading')focusSelector=null;
 }
 const session=createWalletTransactions({address,fetcher,endpoint,timeoutMs,onChange:state=>{
  listState=state;
  const present=new Set(state.transactions.map(transaction=>transaction.signature));
  for(const [signature,entry] of details)if(!present.has(signature)){entry.session.dispose();details.delete(signature);}
  queue=queue.filter(entry=>details.get(entry.signature)===entry);
  if(autoDetails&&state.status==='ready')for(const transaction of state.transactions){const entry=detailFor(transaction.signature);if(entry.state.status==='idle')enqueue(entry);}
  render();pump();
 }});
 function detailFor(signature){
  if(details.has(signature))return details.get(signature);
  const entry={signature,open:false,state:detailCache.has(signature)?{status:'ready',data:detailCache.get(signature)}:{status:'idle'},session:null,queued:false,running:false,manual:false};
  entry.session=createWalletTransactionDetails({address,signature,fetcher,endpoint:detailsEndpoint,timeoutMs,onChange:state=>{if(!disposed&&details.get(signature)===entry){entry.state=state;if(state.status==='ready'){detailCache.set(signature,state.data);collectMetadata(state.data);}if(state.rateLimited){detailsPaused=true;detailRetryAt=Math.max(detailRetryAt,Date.now()+state.retryAfterMs);for(const pending of queue)pending.state={status:'idle'};}render();}}});
  details.set(signature,entry);return entry;
 }
 function enqueue(entry,manual=false){
  if(entry.running)return;
  entry.manual=manual||entry.manual;entry.state={status:detailsPaused&&!manual?'idle':'queued'};
  if(entry.queued)queue=queue.filter(item=>item!==entry);
  entry.queued=true;if(manual)queue.unshift(entry);else queue.push(entry);
 }
 function pump(){
  if(disposed||queueTimer||inFlight>=2||!queue.length)return;
  const index=detailsPaused?queue.findIndex(entry=>entry.manual):0;if(index<0)return;
  const wait=Math.max(0,400-(Date.now()-lastDetailStart),detailRetryAt-Date.now());
  if(wait){queueTimer=setTimeout(()=>{queueTimer=null;pump();},wait);return;}
  const [entry]=queue.splice(index,1);entry.queued=false;
  if(details.get(entry.signature)!==entry){pump();return;}
  entry.running=true;inFlight++;
  const loading=entry.session.load();
  // Loading renders before sending the request. Count the gap after that work,
  // so a slower render cannot shorten the spacing between provider requests.
  lastDetailStart=Date.now();
  loading.finally(()=>{entry.running=false;entry.manual=false;inFlight--;pump();scheduleMetadata();});
  pump();
 }
 function collectMetadata(data){
  for(const mint of [...data.tokenChanges.map(item=>item.mint),...data.transfers.filter(item=>item.asset!=='SOL').map(item=>item.asset)]){
   const current=metadataRecords.get(mint);if((!current?.name||!current?.symbol)&&!attemptedMetadata.has(mint))missingMetadata.add(mint);
  }
 }
 function scheduleMetadata(){
  if(disposed||metadataTimer||metadataController||!missingMetadata.size||(!detailsPaused&&(inFlight||queue.length)))return;
  metadataTimer=setTimeout(async()=>{
   metadataTimer=null;if(disposed)return;
   const mints=[...missingMetadata].slice(0,30);for(const mint of mints){missingMetadata.delete(mint);attemptedMetadata.add(mint);}
   const controller=new AbortController();metadataController=controller;
   try{
    const values=await metadataFetcher(mints,{fetcher,signal:controller.signal});
    if(disposed||controller.signal.aborted)return;
    for(const [mint,metadata] of metadataMap(values))if(mints.includes(mint)){const current=metadataRecords.get(mint);metadataRecords.set(mint,{address:mint,name:current?.name||metadata.name,symbol:current?.symbol||metadata.symbol});}
    render();
   }catch{/* Names are optional; verified amounts and short mint labels remain. */}
   finally{if(metadataController===controller)metadataController=null;scheduleMetadata();}
  },250);
 }
 const onClick=async event=>{
  const button=event.target.closest('[data-wallet-transactions-action]');
  if(button){
   if(button.disabled)return;
   const action=button.dataset.walletTransactionsAction;
   if(action==='retry-details'){
    detailsPaused=false;
    for(const entry of details.values())if(['error','idle'].includes(entry.state.status))enqueue(entry);
    render();pump();return;
   }
   if(['refresh','more','retry'].includes(action)){focusSelector=`[data-wallet-transactions-action="${action}"]`;session[action]();}
   return;
  }
  const toggle=event.target.closest('[data-wallet-transaction-toggle]'),retry=event.target.closest('[data-wallet-transaction-retry]');
  const detailSignature=toggle?.dataset.walletTransactionToggle||retry?.dataset.walletTransactionRetry;
  if(detailSignature&&session.getSnapshot().transactions.some(transaction=>transaction.signature===detailSignature)){
   const entry=detailFor(detailSignature);focusSelector=`[data-wallet-transaction-toggle="${detailSignature}"]`;
   if(toggle&&entry.open){entry.open=false;if(!autoDetails){entry.session.cancel();if(entry.state.status==='loading')entry.state={status:'idle'};}render();}
   else{entry.open=true;if(retry||['idle','queued','error'].includes(entry.state.status))enqueue(entry,true);render();pump();}
   return;
  }
  const copy=event.target.closest('[data-wallet-transaction-copy]'),signature=copy?.dataset.walletTransactionCopy;
  if(!signature||!session.getSnapshot().transactions.some(transaction=>transaction.signature===signature))return;
  let message;
  try{if(!clipboard?.writeText)throw new Error('unavailable');await clipboard.writeText(signature);message='Transaction ID copied.';}
  catch{message='Copy unavailable. Transaction ID: '+signature;}
  if(!disposed&&session.getSnapshot().transactions.some(transaction=>transaction.signature===signature)){const status=container.querySelector('.wallet-transactions-copy-status');if(status)status.textContent=message;}
 };
 container.addEventListener('click',onClick);session.refresh();
 return ()=>{disposed=true;session.dispose();clearTimeout(queueTimer);clearTimeout(metadataTimer);metadataController?.abort();queue=[];for(const entry of details.values())entry.session.dispose();details.clear();detailCache.clear();container.removeEventListener('click',onClick);};
}
