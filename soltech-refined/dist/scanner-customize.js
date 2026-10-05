import {PERSONAL_SCANNER_KEY,personalScannerErrors,prepareScannerCustomization} from './personal-scanner-store.js';
import {defaultResultFilters,resultFilterCount} from './scanner-result-filters.js';
import {renderSettings} from './scanner-editor.js';
import {settingStep} from './scanner-guidance.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groups=[
 {title:'Market cap',unit:'USD',fields:[['capMin','Minimum'],['capMax','Maximum']]},
 {title:'Coin age',unit:'Hours',help:'Time since trading began.',fields:[['ageMin','Minimum'],['ageMax','Maximum']]},
 {title:'Liquidity',unit:'USD',fields:[['liquidityMin','Minimum liquidity']]},
 {title:'24-hour volume',unit:'USD',fields:[['volumeMin','Minimum volume']]}
];

export function mountScannerCustomize(root,{store,navigate,toast}){
 const events=new AbortController();let errors=[],recovery=null,reloadPrompt=false,noticeMarkup='';
 if(!store.state.draft&&!store.issue)store.begin();
 document.body.classList.add('scanner-setup');
 document.title='Customize scanner · Soltech';
 const draft=()=>store.state.draft?.config;
 function notice(){
  if(!store.issue)return '';
  const message=store.issue==='conflict'?'Your setup changed in another tab. These edits are still here.':store.issue==='read'?'Your saved setup could not be opened. It has not been overwritten.':'Your edits are kept in this tab, but could not be saved to this device.';
  return `<div class="customize-notice" role="alert">${message}<div><button type="button" data-customize-action="download">Download edits</button>${store.issue==='write'?'<button type="button" data-customize-action="retry">Try saving again</button>':'<button type="button" data-customize-action="reload">Load saved version</button>'}</div>${reloadPrompt?'<p>Replace the edits in this tab with the saved version?</p><button type="button" data-customize-action="confirm-reload">Replace local edits</button><button type="button" data-customize-action="keep">Keep editing</button>':''}</div>`;
 }
 function field(config,group,key,label){
  const message=errors.find(e=>e.source==='results'&&e.key===key)?.message;
  return `<div class="customize-input"><label for="result-${key}">${label}</label><input id="result-${key}" data-result-filter="${key}" type="text" inputmode="decimal" autocomplete="off" maxlength="40" placeholder="No limit" value="${esc(config.resultFilters[key])}" aria-label="${esc(group.title+' '+label.toLowerCase()+' ('+group.unit+')')}" ${message?'aria-invalid="true"':''} aria-describedby="result-${key}-error"><span class="customize-field-error" id="result-${key}-error">${esc(message||'')}</span></div>`;
 }
 function recoveryHTML(config){
  if(!recovery)return '';
  if(recovery.key==='name')return `<section class="customize-recovery"><h2>Review earlier setup</h2><label for="customize-name">Scanner name</label><input id="customize-name" data-repair-name value="${esc(config.name)}" maxlength="50" aria-describedby="customize-name-error" ${recovery.message?'aria-invalid="true"':''}><span class="customize-field-error" id="customize-name-error">${esc(recovery.message||'')}</span></section>`;
  const settings=config.sources[recovery.source].settings;
  return `<details class="customize-recovery" open><summary>Review earlier ${recovery.source==='public'?'Post':'New projects'} settings</summary><p>An earlier setting needs attention before this setup can be applied.</p>${renderSettings(settings,recovery.step??settingStep(recovery.key,settings)).replaceAll('data-action=','data-repair-action=')}</details>`;
 }
 function render(){
  const config=draft(),publicSettings=config?.sources.public.settings;
  const accountError=errors.find(e=>e.source==='public'&&e.key==='accounts')?.message;
  noticeMarkup=notice();
  root.innerHTML=`<div class="page-width scanner-customize"><a class="customize-back" href="#scanner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M19 12H5m6-6-6 6 6 6"/></svg><span>Scanner</span></a><header class="customize-heading"><h1>Customize scanner<span>.</span></h1><p>A few preferences for your finds.</p></header><div data-customize-storage-status>${noticeMarkup}</div>${!config?'<p>Your saved setup is unavailable.</p>':`
   <div class="customize-sources"><span class="customize-source-dot" aria-hidden="true"></span><strong>Post + New projects</strong></div>
   <form id="scanner-customize-form" novalidate>
    <section class="customize-section customize-people" aria-labelledby="customize-people-title"><h2 id="customize-people-title">Posts from</h2><p>Choose whose posts your scanner follows.</p>
     <fieldset class="customize-account-choice"><legend class="sr-only">Accounts to follow</legend>${[['soltech','Soltech list'],['custom','Specific accounts']].map(([value,label])=>`<label><input type="radio" name="account-scope" value="${value}" ${publicSettings.accountScope===value?'checked':''}><span>${label}</span></label>`).join('')}</fieldset>
     <div class="customize-handles" ${publicSettings.accountScope==='custom'?'':'hidden'}><label for="customize-accounts">X usernames</label><textarea id="customize-accounts" rows="2" maxlength="600" data-accounts placeholder="@username, @another" spellcheck="false" autocapitalize="none" autocomplete="off" aria-describedby="customize-accounts-help customize-accounts-error" ${accountError?'aria-invalid="true"':''}>${esc(publicSettings.accounts)}</textarea><p id="customize-accounts-help">Separate usernames with commas or new lines.</p><span class="customize-field-error" id="customize-accounts-error">${esc(accountError||'')}</span></div>
     <p class="customize-list-note" ${publicSettings.accountScope==='soltech'?'':'hidden'}>Use Soltech’s default account list. The live list isn’t connected yet.</p>
    </section>
    <section class="customize-limits" aria-labelledby="customize-limits-title"><div class="customize-section-heading"><h2 id="customize-limits-title">Coin preferences</h2><span>Optional</span></div><p>Applies to finds from both sources. Leave blank for no extra limit.</p>
     ${groups.map(group=>`<fieldset class="customize-filter-group"><legend>${group.title}<span>${group.unit}</span></legend>${group.help?`<p>${group.help}</p>`:''}<div class="customize-inputs ${group.fields.length===1?'single':''}">${group.fields.map(([key,label])=>field(config,group,key,label)).join('')}</div></fieldset>`).join('')}
    </section>
    ${recoveryHTML(config)}
    <div class="customize-errors" role="alert" tabindex="-1" ${errors.length?'':'hidden'}>${esc(errors[0]?.message||'')}</div>
    <p class="customize-preview-note">Settings preview · Live scanning isn’t connected.</p>
    <footer class="customize-footer"><div><button class="customize-clear" type="button" data-customize-action="clear">Clear limits</button><button class="customize-apply" type="submit" ${store.issue==='read'||store.issue==='conflict'?'disabled':''}>${applyLabel(config)}</button></div><p>${store.issue?'Edits kept in this tab':'Draft saved on this device'}</p></footer>
   </form>`}</div>`;
  if(recovery?.message){
   const input=root.querySelector(`[data-setting="${recovery.key}"]`);
   if(input){input.setAttribute('aria-invalid','true');for(let parent=input.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;}
   const message=root.querySelector(`#setting-${recovery.key}-error`);if(message)message.textContent=recovery.message;
  }
 }
 function renderKeepingFocus(selector){
  const expanded=[...root.querySelectorAll('details[open]')].map(element=>element.id).filter(Boolean);
  render();
  for(const id of expanded){const details=root.querySelector('#'+id);if(details)details.open=true;}
  const target=root.querySelector(selector);
  if(target){for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;target.focus({preventScroll:true});}
 }
 const applyLabel=config=>`Apply filters${resultFilterCount(config.resultFilters)?' ('+resultFilterCount(config.resultFilters)+')':''}`;
 function refreshStorageFeedback(){
  const markup=notice();
  if(markup!==noticeMarkup){const status=root.querySelector('[data-customize-storage-status]');if(status)status.innerHTML=markup;noticeMarkup=markup;}
  const button=root.querySelector('.customize-apply');if(button)button.disabled=store.issue==='read'||store.issue==='conflict';
  const footer=root.querySelector('.customize-footer p');if(footer)footer.textContent=store.issue?'Edits kept in this tab':'Draft saved on this device';
 }
 function update(config){
  store.update(config);
  const button=root.querySelector('.customize-apply');if(button)button.textContent=applyLabel(config);
  refreshStorageFeedback();
 }
 function clearErrors(){
  errors=[];if(recovery)recovery={...recovery,message:''};
  root.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
  root.querySelectorAll('.customize-field-error,.field-error').forEach(el=>el.textContent='');
  const banner=root.querySelector('.customize-errors');if(banner)banner.hidden=true;
 }
 function change(event){
  const el=event.target,config=draft();if(!config)return;
  if(el.dataset.resultFilter)config.resultFilters[el.dataset.resultFilter]=el.value;
  else if(el.hasAttribute('data-accounts'))config.sources.public.settings.accounts=el.value;
  else if(el.name==='account-scope'){
   config.sources.public.settings.accountScope=el.value;
   root.querySelector('.customize-handles').hidden=el.value!=='custom';
   root.querySelector('.customize-list-note').hidden=el.value!=='soltech';
  }else if(el.hasAttribute('data-repair-name'))config.name=el.value;
  else if(el.dataset.setting&&recovery){
   const settings=config.sources[recovery.source].settings,key=el.dataset.setting;
   settings[key]=el.dataset.list?(el.checked?[...new Set([...settings[key],el.value])]:settings[key].filter(v=>v!==el.value)):el.type==='checkbox'?el.checked:el.value;
   if(key==='liquidityMin')settings.legacyLiquidity='';
  }else return;
  clearErrors();update(config);
  if(el.dataset.setting&&['stage','ageBasis','valuation','activityMetric'].includes(el.dataset.setting))renderKeepingFocus('#'+el.id);
 }
 root.addEventListener('input',event=>{if(event.target.matches('input:not([type=radio]):not([type=checkbox]),textarea'))change(event);},{signal:events.signal});
 root.addEventListener('change',event=>{if(event.target.matches('input[type=radio],input[type=checkbox],select'))change(event);},{signal:events.signal});
 root.addEventListener('click',event=>{
  const shortcut=event.target.closest('[data-repair-action="age-shortcut"]');
  if(shortcut&&recovery){const config=draft();config.sources[recovery.source].settings.ageMax=shortcut.dataset.value;clearErrors();update(config);renderKeepingFocus(`[data-repair-action="age-shortcut"][data-value="${shortcut.dataset.value}"]`);return;}
  const filters=event.target.closest('[data-repair-action="builder-step"]');
  if(filters&&recovery){recovery={...recovery,step:3};renderKeepingFocus(`[data-setting="${recovery.key}"]`);return;}
  const button=event.target.closest('[data-customize-action]');if(!button)return;
  const action=button.dataset.customizeAction;
  if(action==='clear'){const config=draft();if(config){config.resultFilters=defaultResultFilters();errors=[];update(config);render();root.querySelector('.customize-clear')?.focus({preventScroll:true});}}
  if(action==='retry'){store.retry();render();}
  if(action==='reload'){reloadPrompt=true;render();}
  if(action==='keep'){reloadPrompt=false;render();}
  if(action==='confirm-reload'){store.reload();if(!store.issue&&!store.state.draft)store.begin();reloadPrompt=false;errors=[];recovery=null;render();}
  if(action==='download'){const url=URL.createObjectURL(new Blob([store.export()],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='soltech-scanner-settings.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 },{signal:events.signal});
 root.addEventListener('submit',event=>{
  if(event.target.id!=='scanner-customize-form')return;event.preventDefault();
  const config=prepareScannerCustomization(draft());errors=personalScannerErrors(config);recovery=null;
  if(errors.length){
   const first=errors[0];if(first.source!=='results'&&first.key!=='accounts')recovery=first;
   render();const target=first.source==='results'?root.querySelector(`[data-result-filter="${first.key}"]`):first.key==='accounts'?root.querySelector('#customize-accounts'):first.key==='name'?root.querySelector('#customize-name'):root.querySelector(`[data-setting="${first.key}"]`)||root.querySelector('.customize-errors');
   target?.focus();target?.scrollIntoView({block:'center',behavior:'auto'});return;
  }
  if(!store.update(config)){render();return;}
  const result=store.save();if(result.ok){toast('Scanner preferences saved. Live scanning isn’t connected.');navigate('scanner');}else{errors=result.errors||[];render();}
 },{signal:events.signal});
 window.addEventListener('storage',event=>{if(event.key===PERSONAL_SCANNER_KEY||event.key===null){store.detectConflict();refreshStorageFeedback();}},{signal:events.signal});
 render();return ()=>{events.abort();document.body.classList.remove('scanner-setup');};
}
