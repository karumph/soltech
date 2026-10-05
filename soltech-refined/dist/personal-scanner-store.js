import {defaultSettings,cleanSettings,settingsErrors} from './scanner-settings.js';
import {cleanAppearance} from './scanner-appearance.js';
import {defaultResultFilters,cleanResultFilters,resultFilterErrors} from './scanner-result-filters.js';

export const PERSONAL_SCANNER_KEY='soltech.scanner.v1';
export const sourceNames={public:'Posts on X',projects:'New coins',market:'Market data'};
export const scannerPresets={public:{name:'X mentions',sources:['public'],description:'Follow accounts and coin mentions.'},projects:{name:'New launches',sources:['projects'],description:'Watch coins as they start trading.'},both:{name:'X + new launches',sources:['public','projects'],description:'Bring both sources into one feed.'}};
const copy=v=>JSON.parse(JSON.stringify(v));
export function defaultPersonalScanner(){return {name:'Soltech scanner',badgeSymbol:'scan',badgeColor:'mint',resultFilters:defaultResultFilters(),sources:Object.fromEntries(Object.keys(sourceNames).map(type=>[type,{enabled:type!=='market',settings:{...defaultSettings(type),accountScope:type==='public'?'soltech':'custom',matchMode:'direct',ageMax:type==='projects'?'24':'',riskLevels:['lower','caution','unknown']}}]))};}
export const enabledSources=config=>Object.keys(sourceNames).filter(key=>config.sources[key].enabled);
export function cleanPersonalScanner(value){
 if(!value||!value.sources||Object.keys(sourceNames).some(key=>!value.sources[key]||typeof value.sources[key].enabled!=='boolean'||!value.sources[key].settings))throw Error('Unrecognized scanner setup');
 return {name:typeof value.name==='string'?value.name.slice(0,50):'My scanner',...cleanAppearance(value),resultFilters:cleanResultFilters(value.resultFilters),sources:Object.fromEntries(Object.keys(sourceNames).map(type=>[type,{enabled:value.sources[type].enabled,settings:cleanSettings({...value.sources[type].settings,type})}]))};
}
// The simple editor always includes the two discovery sources. Their existing
// rules remain separate from the optional limits applied to discovered results.
export function prepareScannerCustomization(config){
 const next=cleanPersonalScanner(config);
 next.sources.public.enabled=true;next.sources.projects.enabled=true;next.sources.market.enabled=false;
 return next;
}
export function applyScannerPreset(config,key){
 if(!scannerPresets[key])return copy(config);
 const next=copy(config);for(const type of Object.keys(sourceNames))next.sources[type].enabled=scannerPresets[key].sources.includes(type);
 return next;
}
export function personalScannerErrors(config){
 const errors=[];
 if(!enabledSources(config).length)errors.push({source:null,key:'sources',message:'Choose at least one source.'});
 for(const source of enabledSources(config))for(const [key,message] of Object.entries(settingsErrors(config.sources[source].settings)))errors.push({source,key,message});
 for(const [key,message] of Object.entries(resultFilterErrors(config.resultFilters)))errors.push({source:'results',key,message});
 if(!config.name.trim())errors.push({source:null,key:'name',message:'Give your scanner a name.'});
 return errors;
}
const initial=()=>({schemaVersion:1,revision:0,saved:null,draft:null});
export function createPersonalScannerStore(storage){
 let state=initial(),baseRaw=null,issue=null;
 function load(){
  try{
   const raw=storage.getItem(PERSONAL_SCANNER_KEY),value=raw?JSON.parse(raw):initial();
   if(value.schemaVersion!==1||!Number.isInteger(value.revision)||value.revision<0)throw Error('Unrecognized scanner data');
   state={schemaVersion:1,revision:value.revision,saved:value.saved?cleanPersonalScanner(value.saved):null,draft:value.draft?{config:cleanPersonalScanner(value.draft.config),screen:['sources','setup','filters','review'].includes(value.draft.screen)?value.draft.screen:'sources',source:Object.hasOwn(sourceNames,value.draft.source)?value.draft.source:'public'}:null};
   baseRaw=raw;issue=null;return true;
  }catch{issue='read';return false;}
 }
 function write(next){
  if(issue==='read'){
   // Keep an existing draft editable and exportable while saved data is unreadable.
   // Applying, discarding or starting a draft still requires successful recovery.
   if(state.draft&&next.draft)state={...state,draft:next.draft};
   return false;
  }
  try{
   if(storage.getItem(PERSONAL_SCANNER_KEY)!==baseRaw){state=next;issue='conflict';return false;}
   const candidate={...next,revision:state.revision+1},raw=JSON.stringify(candidate);
   storage.setItem(PERSONAL_SCANNER_KEY,raw);state=candidate;baseRaw=raw;issue=null;return true;
  }catch{state=next;issue='write';return false;}
 }
 load();
 return {
  get state(){return copy(state);},get issue(){return issue;},reload:load,
  get effective(){return issue==='read'?null:copy(state.saved||defaultPersonalScanner());},
  detectConflict(){try{if(storage.getItem(PERSONAL_SCANNER_KEY)!==baseRaw){issue='conflict';return true;}return false;}catch{issue='read';return true;}},
  begin(preset){if(state.draft)return false;const config=state.saved||defaultPersonalScanner();return write({...state,draft:{config:preset?applyScannerPreset(config,preset):copy(config),screen:'sources',source:'public'}});},
  update(config){if(!state.draft)return false;return write({...state,draft:{...state.draft,config:cleanPersonalScanner(config)}});},
  step(screen,source=state.draft?.source){if(!state.draft||!['sources','setup','filters','review'].includes(screen))return false;return write({...state,draft:{...state.draft,screen,source:Object.hasOwn(sourceNames,source)?source:'public'}});},
  cancel(){return write({...state,draft:null});},
  save(){
   if(!state.draft)return {ok:false};const errors=personalScannerErrors(state.draft.config);if(errors.length)return {ok:false,errors};
   const previous=copy(state),next={...state,saved:copy(state.draft.config),draft:null};
   if(write(next))return {ok:true};state=previous;return {ok:false,issue};
  },
  retry(){return write(state);},export(){return JSON.stringify(state,null,2);}
 };
}
