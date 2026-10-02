import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSettings,cleanSettings,settingsErrors,settingsRows} from '../dist/scanner-settings.js';
import {createWorkspace,STORAGE_KEY} from '../dist/workspace.js';
import {library} from '../dist/data.js';
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};};

test('custom filters survive review, save, reopen and edit without changing their source',()=>{
 const disk=memory(),w=createWorkspace(disk);w.beginDraft({mode:'customize',scanner:library[0]});
 const filters={...w.state.draft.fields.filters,accounts:'@example, @second',capMin:'250000',capMax:'1500000',ageMax:'24',liquidityMin:'10000',riskLevels:['lower','caution'],holdersMin:'100',topHoldersMax:'25',excludeFreezable:true};
 w.updateDraft({filters});w.step(2);assert.deepEqual(createWorkspace(disk).state.draft.fields.filters,filters);
 const saved=w.saveDraft().scanner,reopened=createWorkspace(disk);
 assert.deepEqual(reopened.state.savedScanners[0].filters,filters);
 reopened.beginDraft({mode:'edit',scanner:reopened.state.savedScanners[0]});
 reopened.updateDraft({filters:{...filters,capMax:'2000000'}});
 assert.equal(reopened.state.savedScanners[0].filters.capMax,'1500000');
 assert.equal(reopened.saveDraft().scanner.id,saved.id);
 assert.equal(library[0].criteria.filters.capMin,'');
});
test('invalid numbers and inverted ranges cannot be saved but remain in a recoverable draft',()=>{
 const w=createWorkspace(memory());w.beginDraft();w.updateDraft({filters:{...defaultSettings(),capMin:'900',capMax:'100',topHoldersMax:'105',holdersMin:'1.2'}});
 const errors=settingsErrors(w.state.draft.fields.filters);assert.ok(errors.capMax&&errors.topHoldersMax&&errors.holdersMin);assert.equal(w.saveDraft(),null);assert.equal(w.state.draft.fields.filters.capMax,'100');
});
test('unknown risk is its own selectable status and empty selection is invalid',()=>{
 const r=defaultSettings();assert.ok(r.riskLevels.includes('unknown'));r.riskLevels=[];assert.ok(settingsErrors(r).riskLevels);
 r.riskLevels=['unknown'];assert.deepEqual(settingsErrors(r),{});assert.ok(settingsRows(r).some(([key,value])=>key==='Risk preferences'&&value==='Not assessed'));
});
test('public account validation is scoped and post types cannot be empty',()=>{
 const r={...defaultSettings('public'),accounts:'https://x.com/example',postTypes:[]};assert.ok(settingsErrors(r).accounts);assert.ok(settingsErrors(r).postTypes);
 r.type='projects';assert.equal(settingsErrors(r).accounts,undefined);assert.equal(settingsErrors(r).postTypes,undefined);
});
test('curve stages use real reserves while hidden DEX liquidity is retained, not applied',()=>{
 const r={...defaultSettings('projects'),stage:'curve',liquidityMin:'10000',reserveMin:'500'};
 const rows=settingsRows(r);assert.ok(!rows.some(([label])=>label==='DEX liquidity'));assert.ok(rows.some(([label,value])=>label==='Launchpad reserves'&&value.includes('real reserves')));
 assert.equal(cleanSettings(r).liquidityMin,'10000');r.stage='dex';assert.ok(settingsRows(r).some(([label])=>label==='DEX liquidity'));assert.ok(!settingsRows(r).some(([label])=>label==='Launchpad reserves'));
});
test('a pre-DEX launch stage cannot be combined with a DEX pool age',()=>{
 const r={...defaultSettings('projects'),stage:'curve',ageBasis:'pool'};assert.ok(settingsErrors(r).ageBasis);r.ageBasis='trading';assert.deepEqual(settingsErrors(r),{});
});
test('old saved work retains identity and choices without inventing numeric liquidity thresholds',()=>{
 const disk=memory(),w=createWorkspace(disk);const saved=w.saveLibrary('balanced').scanner;w.beginDraft({mode:'edit',scanner:saved});
 const legacy=JSON.parse(w.export());delete legacy.savedScanners[0].filters;delete legacy.draft.fields.filters;
 legacy.draft.fields.age='At least 30 days';legacy.draft.fields.concentration=false;disk.setItem(STORAGE_KEY,JSON.stringify(legacy));
 const migrated=createWorkspace(disk);assert.equal(migrated.state.savedScanners[0].id,saved.id);assert.equal(migrated.state.savedScanners[0].filters.type,'public');assert.equal(migrated.state.draft.fields.filters.ageMin,'720');assert.equal(migrated.state.draft.fields.filters.ageBasis,'mint');assert.equal(migrated.state.draft.fields.filters.liquidityMin,'');assert.equal(migrated.state.draft.fields.filters.legacyLiquidity,'Established');assert.equal(migrated.state.draft.fields.concentration,false);
});
