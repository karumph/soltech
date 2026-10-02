import {renderSettings} from './scanner-editor.js';
import {accountHandles,activeSettingsRows} from './scanner-settings.js';
import {scannerBadge,scannerAppearance,badgeIcons,badgeSymbols,badgeColors} from './scanner-appearance.js';
import {scannerIntent} from './scanner-guidance.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const purposeNames={public:'Posts on X',projects:'New coins',market:'All coins'};
const purposes=[['public','Posts on X','Follow people. Find the coins and ideas they mention.','publicPosts','mint'],['projects','New coins','Watch projects as they launch and start trading.','launch','peach'],['market','All coins','Choose coin filters for age, activity and risk.','coin','teal']];
const errors='<div id="form-errors" class="form-error-summary" role="alert" hidden></div>';
function filterHighlights(r){return activeSettingsRows(r).map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('');}
export function renderAppearance(f){
 const {symbol,color}=scannerAppearance(f);
 return `<details class="appearance-options"><summary><span id="scanner-badge-preview">${scannerBadge(f)}</span><span>Icon & color<small>Make it yours</small></span></summary><fieldset class="appearance-symbols"><legend>Symbol</legend>${Object.entries(badgeSymbols).map(([key,label])=>`<label><input type="radio" name="badge-symbol" data-field="badgeSymbol" value="${key}" ${key===symbol?'checked':''}><span>${badgeIcons[key]}</span><small>${label}</small></label>`).join('')}</fieldset><fieldset class="appearance-colors"><legend>Color</legend>${Object.entries(badgeColors).map(([key,label])=>`<label><input type="radio" name="badge-color" data-field="badgeColor" value="${key}" ${key===color?'checked':''}>${scannerBadge({...f,badgeSymbol:symbol,badgeColor:key})}<small>${label}</small></label>`).join('')}</fieldset></details>`;
}

export function builderExample(r){
 const related=r.type==='public'&&r.matchMode==='related';
 const [trigger,result,reason]=r.type==='public'
  ?related?['An account posts an idea','A coin may share that theme','Possible connection · not an endorsement. Direct coin mentions are included too.']
   :['An account posts a token address','That exact token is identified','Direct mention · the address ties the post to the coin.']
  :r.type==='projects'?['A project reaches your chosen stage','The coin becomes a candidate','Its age, trading data and risk checks can then be checked against your rules.']
  :['A coin appears in market data','Its details are checked','Your saved market filters describe which coins to look for.'];
 return `<section class="builder-example" aria-labelledby="example-title"><div class="builder-section-title"><h2 id="example-title">How a match works</h2><span>Illustration</span></div><ol><li><span>1</span><p>${trigger}</p></li><li><span>2</span><p>${result}</p></li></ol><p>${reason}</p><small>Not a live result or a test of your filters.</small></section>`;
}

export function renderBuilder(d,{issue=false,recovered=false}={}){
 const f=d.fields,r=f.filters,step=d.step;
 const setupTitles={public:'Who should it follow?',projects:'How new is new?',market:'Which coins fit?'};
 const title=['What do you want to watch?',setupTitles[r.type],'Fine-tune your results.','Review and make it yours.'][step-1];
 const type=purposeNames[r.type];
 const handles=accountHandles(r.accounts);
 const footer=`<div class="builder-draft"><span id="draft-status">${issue?'Kept in this tab only':'Draft saved on this device'}</span><button class="text-link" type="button" data-action="discard">Discard</button></div>`;
 let body='';
 if(step===1){
  body=`<fieldset class="purpose-options" aria-describedby="form-errors"><legend class="sr-only">Scanner purpose</legend>${purposes.map(([value,name,description,symbol,tone])=>`<label class="purpose-option"><input type="radio" name="purpose" data-purpose="${value}" value="${value}" ${d.purposeChosen&&r.type===value?'checked':''}><span class="scanner-mark scanner-identity ${tone}">${badgeIcons[symbol]}</span><span class="purpose-copy"><strong>${name}</strong><small>${description}</small></span><span class="purpose-check" aria-hidden="true"></span></label>`).join('')}<span class="field-error" id="purpose-error"></span></fieldset><div class="builder-actions"><button class="button glass" type="submit">Continue <span aria-hidden="true">→</span></button></div>`;
 }else if(step===2){
  body=`<div class="builder-context"><span>${type}</span><button class="text-link" type="button" data-action="builder-step" data-step="1">Change focus</button></div><div id="scanner-settings">${renderSettings(r,2)}</div><div class="builder-actions"><button class="text-link" type="button" data-action="builder-step" data-step="1">Back</button><button class="button glass" type="submit">Continue to filters <span aria-hidden="true">→</span></button></div>`;
 }else if(step===3){
  body=`<div class="builder-context"><span>${type}</span><button class="text-link" type="button" data-action="builder-step" data-step="2">Edit setup</button></div><div id="scanner-settings">${renderSettings(r,3)}</div><div class="builder-actions"><button class="text-link" type="button" data-action="builder-step" data-step="2">Back</button><button class="button glass" type="submit">Review scanner <span aria-hidden="true">→</span></button></div>`;
 }else{
  body=`<section class="builder-review-intent"><div class="builder-section-title"><h2>${type}</h2><button class="text-link" type="button" data-action="builder-step" data-step="2">Edit setup</button></div><p class="builder-intent">${esc(scannerIntent(r))}</p>${r.type==='public'&&handles.length>1?`<p class="builder-accounts">${esc(handles.map(a=>'@'+a).join(', '))}</p>`:''}</section><div class="builder-personalize"><div class="field name-field"><label for="scanner-name">Give it a name</label><input id="scanner-name" data-field="name" maxlength="50" value="${esc(f.name)}" aria-describedby="name-error" required><span id="name-error" class="field-error"></span></div>${renderAppearance({...f,sourceId:d.sourceId})}</div><div class="builder-section-title"><h2>Chosen rules</h2><button class="text-link" type="button" data-action="builder-step" data-step="3">Edit filters</button></div><dl class="builder-plan">${filterHighlights(r)}</dl><details class="builder-rule-review"><summary>How matches work</summary>${builderExample(r)}</details><details class="advanced-options editor-note"><summary>Personal note <span>Optional</span></summary><div class="field"><label for="scanner-description">Note</label><textarea id="scanner-description" data-field="description" maxlength="180" rows="3">${esc(f.description)}</textarea></div></details><p class="builder-save-note">${d.mode==='edit'&&!recovered?'Updates your existing scanner.':'Saves to Profile → Saved scanners.'} Live scanning isn't connected yet.</p><div class="builder-actions"><button class="text-link" type="button" data-action="builder-step" data-step="3">Back</button><button class="button glass" type="submit">${d.mode==='edit'&&!recovered?'Save changes':'Save scanner'}</button></div>`;

 }
 return `<div class="page-width scanner-builder guided-builder" data-builder-step="${step}"><div class="builder-top"><a class="back-link" href="#profile">← Save draft & exit</a><span class="builder-preview-label">Step ${step} of 4</span></div><ol class="builder-progress" aria-label="Scanner setup progress">${['Focus','Set up','Filters','Review'].map((label,i)=>`<li ${step===i+1?'aria-current="step"':''} class="${step>i+1?'complete':''}"><span>${step>i+1?'✓':i+1}</span>${label}</li>`).join('')}</ol><header class="builder-heading"><h1>${title}</h1>${step===1?'<p>Pick a starting point. We’ll take it from there.</p>':step===3?'<p>Keep these choices, or add limits below.</p>':''}</header>${recovered?'<p class="recovery-note">The original was deleted. This draft can be saved as a new scanner.</p>':''}<section class="builder-surface"><form id="scanner-form" novalidate>${errors}${body}</form></section>${step<4?`<p class="builder-connection-note">Setup preview · Live scanning isn't connected.</p>`:''}${footer}</div>`;
}
