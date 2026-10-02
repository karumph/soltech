import {scannerBadge} from './scanner-appearance.js';
import {scannerIcons} from './scanner-icons.js';
import {library,coins,riskNames,defaults,approaches} from './data.js';
import {createWorkspace} from './workspace.js';
import {scannerTypes,cleanSettings,settingsErrors,accountHandles} from './scanner-settings.js';
import {renderSettings,renderSettingsSummary} from './scanner-editor.js';
import {renderBuilder,builderExample} from './scanner-builder.js';
import {formatFoundTime} from './daily-recap.js';
import {findingsForScanner,unreadFindings} from './scanner-findings.js';
import {mountChecker} from './coin-checker.js';
import {createProfileStore} from './profile-store.js';
import {createProfileFeature} from './profile.js';
let disposeChecker=null,disposeProfile=null;
const main=document.querySelector('#main');
const paths={arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',back:'<path d="M19 12H5m5-5-5 5 5 5"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6 6-2Z"/>',trend:'<path d="m3 17 6-6 4 4 8-10m-6 0h6v6"/>',layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',check:'<path d="m5 12 4 4L19 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',sliders:'<path d="M5 4v5m0 4v7M12 4v10m0 4v2M19 4v2m0 4v10M2 9h6m1 9h6m1-12h6"/>',folder:'<path d="M3 7V5h6l2 2h10v13H3V7Z"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',plus:'<path d="M12 5v14M5 12h14"/>'};
const icon=n=>scannerIcons[n]||`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[n]||paths.compass}</svg>`;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const workspace=createWorkspace({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
workspace.prepareWorkspace();
const profileStore=createProfileStore({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
const profileFeature=createProfileFeature({store:profileStore,getScanners:()=>workspace.state.savedScanners,getDraft:()=>workspace.state.draft,navigate,toast});
let {selected}=workspace.state.view;
let pendingDraft=null,successId=null;
const riskLabel=r=>`<span class="risk ${r}"><span class="risk-dot" aria-hidden="true"></span>${riskNames[r]}</span>`;
const mark=scannerBadge;
const scannerState=s=>s.placement==='active'?'Active':'Inactive';
const scannerStatus=s=>`<span class="scanner-status ${s.placement==='active'?'is-active':''}">${scannerState(s)}</span>`;
const findingScanner=id=>getSaved(id)||library.find(scanner=>scanner.id===id);
const unseenCount=scanner=>scanner.kind==='custom'?0:unreadFindings(scanner,workspace.state.seenFindings[scanner.id]||[]).length;
function coinRows(scanner,limit=Infinity){
 const groups=findingsForScanner(scanner).visible.slice(0,limit),saved=!!getSaved(scanner.id);
 return groups.map(({coin:c})=>{const isNew=saved&&!(workspace.state.seenFindings[scanner.id]||[]).includes(c.id);return `<button class="coin-row finding-row" data-action="coin" data-id="${c.id}" data-scanner="${esc(scanner.id)}" ><span class="coin-token ${c.tone}" aria-hidden="true">${c.name[0]}</span><span class="coin-info"><strong>${esc(c.name)} <span class="finding-new" data-coin-new="${c.id}" ${isNew?'':'hidden'}>Unread</span></strong><span>${esc(c.recapReason||c.reason)}</span></span>${riskLabel(c.risk)}<span class="row-arrow">${icon('arrow')}</span></button>`;}).join('')||'<p class="results-help">No example finds for this scanner.</p>';
}
function resultActions(scanner){const count=findingsForScanner(scanner).excluded.length;return `<div class="preview-foot"><button class="text-link" data-action="risk-help">Risk labels</button>${count?`<button class="text-link" data-action="excluded" data-id="${esc(scanner.id)}">Excluded · ${count}</button>`:''}</div>`;}
function updateFindingIndicators(scanner){
 const count=unseenCount(scanner);
 document.querySelectorAll('[data-unread-scanner]').forEach(el=>{if(el.dataset.unreadScanner===scanner.id){const card=el.closest('.saved-choice'),showCount=card?.dataset.collection==='saved'?0:count;el.textContent=`${showCount} unread`;el.hidden=showCount===0;}});
 document.querySelectorAll('.saved-choice').forEach(el=>{if(el.dataset.id===scanner.id){const showCount=el.dataset.collection==='saved'?0:count,arrow=el.querySelector('.card-open-arrow');if(arrow)arrow.hidden=showCount>0;el.setAttribute('aria-label',`Open ${scanner.name}${el.dataset.collection==='saved'?`, ${scannerState(scanner)}`:''}${showCount?`, ${showCount} new sample ${showCount===1?'find':'finds'}`:''}`);}});
 const seen=workspace.state.seenFindings[scanner.id]||[];
 document.querySelectorAll('[data-coin-new]').forEach(el=>{if(seen.includes(el.dataset.coinNew))el.hidden=true;});
}
function board(s){return `<article class="scanner-board"><header class="board-head ${s.tone}"><div class="board-meta"><span>${s.paid?'Example creator':'By Soltech'}</span></div><div class="board-title"><div><h2>${esc(s.name)}</h2><p>${esc(s.description)}</p></div></div>${libraryActions(s)}<p class="board-disclosure">Also added to Saved scanners.</p></header><div class="board-body">${scannerSetupNote(s)}<div class="section-line"><h3>Example finds</h3><span class="small">Fictional examples</span></div><div class="coin-list">${coinRows(s,2)}</div><div class="preview-foot"><a class="text-link" href="#preview/${s.id}">Full preview ${icon('arrow')}</a><button class="text-link" data-action="risk-help">Risk labels</button></div><p class="fine-print">No reported flags is not proof of safety. Missing information stays “Not assessed.”</p></div></article>`;}
function discover(){main.innerHTML=`<div class="page-intro find-intro"><h1>Find scanners<span class="accent">.</span></h1><button class="button glass create-scanner-button" data-action="new-scanner">Create scanner</button></div><div class="discovery-layout"><section class="chooser" aria-label="Choose a scanner"><div id="catalog"></div></section><section id="scanner-preview" aria-label="Selected scanner preview"></section></div><div id="result-count" class="sr-only" role="status"></div>`;renderCatalog();}
function renderCatalog(){let list=library.filter(s=>s.listed!==false);if(list.length&&!list.some(s=>s.id===selected))selected=list[0].id;document.querySelector('#catalog').innerHTML=list.length?list.map(s=>`<button class="scanner-choice catalog-choice ${selected===s.id?'selected':''}" data-action="select" data-id="${s.id}" aria-pressed="${selected===s.id}" aria-label="Preview ${esc(s.name)}">${mark(s)}<span class="choice-copy"><strong>${esc(s.name)}</strong><span>${esc(s.short)}</span></span><span class="choice-arrow">${icon('arrow')}</span></button>`).join(''):`<div class="empty compact"><h2>No scanners here yet.</h2><p>Available scanners will appear here.</p></div>`;document.querySelector('#scanner-preview').innerHTML=list.length?board(library.find(s=>s.id===selected)):'';document.querySelector('#result-count').textContent=`${list.length} ${list.length===1?'scanner':'scanners'} shown.`;}
const getSaved=id=>workspace.state.savedScanners.find(s=>s.id===id);
const scannerHome=s=>s?.placement==='saved'?'saved':'scanners';
const scannerHomeLabel=s=>s?.placement==='saved'?'Saved scanners':'Active scanners';
function libraryActions(s){const existing=workspace.state.savedScanners.find(x=>x.kind==='library'&&x.sourceId===s.id);return `<div class="board-actions">${existing?.placement==='active'?`<button class="button primary" data-action="select-saved" data-id="${existing.id}">Open scanner ${icon('arrow')}</button>`:`<button class="button glass" data-action="add" data-id="${s.id}">Use scanner ${icon('plus')}</button>`}<button class="text-link" data-action="customize" data-id="${s.id}">Customize</button></div>`;}
function decorate(s){const source=library.find(x=>x.id===s.sourceId);return {...(source||{tone:'lilac',icon:'sliders',number:'',type:'Personal scanner'}),...s,creator:s.kind==='custom'?'You':source?.creator||'You',criteria:{...s}};}
function sync(){const note=document.querySelector('#storage-notice');note.hidden=!workspace.issue;note.innerHTML=workspace.issue==='conflict'?'Another preview changed your saved work. These edits are safe in this tab. <button data-action="export">Download these edits</button><button data-action="review-conflict">Load saved version</button>':workspace.issue==='read'?'Saved data couldn’t be opened. Your existing data has not been changed. Work in this tab is temporary. <button data-action="export">Download this work</button>':'Your work is still in this tab, but couldn’t be saved on this device. <button data-action="retry">Try saving again</button><button data-action="export">Download this work</button>';}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),5500);}
function navigate(hash){if(location.hash===`#${hash}`){route();focusHeading();}else location.hash=hash;}
function focusHeading(){const panel=(/^#(scanners|saved)\//.test(location.hash))?main.querySelector('#selected-scanner-title'):null;const el=(panel?.getClientRects().length?panel:null)||main.querySelector('h1')||main;el.setAttribute('tabindex','-1');el.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
const dialog=document.querySelector('#detail-dialog');
function showDialog(title,body,footer='',label='A closer look'){dialog.innerHTML=`<div class="dialog-content"><div class="dialog-top"><span>${label}</span><button class="icon-button" data-action="close" aria-label="Close dialog">${icon('close')}</button></div><h2 id="dialog-title">${title}</h2>${body}</div><div class="dialog-footer">${footer||'<button class="button primary" data-action="close">Got it</button>'}</div>`;dialog.showModal();}
function coinDetails(id,scannerId){
 const c=coins.find(x=>x.id===id);
 if(!c){showDialog('Coin unavailable','<p>Coin details unavailable. Close to return.</p>','','Coin overview');return;}
 const scanner=findingScanner(scannerId),results=scanner?findingsForScanner(scanner):null;
 const matches=results?[...results.visible,...results.excluded].find(group=>group.coin.id===id)?.matches||[]:[];
 if(getSaved(scannerId)&&results?.visible.some(group=>group.coin.id===id)){workspace.markFindingSeen(scannerId,id);updateFindingIndicators(scanner);sync();}
 const context=`<section class="dialog-section"><h3>Why it matched</h3><ul class="match-list">${matches.length?matches.map(match=>`<li><strong>${esc(scanner?.name||'Scanner unavailable')}</strong><span class="match-time">${match.scannerId==='balanced'?'Public-post example':'Launch-listing example'} · ${esc(formatFoundTime(match.foundAt))}</span><p>${esc(match.reason||'Match reason unavailable.')}</p></li>`).join(''):'<li><p>Match details unavailable.</p></li>'}</ul></section>`;
 showDialog(`${esc(c.name)} <span class="dialog-symbol">${esc(c.symbol)}</span>`,`<section class="dialog-section coin-summary"><h3>What is ${esc(c.name)}?</h3><p>${esc(c.summary||'There isn’t enough information to summarize this coin.')}</p></section><div class="coin-risk-panel ${c.risk}">${riskLabel(c.risk)}<p>${esc(c.reason)}</p></div>${context}<section class="dialog-section"><h3>Risk checks</h3>${c.checks.map(([label,body])=>`<details class="check-detail"><summary>${esc(label)}</summary><p>${esc(body)}</p></details>`).join('')}</section>`,'','Coin overview · Fictional example');
}
function excludedCoins(scannerId){
 const scanner=findingScanner(scannerId);if(!scanner)return;
 const {excluded}=findingsForScanner(scanner);
 showDialog('Excluded coins',`<p>High-risk coins are kept out of the main list.</p><ul class="excluded-list">${excluded.map(({coin:c})=>`<li><div><strong>${esc(c.name)}</strong>${riskLabel(c.risk)}</div><p>${esc(c.reason)}</p></li>`).join('')||'<li>No excluded coins.</li>'}</ul>`,'','Fictional examples');
}
function dailyRecap(){collection();}
function riskHelp(){showDialog('A signal. Not a guarantee.',`<p>Risk labels show reported concerns, not price predictions or buy advice.</p><div class="risk-guide">${[['lower','No flags in the checks shown. This is not proof of safety.'],['caution','A concern needs a closer look. Read the reason beside the label.'],['high','Significant concerns appear in the checks.'],['unknown','Information is missing. This is never treated as low risk.']].map(([r,t])=>`<div>${riskLabel(r)}<p>${t}</p></div>`).join('')}</div>`,'','Understanding risk');}
function rules(s){const f=s.criteria||s;return renderSettingsSummary(cleanSettings(f.filters,{...f,sourceId:s.sourceId||s.id}));}
function preview(id,saved=false,origin=null){const raw=saved?getSaved(id):library.find(s=>s.id===id);if(!raw){unavailable();return;}if(saved){const home=origin==='saved'?'saved':scannerHome(raw);document.title=`${raw.name} · Soltech`;main.innerHTML=`<div class="page-width"><a class="back-link" href="#${home}/${raw.id}">${icon('back')} ${home==='saved'?'Saved scanners':'Active scanners'}</a>${savedPanel(raw,'h1')}</div>`;return;}const s=raw;const hasSaved=workspace.state.savedScanners.find(x=>x.kind==='library'&&x.sourceId===id);document.title=`${s.name} · Soltech`;main.innerHTML=`<div class="page-width"><a class="back-link" href="${saved?'#scanners/'+id:'#explore'}">${icon('back')} ${saved?'Your scanners':'All scanners'}</a>${successId===id?`<div class="success-banner" role="status">${icon('check')}<div><strong>${workspace.issue?'Kept in this tab.':'A good find. It’s yours.'}</strong><span>${workspace.issue?'Device storage is unavailable. Download your work above.':'Saved to Your scanners on this device. No live scan has started.'}</span></div><a href="#scanners">Your scanners ${icon('arrow')}</a></div>`:''}<div class="detail-layout"><section class="scanner-board detail-board"><header class="board-head ${s.tone}"><div class="board-meta"><span>${saved?'Your scanner':s.paid?'Example creator · Sample listing':'By Soltech · Free'}</span></div><div class="board-title"><div><h1>${esc(s.name)}</h1><p>${esc(s.description)}</p></div>${mark(s)}</div>${libraryActions(s)}${s.paid&&!saved?'<p class="board-disclosure">Illustrative paid listing. No creator endorsement, price or checkout is connected.</p>':`<p class="board-disclosure">Also added to Saved scanners.</p>`}</header><div class="board-body">${scannerSetupNote(s)}<div class="section-line"><h2 class="section-title">Example coins</h2><span class="small">Fictional data</span></div><p class="results-help">Select a coin for its summary and risk details.</p><div class="coin-list">${coinRows(s)}</div>${resultActions(s)}<p class="fine-print">Sample finds · Filters aren’t applied. High-risk coins are in Excluded.</p></div></section><aside class="rules-panel"><details class="preview-settings"><summary>Scanner settings</summary>${rules(s)}<details class="dark-details"><summary>What does liquidity mean?</summary><p>How easily a coin can be bought or sold. Limited liquidity can make trading difficult.</p></details><p class="small muted">Risk checks stay included. Missing information stays “Not assessed.”</p>${s.sourceId&&s.kind==='custom'?`<p class="attribution">Your copy of ${esc(library.find(x=>x.id===s.sourceId)?.name)}<br>Originally by ${esc(library.find(x=>x.id===s.sourceId)?.creator)}.</p>`:''}${saved?`<button class="text-link remove-link" data-action="remove" data-id="${id}">Remove from Your scanners</button>`:''}</details></aside></div></div>`;}
function savedPanel(raw,heading='h2'){
 const s=decorate(raw);
 return `<article class="scanner-board home-board"><header class="board-head ${s.tone}"><div class="board-meta"><span>${scannerStatus(s)} · Scanner setup</span></div><div class="board-title"><${heading} id="selected-scanner-title">${esc(s.name)}</${heading}>${mark(s)}</div><div class="board-actions scanner-management-actions"><button class="button glass" data-action="edit" data-id="${s.id}">${icon('sliders')} Edit</button>${s.placement==='saved'?`<button class="button glass" data-action="activate" data-id="${s.id}">Use scanner ${icon('plus')}</button>`:`<button class="button glass" data-action="set-aside" data-id="${s.id}">Deactivate</button>`}</div></header><div class="board-body">${scannerSetupNote(s)}${s.kind==='custom'?`<p class="setup-note">Your rules are saved for when monitoring is connected.</p>${builderExample(s.filters)}`:`<div class="section-line"><${heading==='h1'?'h2':'h3'} class="coins-title">Finds</${heading==='h1'?'h2':'h3'}><span class="new-findings-badge" data-unread-scanner="${s.id}" ${unseenCount(raw)?'':'hidden'}>${unseenCount(raw)} unread examples</span></div><div class="coin-list">${coinRows(s)}</div>${resultActions(s)}<p class="fine-print">Sample finds · Filters aren’t applied. Open an example to mark it read.</p>`}<details class="saved-rules"><summary>Scanner settings</summary>${s.description?`<p>${esc(s.description)}</p>`:''}${rules(s)}<button class="text-link remove-link" data-action="remove" data-id="${s.id}">Delete scanner</button></details></div></article>`;
}
function collectionChoice(raw,current,placement){
 const s=decorate(raw),count=placement==='active'?unseenCount(raw):0;
 return `<button class="scanner-choice saved-choice ${s.id===current.id?'selected':''}" data-action="select-saved" data-id="${s.id}" data-collection="${placement}" aria-pressed="${s.id===current.id}" aria-label="Open ${esc(s.name)}${placement==='saved'?`, ${scannerState(raw)}`:''}${count?`, ${count} new sample ${count===1?'find':'finds'}`:``}">${mark(s)}<span class="choice-copy"><strong>${esc(s.name)}</strong>${placement==='saved'?`<small>${scannerStatus(raw)}</small>`:''}</span><span class="choice-trailing"><span class="new-findings-badge" data-unread-scanner="${s.id}" ${count?'':'hidden'}>${count} unread</span><span class="card-open-arrow" ${count?'hidden':''}>${icon('arrow')}</span></span></button>`;
}
function scannerSetupNote(s){const f=s.filters||s.criteria?.filters;return '<div class="scanner-service">'+icon('info')+'<div><strong>Monitoring not connected</strong><span>This saves your setup. No live scan is running.</span></div></div>'+ (f?.type==='public'&&!accountHandles(f.accounts||'').length?'<p class="setup-note">No X accounts chosen. <button class="text-link" data-action="'+(getSaved(s.id)?'edit':'customize')+'" data-id="'+esc(s.id)+'">Choose accounts</button></p>':'');}

function collection(id,placement='active'){
 const label=placement==='saved'?'Saved scanners':'Active scanners';
 document.title=label+' · Soltech';
 const scanners=workspace.state.savedScanners.filter(s=>placement==='saved'||(s.placement||'active')==='active');
 const current=scanners.find(s=>s.id===id)||scanners[0];
 main.innerHTML=`${placement==='saved'?`<a class="back-link" href="#profile">${icon('back')} Profile</a>`:''}<div class="page-intro workspace-intro ${placement==='active'?'active-intro':''}"><h1>${label}<span class="accent">.</span></h1><button class="preview-label" data-action="about">UI preview ${icon('info')}</button></div>${placement==='active'&&scanners.length?'<p class="collection-context">Monitoring not connected · Examples only</p>':placement==='saved'?'<p class="collection-context">All your scanners, including Active.</p>':''}${successId===current?.id?`<div class="saved-confirmation" role="status">${icon('check')} ${workspace.issue?'Kept in this tab. Device storage is unavailable.':`Added to ${label.toLowerCase()}.`}</div>`:''}${scanners.length?`<div class="discovery-layout workspace-layout"><section class="chooser saved-chooser" aria-label="${label}">${scanners.map(raw=>collectionChoice(raw,current,placement)).join('')}<button class="text-link new-scanner-link" data-action="choose-new">${icon('plus')} New scanner</button></section><section id="saved-panel" aria-label="Selected scanner">${savedPanel(current)}</section></div>`:`<section class="empty collection-empty">${placement==='saved'?'<h2>Your saved scanners</h2>':''}${placement==='saved'?`<p>Scanners you use appear here.</p><a class="button glass" href="#explore">Find scanners ${icon('arrow')}</a>`:`<button class="button glass first-scanner-button" data-action="choose-new">${icon('plus')} Add scanner</button>`}</section>`}${workspace.issue||placement==='saved'?`<p class="collection-note">${icon('info')} ${workspace.issue?'Kept in this tab only.':'Saved on this device.'}</p>`:''}<button class="text-link workspace-export" data-action="export">Download scanner backup</button>`;
}
function scannerContext(id){const [view,,origin]=location.hash.slice(1).split('/');return view==='saved'||(view==='scanner'&&origin==='saved')?'saved':scannerHome(getSaved(id));}
function openSaved(id,home=scannerHome(getSaved(id))){navigate(matchMedia('(max-width:800px)').matches?`scanner/${id}${home==='saved'?'/saved':''}`:`${home}/${id}`);}

function requestDraft(mode,scanner){if(workspace.state.draft){pendingDraft={mode,scanner};showDialog('Keep your unfinished work?',`<p>You have a draft of <strong>${esc(workspace.state.draft.fields.name||'Untitled scanner')}</strong>. Continue editing it, or replace it with this ${mode==='edit'?'edit':'new draft'}.</p>`,`<button class="button secondary" data-action="replace-draft">Replace draft</button><button class="button primary" data-action="resume-draft">Continue my draft</button>`,'Unfinished draft');return;}workspace.beginDraft({mode,scanner});sync();navigate('builder');}
function builder(){
 if(!workspace.state.draft){document.title='Create scanner · Soltech';main.innerHTML='<div class="page-width"><div class="page-intro"><h1>Create a scanner</h1></div><p>Choose what to watch and keep your rules in Saved scanners.</p><button class="button glass" data-action="new-scanner">Create scanner</button><a class="back-link" href="#profile">Back to Profile</a></div>';return;}
 const repairedReview=workspace.state.draft.step===3&&Object.keys(settingsErrors(workspace.state.draft.fields.filters)).length;
 if(repairedReview)workspace.step(2);
 const d=workspace.state.draft;
 document.title=(d.mode==='edit'?'Edit':'Create')+' scanner · Soltech';
 main.innerHTML=renderBuilder(d,{issue:!!workspace.issue,recovered:d.mode==='edit'&&!getSaved(d.editingId)});
 sync();
 if(repairedReview)validateEditor();
}
function refreshSettings(focusId){
 const section=document.querySelector('#scanner-settings');
 const open=[...section.querySelectorAll('details[open]')].map(e=>e.id);
 section.innerHTML=renderSettings(workspace.state.draft.fields.filters);
 open.forEach(id=>{const el=document.getElementById(id);if(el)el.open=true;});
 if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
}
function refreshSettingSummaries(){
 const template=document.createElement('template');
 template.innerHTML=renderSettings(workspace.state.draft.fields.filters);
 template.content.querySelectorAll('.settings-group').forEach(group=>{
  const current=document.getElementById(group.id)?.querySelector('summary span');
  if(current)current.textContent=group.querySelector('summary span').textContent;
 });
}
function validateEditor(){
 const f=workspace.state.draft.fields,errors=settingsErrors(f.filters);
 if(workspace.state.draft.step===3&&!f.name.trim())errors.name='Add a name so you can find your scanner again.';
 document.querySelectorAll('#scanner-form [aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
 document.querySelectorAll('#scanner-form .field-error').forEach(el=>el.textContent='');
 const entries=Object.entries(errors),summary=document.getElementById('form-errors');
 summary.hidden=!entries.length;
 summary.textContent=entries.length?'Check the highlighted choices below.':'';
 for(const [key,message] of entries){
  const control=key==='name'?document.getElementById('scanner-name'):document.getElementById('setting-'+key)||document.querySelector('[data-setting="'+key+'"]');
  const messageEl=document.getElementById(key==='name'?'name-error':'setting-'+key+'-error');
  if(messageEl)messageEl.textContent=message;
  if(control){control.setAttribute('aria-invalid','true');control.closest('fieldset')?.setAttribute('aria-invalid','true');let parent=control.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}}
 }
 if(entries.length){const key=entries[0][0];const control=key==='name'?document.getElementById('scanner-name'):document.getElementById('setting-'+key)||document.querySelector('[data-setting="'+key+'"]');control?.focus();control?.scrollIntoView({block:'center',behavior:'instant'});}
 return !entries.length;
}
function unavailable(){main.innerHTML=`<div class="page-intro"><h1>Let’s find your way back.</h1></div><div class="empty"><h2>This scanner isn’t here.</h2><p>It may have been removed or saved in another browser. Check Saved scanners and drafts.</p><a class="button glass" href="#saved">Open Saved scanners ${icon('arrow')}</a></div>`;}
function addScanner(id){const result=workspace.saveLibrary(id);if(!result)return;const alreadyActive=result.existing&&result.scanner.placement==='active';if(result.scanner.placement==='saved')workspace.move(result.scanner.id,'active');sync();successId=result.scanner.id;openSaved(result.scanner.id);toast(alreadyActive?'Already in Active scanners.':'Added to Active and Saved scanners.');}
function removeScanner(id){const s=getSaved(id);if(!s)return;showDialog('Delete this scanner?',`<p><strong>${esc(s.name)}</strong> will be removed from ${s.placement==='active'?'Active and Saved scanners':'Saved scanners'}. ${workspace.state.draft?.editingId===id?'Your unfinished edit stays in Profile under Continue draft.':s.kind==='library'&&library.some(source=>source.id===s.sourceId&&source.listed!==false)?'You can add it again from Find scanners.':'These custom settings will be deleted.'}</p>`,`<button class="button secondary" data-action="close">Keep scanner</button><button class="button danger" data-action="confirm-remove" data-id="${id}">Delete scanner</button>`,'Your collection');}
document.addEventListener('click',e=>{
 if(e.target.closest('.skip')){e.preventDefault();main.focus();return;}
 const b=e.target.closest('[data-action]');if(!b)return;const id=b.dataset.id,a=b.dataset.action;
 if(a==='select-saved')openSaved(id,scannerContext(id));
 if(a==='age-shortcut'){workspace.updateDraft({filters:{...workspace.state.draft.fields.filters,ageMax:b.dataset.value}});refreshSettings();document.querySelector(`[data-action="age-shortcut"][data-value="${b.dataset.value}"]`)?.focus();sync();}
 if(a==='browse-scanners')navigate('explore');
 if(a==='browse-saved')navigate('saved');
 if(a==='choose-new')showDialog('New scanner','',`<div class="scanner-options"><button class="button glass" data-action="browse-scanners"><span class="option-label">${icon('compass')} Find</span>${icon('arrow')}</button><button class="button glass" data-action="browse-saved"><span class="option-label">${icon('layers')} Saved</span>${icon('arrow')}</button><button class="button glass" data-action="new-scanner"><span class="option-label">${icon('plus')} Create</span>${icon('arrow')}</button></div>`,'Your scanners');
 if(a==='new-scanner'){e.preventDefault();if(dialog.open)dialog.close();requestDraft('new',null);}
 if(a==='select'){selected=id;workspace.setView({selected});if(matchMedia('(max-width:800px)').matches)navigate(`preview/${id}`);else{renderCatalog();document.querySelector(`[data-action="select"][data-id="${id}"]`)?.focus({preventScroll:true});document.querySelector('#result-count').textContent=`${library.find(s=>s.id===id).name} preview selected.`;}}
 if(a==='close')dialog.close();
 if(a==='coin')coinDetails(id,b.dataset.scanner);
 if(a==='excluded')excludedCoins(id);
 if(a==='risk-help')riskHelp();
 if(a==='about')showDialog('A little clarity.',`<p><strong>Check a coin</strong> retrieves real token data from DEX Screener, Rugcheck or GoPlus, and GeckoTerminal. Supported networks appear in the checker. Data may be incomplete or delayed; it does not refresh automatically.</p><p><strong>Scanners show fictional finds.</strong> Live scans, wallets, payments and trades aren’t connected.</p><p>Scanners and drafts stay in this browser, without account sync. Coin checks stay in this tab.</p>`,'','About Soltech');
 if(a==='add')addScanner(id);
 if(a==='activate'||a==='set-aside'){const scanner=workspace.move(id,a==='activate'?'active':'saved');if(scanner){sync();a==='activate'?openSaved(id):navigate('scanners');toast(a==='activate'?'Added to Active and Saved scanners.':'Deactivated. Kept in Saved scanners.');}}
 if(a==='customize')requestDraft('customize',library.find(s=>s.id===id));
 if(a==='edit')requestDraft('edit',getSaved(id));
 if(a==='resume-draft'){pendingDraft=null;dialog.close();navigate('builder');}
 if(a==='replace-draft'){workspace.beginDraft(pendingDraft);pendingDraft=null;dialog.close();sync();navigate('builder');}
 if(a==='builder-step'){workspace.step(Number(b.dataset.step));builder();focusHeading();}

 if(a==='discard')showDialog('Let this draft go?',`<p>Your saved scanners stay as they are. Only this unfinished draft will be discarded.</p>`,`<button class="button secondary" data-action="close">Keep editing</button><button class="button danger" data-action="confirm-discard">Discard draft</button>`,'Unfinished draft');
 if(a==='confirm-discard'){workspace.discardDraft();dialog.close();sync();history.replaceState(null,'','#scanners');route();focusHeading();toast('Draft discarded. Your saved scanners are unchanged.');}
 if(a==='remove')removeScanner(id);
 if(a==='confirm-remove'){const home=scannerContext(id);workspace.remove(id);dialog.close();successId=null;sync();navigate(home);toast('Scanner removed.');}

 if(a==='retry'){workspace.retry();sync();if(!workspace.issue)toast('Your work is saved on this device.');}
 if(a==='review-conflict')showDialog('Load the other version?', '<p>Download these edits first if you want to keep both. Reloading replaces the work in this tab with the latest saved version.</p>', '<button class="button secondary" data-action="close">Keep this tab</button><button class="button primary" data-action="load-saved-workspace">Load saved version</button>', 'Saved work changed');
 if(a==='load-saved-workspace')location.reload();
 if(a==='export'){const url=URL.createObjectURL(new Blob([workspace.export()],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='soltech-workspace.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
});
function updateInput(e){
 const el=e.target;if(!el.isConnected||!workspace.state.draft||(!el.dataset.field&&!el.dataset.setting))return;
 if(el.dataset.setting){
  const key=el.dataset.setting,current=workspace.state.draft.fields.filters;
  const value=el.dataset.list?(el.checked?[...new Set([...current[key],el.value])]:current[key].filter(v=>v!==el.value)):el.type==='checkbox'?el.checked:el.value;
  workspace.updateDraft({filters:{...current,[key]:value,...(key==='liquidityMin'?{legacyLiquidity:''}:{})}});
  if(['type','stage','valuation','activityMetric','ageBasis'].includes(key))refreshSettings(el.id);else refreshSettingSummaries();
  document.getElementById('setting-'+key+'-error')?.replaceChildren();
 }else {workspace.updateDraft({[el.dataset.field]:el.value});if(el.dataset.field==='badgeSymbol'||el.dataset.field==='badgeColor'){const badge=document.getElementById('scanner-badge-preview');if(badge)badge.innerHTML=scannerBadge({...workspace.state.draft.fields,sourceId:workspace.state.draft.sourceId});document.querySelectorAll('.appearance-colors label').forEach(label=>{label.querySelector('.scanner-mark').outerHTML=scannerBadge({...workspace.state.draft.fields,sourceId:workspace.state.draft.sourceId,badgeColor:label.querySelector('input').value});});}}
 if(el.dataset.setting==='ageMax')document.querySelectorAll('[data-action="age-shortcut"]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.value===el.value)));
 const status=document.querySelector('#draft-status');if(status)status.textContent=workspace.issue?'Kept in this tab only':'Draft saved on this device';
 el.removeAttribute('aria-invalid');
 if(el.dataset.field==='name')document.querySelector('#name-error').textContent='';
 const alert=document.getElementById('form-errors');if(alert)alert.hidden=true;
 sync();
}
document.addEventListener('input',e=>{if(e.target.matches('input:not([type="radio"]):not([type="checkbox"]),textarea'))updateInput(e);});
document.addEventListener('change',e=>{if(e.target.dataset.purpose){workspace.choosePurpose(e.target.dataset.purpose);document.getElementById('purpose-error').textContent='';document.querySelector('.purpose-options').removeAttribute('aria-invalid');document.getElementById('form-errors').hidden=true;sync();return;}if(e.target.matches('select,input[type="checkbox"],input[type="radio"]'))updateInput(e);});
document.addEventListener('submit',e=>{
 if(e.target.id!=='scanner-form')return;e.preventDefault();const d=workspace.state.draft;
 if(d.step===1){
  if(!d.purposeChosen){const alert=document.getElementById('form-errors');alert.hidden=false;alert.textContent='Choose what you want to watch.';document.querySelector('.purpose-options').setAttribute('aria-invalid','true');document.querySelector('[data-purpose]')?.focus();return;}
  workspace.step(2);builder();focusHeading();return;
 }
 if(d.step===3&&Object.keys(settingsErrors(d.fields.filters)).length){workspace.step(2);builder();validateEditor();return;}
 if(!validateEditor())return;
 if(d.step===2){workspace.step(3);builder();focusHeading();return;}
 const result=workspace.saveDraft();if(!result)return;
 successId=result.existing?null:result.scanner.id;sync();const home=scannerHome(result.scanner);history.replaceState(null,'','#'+(matchMedia('(max-width:800px)').matches?`scanner/${result.scanner.id}${home==='saved'?'/saved':''}`:`${home}/${result.scanner.id}`));route();focusHeading();
 toast(workspace.issue?'Kept in this tab only.':result.existing?'Changes saved.':'Saved to Profile. No live scan has started.');
});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
function route(){disposeChecker?.();disposeChecker=null;disposeProfile?.();disposeProfile=null;const hash=location.hash.slice(1)||'check';const [view,id,origin]=hash.split('/');document.body.classList.toggle('scanner-setup',view==='builder');if(dialog.open)dialog.close();main.setAttribute('aria-busy','true');document.title='Find scanners · Soltech';if(['check','home','main'].includes(view))disposeChecker=mountChecker(main);else if(['profile','settings'].includes(view))disposeProfile=profileFeature.mount(main,view,id);else if(view==='explore')discover();else if(view==='scanners')collection(id);else if(view==='saved')collection(id,'saved');else if(view==='recap')dailyRecap();else if(view==='builder')builder();else if(view==='preview')preview(id);else if(view==='scanner'){if(getSaved(id))preview(id,true,origin==='saved'?'saved':null);else if(library.some(s=>s.id===id))preview(id);else unavailable();}else if(view==='start')preview('balanced');else unavailable();const currentNav=['check','home','main'].includes(view)?'check':['profile','settings','saved','builder'].includes(view)?'profile':view==='scanner'&&getSaved(id)?(scannerContext(id)==='saved'?'profile':'scanners'):['scanners','recap'].includes(view)?'scanners':'explore';const nav=document.querySelector('.main-nav');nav.style.setProperty('--nav-index',['check','scanners','explore','profile'].indexOf(currentNav));document.querySelectorAll('[data-nav]').forEach(el=>{if(el.dataset.nav===currentNav)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});sync();successId=null;main.setAttribute('aria-busy','false');}
window.addEventListener('hashchange',()=>{route();focusHeading();});
if(document.modelContext?.registerTool){const lifecycle=new AbortController();try{Promise.resolve(document.modelContext.registerTool({name:'open_soltech_preview_view',title:'Open a Soltech preview view',description:'Navigate Soltech. Check opens the live coin lookup form without submitting it; scanners are previews. Does not create a scanner or start scanning.',inputSchema:{type:'object',properties:{view:{type:'string',enum:['check','explore','scanners','profile','saved','builder']}},required:['view'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||!['check','explore','scanners','profile','saved','builder'].includes(input.view)||Object.keys(input).length!==1)throw new Error('Choose check, explore, scanners, profile, saved, or builder.');navigate(input.view);return {view:input.view,mode:input.view==='check'?'Live lookup form':'Scanner preview',liveScanning:false};}},{signal:lifecycle.signal})).catch(()=>{});window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}catch{}}
route();

