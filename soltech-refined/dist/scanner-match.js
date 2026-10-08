// Applies one person's saved scanner preferences to coins from the shared scan.
// Used by Feed, the Scanner page and the Finds count, so all three always agree.
// Missing data is never a pass: a limit on a value the scan did not report leaves the coin out.

import {enabledSources} from './personal-scanner-store.js';
import {cleanResultFilters} from './scanner-result-filters.js';

export const scanNetworks={solana:'Solana',base:'Base'};
const riskWords={lower:'Lower risk',caution:'Caution',high:'High risk',unknown:'Not assessed'};
const venues={pump:/^pump-?(fun|swap)$/i,raydium:/raydium/i,meteora:/meteora/i,orca:/orca/i};
const num=value=>value===''||value==null?null:Number(value);
const usd=n=>n>=1e9?`$${(n/1e9).toFixed(1)}B`:n>=1e6?`$${(n/1e6).toFixed(1)}M`:n>=1e3?`$${Math.round(n/1e3)}K`:`$${Math.round(n)}`;
const hours=h=>h<1?`${Math.round(h*60)} min`:h<48?`${+h.toFixed(1)}h`:`${Math.round(h/24)}d`;

// The scanner's limits as a flat list. Settings the live scan can't read yet come back in `unsupported`.
export function scannerLimits(config){
 const projects=config?.sources?.projects,settings=projects?.settings||{},results=cleanResultFilters(config?.resultFilters);
 const limits=[],unsupported=[];
 const range=(key,label,min,max,format,read)=>{
  min=num(min);max=num(max);
  if(min!=null&&Number.isFinite(min))limits.push({key:key+'Min',label,test:c=>{const v=read(c);return v==null?null:v>=min;},text:`${label} ≥ ${format(min)}`,why:c=>`${label} ${format(read(c))}, under ${format(min)}`});
  if(max!=null&&Number.isFinite(max))limits.push({key:key+'Max',label,test:c=>{const v=read(c);return v==null?null:v<=max;},text:`${label} ≤ ${format(max)}`,why:c=>`${label} ${format(read(c))}, over ${format(max)}`});
 };
 const ageHours=c=>c.pairCreatedAt?(Date.now()-c.pairCreatedAt)/36e5:null;
 const cap=valuation=>c=>valuation==='fdv'?(c.fdv??null):(c.marketCap??c.fdv??null);
 // Source rules from the full setup.
 const risks=Array.isArray(settings.riskLevels)&&settings.riskLevels.length?settings.riskLevels:Object.keys(riskWords);
 if(risks.length<4)limits.push({key:'risk',label:'Risk',test:c=>risks.includes(c.risk in riskWords?c.risk:'unknown'),text:risks.map(r=>riskWords[r]).join(', '),why:c=>`${riskWords[c.risk]||riskWords.unknown}, not in your risk levels`});
 range('age','Age',settings.ageMin,settings.ageMax,hours,ageHours);
 range('cap',settings.valuation==='fdv'?'FDV':'Market cap',settings.capMin,settings.capMax,usd,cap(settings.valuation));
 range('liquidity','Liquidity',settings.liquidityMin,'',usd,c=>c.liquidity??null);
 if(settings.activityMin!==''&&settings.activityMin!=null){
  const min=num(settings.activityMin),w=settings.activityWindow||'1h';
  if(settings.activityMetric==='volume')limits.push({key:'activity',label:'Volume',test:c=>{const v=c[{'5m':'volume5m','1h':'volume1h','24h':'volume24h'}[w]];return v==null?null:v>=min;},text:`${w} volume ≥ ${usd(min)}`});
  else if(settings.activityMetric==='trades'&&w==='1h')limits.push({key:'activity',label:'Trades',test:c=>c.buys1h==null||c.sells1h==null?null:c.buys1h+c.sells1h>=min,text:`1h trades ≥ ${min}`});
  else unsupported.push(settings.activityMetric==='wallets'?'Active wallets':`${w} trade count`);
 }
 if(settings.priceMin!==''||settings.priceMax!==''){
  const key={'5m':'change5m','1h':'change1h','24h':'change24h'}[settings.priceWindow||'1h'];
  range('price',`${settings.priceWindow||'1h'} price change`,settings.priceMin,settings.priceMax,v=>`${v}%`,c=>c[key]??null);
 }
 if(settings.venue&&settings.venue!=='any'&&venues[settings.venue])limits.push({key:'venue',label:'Venue',test:c=>c.dex?venues[settings.venue].test(c.dex):null,text:{pump:'Pump.fun',raydium:'Raydium',meteora:'Meteora',orca:'Orca'}[settings.venue]});
 if(settings.stage==='curve'||settings.stage==='graduating')limits.push({key:'stage',label:'Stage',test:c=>c.stage?c.stage==='curve':null,text:'On a launchpad'});
 if(settings.stage==='dex')limits.push({key:'stage',label:'Stage',test:c=>c.stage?c.stage==='dex':null,text:'Trading on a DEX'});
 for(const [key,label] of [['holdersMin','Holders'],['topHoldersMax','Top holders'],['creatorMax','Creator holdings'],['reserveMin','Launchpad reserves']])if(settings[key]!==''&&settings[key]!=null)unsupported.push(label);
 // Contract checks from the scan's safety pass. A coin whose contract hasn't been checked yet doesn't count as passing.
 const safety=c=>c.safety&&!c.safety.failedAt?c.safety:null;
 const hasFlag=(c,keys)=>(c.flags||[]).some(f=>keys.includes(f.key));
 if(settings.excludeMintable)limits.push({key:'mintable',label:'Mint authority',test:c=>safety(c)?!safety(c).mintable&&!hasFlag(c,['mintable']):null,text:'Mint authority revoked',why:()=>'The creator can still mint more tokens'});
 if(settings.excludeFreezable)limits.push({key:'freezable',label:'Freeze authority',test:c=>safety(c)?!safety(c).freezable&&!hasFlag(c,['freezable']):null,text:'Freeze authority revoked',why:()=>'The creator can freeze holders’ tokens'});
 if(settings.excludeMutableFees||settings.excludeTransferHooks)limits.push({key:'transfer',label:'Transfer rules',test:c=>safety(c)?!hasFlag(c,['transferFee','transferHook','taxModifiable','sellTax']):null,text:'No transfer fees or hooks',why:()=>'Transfers carry a fee, tax or custom code'});
 if(config?.hideCopycats)limits.push({key:'copycat',label:'Copycats',test:c=>!hasFlag(c,['knownName','copycat'])&&!(c.flags||[]).some(f=>f.key==='sameTicker'&&f.level!=='info'),text:'No copycats',why:c=>(c.flags||[]).find(f=>['knownName','copycat','sameTicker'].includes(f.key))?.text||'Looks like a copy of another coin'});
 const momentumMin=num(config?.momentumMin);
 if(momentumMin)limits.push({key:'momentum',label:'Momentum',test:c=>c.momentum==null?null:c.momentum>=momentumMin,text:`Momentum ≥ ${momentumMin}`,why:c=>`Momentum ${c.momentum}, under ${momentumMin}`});
 // Coin preferences from Customize.
 range('rAge','Age',results.ageMin,results.ageMax,hours,ageHours);
 range('rCap','Market cap',results.capMin,results.capMax,usd,cap('marketCap'));
 range('rLiquidity','Liquidity',results.liquidityMin,'',usd,c=>c.liquidity??null);
 range('rVolume','24h volume',results.volumeMin,'',usd,c=>c.volume24h??null);
 const networks=Array.isArray(config?.networks)?config.networks.filter(n=>n in scanNetworks):Object.keys(scanNetworks);
 if(networks.length<Object.keys(scanNetworks).length)limits.push({key:'network',label:'Network',test:c=>networks.includes(c.chain),text:networks.map(n=>scanNetworks[n]).join(', ')||'No networks'});
 return {limits,unsupported,projectsOn:!!projects?.enabled};
}

// One coin against one scanner. `results` lists every limit with pass (true), fail (false) or not reported (null).
export function matchCoin(coin,config,prepared=scannerLimits(config)){
 if(!prepared.projectsOn)return {match:false,results:[],reason:'New coins is turned off in your scanner.'};
 const results=prepared.limits.map(limit=>({key:limit.key,label:limit.label,text:limit.text,pass:limit.test(coin),limit}));
 const failed=results.find(r=>r.pass!==true);
 const reason=!failed?'':failed.pass===null?`${failed.label} not reported`:failed.limit.why?failed.limit.why(coin):`Outside your ${failed.label.toLowerCase()} limit`;
 return {match:!failed,results:results.map(({limit,...rest})=>rest),reason};
}

export function matchScan(coins,config){
 const prepared=scannerLimits(config),matched=[],skipped=[];
 for(const coin of coins||[]){const result=matchCoin(coin,config,prepared);(result.match?matched:skipped).push({coin,...result});}
 return {matched,skipped,limits:prepared.limits,unsupported:prepared.unsupported,projectsOn:prepared.projectsOn,postsOn:!!config?.sources?.public?.enabled&&enabledSources(config).includes('public')};
}

// Short phrases for the active limits, for summaries like "Under 24h · Lower risk, Caution".
export const limitSummary=limits=>limits.map(limit=>limit.text);
