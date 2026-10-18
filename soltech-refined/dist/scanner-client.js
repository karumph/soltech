// One connection per app tab. The local service owns the scan, not the page.
export function initialScannerState(){
 return {version:1,revision:0,status:'paused',updatedAt:null,message:'Start the scanner to discover new Solana markets.',sources:{posts:{status:'disconnected',message:'X access is not connected.'},projects:{status:'idle',message:'Ready to discover new markets.'}},counts:{discovered:0,matched:0,checked:0,finds:0},groups:[],connection:{status:'connecting',message:'Connecting to scanner…'}};
}

export function createScannerClient({fetchImpl=(...args)=>fetch(...args),eventSourceFactory=url=>new EventSource(url),setTimer=setTimeout,clearTimer=clearTimeout}={}){
 let state=initialScannerState(),stream=null,retry=null,disposed=false,generation=0,refreshPromise=null,updates=0;
 const listeners=new Set();
 const emit=()=>{for(const listener of listeners)listener(state);};
 const valid=value=>value?.version===1&&Number.isInteger(value.revision)&&['running','paused'].includes(value.status)&&Array.isArray(value.groups)&&value.sources&&value.counts;
 const accept=value=>{
  if(!valid(value))throw Error('The scanner returned an incomplete update.');
  const restarted=typeof value.instanceId==='string'&&value.instanceId!==state.instanceId;
  if(!restarted&&value.revision<state.revision)return;
  state={...value,connection:{status:'connected',message:''}};updates++;emit();
 };
 const offline=()=>{state={...state,connection:{status:'offline',message:'Scanner connection lost. Showing the last received results.'}};emit();};
 async function request(path,body){
  const controller=new AbortController(),timeout=setTimer(()=>controller.abort(),12000);
  try{
   const response=await fetchImpl('/api/scanner'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{Accept:'application/json'}:{Accept:'application/json','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',credentials:'same-origin',signal:controller.signal});
   let value;try{value=await response.json();}catch{throw Error('The scanner service is unavailable.');}
   if(!response.ok)throw Error(typeof value?.message==='string'?value.message:'The scanner could not complete that request.');
   return value;
  }finally{clearTimer(timeout);}
 }
 async function refresh(){
  if(refreshPromise)return refreshPromise;
  const at=generation,requestedAt=updates;
  refreshPromise=(async()=>{
   try{const value=await request('');if(!disposed&&at===generation&&(requestedAt===updates||value.instanceId===state.instanceId))accept(value);return value;}
   catch(error){if(!disposed&&at===generation&&requestedAt===updates)offline();throw error;}
   finally{refreshPromise=null;}
  })();return refreshPromise;
 }
 function connect(){
  if(disposed||!listeners.size||stream)return;
  const at=generation;
  try{
   const current=stream=eventSourceFactory('/api/scanner/events');
   stream.addEventListener('snapshot',event=>{
    if(disposed||at!==generation||current!==stream)return;
    try{accept(JSON.parse(event.data));}catch{offline();}
   });
   stream.addEventListener('error',()=>{
    if(disposed||at!==generation||current!==stream)return;
    stream?.close();stream=null;offline();
    if(retry===null)retry=setTimer(()=>{retry=null;void refresh().catch(()=>{});connect();},5000);
   });
  }catch{
   // A browser without EventSource can still receive progressive snapshots.
   retry=setTimer(()=>{retry=null;void refresh().catch(()=>{});connect();},3000);
  }
 }
 function disconnect(){generation++;stream?.close();stream=null;if(retry!==null)clearTimer(retry);retry=null;refreshPromise=null;}
 async function command(path,body){
  const requestedAt=updates;
  try{const value=await request(path,body);if(!disposed&&(requestedAt===updates||value.instanceId===state.instanceId))accept(value);return value;}
  catch(error){void refresh().catch(()=>{});throw error;}
 }
 return {
  get state(){return state;},refresh,
  subscribe(listener){
   if(disposed)return ()=>{};
   listeners.add(listener);listener(state);
   if(listeners.size===1){void refresh().catch(()=>{});connect();}
   return ()=>{listeners.delete(listener);if(!listeners.size)disconnect();};
  },
  start:config=>command('/start',{config}),pause:()=>command('/pause',{}),
  dispose(){disposed=true;listeners.clear();disconnect();}
 };
}
let shared;
export function getScannerClient(){return shared??=createScannerClient();}
