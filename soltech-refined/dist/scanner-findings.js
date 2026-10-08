import {coins} from './data.js';
import {exampleFinds,groupRecapFinds} from './daily-recap.js';

// These fixed examples demonstrate each scanner family, not live filter matches.
export function findingsForScanner(scanner){
  const type=scanner?.filters?.type||scanner?.criteria?.filters?.type||'market';
  const live=typeof window!=='undefined'&&window.SOLTECH_HOSTED?window.SOLTECH_LIVE:null;
  if(typeof window!=='undefined'&&window.SOLTECH_HOSTED&&type==='public')return {visible:[],excluded:[]};
  if(live?.coins?.length&&type!=='public'){
    const groups=groupRecapFinds(live.finds||[],live.coins);
    return {visible:groups.filter(group=>group.coin.risk!=='high'),excluded:groups.filter(group=>group.coin.risk==='high')};
  }
  const sourceIds=type==='public'?['balanced']:type==='projects'?['momentum']:['balanced','momentum'];
  const groups=groupRecapFinds(exampleFinds.filter(find=>sourceIds.includes(find.scannerId)),coins);
  return {
    visible:groups.filter(group=>group.coin.risk!=='high'),
    excluded:groups.filter(group=>group.coin.risk==='high')
  };
}

export function unreadFindings(scanner,seen=[]){
  const read=new Set(seen);
  return findingsForScanner(scanner).visible.filter(group=>!read.has(group.coin.id));
}
