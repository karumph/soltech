// Account screens inside Profile: create account, sign in, forgot password, change password and delete account.
// They use the Profile page's look (personal-page, personal-field, personal-form-actions).
import {ACCOUNT_DATA_KEYS} from './account.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const accountPages=['join','signin','forgot','password','delete'];

// Profile before an account exists: nothing personal yet, just a way in.
export function mountSignedOut(root){
 document.title='Profile · Soltech';
 root.innerHTML=`<section class="personal-page page-width profile-gate"><div class="profile-gate-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg></div><h1>Your Soltech profile<span class="accent">.</span></h1><p>Sign in, or create a free account, to keep your profile, scanner settings and watchlist on every device.</p><div class="profile-gate-actions"><a class="button primary" href="#profile/join">Create account</a><a class="button secondary" href="#profile/signin">Sign in</a></div><p class="profile-gate-note">You can use Check, Feed and the Scanner without an account.</p></section>`;
 return ()=>{};
}
const titles={join:'Create account',signin:'Sign in',forgot:'Reset password',password:'Change password',delete:'Delete account'};
export const accountPageTitle=page=>titles[page];
const rules=[[/.{8,}/,'8+ characters'],[/[A-Z]/,'Uppercase letter'],[/[a-z]/,'Lowercase letter'],[/\d/,'Number']];
const passwordOk=value=>rules.every(([rule])=>rule.test(value));
const back=`<a class="back-link" href="#profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg> Profile</a>`;
const field=(id,label,{type='text',autocomplete='',value='',hint='',inputmode='',hidden=false,reveal=false}={})=>`<div class="personal-field" id="${id}-field" ${hidden?'hidden':''}><label for="${id}">${label}</label><div class="account-input${reveal?' has-reveal':''}"><input id="${id}" name="${id}" type="${type}" ${autocomplete?`autocomplete="${autocomplete}"`:''} ${inputmode?`inputmode="${inputmode}"`:''} value="${esc(value)}" ${hint?`aria-describedby="${id}-hint"`:''} spellcheck="false" autocapitalize="none">${reveal?`<button type="button" class="account-reveal" data-account-reveal="${id}" aria-label="Show password" aria-pressed="false">Show</button>`:''}</div>${hint?`<p class="field-help" id="${id}-hint">${hint}</p>`:''}</div>`;
const checklist=id=>`<ul class="account-rules" data-rules-for="${id}" aria-label="Password requirements">${rules.map(([,label],i)=>`<li data-rule="${i}">${label}</li>`).join('')}</ul>`;

// Copies an account's saved data onto this device, or uploads this device's data to a new, empty account.
export async function syncAfterSignIn(account){
 const saved=await account.load();
 const hasSaved=saved.profile||saved.scanner||saved.workspace||saved.signals;
 if(hasSaved){
  const map={'soltech.profile.v1':saved.profile,'soltech.scanner.v1':saved.scanner,'soltech.workspace.v1':saved.workspace,'soltech.signals.v1':saved.signals};
  for(const key of ACCOUNT_DATA_KEYS){if(map[key])localStorage.setItem(key,JSON.stringify(map[key]));}
  account.markSynced(saved.updatedAt||new Date().toISOString());
  return 'pulled';
 }
 const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
 const result=await account.save({profile:read('soltech.profile.v1'),scanner:read('soltech.scanner.v1'),workspace:read('soltech.workspace.v1'),signals:read('soltech.signals.v1')});
 account.markSynced(result.updatedAt);
 return 'pushed';
}

export function mountAccountPage(root,page,{account,navigate,toast}){
 const events=new AbortController();
 let step=page==='forgot'?'request':'form',pendingPassword='',busy=false,error='',message='',email=sessionStorage.getItem('soltech.account-email')||'';
 const remember=value=>{email=value;try{sessionStorage.setItem('soltech.account-email',value);}catch{}};
 document.title=`${titles[page]} · Soltech`;
 if(['password','delete'].includes(page)&&!account.signedIn()){navigate('profile/signin');return ()=>{};}
 if(['join','signin','forgot'].includes(page)&&account.signedIn()){navigate('profile');return ()=>{};}
 function body(){
  if(page==='join')return step==='form'?`<p class="personal-info">Save your profile and scanner to your account and open them on any device.</p>${field('account-email','Email',{type:'email',autocomplete:'email',value:email})}${field('account-password','Password',{type:'password',autocomplete:'new-password',reveal:true})}${checklist('account-password')}${actions('Create account')}<p class="account-switch">Already have an account? <a href="#profile/signin">Sign in</a></p>`
   :`<p class="personal-info">We sent a 6-digit code to <strong>${esc(email)}</strong>. Enter it to finish creating your account.</p>${field('account-code','Email code',{inputmode:'numeric',autocomplete:'one-time-code'})}${field('account-password','Password',{type:'password',autocomplete:'new-password',reveal:true,hint:'The password you just chose, so we can sign you in.'})}${actions('Confirm and sign in')}<p class="account-switch"><button type="button" class="text-link" data-account-action="resend">Send a new code</button> · <button type="button" class="text-link" data-account-action="restart">Use a different email</button></p>`;
  if(page==='signin')return step==='form'?`${field('account-email','Email',{type:'email',autocomplete:'email',value:email})}${field('account-password','Password',{type:'password',autocomplete:'current-password',reveal:true})}<label class="account-remember"><input type="checkbox" id="account-remember" checked> Keep me signed in on this device</label>${actions('Sign in')}<p class="account-switch"><a href="#profile/forgot">Forgot password?</a> · <a href="#profile/join">Create account</a></p>`
   :`<p class="personal-info">Your email isn’t confirmed yet. Enter the code we sent to <strong>${esc(email)}</strong>.</p>${field('account-code','Email code',{inputmode:'numeric',autocomplete:'one-time-code'})}${actions('Confirm and sign in')}<p class="account-switch"><button type="button" class="text-link" data-account-action="resend">Send a new code</button></p>`;
  if(page==='forgot')return step==='request'?`<p class="personal-info">Enter your email and we’ll send a code to reset your password.</p>${field('account-email','Email',{type:'email',autocomplete:'email',value:email})}${actions('Send code')}<p class="account-switch"><a href="#profile/signin">Back to sign in</a></p>`
   :`<p class="personal-info">If an account exists for <strong>${esc(email)}</strong>, we sent it a code.</p>${field('account-code','Email code',{inputmode:'numeric',autocomplete:'one-time-code'})}${field('account-password','New password',{type:'password',autocomplete:'new-password',reveal:true})}${checklist('account-password')}${actions('Reset password')}<p class="account-switch"><button type="button" class="text-link" data-account-action="forgot-again">Send a new code</button></p>`;
  if(page==='password')return `<p class="personal-info">Signed in as <strong>${esc(account.email())}</strong>.</p>${field('account-current','Current password',{type:'password',autocomplete:'current-password',reveal:true})}${field('account-password','New password',{type:'password',autocomplete:'new-password',reveal:true})}${checklist('account-password')}${actions('Change password')}`;
  return `<div class="account-danger"><p><strong>This permanently deletes ${esc(account.email())}</strong> and the profile, scanner and drafts saved to it. Coins you checked aren’t stored, so there’s nothing else to remove.</p><p>This can’t be undone.</p></div>${field('account-confirm','Type your email to confirm',{type:'email',autocomplete:'off'})}${actions('Delete account','danger')}`;
 }
 function actions(label,tone='primary'){return `<p id="account-feedback" class="personal-feedback ${error?'personal-error':''}" role="status" aria-live="polite">${esc(error||message)}</p><div class="personal-form-actions"><a class="button secondary" href="#profile">Cancel</a><button class="button ${tone}" type="submit" ${busy?'disabled':''}>${busy?'Working…':label}</button></div>`;}
 function render(focus){
  root.innerHTML=`<section class="personal-page page-width account-page">${back}<div class="page-intro"><h1>${titles[page]}<span class="accent">.</span></h1></div><form id="account-form" novalidate>${body()}</form></section>`;
  updateRules();
  if(focus)root.querySelector(focus)?.focus();
 }
 function feedback(){const node=root.querySelector('#account-feedback');if(node){node.textContent=error||message;node.classList.toggle('personal-error',!!error);}const submit=root.querySelector('#account-form [type=submit]');if(submit){submit.disabled=busy;if(busy){submit.dataset.label??=submit.textContent;submit.textContent='Working…';}else if(submit.dataset.label){submit.textContent=submit.dataset.label;delete submit.dataset.label;}}}
 function updateRules(){for(const list of root.querySelectorAll('[data-rules-for]')){const value=root.querySelector('#'+list.dataset.rulesFor)?.value||'';list.querySelectorAll('[data-rule]').forEach(li=>li.classList.toggle('is-met',rules[Number(li.dataset.rule)][0].test(value)));}}
 const value=id=>root.querySelector('#'+id)?.value.trim()||'';
 const fail=(message,focus)=>{error=message;busy=false;feedback();if(focus)root.querySelector(focus)?.focus();};
 async function finishSignIn(password,keep=true){
  await account.login(email,password,{remember:keep});
  message='Signed in. Loading your saved work…';feedback();
  try{await syncAfterSignIn(account);}catch{toast('Signed in, but your saved work could not be loaded. It will sync on your next change.');}
  try{sessionStorage.removeItem('soltech.account-email');}catch{}
  location.hash='#profile';location.reload();
 }
 async function submit(){
  error='';message='';
  const emailValue=value('account-email'),password=root.querySelector('#account-password')?.value||'',code=value('account-code');
  if(root.querySelector('#account-email')){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue))return fail('Enter a valid email address.','#account-email');remember(emailValue.toLowerCase());}
  if(page==='join'&&step==='form'){
   if(!passwordOk(password))return fail('Choose a password that meets all four requirements.','#account-password');
   busy=true;feedback();
   try{await account.signup(email,password);step='code';busy=false;message='';render('#account-code');root.querySelector('#account-password').value=password;}
   catch(err){if(err.code==='exists'){busy=false;error='';page='signin';step='form';render('#account-password');error='That email already has an account. Sign in instead.';feedback();return;}fail(err.message);}
   return;
  }
  if((page==='join'||page==='signin')&&step==='code'){
   if(!/^\d{6}$/.test(code))return fail('Enter the 6-digit code from the email.','#account-code');
   busy=true;feedback();
   try{await account.confirm(email,code);await finishSignIn(page==='join'?password:pendingPassword);}
   catch(err){fail(err.code==='credentials'?'Email confirmed. Sign in with your password.':err.message,'#account-code');if(err.code==='credentials'){page='signin';step='form';render('#account-password');}}
   return;
  }
  if(page==='signin'){
   if(!password)return fail('Enter your password.','#account-password');
   busy=true;feedback();
   try{await finishSignIn(password,root.querySelector('#account-remember')?.checked!==false);}
   catch(err){
    if(err.code==='unconfirmed'){pendingPassword=password;step='code';busy=false;error='';render('#account-code');return;}
    fail(err.message,'#account-password');
   }
   return;
  }
  if(page==='forgot'&&step==='request'){
   busy=true;feedback();
   try{await account.forgot(email);step='reset';busy=false;render('#account-code');}catch(err){fail(err.message);}
   return;
  }
  if(page==='forgot'){
   if(!/^\d{6}$/.test(code))return fail('Enter the 6-digit code from the email.','#account-code');
   if(!passwordOk(password))return fail('Choose a password that meets all four requirements.','#account-password');
   busy=true;feedback();
   try{await account.reset(email,code,password);message='Password reset. Signing you in…';feedback();await finishSignIn(password);}
   catch(err){fail(err.message);}
   return;
  }
  if(page==='password'){
   const current=root.querySelector('#account-current')?.value||'';
   if(!current)return fail('Enter your current password.','#account-current');
   if(!passwordOk(password))return fail('Choose a new password that meets all four requirements.','#account-password');
   busy=true;feedback();
   try{await account.changePassword(current,password);toast('Password changed.');navigate('profile');}
   catch(err){if(err.code==='session'){toast('Your session ended. Sign in again.');navigate('profile/signin');return;}fail(err.message);}
   return;
  }
  if(page==='delete'){
   if(value('account-confirm').toLowerCase()!==account.email().toLowerCase())return fail('Type your account email exactly to confirm.','#account-confirm');
   busy=true;feedback();
   try{await account.deleteAccount();toast('Account deleted. Saved work was removed from this device.');location.hash='#profile';location.reload();}
   catch(err){fail(err.message);}
  }
 }
 root.addEventListener('submit',event=>{if(event.target.id!=='account-form')return;event.preventDefault();if(!busy)submit();},{signal:events.signal});
 root.addEventListener('input',event=>{if(event.target.id==='account-password')updateRules();if(error){error='';feedback();}},{signal:events.signal});
 root.addEventListener('click',async event=>{
  const reveal=event.target.closest('[data-account-reveal]');
  if(reveal){const input=root.querySelector('#'+reveal.dataset.accountReveal),show=input.type==='password';input.type=show?'text':'password';reveal.textContent=show?'Hide':'Show';reveal.setAttribute('aria-pressed',String(show));reveal.setAttribute('aria-label',show?'Hide password':'Show password');return;}
  const action=event.target.closest('[data-account-action]')?.dataset.accountAction;if(!action||busy)return;
  if(action==='restart'){step='form';error='';message='';render('#account-email');}
  if(action==='resend'){busy=true;error='';message='';feedback();try{await account.resend(email);message='A new code is on its way.';}catch(err){error=err.message;}busy=false;feedback();}
  if(action==='forgot-again'){busy=true;error='';message='';feedback();try{await account.forgot(email);message='A new code is on its way.';}catch(err){error=err.message;}busy=false;feedback();}
 },{signal:events.signal});
 render(page==='password'?'#account-current':page==='delete'?'#account-confirm':email?'#account-password':'#account-email');
 return ()=>{pendingPassword='';events.abort();};
}
