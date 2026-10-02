import {accountHandles,activeSettingsRows,ageBases,stages,settingsErrors} from './scanner-settings.js';

// Describe saved rules, never pretend they have produced live matches.
export function scannerIntent(r){
 if(r.type==='public'){
  const accounts=accountHandles(r.accounts);
  const source=r.accountScope==='soltech'?'the Soltech account list (not connected yet)':!accounts.length?'the X accounts you choose':accounts.length===1?'@'+accounts[0]:`${accounts.length} X accounts`;
  return r.matchMode==='direct'?`Look for token addresses and coin links from ${source}.`:`Look for coin mentions and possible theme connections from ${source}.`;
 }
 if(r.type==='projects'){
  const bounded=r.ageMin!==''||r.ageMax!=='';
  const age=r.ageMin!==''?(r.ageMax!==''?`${r.ageMin}–${r.ageMax} hours old`:`at least ${r.ageMin} hours old`):r.ageMax!==''?`up to ${r.ageMax} hours old`:'of any age';
  const basis={trading:'since trading began',mint:'since token creation',pool:'since this pool opened'}[r.ageBasis];
  const stage=r.stage==='any'?'at any launch stage':stages[r.stage].toLowerCase();
  return `Look for coins ${age}${bounded?` (${basis})`:''}, ${stage}.`;
 }
 return 'Look for coins across market data that meet your chosen limits.';
}

export function extraFilterRows(r){
 return activeSettingsRows(r).filter(([label])=>{
  if(['Risk preferences','Launch stage'].includes(label))return false;
  if(r.type==='projects'&&label===ageBases[r.ageBasis])return r.ageMin!==''||r.ageBasis!=='trading';
  if(r.type==='market'&&['DEX liquidity','Market cap','FDV'].includes(label))return false;
  if(label==='Posts')return !(r.postTypes.length===2&&r.postTypes.includes('posts')&&r.postTypes.includes('quotes'));
  if(label==='Post age')return r.postWindow!=='24';
  return true;
 });
}

export function riskSummary(r){
 if(!r.riskLevels.length)return 'Choose at least one status';
 return `${r.riskLevels.includes('high')?'High risk included':'High risk excluded'} · ${r.riskLevels.includes('unknown')?'Unassessed included':'Unassessed excluded'}`;
}

export function setupGuidance(r){
 const errors=settingsErrors(r);
 const sourceInvalid=r.type==='public'&&errors.accounts;
 const intent=sourceInvalid?'Add valid X handles to define whose posts to watch.':r.type==='projects'&&errors.ageMax?'Choose a valid maximum age for new coins.':scannerIntent(r);
 const details=r.type==='public'?(r.matchMode==='direct'?'An address identifies the coin. A name alone is not enough.':'Theme connections are suggestions, not proof of an endorsement.'):
 r.type==='projects'?'Age and launch stage are separate: an older coin can open a new pool.':'Leave a limit blank to include any value.';
 const extras=extraFilterRows(r);
 return {intent,details,extras,risk:riskSummary(r),needsReview:Object.keys(errors).length>0};
}

export function settingStep(key,r){
 if(r.type==='public'&&key==='accounts')return 2;
 if(r.type==='projects'&&key==='ageMax')return 2;
 if(r.type==='market'&&['liquidityMin','capMin','capMax'].includes(key))return 2;
 return 3;
}

export function stepErrors(r,step){
 return Object.fromEntries(Object.entries(settingsErrors(r)).filter(([key])=>step===4||settingStep(key,r)===step||(step===3&&r.type==='projects'&&key==='ageMax')));
}
