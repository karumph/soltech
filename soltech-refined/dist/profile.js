import {profileShortcutIcons} from './profile-shortcut-icons.js';
import {avatarColors,loadProfilePhoto} from './profile-store.js';
import {choosePhotoCrop} from './photo-crop.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const glyphs={person:'<circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',gear:'<path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 3 3-1 1-3 3-1 2-3-2-2 1-3-3-2-3 1-2-3Z"/><circle cx="11.5" cy="11" r="3"/>',arrow:'<path d="m9 5 7 7-7 7"/>',back:'<path d="M19 12H5m6-6-6 6 6 6"/>',bell:'<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 3h4"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',file:'<path d="M14 3H6v18h12V7l-4-4Zm0 0v5h4M9 12h6m-6 4h6"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',bookmark:'<path d="M6 3h12v18l-6-4-6 4V3Z"/>'};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphs[name]}</svg>`;
const avatarSymbol=()=>'<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="profile-silver" x1="0" y1="0" x2="0.7" y2="1"><stop stop-color="#ffffff"/><stop offset=".55" stop-color="#fbfcff"/><stop offset="1" stop-color="#d9e2ef"/></linearGradient></defs><g fill="url(#profile-silver)" stroke="#ffffff" stroke-width=".6"><circle cx="24" cy="15" r="7.3"/><path d="M24 25c-8.1 0-14 4.8-14 10.7v1.5c0 1 .8 1.8 1.8 1.8h24.4c1 0 1.8-.8 1.8-1.8v-1.5C38 29.8 32.1 25 24 25Z"/></g></svg>';
const avatar=p=>`<span class="personal-avatar avatar-${p.color}" aria-hidden="true">${p.photo?`<img src="${p.photo}" alt="">`:avatarSymbol()}</span>`;
const back=(href,label)=>`<a class="back-link" href="#${href}">${icon('back')} ${label}</a>`;
const row=(href,title,detail,symbol,tail='')=>`<a class="personal-row" href="#${href}"><span class="personal-row-icon${profileShortcutIcons[symbol]?` personal-shortcut-icon shortcut-${symbol}`:''}">${profileShortcutIcons[symbol]||icon(symbol)}</span><span class="personal-row-copy"><strong>${title}</strong>${detail?`<span>${detail}</span>`:''}</span>${tail}${icon('arrow')}</a>`;
const identity=p=>({name:p.name,color:p.color,photo:p.photo});

export function createProfileFeature({store,getScanners,getDraft,getScannerState=()=>({saved:null,draft:null}),navigate,toast}) {
 let editDraft=null,notificationDraft=null,editBase=null,notificationBase=null;
 const editDirty=()=>Boolean(editDraft&&JSON.stringify(editDraft)!==JSON.stringify(editBase));
 const notificationDirty=()=>Boolean(notificationDraft&&JSON.stringify(notificationDraft)!==JSON.stringify(notificationBase));
 const dirty=()=>editDirty()||notificationDirty();
 window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
 return {
  mount(root,view,subpage) {
   const events=new AbortController();let photoJob=null,busy=false,disposed=false,error='',message='',conflict=false;
   store.retry();
   const returnView=view==='profile'?'profile':'settings';
   const returnLabel=returnView==='profile'?'Profile':'Settings';
   const page=view==='profile'?(['edit','notifications'].includes(subpage)?subpage:'profile'):(['notifications','privacy','terms'].includes(subpage)?subpage:'settings');
   const title={profile:'Profile',edit:'Edit profile',settings:'Settings',notifications:'Notifications',privacy:'Privacy',terms:'Terms of Service'}[page];
   document.title=`${title} · Soltech`;
   if(page==='edit'&&!editDraft){editDraft=identity(store.value);editBase=identity(store.value);}
   if(page==='notifications'&&!notificationDraft){notificationDraft=store.value.notifications;notificationBase=store.value.notifications;}
   const notice=()=>store.issue==='read'?'<div class="personal-error" role="alert">Your saved profile couldn’t be opened. It hasn’t been changed. <button type="button" class="text-link" data-profile-action="retry">Try again</button></div>':'';
   function render() {
    const p=store.value,scanners=getScanners();let body='';
    if(page==='profile') {
     const draft=getDraft(),primary=getScannerState();
     body=`<div class="page-intro personal-heading"><h1>Profile<span class="accent">.</span></h1></div>${notice()}<section class="personal-identity" aria-label="Your profile">${avatar(p)}<div class="personal-identity-copy"><h2>${esc(p.name||'Your space')}</h2><span>${p.name?'Your Soltech profile':'Name, photo & color'}</span></div><a class="button glass personal-edit" href="#profile/edit" aria-label="${editDirty()?'Continue editing profile':'Edit profile'}">${editDirty()?'Continue':'Edit'}</a></section><section class="personal-section" aria-labelledby="personal-library-title"><h2 id="personal-library-title">Your scanner</h2><div class="personal-rows personal-library">${row('scanner/edit','Scanner settings',primary.saved?'Your sources and filters':'Soltech defaults · Customize anytime','saved')}</div>${primary.draft?`<div class="personal-rows personal-draft">${row('scanner/edit','Continue setup','Your unfinished changes','draft')}</div>`:''}${scanners.length||draft?`<details class="personal-previous"><summary>Previous setups</summary><div class="personal-rows">${row('previous','Earlier scanners & drafts','Kept for reference or reuse','saved')}</div></details>`:''}</section><section class="personal-section" aria-labelledby="personal-preferences-title"><h2 id="personal-preferences-title">Preferences</h2><div class="personal-rows">${row('profile/notifications','Notifications','Live alerts aren’t connected yet','alerts')}</div></section><p class="personal-device-note">Saved on this device · No account sync</p>`;
    } else if(page==='edit') {
     body=`${back('profile','Profile')}<div class="page-intro"><h1>Edit profile<span class="accent">.</span></h1></div>${notice()}<form id="personal-edit-form"><div class="personal-photo-editor"><div id="personal-avatar-preview">${avatar(editDraft)}</div><div class="personal-photo-actions"><button class="button glass" type="button" data-profile-action="photo">${editDraft.photo?'Change photo':'Add photo'}</button><button class="text-link" type="button" data-profile-action="remove-photo" ${editDraft.photo?'':'hidden'}>Remove</button></div><input id="personal-photo-file" hidden type="file" accept="image/jpeg,image/png,image/webp" tabindex="-1" aria-label="Choose profile photo"><p>JPG, PNG or WebP · Up to 6 MB</p></div><div class="personal-field"><label for="personal-name">Your name <span>Optional</span></label><input id="personal-name" data-profile-field="name" autocomplete="nickname" maxlength="40" value="${esc(editDraft.name)}" placeholder="What should we call you?"></div><fieldset class="personal-colors" ${editDraft.photo?'hidden':''}><legend>Avatar color</legend><div>${Object.entries(avatarColors).map(([key,label])=>`<label class="personal-color-choice avatar-${key}"><input type="radio" name="avatar-color" data-profile-field="color" value="${key}" ${editDraft.color===key?'checked':''}><span aria-hidden="true">✓</span><span class="sr-only">${label}</span></label>`).join('')}</div></fieldset><p class="personal-local-copy">Your photo stays on this device.</p>${feedback()}<div class="personal-form-actions"><button class="button secondary" type="button" data-profile-action="cancel">Cancel</button><button class="button primary" type="submit" data-profile-save ${store.issue==='read'?'disabled':''}>Save changes</button></div></form>`;
    } else if(page==='settings') {
     body=`${back('profile','Profile')}<div class="page-intro"><h1>Settings<span class="accent">.</span></h1></div>${notice()}<div class="personal-rows">${row('settings/notifications','Notifications','Choose your alerts','bell')}${row('settings/privacy','Privacy','How this preview uses data','lock')}${row('settings/terms','Terms of Service','Not published yet','file')}</div><button class="personal-row personal-about" data-action="about"><span class="personal-row-icon">${icon('info')}</span><span class="personal-row-copy"><strong>About Soltech</strong></span>${icon('arrow')}</button><p class="personal-device-note">Preferences stay on this device.</p>`;
    } else if(page==='notifications') {
     const n=notificationDraft;
     body=`${back(returnView,returnLabel)}<div class="page-intro"><h1>Notifications<span class="accent">.</span></h1></div>${notice()}<p class="personal-info">Set your preferences for later. Live alerts aren’t connected yet.</p><form id="personal-notifications-form"><label class="personal-toggle-row"><span><strong>New finds</strong><small>When your scanner finds a coin</small></span><input type="checkbox" role="switch" data-profile-field="newFinds" ${n.newFinds?'checked':''} aria-label="New finds"></label>${feedback()}<div class="personal-form-actions"><button class="button secondary" type="button" data-profile-action="cancel">Cancel</button><button class="button primary" type="submit" ${store.issue==='read'?'disabled':''}>Save preferences</button></div></form>`;
    } else if(page==='privacy') {
     body=`${back('settings','Settings')}<div class="page-intro"><h1>Privacy<span class="accent">.</span></h1></div><div class="personal-reading"><p class="personal-info">How the current preview works.</p><section><h2>On your device</h2><p>Your name, photo, preferences, scanners and drafts are saved in this browser. Profile photos are resized here, not uploaded. Clearing site data removes these saved items.</p></section><section><h2>Coin lookups</h2><p>Checking a coin sends its address to market and risk data providers. Depending on the network, these include DEX Screener, Rugcheck, GoPlus, GeckoTerminal and Solana Tracker.</p></section><section><h2>No account sync</h2><p>Your profile doesn’t follow you to another browser or device. Scanner alerts aren’t connected yet.</p></section><p class="personal-local-copy">A published privacy policy is still needed before launch.</p></div>`;
    } else {
     body=`${back('settings','Settings')}<div class="page-intro"><h1>Terms of Service<span class="accent">.</span></h1></div><section class="personal-reading"><span class="personal-pending">Not published yet</span><h2>Before Soltech launches</h2><p>Reviewed terms will be available here. There’s nothing to accept in this preview.</p></section>`;
    }
    root.innerHTML=`<section class="personal-page page-width">${body}</section>`;
    updateFeedback();
   }
   function feedback(){return `<p id="personal-feedback" class="personal-feedback ${error?'personal-error':''}" role="status" aria-live="polite">${esc(error||message)}</p><button type="button" class="text-link" data-profile-action="reload-saved" ${conflict?'':'hidden'}>Load saved version</button>`;}
   function updateFeedback(){const node=root.querySelector('#personal-feedback');if(node){node.textContent=error||message;node.classList.toggle('personal-error',!!error);}const reload=root.querySelector('[data-profile-action="reload-saved"]');if(reload)reload.hidden=!conflict;const save=root.querySelector('[data-profile-save]');if(save){save.disabled=busy||store.issue==='read';save.textContent=busy?'Preparing photo…':'Save changes';}}
   function updateAvatar(){const colors=root.querySelector('.personal-colors');if(colors)colors.hidden=!!editDraft.photo;const node=root.querySelector('#personal-avatar-preview');if(node)node.innerHTML=avatar(editDraft);const remove=root.querySelector('[data-profile-action="remove-photo"]');if(remove)remove.hidden=!editDraft.photo;const choose=root.querySelector('[data-profile-action="photo"]');if(choose)choose.textContent=editDraft.photo?'Change photo':'Add photo';}
   function cancelPhoto(){photoJob?.abort();photoJob=null;busy=false;}
   async function loadPhoto(file){
    cancelPhoto();const job=new AbortController();photoJob=job;busy=true;error='';message='Preparing your photo…';updateFeedback();
    let source;
    try{source=await loadProfilePhoto(file,{signal:job.signal});if(disposed||photoJob!==job)return;const photo=await choosePhotoCrop(source,{signal:job.signal});if(disposed||photoJob!==job)return;if(photo){editDraft.photo=photo;message='Photo ready. Save to keep it.';updateAvatar();}else message='';}
    catch(err){if(disposed||photoJob!==job||err.name==='AbortError')return;error=err.message;message='';}
    finally{source?.dispose();if(!disposed&&photoJob===job){photoJob=null;busy=false;updateFeedback();}}
   }
   root.addEventListener('click',event=>{
    const action=event.target.closest('[data-profile-action]')?.dataset.profileAction;if(!action)return;
    if(action==='photo')root.querySelector('#personal-photo-file').click();
    if(action==='remove-photo'){cancelPhoto();editDraft.photo='';error='';message='Photo removed. Save to keep this change.';updateAvatar();updateFeedback();}
    if(action==='cancel'){cancelPhoto();if(page==='edit')editDraft=null;else notificationDraft=null;navigate(returnView);}
    if(action==='retry'){store.retry();error='';message='';render();}
    if(action==='reload-saved'){
     cancelPhoto();
     if(!store.retry()){error='Your saved profile couldn’t be loaded. Your unsaved changes are still here.';message='';render();return;}
     if(page==='edit'){editDraft=identity(store.value);editBase=identity(store.value);}else{notificationDraft=store.value.notifications;notificationBase=store.value.notifications;}
     error='';message='Saved version loaded.';conflict=false;render();
    }
   },{signal:events.signal});
   root.addEventListener('input',event=>{
    const field=event.target.dataset.profileField;
    if(field==='name'){editDraft.name=event.target.value;updateAvatar();}
   },{signal:events.signal});
   root.addEventListener('change',event=>{
    const node=event.target,field=node.dataset.profileField;
    if(node.id==='personal-photo-file'&&node.files?.[0]){const file=node.files[0];node.value='';loadPhoto(file);}
    if(field==='color'){editDraft.color=node.value;updateAvatar();}
    if(field==='newFinds'){notificationDraft.newFinds=node.checked;}
    if(field==='scanner')notificationDraft.scanners[node.dataset.profileScanner]=node.checked;
   },{signal:events.signal});
   root.addEventListener('submit',event=>{
    if(!['personal-edit-form','personal-notifications-form'].includes(event.target.id))return;
    event.preventDefault();if(busy)return;
    const result=page==='edit'?store.saveSection('identity',editDraft,editBase):store.saveSection('notifications',notificationDraft,notificationBase);
    if(!result.ok){error=result.error;conflict=!!result.conflict;message='';if(store.issue==='read')render();else updateFeedback();return;}
    if(page==='edit')editDraft=null;else notificationDraft=null;
    navigate(returnView);toast(page==='edit'?'Profile saved.':'Preferences saved.');
   },{signal:events.signal});
   root.addEventListener('error',event=>{if(event.target.matches('.personal-avatar img')){event.target.parentElement.innerHTML=avatarSymbol();}},{capture:true,signal:events.signal});
   render();
   return ()=>{disposed=true;cancelPhoto();events.abort();if(!editDirty()){editDraft=null;editBase=null;}if(!notificationDirty()){notificationDraft=null;notificationBase=null;}};
  }
 };
}
