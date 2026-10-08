import {sourceNames,enabledSources,personalScannerErrors} from './personal-scanner-store.js';
import {renderSettings,renderSettingsSummary} from './scanner-editor.js';
import {renderAppearance} from './scanner-builder.js';
import {scannerBadge} from './scanner-appearance.js';
import {scannerIntent,settingStep,stepErrors} from './scanner-guidance.js';
import {activeSettingsRows,cleanSettings} from './scanner-settings.js';
import {scannerFlowHTML,scannerActivityHTML,mountScannerFlow} from './scanner-flow.js';
import {mountScannerCustomize} from './scanner-customize.js';
import {coinFeedPreviewHTML} from './coin-feed.js';
import {mountCoinFeedCopy} from './coin-feed-copy.js';
import {coinFeedLoadingHTML,mountLiveFeed} from './coin-feed-live.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const marks={public:{badgeSymbol:'publicPosts',badgeColor:'mint'},projects:{badgeSymbol:'launch',badgeColor:'peach'},market:{badgeSymbol:'coin',badgeColor:'teal'}};
const sourceCopy={public:'Accounts, coin mentions and related ideas.',projects:'Launch stages and the age of a coin.',market:'Coins that meet your market filters.'};
const adapt=html=>html.replaceAll('data-setting=','data-primary-setting=').replaceAll('data-field=','data-primary-field=').replaceAll('data-action=','data-primary-action=');
const sourceList=config=>enabledSources(config).map(key=>sourceNames[key]).join(' + ');
const ruleRows=r=>activeSettingsRows(r).map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('');
const steps=['sources','setup','filters','review'];

const hosted=()=>typeof window!=='undefined'&&!!(window.SOLTECH_HOSTED&&window.SOLTECH_API);

export function createPersonalScannerFeature({store,getPrevious,navigate,toast}){
 return {
  mount(root,view,subpage){
   if(view==='scanner'&&subpage==='edit')return mountScannerCustomize(root,{store,navigate,toast});
   const events=new AbortController();let error='',cancelPrompt=false,disposeFlow=()=>{},disposeFeedCopy=()=>{},disposeFeed=()=>{};
   if(view==='scanner'&&subpage==='edit'&&!store.state.draft&&!store.issue)store.begin();
   const editing=view==='scanner'&&subpage==='edit';
   document.body.classList.toggle('scanner-setup',editing);
   const source=()=>{const d=store.state.draft;return enabledSources(d.config).includes(d.source)?d.source:enabledSources(d.config)[0]||'public';};
   function notice(){
    if(!store.issue)return '';
    const message=store.issue==='conflict'?'This setup changed in another tab. Your edits are still here.':store.issue==='read'?'Your scanner setup could not be opened. It has not been overwritten.':'Changes are in this tab but could not be saved.';
    return `<div class="personal-error" role="alert">${message}<div class="scanner-recovery"><button type="button" class="text-link" data-primary-action="download">Download this work</button>${store.issue==='write'?'<button type="button" class="text-link" data-primary-action="retry">Try saving again</button>':'<button type="button" class="text-link" data-primary-action="reload">Load saved version</button>'}</div></div>`;
   }
   function home(){
    const c=store.effective;
    const heading=`<div class="page-intro scanner-intro"><h1>Scanner<span class="accent">.</span></h1>${hosted()?'<a class="how-link" href="#how">How it works</a>':''}</div>`;
    if(!c)return heading+notice();
    return heading+notice()+(hosted()?`<div class="scanner-layout">${scannerFlowHTML(c.name,c)}${scannerActivityHTML()}</div>`:scannerFlowHTML(c.name));
   }
   function finds(){
    return `<div class="page-intro"><h1>Feed<span class="accent">.</span></h1><a class="button glass" href="#scanner">Scanner</a></div>${notice()}${hosted()?coinFeedLoadingHTML():coinFeedPreviewHTML()}`;
   }
   function previous(){
    const previous=getPrevious();
    return `<a class="back-link" href="#profile">Back to Profile</a><div class="page-intro"><h1>Previous setups<span class="accent">.</span></h1></div><p class="field-help">Your earlier scanners are kept here. They aren’t running. You can copy one source’s rules into your new scanner.</p>${notice()}${previous.length?previous.map((item,index)=>`<details class="single-source-detail"><summary>${esc(item.name||'Unfinished draft')}${item.draft?' · Draft':''}</summary>${renderSettingsSummary(cleanSettings(item.filters,item))}<button type="button" class="button glass" data-primary-action="import" data-index="${index}">Use these rules</button></details>`).join(''):'<p class="empty">No previous setups.</p>'}`;
   }
   function wizard(){
    const d=store.state.draft;if(!d)return `<h1>Scanner setup</h1>${notice()}<a class="button glass" href="#scanner">Back to Scanner</a>`;
    const c=d.config,key=source(),r=c.sources[key].settings,enabled=enabledSources(c),step=steps.indexOf(d.screen)+1;
    let body='',title='',intro='';
    if(d.screen==='sources'){
     title='Customize your sources.';intro='Adjust what feeds into your finds.';
     body=`<fieldset class="purpose-options"><legend>Sources</legend>${Object.entries(sourceNames).map(([key,label])=>`<label class="purpose-option"><input type="checkbox" data-primary-source="${key}" ${c.sources[key].enabled?'checked':''}>${scannerBadge(marks[key])}<span class="purpose-copy"><strong>${label}</strong><small>${sourceCopy[key]}</small></span><span class="purpose-check" aria-hidden="true"></span></label>`).join('')}</fieldset><p class="field-help">Finds can come from any selected source. Each source keeps its own filters.</p>`;
    }else if(d.screen==='setup'){
     title={public:'Who should it follow?',projects:'How new is new?',market:'Which coins fit?'}[key];intro=`${sourceNames[key]} · Source ${enabled.indexOf(key)+1} of ${enabled.length}`;
     body=`<div id="personal-settings">${adapt(renderSettings(r,2))}</div>`;
    }else if(d.screen==='filters'){
     title='Fine-tune your results.';intro='Keep the defaults, or adjust each source.';
     body=`${enabled.length>1?`<div class="source-tabs" role="group" aria-label="Choose source to filter">${enabled.map(k=>`<button type="button" data-primary-action="filter-source" data-source="${k}" aria-pressed="${k===key}">${sourceNames[k]}</button>`).join('')}</div>`:''}<p class="filter-source-label">Filters for <strong>${sourceNames[key]}</strong></p><div id="personal-settings">${adapt(renderSettings(r,3))}</div>`;
    }else{
     title='Review your scanner.';intro='One feed, with your sources and rules.';
     body=`<div class="field name-field"><label for="primary-scanner-name">Scanner name</label><input id="primary-scanner-name" data-primary-field="name" maxlength="50" value="${esc(c.name)}"></div>${adapt(renderAppearance(c))}${enabled.map(k=>`<section class="review-source"><div class="builder-section-title"><h2>${sourceNames[k]}</h2><button type="button" class="text-link" data-primary-action="edit-source" data-source="${k}">Edit setup</button></div><p>${esc(scannerIntent(c.sources[k].settings))}</p><details class="single-source-detail"><summary>Chosen rules</summary><dl class="builder-plan">${ruleRows(c.sources[k].settings)}</dl><button type="button" class="text-link" data-primary-action="filter-source" data-source="${k}">Edit filters</button></details></section>`).join('')}<p class="builder-save-note">Saves your setup. Live monitoring isn’t connected yet.</p>`;
    }
    const next=d.screen==='review'?'Save setup':d.screen==='sources'?'Set up sources':d.screen==='setup'&&enabled.indexOf(key)<enabled.length-1?`Next: ${sourceNames[enabled[enabled.indexOf(key)+1]]}`:d.screen==='setup'?'Choose filters':'Review setup';
    return `<div class="builder-top"><button type="button" class="button glass scanner-save-exit" data-primary-action="exit">Save draft &amp; exit</button><span class="builder-preview-label">Step ${step} of 4</span></div><ol class="builder-progress" aria-label="Scanner setup progress">${['Sources','Set up','Filters','Review'].map((label,i)=>`<li ${i+1===step?'aria-current="step"':''} class="${i+1<step?'complete':''}"><span>${i+1<step?'✓':i+1}</span>${label}</li>`).join('')}</ol><header class="builder-heading"><h1>${title}</h1><p>${intro}</p></header>${notice()}<form id="personal-scanner-form" novalidate><div class="form-error-summary" role="alert" id="primary-errors" ${error?'':'hidden'}>${esc(error)}</div>${body}<div class="builder-actions"><button type="button" class="text-link" data-primary-action="back">${d.screen==='sources'?'Cancel':'Back'}</button><button class="button glass" type="submit" ${store.issue==='read'||store.issue==='conflict'?'disabled':''}>${next}</button></div></form><p class="builder-connection-note">Setup preview · Live monitoring isn’t connected.</p><p class="personal-device-note">${store.issue?'Changes kept in this tab':'Draft saved on this device'}</p>`;
   }
   function render(focus=false){
    disposeFlow();disposeFeedCopy();disposeFeed();
    document.title=(view==='finds'?'Feed':view==='previous'?'Previous setups':'Scanner')+' · Soltech';
    root.innerHTML=`<div class="page-width personal-scanner ${editing?'scanner-builder guided-builder':view==='scanner'?`scanner-flow-page${hosted()?' is-live':''}`:view==='finds'?'coin-feed-page':''}">${editing?wizard():view==='finds'?finds():view==='previous'?previous():home()}</div>`;
    disposeFlow=mountScannerFlow(root,{getConfig:()=>store.effective});
    disposeFeedCopy=view==='finds'?mountCoinFeedCopy(root,{toast}):()=>{};
    if(view==='finds'&&hosted()){const slot=root.querySelector('#live-feed');if(slot)disposeFeed=mountLiveFeed(slot,{getConfig:()=>store.effective,toast});}
    if(focus){const heading=root.querySelector('h1');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
   }
   function routeError(item){
    error=item.message;
    if(item.key==='sources')store.step('sources');else if(item.key==='name')store.step('review');else store.step(settingStep(item.key,store.state.draft.config.sources[item.source].settings)===2?'setup':'filters',item.source);
    render(true);
    const input=root.querySelector(item.key==='name'?'#primary-scanner-name':`[data-primary-setting="${item.key}"]`);
    if(input){input.setAttribute('aria-invalid','true');let node=input.parentElement;while(node){if(node.tagName==='DETAILS')node.open=true;node=node.parentElement;}const message=root.querySelector(`#setting-${item.key}-error`);if(message)message.textContent=item.message;input.focus();input.scrollIntoView({block:'center',behavior:'instant'});}
   }
   function change(event){
    const el=event.target,d=store.state.draft;if(!d)return;
    const c=d.config,key=source();
    if(el.dataset.primarySource){c.sources[el.dataset.primarySource].enabled=el.checked;store.update(c);}
    else if(el.dataset.primarySetting){
     const field=el.dataset.primarySetting,r=c.sources[key].settings;
     r[field]=el.dataset.list?(el.checked?[...new Set([...r[field],el.value])]:r[field].filter(v=>v!==el.value)):el.type==='checkbox'?el.checked:el.value;
     if(field==='liquidityMin')r.legacyLiquidity='';store.update(c);
     if(['stage','valuation','activityMetric','ageBasis','accountScope'].includes(field)){
      const open=[...root.querySelectorAll('details[open]')].map(x=>x.id),id=el.id;render();open.forEach(id=>{const node=root.querySelector('#'+id);if(node)node.open=true;});root.querySelector('#'+id)?.focus({preventScroll:true});
     }else{
      const template=document.createElement('template');template.innerHTML=adapt(renderSettings(store.state.draft.config.sources[key].settings,d.screen==='setup'?2:3));
      for(const selector of ['#setup-guidance','#risk-selection-summary',...Array.from(root.querySelectorAll('.settings-group')).map(x=>'#'+x.id+' > summary span')]){const old=root.querySelector(selector),next=template.content.querySelector(selector);if(old&&next)old.innerHTML=next.innerHTML;}
      if(field==='ageMax')root.querySelectorAll('[data-primary-action="age-shortcut"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===el.value)));
     }
    }else if(el.dataset.primaryField){c[el.dataset.primaryField]=el.value;store.update(c);if(el.dataset.primaryField!=='name'){const open=root.querySelector('.appearance-options')?.open;render();const picker=root.querySelector('.appearance-options');if(picker)picker.open=open;root.querySelector(`[data-primary-field="${el.dataset.primaryField}"][value="${el.value}"]`)?.focus({preventScroll:true});}}
    else return;
    error='';const banner=root.querySelector('#primary-errors');if(banner)banner.hidden=true;el.removeAttribute('aria-invalid');if(el.dataset.primarySetting)root.querySelector(`#setting-${el.dataset.primarySetting}-error`)?.replaceChildren();
    if(store.issue)render();
   }
   root.addEventListener('input',e=>{if(e.target.matches('input:not([type=radio]):not([type=checkbox]),textarea'))change(e);},{signal:events.signal});
   root.addEventListener('change',e=>{if(e.target.matches('select,input[type=radio],input[type=checkbox]'))change(e);},{signal:events.signal});
   root.addEventListener('click',e=>{
    const b=e.target.closest('[data-primary-action]');if(!b)return;
    const action=b.dataset.primaryAction,d=store.state.draft;
    if(action==='exit'){
     if(store.issue==='write')store.retry();
     if(store.issue){render();root.querySelector('.personal-error')?.scrollIntoView({block:'center',behavior:'instant'});return;}
     toast('Draft saved. Continue anytime.');navigate('scanner');return;
    }
    if(action==='filter-source'||action==='builder-step'){if(d){store.step('filters',b.dataset.source||source());render(true);}}
    if(action==='edit-source'){store.step('setup',b.dataset.source);render(true);}
    if(action==='age-shortcut'){const c=d.config;c.sources[source()].settings.ageMax=b.dataset.value;store.update(c);render();root.querySelector(`[data-primary-action="age-shortcut"][data-value="${b.dataset.value}"]`)?.focus({preventScroll:true});}
    if(action==='back'){
     error='';const enabled=enabledSources(d.config),key=source(),index=enabled.indexOf(key);
     if(d.screen==='sources'){cancelPrompt=true;root.querySelector('#primary-errors').hidden=false;root.querySelector('#primary-errors').innerHTML='Discard this unfinished setup? Your saved scanner stays unchanged. <button type="button" class="text-link" data-primary-action="confirm-cancel">Discard draft</button> <button type="button" class="text-link" data-primary-action="keep">Keep editing</button>';}
     else if(d.screen==='setup')store.step(index>0?'setup':'sources',enabled[index-1]||key);
     else if(d.screen==='filters')store.step('setup',enabled.at(-1));else store.step('filters',enabled[0]);
     if(d.screen!=='sources')render(true);
    }
    if(action==='keep'){cancelPrompt=false;error='';render();}
    if(action==='confirm-cancel'&&cancelPrompt){if(store.cancel())navigate('scanner');else render();}
    if(action==='retry'){store.retry();render();}
    if(action==='download'){const url=URL.createObjectURL(new Blob([store.export()],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='soltech-scanner-setup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    if(action==='reload'){root.querySelector('.scanner-recovery').innerHTML='<span>Download your local edits first if you want to keep them.</span><button type="button" class="text-link" data-primary-action="confirm-reload">Replace local edits with saved version</button>';}
    if(action==='confirm-reload'){store.reload();error='';render();}
    if(action==='import'){
     if(d){toast('Finish or discard your current setup before copying previous rules.');navigate('scanner/edit');return;}
     const item=getPrevious()[Number(b.dataset.index)];if(!item)return;const hadSaved=!!store.state.saved;store.begin();if(!store.state.draft){render();return;}const c=store.state.draft.config,r=cleanSettings(item.filters,item);if(!hadSaved)for(const branch of Object.values(c.sources))branch.enabled=false;c.sources[r.type]={enabled:true,settings:r};store.update(c);store.step('setup',r.type);navigate('scanner/edit');
    }
   },{signal:events.signal});
   root.addEventListener('submit',e=>{
    if(e.target.id!=='personal-scanner-form')return;e.preventDefault();error='';
    const d=store.state.draft,enabled=enabledSources(d.config),key=source();
    if(!enabled.length){routeError({key:'sources',message:'Choose at least one source.'});return;}
    if(d.screen==='setup'){
     const errors=Object.entries(stepErrors(d.config.sources[key].settings,2));
     if(errors.length){routeError({source:key,key:errors[0][0],message:errors[0][1]});return;}
     const next=enabled[enabled.indexOf(key)+1];store.step(next?'setup':'filters',next||enabled[0]);
    }else if(d.screen==='sources')store.step('setup',enabled[0]);
    else{
     const failures=personalScannerErrors(d.config).filter(item=>d.screen==='review'||item.key!=='name');
     if(failures.length){routeError(failures[0]);return;}
     if(d.screen==='filters')store.step('review');else{const result=store.save();if(result.ok){toast('Scanner setup saved. Monitoring is not connected.');navigate('scanner');return;}}
    }
    render(true);
   },{signal:events.signal});
   const onStorage=e=>{if(e.key==='soltech.scanner.v1'||e.key===null){if(editing){store.detectConflict();error='This setup changed in another tab. Your local draft is still here.';}else if(!store.issue)store.reload();render();}};
   window.addEventListener('storage',onStorage,{signal:events.signal});
   render();return ()=>{disposeFlow();disposeFeedCopy();disposeFeed();events.abort();};
  }
 };
}
