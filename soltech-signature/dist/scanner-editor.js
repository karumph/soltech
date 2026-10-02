import {scannerTypes,stages,ageBases,riskOptions,postOptions,usesCurve,settingsRows,activeSettingsRows} from './scanner-settings.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const error=k=>`<span class="field-error" id="setting-${k}-error"></span>`;
function select(r,key,label,options,help=''){
 return `<div class="field setting-field"><label for="setting-${key}">${label}</label><select id="setting-${key}" data-setting="${key}" aria-describedby="setting-${key}-help setting-${key}-error">${Object.entries(options).map(([v,l])=>`<option value="${v}" ${r[key]===v?'selected':''}>${l}</option>`).join('')}</select><span class="field-help" id="setting-${key}-help">${help}</span>${error(key)}</div>`;
}
function number(r,key,label,unit='',help=''){
 return `<div class="field setting-field"><label for="setting-${key}">${label}${unit?` <span>${unit}</span>`:''}</label><input type="text" inputmode="${key.startsWith('price')?'text':'decimal'}" id="setting-${key}" data-setting="${key}" value="${esc(r[key])}" placeholder="No limit" maxlength="24" autocomplete="off" aria-describedby="setting-${key}-help setting-${key}-error"><span class="field-help" id="setting-${key}-help">${help}</span>${error(key)}</div>`;
}
function range(r,min,max,label,unit,help=''){
 return `<fieldset class="setting-range"><legend>${label} <span>${unit}</span></legend><div class="range-inputs">${number(r,min,'Minimum')}${number(r,max,'Maximum')}</div>${help?`<p class="field-help">${help}</p>`:''}</fieldset>`;
}
function choices(r,key,options,label,help=''){
 return `<fieldset class="setting-choices" id="group-${key}" aria-describedby="setting-${key}-help setting-${key}-error"><legend>${label}</legend><div class="choice-pills">${Object.entries(options).map(([v,l])=>`<label class="choice-pill"><input type="checkbox" data-setting="${key}" data-list="true" aria-describedby="setting-${key}-help setting-${key}-error" value="${v}" ${r[key].includes(v)?'checked':''}>${key==='riskLevels'?`<span class="risk-dot ${v}" aria-hidden="true"></span>`:''}<span>${l}</span></label>`).join('')}</div><p class="field-help" id="setting-${key}-help">${help}</p>${error(key)}</fieldset>`;
}
const exclusion=(r,key,label,help)=>`<label class="check-option"><input type="checkbox" data-setting="${key}" ${r[key]?'checked':''}><span><strong>${label}</strong><small>${help}</small></span></label>`;
const countRules=(r,labels)=>activeSettingsRows(r).filter(([label])=>labels.includes(label)).length;
const group=(id,title,summary,body)=>`<details class="settings-group" id="${id}"><summary>${title}<span>${esc(summary)}</span></summary><section class="editor-section">${body}</section></details>`;
const ageHelp=r=>r.ageBasis==='trading'?'Since trading began; a new pool does not reset this.':r.ageBasis==='mint'?'Since the token was created.':'Since this pool was created; the token may be older.';
function marketControls(r){return `${usesCurve(r)?number(r,'reserveMin','Minimum launchpad reserves','USD','Actual funds, excluding virtual reserves.'):number(r,'liquidityMin','Minimum liquidity','USD','Money in the trading pool.')}
 ${r.type==='projects'&&r.stage==='any'?number(r,'reserveMin','Minimum launchpad reserves','USD','Applies before a DEX pool exists.'):''}
 ${r.legacyLiquidity?`<p class="legacy-rule">Earlier preference: <strong>${esc(r.legacyLiquidity)}</strong>. Enter a numeric limit to replace it.</p>`:''}
 ${range(r,'capMin','capMax',r.valuation==='fdv'?'FDV':'Market cap','USD')}`;}
export function renderSettings(r){
 const rules=Object.fromEntries(settingsRows(r));
 const marketCount=countRules(r,['DEX liquidity','Launchpad reserves','Market cap','FDV']);
 const ageCount=countRules(r,Object.values(ageBases));
 const activityCount=countRules(r,['Activity','Price change']);
 const ownershipCount=countRules(r,['Holders','Top 10 holders','Creator holdings','Exclude tokens with']);
 const count=n=>n?`${n} set`:'Optional';
 const ageFields=`${select(r,'ageBasis','Measure age from',ageBases)}${r.type==='projects'?number(r,'ageMin','Minimum age','hours'):range(r,'ageMin','ageMax',ageBases[r.ageBasis],'hours',ageHelp(r))}`;
 const venueHelp=usesCurve(r)?'DEX venues apply after graduation. Choose Any venue or Pump.fun at this stage.':'Where the coin trades. Venue coverage is Solana-focused.';
 const extraMarket=`${select(r,'valuation','Value to filter',{marketCap:'Market cap',fdv:'Fully diluted value (FDV)'},'FDV uses total supply; it is different from circulating market cap.')}
 ${select(r,'venue','Trading venue',{any:'Any venue',pump:'Pump.fun / PumpSwap',raydium:'Raydium',meteora:'Meteora',orca:'Orca'},venueHelp)}`;
 return `${renderSourceSettings(r)}
 ${r.type==='market'?`<section class="builder-basics">${marketControls(r)}<p class="field-help">Blank limits include any value.</p></section>`:group('market-settings','Market limits',count(marketCount),marketControls(r))}
 ${group('age-settings',r.type==='projects'?'Age details':'Coin age',r.type==='projects'?ageBases[r.ageBasis]:ageCount?rules[ageBases[r.ageBasis]]:'Any age',ageFields)}
 ${group('venue-settings','Value & venue',r.venue!=='any'?'Venue selected':r.valuation==='fdv'?'FDV selected':'Optional',extraMarket)}
 ${group('activity-settings','Trading activity',count(activityCount),`${select(r,'activityMetric','Measure',{volume:'Trading volume',trades:'Number of trades',wallets:'Active wallets'})}<div class="activity-row">${number(r,'activityMin','Minimum',r.activityMetric==='volume'?'USD':'count')}${select(r,'activityWindow','During',{'5m':'5 minutes','1h':'1 hour','24h':'24 hours'})}</div><p class="field-help">Activity can be faked. New coins may lack a full period of history.</p>${range(r,'priceMin','priceMax','Price change','%','Negative values allow price drops.')}${select(r,'priceWindow','Price-change period',{'5m':'5 minutes','1h':'1 hour','24h':'24 hours'})}`)}
 ${group('risk-settings','Risk preferences',r.riskLevels.length===4?'All statuses':`${r.riskLevels.length} selected`,choices(r,'riskLevels',riskOptions,'Include coins with','Lower risk is not risk-free. Not assessed means information is missing.'))}
 ${group('ownership-settings','Ownership & token controls',count(ownershipCount),`${number(r,'holdersMin','Minimum holders','wallets')}${number(r,'topHoldersMax','Top 10 holders, maximum','%','Excludes known pools and system accounts. One person may use several wallets.')}${number(r,'creatorMax','Creator holdings, maximum','%','Attributed holdings only; related wallets are unverified.')}<h3>Exclude tokens with</h3>${exclusion(r,'excludeMintable','Additional minting','An authority can create more supply.')}${exclusion(r,'excludeFreezable','Freeze authority','An authority can freeze token accounts.')}${exclusion(r,'excludeMutableFees','Changeable transfer fees','Transfer fees can be changed later.')}${exclusion(r,'excludeTransferHooks','Custom transfer hooks','Extra program logic runs during transfers.')}<p class="field-help technical-note">A token control alone is not proof of a scam. Missing checks stay unassessed.</p>`)}`;
}

export function renderSettingsSummary(r){return `<dl class="rules-list settings-summary">${settingsRows(r).map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;}

export function renderSourceSettings(r){
 if(r.type==='public')return `<div class="field setting-field source-accounts"><label for="setting-accounts">Who do you want to follow?</label><textarea id="setting-accounts" data-setting="accounts" rows="2" maxlength="600" placeholder="@account, @another" autocapitalize="none" spellcheck="false" aria-describedby="setting-accounts-help setting-accounts-error">${esc(r.accounts)}</textarea><span class="field-help" id="setting-accounts-help">Separate X handles with commas. Accounts aren't verified yet.</span>${error('accounts')}</div>
 <fieldset class="match-options"><legend>What should count as a match?</legend>${[['direct','Direct coin mentions','A token address or coin link in a post.'],['related','Mentions + related ideas','Also look for coins with a similar theme. A connection is not an endorsement.']].map(([value,label,help])=>`<label class="match-option"><input type="radio" name="match-mode" data-setting="matchMode" value="${value}" ${r.matchMode===value?'checked':''}><span><strong>${label}</strong><small>${help}</small></span></label>`).join('')}</fieldset>
 <details class="settings-group" id="post-settings"><summary>Post options<span>${r.postTypes.length} types · ${r.postWindow==='168'?'7 days':r.postWindow==='1'?'1 hour':'24 hours'}</span></summary><section class="editor-section">${select(r,'postWindow','Look back',{'1':'Past hour','24':'Past 24 hours','168':'Past 7 days'})}${choices(r,'postTypes',postOptions,'Include')}</section></details>`;
 if(r.type==='projects')return `${number(r,'ageMax',`Maximum ${ageBases[r.ageBasis].toLowerCase()}`,'hours',ageHelp(r))}<div class="age-shortcuts" aria-label="Age shortcuts">${[['1','1 hour'],['6','6 hours'],['24','1 day'],['168','1 week'],['','Any age']].map(([v,l])=>`<button type="button" data-action="age-shortcut" data-value="${v}" aria-pressed="${r.ageMax===v}">${l}</button>`).join('')}</div>${select(r,'stage','Launch stage',stages,'Graduation means moving from a launchpad to a decentralized exchange (DEX).')}<p class="setup-scope">Launch stages and venues are Solana-focused in this preview.</p>`;
 return '';
}
