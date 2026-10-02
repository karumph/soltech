import test from 'node:test';
import assert from 'node:assert/strict';
import {findingsForScanner,unreadFindings} from '../dist/scanner-findings.js';
import {createWorkspace,STORAGE_KEY} from '../dist/workspace.js';
import {defaultSettings} from '../dist/scanner-settings.js';
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};};

test('sample result family follows current scanner type, including a customized source',()=>{
 const edited={sourceId:'balanced',filters:defaultSettings('projects')};
 const {visible,excluded}=findingsForScanner(edited);
 assert.deepEqual(visible.map(group=>group.coin.id),['luma','cove']);
 assert.deepEqual(excluded.map(group=>group.coin.id),['pico']);
 assert.ok(visible.every(group=>group.matches.every(match=>match.scannerId==='momentum')));
 const publicResults=findingsForScanner({filters:defaultSettings('public')});
 assert.deepEqual(publicResults.visible.map(group=>group.coin.id),['orbit','cove']);
 assert.equal(publicResults.excluded.length,0);
});

test('opening one coin reduces only that scanner’s unread count and persists across move/reload',()=>{
 const disk=memory(),w=createWorkspace(disk);
 const early=w.saveLibrary('momentum').scanner,people=w.saveLibrary('balanced').scanner;
 assert.equal(unreadFindings(early).length,2);
 w.markFindingSeen(early.id,'cove');w.markFindingSeen(early.id,'cove');
 assert.deepEqual(w.state.seenFindings[early.id],['cove']);
 assert.equal(unreadFindings(early,w.state.seenFindings[early.id]).length,1);
 assert.equal(unreadFindings(people,w.state.seenFindings[people.id]).length,2);
 w.move(early.id,'saved');w.move(early.id,'active');
 const reopened=createWorkspace(disk);
 assert.equal(unreadFindings(reopened.state.savedScanners[0],reopened.state.seenFindings[early.id]).length,1);
 assert.equal(reopened.state.savedScanners.length,2);
});

test('old workspaces gain empty seen state while saved work and drafts remain unchanged',()=>{
 const disk=memory(),w=createWorkspace(disk);const saved=w.saveLibrary('balanced').scanner;
 w.beginDraft({mode:'edit',scanner:saved});w.updateDraft({name:'Unfinished'});
 const old=JSON.parse(w.export());delete old.seenFindings;disk.setItem(STORAGE_KEY,JSON.stringify(old));
 const loaded=createWorkspace(disk);
 assert.deepEqual(loaded.state.seenFindings,{});
 assert.equal(loaded.state.draft.fields.name,'Unfinished');
 assert.equal(loaded.state.savedScanners[0].id,saved.id);
 loaded.markFindingSeen('missing','cove');assert.deepEqual(loaded.state.seenFindings,{});
});

test('saving an edit whose original was deleted reports recovery into a new scanner',()=>{
 const w=createWorkspace(memory()),original=w.saveLibrary('momentum').scanner;
 w.beginDraft({mode:'edit',scanner:original});w.updateDraft({name:'Recovered work'});w.remove(original.id);
 const result=w.saveDraft();
 assert.equal(result.recovered,true);assert.equal(result.existing,false);
 assert.notEqual(result.scanner.id,original.id);assert.equal(result.scanner.name,'Recovered work');
 assert.equal(result.scanner.placement,'saved');
});
