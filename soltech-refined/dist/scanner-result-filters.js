const fields=['capMin','capMax','ageMin','ageMax','liquidityMin','volumeMin'];
const groups=[['capMin','capMax'],['ageMin','ageMax'],['liquidityMin'],['volumeMin']];

// Shared post-discovery limits: USD market cap/liquidity, trading age in hours,
// and USD trading volume over the past 24 hours. Blank means no added limit.
export function defaultResultFilters(){
 return Object.fromEntries(fields.map(key=>[key,'']));
}

export function cleanResultFilters(value){
 const input=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const result=defaultResultFilters();
 for(const key of fields){
  const entry=input[key];
  // Keep invalid typed strings intact so a draft can explain and repair them.
  if(typeof entry==='string')result[key]=entry;
  else if(typeof entry==='number')result[key]=String(entry);
 }
 return result;
}

export function resultFilterErrors(value){
 const result=cleanResultFilters(value),errors={};
 for(const key of fields){
  const entry=result[key];
  if(entry==='')continue;
  if(!/^-?\d+(\.\d+)?$/.test(entry)||!Number.isFinite(Number(entry)))errors[key]='Enter a valid number.';
  else if(Number(entry)<0)errors[key]='Use zero or a positive number.';
 }
 for(const [min,max] of groups.filter(group=>group.length===2)){
  if(result[min]!==''&&result[max]!==''&&!errors[min]&&!errors[max]&&Number(result[min])>Number(result[max]))errors[max]='Maximum must be at least the minimum.';
 }
 return errors;
}

export function resultFilterCount(value){
 const result=cleanResultFilters(value);
 return groups.filter(group=>group.some(key=>result[key]!=='')).length;
}
