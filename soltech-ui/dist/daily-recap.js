// Fixed, fictional records for the UI preview. These are never scanner output.
export const exampleFinds = [
  {coinId:'cove',scannerId:'balanced',foundAt:'2026-09-24T14:15:00Z',reason:'A sample public post may relate to Cove’s community theme. This is not an endorsement.'},
  {coinId:'cove',scannerId:'momentum',foundAt:'2026-09-24T14:42:00Z',reason:'A sample new-pair listing also matched the early-project example.'},
  {coinId:'orbit',scannerId:'balanced',foundAt:'2026-09-24T17:20:00Z',reason:'A sample public post includes a direct token link to Orbit. A mention does not verify the project’s claims.'},
  {coinId:'pico',scannerId:'momentum',foundAt:'2026-09-24T19:05:00Z',reason:'A sample launch listing matched the new-project example. The match does not remove its liquidity and holder concerns.'},
  {coinId:'luma',scannerId:'momentum',foundAt:'2026-09-24T21:30:00Z',reason:'A sample new-pair listing appeared, but project and risk information are incomplete.'}
];

// Catalog IDs identify individual fictional coins, never tickers or names.
export function groupRecapFinds(finds,catalog){
  const lookup=new Map(catalog.map(coin=>[coin.id,coin]));
  const groups=new Map();
  for(const find of finds){
    const coin=lookup.get(find.coinId);
    if(!coin)continue;
    const time=typeof find.foundAt==='string'?Date.parse(find.foundAt):NaN;
    const foundAt=Number.isFinite(time)?new Date(time).toISOString():null;
    if(!groups.has(coin.id))groups.set(coin.id,{coin,matches:[],latestAt:null});
    const group=groups.get(coin.id);
    const match={scannerId:find.scannerId||null,foundAt,reason:find.reason||null};
    if(!group.matches.some(item=>item.scannerId===match.scannerId&&item.foundAt===match.foundAt&&item.reason===match.reason))group.matches.push(match);
    if(foundAt&&(!group.latestAt||foundAt>group.latestAt))group.latestAt=foundAt;
  }
  return [...groups.values()].sort((a,b)=>(b.latestAt||'').localeCompare(a.latestAt||''));
}

export function formatFoundTime(value){
  if(!value||!Number.isFinite(Date.parse(value)))return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date(value));
}

export function partitionRecapFinds(finds,catalog){
  const groups=groupRecapFinds(finds,catalog);
  return {visible:groups.filter(group=>group.coin.risk!=='high'),excluded:groups.filter(group=>group.coin.risk==='high')};
}
