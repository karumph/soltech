// Coins someone chose to watch. Guests keep the list in this browser; signed-in users keep it in their account
// (the soltech-watchlists table), so it follows them to other devices. Prices come from /api/lookup on demand.

export const WATCHLIST_KEY='soltech.watchlist.v1';
const LIMIT=50;
export function networkOf(address){
 const value=String(address||'').trim();
 if(/^0x[0-9a-fA-F]{40}$/.test(value))return 'base';
 if(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value))return 'solana';
 return null;
}
export const coinKey=(chain,address)=>`${chain}:${chain==='base'?String(address).toLowerCase():address}`;
const clean=list=>{
 const seen=new Set(),out=[];
 for(const item of Array.isArray(list)?list:[]){
  const address=String(item?.address||'').trim(),chain=networkOf(address);
  if(!chain)continue;
  const id=coinKey(chain,address);if(seen.has(id))continue;seen.add(id);
  out.push({id,chain,address,name:String(item.name||'').slice(0,60),symbol:String(item.symbol||'').slice(0,24),addedAt:item.addedAt||new Date().toISOString()});
  if(out.length>=LIMIT)break;
 }
 return out;
};

export async function lookupCoins(coins,{fetchImpl=(...args)=>fetch(...args)}={}){
 const response=await fetchImpl(`${window.SOLTECH_API||''}/lookup`,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({coins:coins.map(({chain,address})=>({chain,address}))})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'That coin could not be looked up. Try again in a moment.');
 return data.coins||[];
}

export function createWatchlist({account,storage=globalThis.localStorage}={}){
 const listeners=new Set();
 let list=[],saveTimer=0,synced=false;
 try{list=clean(JSON.parse(storage?.getItem(WATCHLIST_KEY)||'[]'));}catch{list=[];}
 const emit=()=>{for(const fn of listeners){try{fn(list);}catch{}}};
 const persist=()=>{
  try{storage?.setItem(WATCHLIST_KEY,JSON.stringify(list));}catch{}
  if(!account?.signedIn?.())return;
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{account.saveWatchlist(list).catch(()=>{});},400);
 };
 return {
  get list(){return list.slice();},
  has:id=>list.some(item=>item.id===id),
  onChange(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
  add(coin){
   const chain=networkOf(coin.address);if(!chain)return false;
   const id=coinKey(chain,coin.address);if(list.some(item=>item.id===id))return true;
   if(list.length>=LIMIT)return false;
   list=clean([{...coin,id,chain,addedAt:new Date().toISOString()},...list]);persist();emit();return true;
  },
  remove(id){const before=list.length;list=list.filter(item=>item.id!==id);if(list.length!==before){persist();emit();}},
  toggle(coin){const id=coin.id||coinKey(networkOf(coin.address),coin.address);if(list.some(item=>item.id===id)){this.remove(id);return false;}return this.add(coin);},
  // Signed in: merge what this browser has with the account's list, newest first, and save the union.
  async sync(){
   if(!account?.signedIn?.()||synced)return;
   try{
    const saved=await account.loadWatchlist();
    const merged=clean([...list,...(saved.coins||[])].sort((a,b)=>String(b.addedAt).localeCompare(String(a.addedAt))));
    const changed=JSON.stringify(merged)!==JSON.stringify(clean(saved.coins||[]));
    list=merged;synced=true;
    try{storage?.setItem(WATCHLIST_KEY,JSON.stringify(list));}catch{}
    if(changed)await account.saveWatchlist(list);
    emit();
   }catch{/* stays local until the next try */}
  },
 };
}
