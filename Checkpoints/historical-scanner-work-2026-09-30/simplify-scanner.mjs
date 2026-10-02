import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const project = String.raw`C:\Users\jayde\OneDrive\Desktop\SolTech\soltech-refined`;
const task = String.raw`C:\Users\jayde\Documents\Codex\2026-09-30\soltech-continuation\work`;
const planPath = path.join(task, 'scanner-change-plan.json');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const mode = process.argv[2];

if (mode === '--prepare') {
  const jsPath = path.join(project, 'dist', 'personal-scanner.js');
  const cssPath = path.join(project, 'dist', 'soltech-identity.css');
  const notesPath = path.join(project, 'DESIGN-NOTES.md');
  const js = fs.readFileSync(jsPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');
  const notes = fs.readFileSync(notesPath, 'utf8');
  const begin = js.indexOf('   function home(){');
  const end = js.indexOf('   function finds(){', begin);
  if (begin < 0 || end < 0 || !js.slice(begin, end).includes('scanner-source-summary')) throw new Error('Scanner home does not match the reviewed source.');
  const home = `   function home(){
    const c=store.effective;
    const heading='<div class="page-intro"><h1>Scanner<span class="accent">.</span></h1></div>';
    if(!c)return heading+notice();
    // Monitoring is not connected in this preview; saved settings are not an active scanner.
    return heading+notice()+\`<section class="scanner-status-card" data-state="inactive" aria-labelledby="scanner-status-title"><div class="scanner-status-heading"><h2 id="scanner-status-title">\${esc(c.name||'Soltech scanner')}</h2><span class="scanner-state"><span class="scanner-state-dot" aria-hidden="true"></span>Inactive</span></div><p class="scanner-status-copy">Monitoring isn’t connected yet.</p><div class="scanner-status-actions"><a class="button glass scanner-status-customize" href="#scanner/edit">Customize</a></div></section>\`;
   }
`;
  const styles = `
 /* Scanner landing page: one quiet status card, with optional customization. */
 .scanner-status-card{padding:24px;border:1px solid #bcc5d0;border-radius:18px;background:#fff;box-shadow:0 2px 6px #24324506}
 .scanner-status-heading{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px}
 .scanner-status-heading h2{min-width:0;font-size:1.25rem;font-weight:650;line-height:1.3;letter-spacing:-.025em;overflow-wrap:anywhere}
 .scanner-state{display:inline-flex;align-items:center;gap:7px;flex:none;padding:5px 10px;border:1px solid #d9dfe6;border-radius:999px;background:#f3f5f7;color:#505c6b;font-size:.8125rem;font-weight:600;line-height:1.5}
 .scanner-state-dot{width:6px;height:6px;border-radius:50%;background:#7a8593;flex:none}
 .scanner-status-copy{margin:14px 0 0;color:#556170;font-size:.875rem;line-height:1.6}
 .scanner-status-actions{display:flex;justify-content:flex-end;margin-top:24px}
 .scanner-status-actions .scanner-status-customize{min-height:44px;padding:10px 18px;font-size:.875rem;border-radius:11px}
 @media(max-width:600px){.scanner-status-card{padding:20px}.scanner-status-heading{gap:12px}}
 @media(forced-colors:active){.scanner-status-card{border-color:CanvasText;background:Canvas;box-shadow:none}.scanner-state{border-color:CanvasText;background:Canvas;color:CanvasText}.scanner-state-dot{background:CanvasText}.scanner-status-copy{color:CanvasText}}
`;
  const cssEnd = css.lastIndexOf('}');
  if (cssEnd < 0 || css.includes('.scanner-status-card{')) throw new Error('Styles do not match the reviewed source.');
  const note = `\n## Latest: one scanner status card — September 30\n\nThe user requested a simpler Scanner landing page on white: the Scanner heading and one box for Soltech scanner, its activity state, and optional Customize. The source lists, rule accordions, decorative scanner badge, repeated setup copy and device footer have been removed from this landing page. Customization, stored configurations, previous setups and drafts remain in the existing feature.\n\nThe card says Inactive and explains that monitoring is not connected yet. It does not simulate activation. The user's future direction is a white profile from the existing logo with eyes that turn green when real monitoring is active; that artwork and activation behavior are not implemented by this change. The original logo remains intact. This is a local change with no deployment.\n`;
  const changes = [
    {file:jsPath, before:js, after:js.slice(0,begin)+home+js.slice(end)},
    {file:cssPath, before:css, after:css.slice(0,cssEnd)+styles+css.slice(cssEnd)},
    {file:notesPath, before:notes, after:notes+note}
  ].map(change => ({...change, beforeHash:hash(change.before)}));
  fs.mkdirSync(task,{recursive:true});
  fs.writeFileSync(planPath,JSON.stringify(changes,null,2));
  console.log('Prepared three-file change: scanner landing markup, scoped card styles, and design notes. No project files changed.');
  console.log(home);
  console.log(styles);
} else if (mode === '--apply') {
  const changes=JSON.parse(fs.readFileSync(planPath,'utf8'));
  for(const change of changes) if(hash(fs.readFileSync(change.file,'utf8'))!==change.beforeHash) throw new Error('A project file changed after preparation: '+change.file);
  const backup=path.join(task,'scanner-before-'+new Date().toISOString().replaceAll(':','-'));
  fs.mkdirSync(backup,{recursive:true});
  for(const change of changes){
    fs.writeFileSync(path.join(backup,path.basename(change.file)),change.before);
    fs.writeFileSync(change.file,change.after);
  }
  console.log('Applied the prepared scanner change. Original files preserved in the task work backup.');
} else throw new Error('Use --prepare or --apply.');
