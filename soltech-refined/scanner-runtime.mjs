import {mkdir,open,readFile,rename,stat} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {validMint} from './dist/coin-checker-data.js';
import {cleanPersonalScanner,defaultPersonalScanner,prepareScannerCustomization} from './dist/personal-scanner-store.js';
import {resultFilterErrors} from './dist/scanner-result-filters.js';
import {createScannerProviders,waitForScanner} from './scanner-providers.mjs';
import {matchPostToCoin,evaluateScannerFilters,inspectMint} from './scanner-analysis.mjs';
import {summarizeScannerPost} from './scanner-post-summary.mjs';

const clone=value=>JSON.parse(JSON.stringify(value));
const MAX_COINS=120,MAX_GROUPS=60;
const pausedMessage='Scanner paused. Saved results stay available.';
const unavailable=label=>({status:'unavailable',label,items:[],checkedAt:null});
const safeMessage=error=>error?.name==='ScannerProviderError'?error.message:'The data provider is unavailable. The scanner will retry later.';

export function createScannerFileStore(path=fileURLToPath(new URL('./.runtime/scanner.json',import.meta.url))){
 return {
  async read(){try{if((await stat(path)).size>3000000)throw Error('storage size');return JSON.parse(await readFile(path,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}},
  async write(value){
   const serialized=JSON.stringify(value);if(Buffer.byteLength(serialized)>3000000)throw Error('storage size');
   await mkdir(dirname(path),{recursive:true});const temporary=path+'.tmp';let file;
   try{file=await open(temporary,'w');await file.writeFile(serialized);await file.sync();}finally{await file?.close();}
   await rename(temporary,path);
  }
 };
}

// A single local pilot owns this state. The browser is only a controller/view;
// requests and persistence continue without an open tab while it is running.
export async function createScannerRuntime({storagePath,storage=createScannerFileStore(storagePath),providers=createScannerProviders(),fetchImpl=fetch,inspect=inspectMint,evaluate=evaluateScannerFilters,match=matchPostToCoin,now=Date.now,intervalMs=60000,marketRefreshMs=300000,checkSpacingMs=1100,maxFailures=5}={}){
 const instanceId=randomUUID();
 let state={version:1,instanceId,revision:0,status:'paused',startedAt:null,updatedAt:new Date(now()).toISOString(),message:pausedMessage,persistent:true,persistenceError:null,sources:{posts:{status:'disconnected',message:'X is not connected. New-market discovery works independently.'},projects:{status:'idle',message:'Start to discover recent indexed Solana pools.'}},counts:{discovered:0,matched:0,checked:0,finds:0},groups:[]};
 let config=defaultPersonalScanner(),cursors={},seen=[],generation=0,controller=null,timer=null,disposed=false,writeQueue=Promise.resolve(),cyclePromise=null,workerPromise=null,workerGeneration=-1,failures=0,loadFailed=false,inspectAfter=0;
 const listeners=new Set();let registry=new Map();
 function rebuild(){registry=new Map();for(const group of state.groups)for(const coin of group.coins)if(!registry.has(coin.id))registry.set(coin.id,coin);}
 function count(){const coins=[...registry.values()],matched=new Set(state.groups.filter(group=>group.kind==='post').flatMap(group=>group.coins.filter(coin=>['address','link','possible'].includes(coin.match.kind)).map(coin=>coin.id)));state.counts={discovered:coins.length,matched:matched.size,checked:coins.filter(coin=>['ready','unavailable'].includes(coin.stage)).length,finds:coins.filter(coin=>coin.filter.status==='pass'&&coin.stage==='ready').length};}
 function notify(){const snapshot=clone(state);for(const listener of listeners){try{listener(snapshot);}catch{}}}
 function cancel(){generation++;controller?.abort();controller=null;clearTimeout(timer);timer=null;}
 function interruption(){for(const coin of registry.values())if(coin.stage==='checking')setCoin(coin.id,{stage:'unavailable',checks:unavailable('Checks paused before completion.'),filter:evaluate(coin,config,now())});}
 function storageFailure(){cancel();state.status='paused';interruption();state.persistent=false;state.persistenceError='Results could not be saved on this device. Check local storage and try Start again.';state.message=state.persistenceError;state.revision++;state.updatedAt=new Date(now()).toISOString();count();notify();}
 function persist(){if(loadFailed)return Promise.resolve(false);const payload={version:1,state:clone(state),config:clone(config),cursors:clone(cursors),seen:[...seen]};const operation=writeQueue.then(()=>storage.write(payload));writeQueue=operation.catch(()=>{});return operation.catch(()=>{storageFailure();return false;}).then(result=>result!==false);}
 async function publish({save=true}={}){trim();state.revision++;state.updatedAt=new Date(now()).toISOString();count();notify();return save?persist():true;}
 function trim(){
  state.groups=state.groups.slice(0,MAX_GROUPS);const ids=new Set();let associations=0;
  for(const group of state.groups)group.coins=group.coins.filter(coin=>{if(associations>=240)return false;if(ids.has(coin.id)){associations++;return true;}if(ids.size>=MAX_COINS)return false;ids.add(coin.id);associations++;return true;});
  state.groups=state.groups.filter(group=>group.kind==='post'||group.coins.length);
  // Long original posts can be much larger than a market row. Retain whole
  // newest groups, leaving headroom for settings and SSE framing in the 3 MB cap.
  while(state.groups.length>1&&Buffer.byteLength(JSON.stringify(state.groups))>2400000)state.groups.pop();
  seen=seen.slice(-2000);rebuild();
 }
 function setCoin(id,patch){const coin=registry.get(id);if(coin)Object.assign(coin,patch);for(const group of state.groups)for(const item of group.coins)if(item.id===id){Object.assign(item,patch);group.updatedAt=new Date(now()).toISOString();}}
 function makeCoin(seed,kind='launch'){
  const discoveredAt=new Date(now()).toISOString();
  return {...seed,id:'solana:'+seed.address,chain:'solana',name:seed.name||(kind==='launch'?'Unnamed coin':'Unverified address'),symbol:seed.symbol||'—',imageUrl:seed.imageUrl||null,discoveredAt,marketCap:seed.marketCap??null,liquidity:seed.liquidity??null,volume24h:seed.volume24h??null,poolCreatedAt:seed.poolCreatedAt??null,
   stage:'discovered',riskLevel:'unknown',match:{kind,label:kind==='launch'?'New indexed pool':'Coin mentioned in a post',evidence:kind==='launch'?['A Solana pool was indexed by GeckoTerminal. This does not establish a new project.']:[]},checks:{status:'pending',label:'Checks have not run yet.',items:[]},filter:{status:'pending',reason:'Waiting for market data and checks.'}};
 }
 function addLaunches(seeds){
  const fresh=[];
  for(const seed of seeds){if(!validMint(seed.address)||seed.chain!=='solana')continue;const id='solana:'+seed.address;if(seen.includes(id))continue;const coin=makeCoin(seed);if(registry.has(id))setCoin(id,{...seed,stage:'discovered',checkAttempts:0});else registry.set(id,coin);fresh.push(coin);seen.push(id);}
  if(fresh.length){const at=new Date(now()).toISOString();state.groups.unshift({id:'launch:'+at+':'+state.revision,kind:'launch',createdAt:at,updatedAt:at,post:null,summary:'New indexed Solana markets',summaryStatus:'observed',coins:fresh});}trim();
 }
 function addPosts(posts){
  for(const post of posts){
   if(state.groups.some(group=>group.id==='post:'+post.id))continue;
   const at=new Date(now()).toISOString(),coins=[];
   const candidates=post.context?.kind==='repost'?[]:[...new Set((post.text+' '+(post.links||[]).join(' ')).match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g)||[])].filter(validMint).slice(0,20);
   for(const address of candidates){const seed=registry.get('solana:'+address)||makeCoin({address},'unresolved'),result=match(post,seed);if(!['address','link'].includes(result.kind))continue;const coin={...seed,match:result};if(!registry.has(coin.id))registry.set(coin.id,coin);coins.push(coin);}
   const brief=summarizeScannerPost(post);
   state.groups.unshift({id:'post:'+post.id,kind:'post',createdAt:post.publishedAt,updatedAt:at,post,summary:brief.text,summaryStatus:brief.status,coins});
  }
  rematchPosts();state.groups.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));trim();
 }
 function rematchPosts(){
  for(const group of state.groups.filter(group=>group.kind==='post')){
   if(!['excerpt','unavailable'].includes(group.summaryStatus)){const brief=summarizeScannerPost(group.post);group.summary=brief.text;group.summaryStatus=brief.status;}
   if(group.post.context?.kind==='repost'){group.coins=[];continue;}
   for(const coin of registry.values()){
    const result=match(group.post,coin);
    const existing=group.coins.find(item=>item.id===coin.id);
    if(result.kind==='unresolved'){if(existing?.match.kind==='possible')group.coins=group.coins.filter(item=>item.id!==coin.id);continue;}
    if(existing){existing.match=result;continue;}
    // A coin can belong to several posts. Keep each post's association local.
    group.coins.push({...coin,match:result});
   }
  }
 }
 const live=token=>!disposed&&state.status==='running'&&token===generation&&!controller?.signal.aborted;
 async function cycle(token){
  const signal=controller.signal;
  try{
   let sourceWorked=false;
   const discovery=(async()=>{
    try{const result=await providers.discover({signal});if(!live(token))return;addLaunches(result.coins);state.sources.projects={status:'running',message:result.message};sourceWorked=true;}
    catch(error){if(!live(token))return;state.sources.projects={status:'error',message:safeMessage(error)};}
    if(await publish()&&live(token))startWorker(token);
   })();
   const posts=(async()=>{
    try{const result=await providers.posts(config,{signal,cursors});if(!live(token))return;state.sources.posts={status:result.status==='ready'?'running':result.status,message:result.message};addPosts(result.posts);cursors=recordCursors(result.cursors);if(result.status==='ready')sourceWorked=true;}
    catch(error){if(!live(token))return;state.sources.posts={status:'error',message:safeMessage(error)};}
    if(await publish()&&live(token))startWorker(token);
   })();
   await Promise.allSettled([discovery,posts]);if(!live(token))return;
   for(const coin of registry.values())setCoin(coin.id,{filter:evaluate(coin,config,now())});
   failures=sourceWorked?0:failures+1;if(!await publish()||!live(token))return;
   startWorker(token);
   if(!live(token))return;state.message=sourceWorked?'Scanner running. Results are observations, not safety or profit guarantees.':'Discovery sources are unavailable. Saved results stay visible while the scanner retries.';
   if(failures>=maxFailures){cancel();state.status='paused';interruption();state.message='Scanner paused after repeated provider failures. Saved results remain available; try Start later.';}
   await publish();
  }catch(error){
   if(!live(token))return;failures++;state.sources.projects={status:'error',message:safeMessage(error)};state.message=state.sources.projects.message;
   if(failures>=maxFailures){cancel();state.status='paused';interruption();state.message='Scanner paused after repeated provider failures. Saved results remain available; try Start later.';}
   await publish();
  }finally{
   if(live(token)){timer=setTimeout(()=>{cyclePromise=cycle(token);},Math.max(1000,intervalMs)*Math.min(8,2**failures));timer.unref?.();}
  }
 }
 function startWorker(token){
  if(workerGeneration===token||!live(token))return;
  workerGeneration=token;
  workerPromise=processQueue(token,controller.signal).catch(()=>{
   if(live(token)){interruption();return publish();}
   }).finally(()=>{if(workerGeneration===token){workerGeneration=-1;if(live(token)&&[...registry.values()].some(coin=>coin.stage==='discovered'))queueMicrotask(()=>startWorker(token));}});
 }
 async function processQueue(token,signal){
  // Optional mint checks cannot delay the independent discovery schedule.
  while(live(token)){
   const candidates=[...registry.values()].filter(coin=>coin.stage==='discovered'||coin.stage==='checking'||now()-(coin.lastAttemptAt||0)>=marketRefreshMs||coin.stage==='unavailable'&&(coin.checkAttempts||0)<3&&now()-(coin.lastAttemptAt||0)>=intervalMs||coin.checks.status==='unavailable'&&(coin.checkAttempts||0)<3&&now()-(coin.lastAttemptAt||0)>=intervalMs).sort((a,b)=>(a.stage==='ready')-(b.stage==='ready')).slice(0,30);
   if(!candidates.length)return;
   for(const coin of candidates)setCoin(coin.id,{stage:'checking',checks:{status:'pending',label:'Checking market data and mint controls.',items:[]}});
   if(!await publish()||!live(token))return;
   let markets=new Map(),marketIssue=null;
   try{markets=await providers.enrich(candidates.map(coin=>coin.address),{signal});}catch(error){marketIssue=safeMessage(error);}
   if(!live(token))return;
   // Publish every market update together, before waiting for any optional RPC check.
   for(const coin of candidates){const market=markets.get(coin.address);
    if(market)setCoin(coin.id,{market,marketCap:market.marketCap,fdv:market.fdv,liquidity:market.liquidity,volume24h:market.volume,volume1h:market.volume1h,priceChange1h:market.change1h,priceChange24h:market.change,name:market.name,symbol:market.symbol,imageUrl:market.imageUrl,poolCreatedAt:market.created?new Date(market.created).toISOString():coin.poolCreatedAt,dex:market.dex,marketProvider:'DEX Screener',marketCheckedAt:new Date(market.retrievedAt).toISOString(),providerUrl:'https://dexscreener.com/solana/'+market.pair});
    setCoin(coin.id,{filter:evaluate(coin,config,now()),marketMessage:marketIssue||(!market?'DEX Screener has not indexed an exact market for this token.':null)});
   }
   rematchPosts();trim();if(!await publish()||!live(token))return;
   for(let index=0;index<candidates.length;index++){
    if(index)await waitForScanner(checkSpacingMs,signal);if(!live(token))return;
    const coin=registry.get(candidates[index].id);if(!coin)continue;let checks;
    if(inspectAfter>now())checks=unavailable('The mint-check provider is busy. Checks will retry after its cooldown.');
    else try{checks=await inspect(coin.address,{fetchImpl,signal,timeoutMs:8000});}catch{checks=unavailable('Mint checks are unavailable. No safety conclusion was made.');}
    if(!live(token))return;
    if(Number.isFinite(checks.retryAfterMs)&&checks.retryAfterMs>0)inspectAfter=now()+checks.retryAfterMs;
    setCoin(coin.id,{stage:coin.marketProvider?'ready':'unavailable',checks,checkAttempts:(coin.checkAttempts||0)+1,lastAttemptAt:now(),filter:evaluate(coin,config,now()),...(checks.mintVerified&&coin.name==='Unverified address'?{name:'Unlisted token'}:{})});
    if(!await publish()||!live(token))return;
   }
  }
 }
 try{
  const saved=await storage.read();
  if(saved){
   if(saved.version!==1||saved.state?.version!==1||!Number.isSafeInteger(saved.state.revision)||saved.state.revision<0||!Array.isArray(saved.state.groups)||saved.state.groups.length>MAX_GROUPS)throw Error('invalid saved scanner');
   for(const group of saved.state.groups)if(!['post','launch'].includes(group.kind)||!Array.isArray(group.coins)||group.coins.length>MAX_COINS||group.kind==='post'&&typeof group.post?.id!=='string'||group.coins.some(coin=>!validMint(coin?.address)||coin.id!=='solana:'+coin.address||coin.chain!=='solana'||!coin.checks||!coin.match||!coin.filter))throw Error('invalid saved results');
   state={...state,...saved.state,instanceId,status:'paused',revision:saved.state.revision+1,message:pausedMessage,persistent:true,persistenceError:null};config=cleanPersonalScanner(saved.config);cursors=recordCursors(saved.cursors);seen=Array.isArray(saved.seen)?saved.seen.filter(id=>typeof id==='string'&&id.startsWith('solana:')&&validMint(id.slice(7))).slice(-2000):[];
   rebuild();interruption();state.sources.posts=providers.postsStatus(config);state.sources.projects={status:'idle',message:'Saved results loaded. Start to resume new-market discovery.'};trim();count();
  }
 }catch{loadFailed=true;state.persistent=false;state.persistenceError='Saved scanner data could not be read. It was left untouched.';state.message=state.persistenceError;}
 function recordCursors(value){return value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).filter(([key,id])=>/^\d+$/.test(key)&&typeof id==='string'&&/^\d+$/.test(id)).slice(0,20)):{};}
 return {
  getSnapshot(){return clone(state);},
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  async start(value=config){
   if(disposed)throw Error('Scanner is closed.');if(loadFailed)throw Error(state.persistenceError);
   let next;try{next=prepareScannerCustomization(value);}catch{throw Object.assign(Error('Choose a valid scanner setup.'),{statusCode:400});}
   const errors=Object.values(resultFilterErrors(next.resultFilters));if(errors.length)throw Object.assign(new Error(errors[0]),{statusCode:400});
   cancel();config=next;state.persistent=true;state.persistenceError=null;state.status='running';state.startedAt=new Date(now()).toISOString();state.message='Starting live new-market discovery.';state.sources.posts=providers.postsStatus(config);state.sources.projects={status:config.sources.projects.enabled?'running':'idle',message:config.sources.projects.enabled?'Reading recent indexed Solana pools.':'New-market discovery is turned off.'};failures=0;
   for(const coin of registry.values())setCoin(coin.id,{filter:evaluate(coin,next,now())});
   if(!config.sources.projects.enabled&&state.sources.posts.status==='disconnected'){state.status='paused';state.message='No connected discovery source is enabled. Enable New coins to start.';}
   controller=new AbortController();const token=generation;
   if(!await publish())throw Error(state.persistenceError);
   if(live(token)){queueMicrotask(()=>{if(live(token))cyclePromise=cycle(token);});}
   return clone(state);
  },
  async pause(){cancel();state.status='paused';interruption();state.message=loadFailed?state.persistenceError:pausedMessage;state.sources.projects={...state.sources.projects,status:'idle'};if(state.sources.posts.status==='running')state.sources.posts.status='ready';await publish();return clone(state);},
  async dispose(){if(disposed)return;disposed=true;cancel();state.status='paused';interruption();state.message=pausedMessage;if(!loadFailed)await publish();await writeQueue;listeners.clear();},
  async settled(){await cyclePromise;await workerPromise;await writeQueue;}
 };
}
