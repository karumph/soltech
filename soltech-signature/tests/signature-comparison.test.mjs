import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace,STORAGE_KEY} from '../dist/workspace.js';
import {createProfileStore,PROFILE_KEY} from '../dist/profile-store.js';
import {resultHTML} from '../dist/coin-checker.js';

const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};

test('a stale comparison tab preserves newer saved work and retains its own edits for export',()=>{
 const storage=memory(),first=createWorkspace(storage),stale=createWorkspace(storage);
 first.prepareWorkspace();first.saveLibrary('momentum');
 const stored=storage.getItem(STORAGE_KEY);
 stale.beginDraft();stale.updateDraft({name:'Unsaved in second tab'});
 assert.equal(stale.issue,'conflict');assert.equal(storage.getItem(STORAGE_KEY),stored);
 assert.equal(JSON.parse(stale.export()).draft.fields.name,'Unsaved in second tab');
 assert.equal(stale.retry(),false);assert.equal(storage.getItem(STORAGE_KEY),stored);
 assert.equal(createWorkspace(storage).state.savedScanners[0].sourceId,'momentum');
});

test('comparison stores never read or overwrite original profile or scanner records',()=>{
 const storage=memory();
 storage.setItem('soltech.workspace.v1','original scanner data');
 storage.setItem('soltech.profile.v1','original profile data');
 const workspace=createWorkspace(storage),profile=createProfileStore(storage);
 workspace.prepareWorkspace();workspace.saveLibrary('balanced');
 assert.equal(workspace.issue,null);assert.equal(profile.issue,null);
 assert.notEqual(STORAGE_KEY,'soltech.workspace.v1');assert.notEqual(PROFILE_KEY,'soltech.profile.v1');
 assert.equal(storage.getItem('soltech.workspace.v1'),'original scanner data');
 assert.equal(storage.getItem('soltech.profile.v1'),'original profile data');
});

test('identity and missing source evidence remain before tabs in every report view',()=>{
 const mint='So11111111111111111111111111111111111111112';
 const state={mint,chainId:'solana',market:{status:'empty'},risk:{status:'error'},history:{status:'error'},listing:{status:'error'}};
 for(const section of ['overview','chart','details']){
  const html=resultHTML(state,section),tabs=html.indexOf('role="tablist"');
  assert.ok(html.indexOf(mint)<tabs);assert.ok(html.indexOf('Behind this check')<tabs);
  assert.ok(html.indexOf('Some info missing')<tabs);assert.match(html,/Not assessed/);
  assert.doesNotMatch(html,/No flags reported|0%|100%/);
 }
 const loading=resultHTML({...state,market:{status:'loading'}});
 assert.match(loading,/Checking sources/);assert.doesNotMatch(loading,/No flags reported/);
});
