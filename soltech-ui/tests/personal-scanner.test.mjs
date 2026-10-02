import test from 'node:test';
import assert from 'node:assert/strict';
import {PERSONAL_SCANNER_KEY,createPersonalScannerStore,defaultPersonalScanner,applyScannerPreset,enabledSources,personalScannerErrors} from '../dist/personal-scanner-store.js';
const memory=()=>{const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)};};
const configure=(store)=>{store.begin('both');const c=store.state.draft.config;c.sources.public.settings.accountScope='custom';c.sources.public.settings.accounts='@example';store.update(c);return c;};

test('one saved scanner combines independent sources and never changes legacy workspace',()=>{
 const disk=memory(),legacy='{"draft":"kept","savedScanners":[1]}';disk.setItem('soltech.workspace.v1',legacy);
 const s=createPersonalScannerStore(disk),c=configure(s);c.sources.projects.settings.ageMax='6';c.sources.public.settings.ageMax='';s.update(c);assert.equal(s.save().ok,true);
 const read=createPersonalScannerStore(disk).state;assert.deepEqual(enabledSources(read.saved),['public','projects']);assert.equal(read.saved.sources.public.settings.ageMax,'');assert.equal(read.saved.sources.projects.settings.ageMax,'6');assert.equal(read.draft,null);assert.equal(disk.getItem('soltech.workspace.v1'),legacy);
});
test('source presets keep accounts, filters and disabled source settings',()=>{
 const c=defaultPersonalScanner();c.sources.public.settings.accounts='@example';c.sources.projects.settings.capMin='0';c.sources.market.settings.priceMin='-10';
 const project=applyScannerPreset(c,'projects'),both=applyScannerPreset(project,'both');assert.deepEqual(enabledSources(both),['public','projects']);assert.equal(both.sources.public.settings.accounts,'@example');assert.equal(both.sources.projects.settings.capMin,'0');assert.equal(both.sources.market.settings.priceMin,'-10');
});
test('draft edits and cancellation never alter the saved scanner',()=>{
 const disk=memory(),s=createPersonalScannerStore(disk);configure(s);s.save();const original=s.state.saved;s.begin();const c=s.state.draft.config;c.name='Unsaved';s.update(c);s.step('filters','projects');
 const reload=createPersonalScannerStore(disk);assert.equal(reload.state.draft.screen,'filters');assert.equal(reload.state.draft.source,'projects');assert.deepEqual(reload.state.saved,original);reload.cancel();assert.deepEqual(createPersonalScannerStore(disk).state.saved,original);assert.equal(reload.state.draft,null);
});
test('only enabled sources validate and every source cannot be disabled at save',()=>{
 const s=createPersonalScannerStore(memory());s.begin('projects');let c=s.state.draft.config;c.sources.public.settings.accountScope='custom';c.sources.public.settings.accounts='bad/link';s.update(c);assert.equal(s.save().ok,true);
 s.begin();c=s.state.draft.config;c.sources.public.enabled=true;s.update(c);assert.ok(s.save().errors.some(e=>e.source==='public'&&e.key==='accounts'));
 for(const source of Object.values(c.sources))source.enabled=false;assert.ok(personalScannerErrors(c).some(e=>e.key==='sources'));
});
test('an existing draft is never replaced by begin or a new preset',()=>{
 const s=createPersonalScannerStore(memory());configure(s);const original=s.state.draft;assert.equal(s.begin('projects'),false);assert.deepEqual(s.state.draft,original);
});
test('cross-tab conflict retains local draft and does not overwrite remote changes',()=>{
 const disk=memory(),a=createPersonalScannerStore(disk);configure(a);a.save();const b=createPersonalScannerStore(disk);a.begin();b.begin('projects');assert.equal(b.issue,'conflict');const remote=disk.getItem(PERSONAL_SCANNER_KEY);assert.equal(b.state.draft.config.sources.public.enabled,false);assert.equal(b.save().ok,false);assert.equal(disk.getItem(PERSONAL_SCANNER_KEY),remote);assert.ok(b.state.draft);
});
test('failed final save keeps previous saved state and the recoverable draft',()=>{
 const disk=memory(),s=createPersonalScannerStore(disk);configure(s);s.save();const original=s.state.saved;s.begin();const c=s.state.draft.config;c.name='Edited';s.update(c);const set=disk.setItem;disk.setItem=()=>{throw Error('quota');};assert.equal(s.save().ok,false);assert.deepEqual(s.state.saved,original);assert.equal(s.state.draft.config.name,'Edited');disk.setItem=set;assert.equal(s.save().ok,true);assert.equal(createPersonalScannerStore(disk).state.saved.name,'Edited');
});
test('unrecognized saved data remains untouched',()=>{
 const disk=memory();disk.setItem(PERSONAL_SCANNER_KEY,'{"schemaVersion":999}');const s=createPersonalScannerStore(disk);assert.equal(s.issue,'read');assert.equal(s.effective,null);s.begin('both');assert.equal(disk.getItem(PERSONAL_SCANNER_KEY),'{"schemaVersion":999}');
});

test('storage-event conflicts retain the local draft without replacing it',()=>{
 const disk=memory(),a=createPersonalScannerStore(disk);configure(a);const b=createPersonalScannerStore(disk);const local=a.state.draft;
 const changed=b.state.draft.config;changed.name='Other tab';b.update(changed);const remote=disk.getItem(PERSONAL_SCANNER_KEY);
 assert.equal(a.detectConflict(),true);assert.equal(a.issue,'conflict');assert.deepEqual(a.state.draft,local);assert.equal(disk.getItem(PERSONAL_SCANNER_KEY),remote);
});

test('fresh visits derive one default without writing storage or creating a draft',()=>{
 const disk=memory(),s=createPersonalScannerStore(disk),c=s.effective;
 assert.equal(c.name,'Soltech scanner');assert.deepEqual(enabledSources(c),['public','projects']);
 assert.equal(c.sources.public.settings.accountScope,'soltech');assert.equal(c.sources.projects.settings.ageMax,'24');
 assert.equal(s.state.saved,null);assert.equal(s.state.draft,null);assert.equal(disk.getItem(PERSONAL_SCANNER_KEY),null);
 c.name='Changed copy';c.sources.projects.settings.ageMax='1';
 assert.equal(s.effective.name,'Soltech scanner');assert.equal(s.effective.sources.projects.settings.ageMax,'24');
});

test('default cosmetic edits save without requiring a personal X list',()=>{
 const disk=memory(),s=createPersonalScannerStore(disk);s.begin();const c=s.state.draft.config;
 c.name='My discovery feed';c.badgeColor='teal';s.update(c);assert.equal(s.save().ok,true);
 const reopened=createPersonalScannerStore(disk);assert.equal(reopened.effective.name,'My discovery feed');
 assert.equal(reopened.effective.sources.public.settings.accountScope,'soltech');assert.equal(reopened.effective.sources.public.settings.accounts,'');
});

test('cancelling a first customization returns the unchanged default',()=>{
 const disk=memory(),s=createPersonalScannerStore(disk),original=s.effective;s.begin();const c=s.state.draft.config;
 c.sources.public.enabled=false;c.name='Abandoned';s.update(c);assert.equal(s.cancel(),true);
 const reopened=createPersonalScannerStore(disk);assert.deepEqual(reopened.effective,original);assert.equal(reopened.state.saved,null);assert.equal(reopened.state.draft,null);
});

test('custom account scope validates handles and switching scope preserves them',()=>{
 const s=createPersonalScannerStore(memory());s.begin();const c=s.state.draft.config,r=c.sources.public.settings;
 r.accountScope='custom';s.update(c);assert.ok(s.save().errors.some(e=>e.key==='accounts'));
 r.accounts='bad/link';r.accountScope='soltech';s.update(c);assert.equal(s.save().ok,true);
 s.begin();const resumed=s.state.draft.config;assert.equal(resumed.sources.public.settings.accounts,'bad/link');
 resumed.sources.public.settings.accountScope='custom';s.update(resumed);assert.ok(s.save().errors.some(e=>e.key==='accounts'));
 resumed.sources.public.settings.accounts='@example';s.update(resumed);assert.equal(s.save().ok,true);
});

test('legacy saved configurations and drafts infer custom scope without replacing choices',()=>{
 const disk=memory(),saved=defaultPersonalScanner(),draft=defaultPersonalScanner();
 saved.name='Earlier scanner';saved.sources.projects.enabled=false;saved.sources.public.settings.accounts='@original';
 draft.name='Unfinished';draft.sources.public.settings.accounts='@draft';
 for(const c of [saved,draft])for(const source of Object.values(c.sources))delete source.settings.accountScope;
 disk.setItem(PERSONAL_SCANNER_KEY,JSON.stringify({schemaVersion:1,revision:3,saved,draft:{config:draft,screen:'review',source:'public'}}));
 const before=disk.getItem(PERSONAL_SCANNER_KEY),s=createPersonalScannerStore(disk);
 assert.equal(s.effective.name,'Earlier scanner');assert.deepEqual(enabledSources(s.effective),['public']);assert.equal(s.effective.sources.public.settings.accountScope,'custom');
 assert.equal(s.effective.sources.public.settings.accounts,'@original');assert.equal(s.state.draft.config.sources.public.settings.accountScope,'custom');
 assert.equal(s.state.draft.config.sources.public.settings.accounts,'@draft');assert.equal(s.state.draft.screen,'review');
 assert.equal(s.begin(),false);assert.equal(disk.getItem(PERSONAL_SCANNER_KEY),before);
});
