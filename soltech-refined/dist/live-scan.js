// One poller for the shared scheduled scan, used by Feed and Scanner on the hosted site.
// The server scans every minute. Pages poll every 15 seconds while visible and get a few bytes back
// when nothing changed, so a new scan shows up within seconds of finishing.

const POLL_MS=15000,HIDDEN_POLL_MS=60000;
const listeners=new Set();
let state={status:'idle',scan:null,arrived:[],checkedAt:0,error:''},timer=0,inflight=null;

export const liveScanAvailable=()=>typeof window!=='undefined'&&!!(window.SOLTECH_HOSTED&&window.SOLTECH_API);
export const liveScanState=()=>state;
// Expected time of the next scan, from the server's own cadence.
export function nextScanAt(scan=state.scan){
 if(!scan?.updatedAt)return null;
 const every=(Number(scan.run?.every)||60)*1000;
 return Date.parse(scan.updatedAt)+every;
}

function emit(){for(const listener of listeners){try{listener(state);}catch(error){console.error(error);}}}

async function poll(){
 if(inflight)return inflight;
 inflight=(async()=>{
  try{
   const since=state.scan?.updatedAt;
   const response=await fetch(`${window.SOLTECH_API}/finds${since?`?since=${encodeURIComponent(since)}`:''}`,{cache:'no-store'});
   if(!response.ok)throw new Error(`Scan service answered ${response.status}`);
   const data=await response.json();
   if(data.unchanged){state={...state,status:'ready',checkedAt:Date.now(),error:'',scan:{...state.scan,run:data.run||state.scan.run}};}
   else{
    if(!Array.isArray(data.coins)||!data.updatedAt)throw new Error('The scan response was not readable.');
    const before=new Set((state.scan?.coins||[]).map(coin=>coin.id));
    // On the first load nothing counts as "arrived"; after that, every coin we hadn't seen is new to this visitor.
    const arrived=state.scan?data.coins.filter(coin=>!before.has(coin.id)).map(coin=>coin.id):[];
    state={status:data.coins.length?'ready':'empty',scan:data,arrived,checkedAt:Date.now(),error:''};
    window.SOLTECH_LIVE=data;
   }
  }catch(error){state={...state,status:state.scan?'stale':'error',checkedAt:Date.now(),error:error.message||'The scan service could not be reached.'};}
  finally{inflight=null;}
  emit();
 })();
 return inflight;
}

function schedule(){
 clearTimeout(timer);
 if(!listeners.size)return;
 // Poll just after the next scan is due, but never less often than every 15 seconds while visible.
 const due=nextScanAt();
 let wait=document.hidden?HIDDEN_POLL_MS:POLL_MS;
 if(due&&!document.hidden){const untilDue=due+4000-Date.now();if(untilDue>1500&&untilDue<wait)wait=untilDue;}
 timer=setTimeout(async()=>{await poll();schedule();},wait);
}

const onVisible=()=>{if(!document.hidden&&listeners.size){poll().then(schedule);}};

// Returns an unsubscribe function. The listener is called right away with the current state.
export function subscribeLiveScan(listener){
 if(!liveScanAvailable())return ()=>{};
 listeners.add(listener);
 if(listeners.size===1){document.addEventListener('visibilitychange',onVisible);}
 listener(state);
 if(state.status==='idle'){state={...state,status:'loading'};listener(state);}
 if(!state.scan||Date.now()-state.checkedAt>POLL_MS)poll().then(schedule);else schedule();
 return ()=>{listeners.delete(listener);if(!listeners.size){clearTimeout(timer);document.removeEventListener('visibilitychange',onVisible);}};
}

export function refreshLiveScan(){return poll().then(schedule);}
