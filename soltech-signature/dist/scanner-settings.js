export const scannerTypes = {public:'Posts on X',projects:'New coins',market:'All coins'};
export const stages = {any:'Any stage',curve:'On a launchpad',graduating:'Nearing graduation',dex:'Trading on a DEX'};
export const ageBases = {trading:'Trading age',mint:'Token age',pool:'Pool age'};
export const riskOptions = {lower:'No flags reported',caution:'Caution',high:'High risk reported',unknown:'Not assessed'};
export const postOptions = {posts:'Posts',quotes:'Quotes',replies:'Replies',reposts:'Reposts'};
export const numericFields = ['ageMin','ageMax','liquidityMin','reserveMin','capMin','capMax','activityMin','holdersMin','topHoldersMax','creatorMax','priceMin','priceMax'];
export const booleanFields = ['excludeMintable','excludeFreezable','excludeMutableFees','excludeTransferHooks'];
export function defaultSettings(type='projects') {
 return {version:1,type,accounts:'',matchMode:'related',postTypes:['posts','quotes'],postWindow:'24',stage:'any',ageBasis:'trading',ageMin:'',ageMax:'',liquidityMin:'',reserveMin:'',valuation:'marketCap',capMin:'',capMax:'',activityMetric:'volume',activityMin:'',activityWindow:'1h',riskLevels:Object.keys(riskOptions),holdersMin:'',topHoldersMax:'',creatorMax:'',venue:'any',priceMin:'',priceMax:'',priceWindow:'1h',excludeMintable:false,excludeFreezable:false,excludeMutableFees:false,excludeTransferHooks:false,legacyLiquidity:''};
}
const enumValue=(v,options,fallback)=>options.includes(v)?v:fallback;
const string=(v,max=40)=>typeof v==='string'?v.slice(0,max):typeof v==='number'&&Number.isFinite(v)?String(v):'';
const list=(v,options,fallback)=>Array.isArray(v)?[...new Set(v.filter(x=>options.includes(x)))]:[...fallback];
export function cleanSettings(value,legacy={}) {
 const inferred=legacy.sourceId==='balanced'?'public':legacy.sourceId==='momentum'||legacy.focus==='Growing activity'?'projects':'market';
 const d=defaultSettings(value?.type||inferred),v=value&&typeof value==='object'?value:{};
 const r={...d};
 for(const k of numericFields)r[k]=string(v[k]);
 for(const k of booleanFields)r[k]=v[k]===true;
 r.type=enumValue(v.type,Object.keys(scannerTypes),inferred);
 r.stage=enumValue(v.stage,Object.keys(stages),'any');
 r.ageBasis=enumValue(v.ageBasis,Object.keys(ageBases),'trading');
 r.valuation=enumValue(v.valuation,['marketCap','fdv'],'marketCap');
 r.activityMetric=enumValue(v.activityMetric,['volume','trades','wallets'],'volume');
 r.activityWindow=enumValue(v.activityWindow,['5m','1h','24h'],'1h');
 r.priceWindow=enumValue(v.priceWindow,['5m','1h','24h'],'1h');
 r.venue=enumValue(v.venue,['any','pump','raydium','meteora','orca'],'any');
 r.matchMode=enumValue(v.matchMode,['direct','related'],'related');
 r.postWindow=enumValue(v.postWindow,['1','24','168'],'24');
 r.accounts=string(v.accounts,600);
 r.postTypes=list(v.postTypes,Object.keys(postOptions),d.postTypes);
 r.riskLevels=list(v.riskLevels,Object.keys(riskOptions),d.riskLevels);
 r.legacyLiquidity=enumValue(v.legacyLiquidity,['Established','Higher liquidity'],'');
 if(!value){
  const oldDays={'At least 7 days':7,'At least 30 days':30,'At least 90 days':90}[legacy.age];
  if(oldDays){r.ageBasis='mint';r.ageMin=String(oldDays*24);}
  r.legacyLiquidity=enumValue(legacy.liquidity,['Established','Higher liquidity'],'');
 }
 return r;
}
export const usesCurve=r=>r.type==='projects'&&['curve','graduating'].includes(r.stage);
export function accountHandles(value='') {return [...new Map(value.split(/[\s,]+/).filter(Boolean).map(handle=>[handle.replace(/^@/,'').toLowerCase(),handle.replace(/^@/,'')])).values()];}
export function settingsErrors(r) {
 const errors={};
 for(const key of numericFields){const v=r[key];if(v!==''&&(!/^-?\d+(\.\d+)?$/.test(v)||!Number.isFinite(Number(v))))errors[key]='Enter a valid number.';else if(v!==''&&!key.startsWith('price')&&Number(v)<0)errors[key]='Use zero or a positive number.';}
 for(const [min,max] of [['ageMin','ageMax'],['capMin','capMax'],['priceMin','priceMax']])if(r[min]!==''&&r[max]!==''&&!errors[min]&&!errors[max]&&Number(r[min])>Number(r[max]))errors[max]='Maximum must be at least the minimum.';
 for(const key of ['topHoldersMax','creatorMax'])if(r[key]!==''&&!errors[key]&&Number(r[key])>100)errors[key]='Use a percentage from 0 to 100.';
 if(r.holdersMin!==''&&!errors.holdersMin&&!Number.isInteger(Number(r.holdersMin)))errors.holdersMin='Use a whole number.';
 if(r.activityMetric!=='volume'&&r.activityMin!==''&&!errors.activityMin&&!Number.isInteger(Number(r.activityMin)))errors.activityMin='Use a whole number.';
 if(r.priceMin!==''&&!errors.priceMin&&Number(r.priceMin)<-100)errors.priceMin='Price change cannot be below −100%.';
 if(r.priceMax!==''&&!errors.priceMax&&Number(r.priceMax)<-100)errors.priceMax='Price change cannot be below −100%.';
 if(!r.riskLevels.length)errors.riskLevels='Choose at least one risk status.';
 if(usesCurve(r)&&r.ageBasis==='pool')errors.ageBasis='Launchpad tokens have no DEX pool yet. Choose Trading age or Token age.';
 if(usesCurve(r)&&!['any','pump'].includes(r.venue))errors.venue='This stage is before DEX trading. Choose Any venue or Pump.fun.';
 if(r.type==='public'){
  if(!r.postTypes.length)errors.postTypes='Choose at least one post type.';
  const handles=accountHandles(r.accounts);
  if(!handles.length)errors.accounts='Add at least one X handle. You can leave now and keep this draft.';
  else if(handles.some(a=>!/^[A-Za-z0-9_]{1,15}$/.test(a)))errors.accounts='Use X handles, not links: @account, @another.';
 }
 // Hidden controls stay in the draft, but do not constrain the other scanner type.
 if(usesCurve(r))delete errors.liquidityMin;
 else if(r.type!=='projects'||r.stage==='dex')delete errors.reserveMin;
 return errors;
}
const amount=(v,prefix='')=>Number.isFinite(Number(v))?`${prefix}${Number(v).toLocaleString('en-US',{maximumFractionDigits:8})}`:'Needs review';
const range=(min,max,suffix='',prefix='')=>min===''&&max===''?'Any':min===''?`Up to ${amount(max,prefix)}${suffix}`:max===''?`At least ${amount(min,prefix)}${suffix}`:`${amount(min,prefix)}–${amount(max,prefix)}${suffix}`;
export function settingsRows(r) {
 const rows=[['Looks for',scannerTypes[r.type]]];
 if(r.type==='public')rows.push(['People on X',accountHandles(r.accounts).map(a=>'@'+a).join(', ')||'Not chosen yet'],['Matches',r.matchMode==='direct'?'Direct coin mentions':'Mentions + possible connections'],['Posts',r.postTypes.map(x=>postOptions[x]).join(', ')||'None selected'],['Post age',`Past ${r.postWindow==='168'?'7 days':r.postWindow==='1'?'hour':'24 hours'}`]);
 if(r.type==='projects')rows.push(['Launch stage',stages[r.stage]]);
 rows.push([ageBases[r.ageBasis],range(r.ageMin,r.ageMax,' hours')]);
 if(!usesCurve(r))rows.push(['DEX liquidity',r.liquidityMin===''?'Any':`At least ${amount(r.liquidityMin,'$')}`]);
 if(r.type==='projects'&&r.stage!=='dex')rows.push(['Launchpad reserves',r.reserveMin===''?'Any':`At least ${amount(r.reserveMin,'$')} in real reserves`]);
 rows.push([r.valuation==='fdv'?'FDV':'Market cap',range(r.capMin,r.capMax,'','$')]);
 rows.push(['Activity',r.activityMin===''?'Any':`At least ${r.activityMetric==='volume'?amount(r.activityMin,'$')+' volume':amount(r.activityMin)+' '+(r.activityMetric==='trades'?'trades':'active wallets')} · ${r.activityWindow}`]);
 rows.push(['Risk preferences',r.riskLevels.length===4?'All statuses, including not assessed':r.riskLevels.map(x=>riskOptions[x]).join(' · ')||'None selected']);
 if(r.holdersMin!=='')rows.push(['Holders',`At least ${amount(r.holdersMin)} wallets`]);
 if(r.topHoldersMax!=='')rows.push(['Top 10 holders',`At most ${amount(r.topHoldersMax)}%`]);
 if(r.creatorMax!=='')rows.push(['Creator holdings',`At most ${amount(r.creatorMax)}%`]);
 if(r.venue!=='any')rows.push(['Venue',{pump:'Pump.fun / PumpSwap',raydium:'Raydium',meteora:'Meteora',orca:'Orca'}[r.venue]]);
 if(r.priceMin!==''||r.priceMax!=='')rows.push(['Price change',`${range(r.priceMin,r.priceMax,'%')} · ${r.priceWindow}`]);
 const excluded=[r.excludeMintable&&'Additional minting',r.excludeFreezable&&'Freeze authority',r.excludeMutableFees&&'Changeable transfer fees',r.excludeTransferHooks&&'Custom transfer hooks'].filter(Boolean);
 if(excluded.length)rows.push(['Exclude tokens with',excluded.join(' · ')]);
 rows.push(['Risk checks','Always included; missing data is never a pass']);
 if(r.legacyLiquidity)rows.push(['Earlier liquidity preference',`${r.legacyLiquidity} — no numeric threshold was set`]);
 return rows;
}

// One summary of applied rules, shared by Review and disclosure counts.
export function activeSettingsRows(r){
 return settingsRows(r).filter(([label,value])=>!['Looks for','People on X','Matches','Risk checks'].includes(label)&&value!=='Any'&&!(label==='Launch stage'&&r.stage==='any'));
}
