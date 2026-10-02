import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace,STORAGE_KEY} from '../dist/workspace.js';
import {accountHandles,defaultSettings,settingsErrors,activeSettingsRows} from '../dist/scanner-settings.js';
import {scannerAppearance,cleanAppearance} from '../dist/scanner-appearance.js';
import {renderBuilder,builderExample} from '../dist/scanner-builder.js';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};};

test('unversioned draft steps migrate once without changing scanner records or unfinished fields',()=>{
 for(const oldStep of [1,2]){
  const disk=memory(),w=createWorkspace(disk),saved=w.saveLibrary('balanced').scanner;
  w.beginDraft({mode:'edit',scanner:saved});w.updateDraft({name:'Unfinished X',filters:{...defaultSettings('public'),accounts:', ,',capMax:'oops'}});
  const raw=JSON.parse(w.export());delete raw.draft.flowVersion;delete raw.draft.purposeChosen;raw.draft.step=oldStep;disk.setItem(STORAGE_KEY,JSON.stringify(raw));
  const loaded=createWorkspace(disk);assert.equal(loaded.state.draft.step,oldStep+1);assert.equal(loaded.state.draft.purposeChosen,true);
  assert.deepEqual(loaded.state.draft.fields,raw.draft.fields);assert.deepEqual(loaded.state.savedScanners,raw.savedScanners);
  loaded.persist();assert.equal(createWorkspace(disk).state.draft.step,oldStep+1);
 }
});
test('new draft choice and all three steps survive reload, with direct matching as the new default',()=>{
 const disk=memory(),w=createWorkspace(disk);w.beginDraft();assert.equal(w.state.draft.purposeChosen,false);
 w.choosePurpose('public');assert.equal(w.state.draft.fields.filters.matchMode,'direct');assert.deepEqual(w.state.draft.fields.filters.riskLevels,['lower','caution','unknown']);
 for(const step of [1,2,3]){w.step(step);const d=createWorkspace(disk).state.draft;assert.equal(d.step,step);assert.equal(d.purposeChosen,true);assert.equal(d.fields.filters.type,'public');}
});
test('incomplete X setup stays in a draft but cannot become a saved scanner',()=>{
 const disk=memory(),w=createWorkspace(disk);w.beginDraft();w.choosePurpose('public');
 for(const accounts of ['',', ,','@','https://x.com/example']){w.updateDraft({filters:{...w.state.draft.fields.filters,accounts}});assert.ok(settingsErrors(w.state.draft.fields.filters).accounts);assert.equal(w.saveDraft(),null);assert.equal(createWorkspace(disk).state.draft.fields.filters.accounts,accounts);}
 assert.deepEqual(accountHandles('@Example, example, @second'),['example','second']);
 w.updateDraft({filters:{...w.state.draft.fields.filters,accounts:'@example'}});assert.ok(w.saveDraft());
});
test('changing purpose preserves optional work and returning to X restores its source choices',()=>{
 const w=createWorkspace(memory());w.beginDraft();w.choosePurpose('public');w.updateDraft({name:'My custom name',filters:{...w.state.draft.fields.filters,accounts:'@example',matchMode:'related',capMin:'1000',stage:'dex'}});
 w.choosePurpose('projects');w.choosePurpose('public');assert.equal(w.state.draft.fields.name,'My custom name');assert.equal(w.state.draft.fields.filters.accounts,'@example');assert.equal(w.state.draft.fields.filters.matchMode,'related');assert.equal(w.state.draft.fields.filters.capMin,'1000');
});
test('new configurations save inactive; editing preserves placement and identity',()=>{
 const w=createWorkspace(memory());w.beginDraft();w.choosePurpose('projects');const saved=w.saveDraft().scanner;assert.equal(saved.placement,'saved');
 w.move(saved.id,'active');w.beginDraft({mode:'edit',scanner:saved});w.updateDraft({name:'Edited'});const edited=w.saveDraft().scanner;assert.equal(edited.id,saved.id);assert.equal(edited.placement,'active');
});
test('rendered review labels examples honestly and escapes user content',()=>{
 const w=createWorkspace(memory());w.beginDraft();w.choosePurpose('public');w.updateDraft({name:'<script>bad</script>',filters:{...w.state.draft.fields.filters,accounts:'@example',matchMode:'related'}});w.step(3);
 const html=renderBuilder(w.state.draft);assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>bad'));assert.ok(html.includes('Not a live result or a test of your filters.'));assert.ok(html.includes('Possible connection'));assert.ok(html.includes('Saves to Profile'));
 assert.ok(builderExample({...defaultSettings('public'),matchMode:'direct'}).includes('That exact token'));
});
test('changing purpose never renames an existing or deliberately named scanner',()=>{
 const w=createWorkspace(memory());w.beginDraft();w.choosePurpose('projects');w.updateDraft({name:'My X scanner'});w.choosePurpose('public');assert.equal(w.state.draft.fields.name,'My X scanner');
 w.choosePurpose('projects');const scanner=w.saveDraft().scanner;w.beginDraft({mode:'edit',scanner});w.choosePurpose('market');assert.equal(w.state.draft.fields.name,'My X scanner');
});

test('suggested names follow purpose until the user writes a name, including after reload',()=>{
 const disk=memory(),w=createWorkspace(disk);w.beginDraft();w.choosePurpose('public');w.choosePurpose('market');assert.equal(w.state.draft.fields.name,'My market scanner');
 const loaded=createWorkspace(disk);loaded.choosePurpose('projects');assert.equal(loaded.state.draft.fields.name,'My new coin scanner');loaded.updateDraft({name:'My market scanner'});loaded.choosePurpose('market');loaded.choosePurpose('public');assert.equal(loaded.state.draft.fields.name,'My market scanner');
});
test('new coin age default is explicit; first choice of another purpose has no hidden age limit',()=>{
 for(const type of ['projects','public','market']){const w=createWorkspace(memory());w.beginDraft();w.choosePurpose(type);assert.equal(w.state.draft.fields.filters.ageMax,type==='projects'?'24':'');}
});
test('automatic age follows purpose changes until a custom age is set',()=>{
 const disk=memory(),w=createWorkspace(disk);w.beginDraft();w.choosePurpose('projects');w.choosePurpose('public');assert.equal(w.state.draft.fields.filters.ageMax,'');w.choosePurpose('projects');assert.equal(w.state.draft.fields.filters.ageMax,'24');
 w.updateDraft({filters:{...w.state.draft.fields.filters,ageMax:'6'}});const loaded=createWorkspace(disk);loaded.choosePurpose('market');assert.equal(loaded.state.draft.fields.filters.ageMax,'6');
});
test('review includes every applied advanced restriction and omits unused market defaults',()=>{
 const r={...defaultSettings('market'),holdersMin:'100',topHoldersMax:'20',creatorMax:'5',venue:'orca',priceMin:'-10',excludeMintable:true};
 const rows=Object.fromEntries(activeSettingsRows(r));for(const key of ['Holders','Top 10 holders','Creator holdings','Venue','Price change','Exclude tokens with'])assert.ok(rows[key]);assert.equal(rows['Market cap'],undefined);
 assert.ok(settingsErrors({...r,type:'projects',stage:'curve'}).venue);assert.equal(settingsErrors({...r,type:'projects',stage:'dex'}).venue,undefined);
});
test('custom badge persists through draft reload, save, edit, deactivate and restore',()=>{
 const disk=memory(),w=createWorkspace(disk);w.beginDraft();w.choosePurpose('projects');w.updateDraft({badgeSymbol:'coin',badgeColor:'teal'});
 const loaded=createWorkspace(disk);assert.equal(loaded.state.draft.fields.badgeSymbol,'coin');const saved=loaded.saveDraft().scanner;loaded.move(saved.id,'active');loaded.beginDraft({mode:'edit',scanner:saved});loaded.updateDraft({badgeColor:'silver'});loaded.discardDraft();assert.equal(saved.badgeColor,'teal');
 loaded.move(saved.id,'saved');loaded.remove(saved.id);const restored=createWorkspace(disk).undo();assert.deepEqual(scannerAppearance(restored),{symbol:'coin',color:'teal'});
 assert.deepEqual(cleanAppearance({badgeSymbol:'<svg>',badgeColor:'background:url(x)'}),{});
});
test('legacy records retain source badges without injecting appearance overrides',()=>{
 const w=createWorkspace(memory());const record=w.saveLibrary('balanced').scanner;assert.equal(record.badgeSymbol,undefined);assert.equal(record.badgeColor,undefined);assert.deepEqual(scannerAppearance({...record,icon:'publicPosts',tone:'mint'}),{symbol:'publicPosts',color:'mint'});
 w.beginDraft({mode:'edit',scanner:record});w.choosePurpose('market');assert.deepEqual(scannerAppearance({...w.state.draft.fields,sourceId:w.state.draft.sourceId}),scannerAppearance({...record,filters:w.state.draft.fields.filters}));
});
