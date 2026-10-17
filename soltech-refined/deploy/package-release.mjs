import {createHash} from 'node:crypto';
import {builtinModules} from 'node:module';
import {mkdir,readFile,writeFile,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT=path.resolve(here,'..');
// Deliberate list: adding a file to dist does not automatically publish it.
export const FRONTEND_FILES=Object.freeze(`
app.css app.js blue-glass.css coin-checker-data.js coin-checker.css coin-checker.js
coin-feed-copy.js coin-feed.css coin-feed.js coin-history-chart.js coin-history.js
coin-network-discovery.js coin-networks.js coin-recent.css coin-recent.js
daily-recap.css daily-recap.js data.js index.html navigation-glass.css
personal-scanner-store.js personal-scanner.css personal-scanner.js photo-crop.js
profile-shortcut-icons.js profile-shortcut.js profile-store.js profile.css profile.js
scanner-appearance.js scanner-builder.css scanner-builder.js scanner-client.js
scanner-customize.css scanner-customize.js scanner-editor.css scanner-editor.js
scanner-feed.css scanner-feed.js scanner-findings.css scanner-findings.js
scanner-flow.css scanner-flow.js scanner-guidance.js scanner-icons.js
scanner-result-filters.js scanner-settings.js signals.css signals.js silver-borders.css
soltech-identity.css wallet-check.css wallet-check.js wallet-holding-logos.js
wallet-recent.js wallet-token-logo.js wallet-token-metadata.js wallet-transactions.js workspace.js
assets/address-cut-corner.svg assets/address-cut-corner-error.svg assets/address-cut-corner-focus.svg
assets/feed-coin-bonk.png assets/feed-coin-jup.png assets/feed-coin-pengu.png
assets/feed-coin-popcat.png assets/feed-coin-ray.png assets/feed-coin-wif.png
assets/feed-demo-aster.svg assets/feed-demo-cove.svg assets/feed-demo-luma.svg
assets/feed-demo-mica.svg assets/feed-demo-orbit.svg assets/feed-demo-relay.svg
assets/phosphor-license.txt assets/soltech-logo.png assets/x-logo.png
vendor/lightweight-charts-5.2.1/LICENSE vendor/lightweight-charts-5.2.1/NOTICE
vendor/lightweight-charts-5.2.1/README.md vendor/lightweight-charts-5.2.1/lightweight-charts.standalone.production.js
`.trim().split(/\s+/).sort());

const API_LITERAL=/(["'`])\/api(?=[/?#"'`])/g;
const SERVICE_MODULES=new Set(['deploy/production-server.mjs','wallet-api.mjs','wallet-transactions-api.mjs','signals-api.mjs','bundler-api.mjs','scanner-api.mjs','scanner-runtime.mjs','scanner-providers.mjs','scanner-analysis.mjs','scanner-post-summary.mjs']);
const builtin=new Set(builtinModules.flatMap(name=>[name,name.replace(/^node:/,''),'node:'+name.replace(/^node:/,'')]));
const slash=value=>value.split(path.sep).join('/');
const sha=body=>createHash('sha256').update(body).digest('hex');
const codeFile=name=>/\.(?:[cm]?js)$/.test(name);
const textFile=name=>/\.(?:[cm]?js|css|html|svg|md|txt)$/.test(name)||/(?:^|\/)(?:LICENSE|NOTICE)$/.test(name);

function safeRelative(value){
 if(typeof value!=='string'||!value||value.includes('\\')||value.startsWith('/')||value.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('Unsafe release path: '+value);
 if(value.split('/').some(part=>part.startsWith('.')||/^(?:node_modules|tests?|review|backups?|Checkpoints|secrets?)$/i.test(part))||/\.(?:pem|key|p12|pfx|log|zip|map)$/i.test(value))throw Error('Private or development path is not publishable: '+value);
 return value;
}

async function sourceFile(root,relative){
 safeRelative(relative);
 const absolute=path.resolve(root,relative);
 if(!absolute.startsWith(root+path.sep))throw Error('Source escapes project: '+relative);
 const entry=await lstat(absolute);
 if(!entry.isFile()||entry.isSymbolicLink())throw Error('Source must be a regular file: '+relative);
 const resolved=await realpath(absolute);
 if(!resolved.startsWith(root+path.sep))throw Error('Source resolves outside project: '+relative);
 return readFile(absolute);
}

function assertNoCredentials(text,name){
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/.test(text))throw Error('Credential pattern found; release stopped: '+name);
}

export function moduleReferences(text){
 const found=[];
 for(const pattern of [/\b(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?["']([^"']+)["']/g,/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g]){
  for(const match of text.matchAll(pattern))found.push(match[1]);
 }
 if(/\bimport\s*\(\s*[^\s"']/.test(text))throw Error('Computed imports need an explicit release dependency list.');
 return [...new Set(found)];
}

function dependency(from,specifier){
 if(builtin.has(specifier))return null;
 if(!specifier.startsWith('./')&&!specifier.startsWith('../'))throw Error('Unpackaged dependency '+specifier+' in '+from);
 const result=path.posix.normalize(path.posix.join(path.posix.dirname(from),specifier));
 return safeRelative(result);
}

export function transformFrontend(relative,body){
 if(!/\.(?:js|html|css)$/.test(relative))return body;
 let text=body.toString('utf8').replace(API_LITERAL,(_all,quote)=>quote+'/sjay-api');
 if(relative==='scanner-client.js'){
  const before='if(listeners.size===1){void refresh().catch(()=>{});connect();}';
  const after='if(listeners.size===1){void refresh().catch(()=>{}).finally(connect);}';
  if(text.split(before).length!==2)throw Error('Scanner session bootstrap changed; review production transform.');
  text=text.replace(before,after);
 }
 const hostedCopy={
  'scanner-flow.js':[
   ['Connecting to your local scanner…','Connecting to your scanner…'],
   ['Runs while this local service is open, even if you leave this page.','Runs on the server, even if you leave this page. Pause to stop scanning.'],
  ],
  'app.js':[['Scanner results are stored by this local service;','Scanner results are stored by the hosted service for this browser session;']],
  'profile.js':[
   ['The local scanner reads indexed Solana markets','The scanner reads indexed Solana markets'],
   ['Results are saved by this local service, separately from browser history. It continues while the service is open until you pause it.','Results are saved by the hosted service for this browser session, separately from browser history. Scans run on the server; use Pause to stop new discovery.'],
  ],
 };
 for(const [before,after] of hostedCopy[relative]||[])text=text.replaceAll(before,after);
 if(API_LITERAL.test(text))throw Error('Unrewritten API literal in '+relative);
 API_LITERAL.lastIndex=0;
 return Buffer.from(text);
}

function assetReferences(text){
 const refs=[];
 for(const pattern of [/(?:src|href)\s*=\s*["']([^"']+)["']/g,/url\(\s*["']?([^\s"')]+)["']?\s*\)/g]){
  for(const match of text.matchAll(pattern)){
   const ref=match[1];
   if(ref.startsWith('#')||/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(ref)||ref.includes('${'))continue;
   refs.push(ref.split(/[?#]/)[0]);
  }
 }
 return refs.filter(Boolean);
}

export function validateFrontend(records){
 const files=new Map(records.map(record=>[record.path,record.body]));
 const hosts=new Set();let checked=0;
 for(const [file,body] of files){
  if(!textFile(file))continue;
  const text=body.toString('utf8');assertNoCredentials(text,file);
  // SVG namespace declarations are not network requests. Plain HTTP endpoints are.
  if(/http:\/\/(?!www\.w3\.org\/|www\.apache\.org\/)[^\s"'<>]+/.test(text))throw Error('Non-HTTPS reference in '+file);
  if(/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])\b/i.test(text))throw Error('Local endpoint in '+file);
  for(const match of text.matchAll(/https:\/\/([a-z\d.-]+)/gi))hosts.add(match[1].toLowerCase());
  const refs=codeFile(file)?moduleReferences(text).filter(ref=>ref.startsWith('.')):[];
  for(const ref of refs){
   const target=dependency(file,ref);if(!files.has(target))throw Error('Missing frontend import: '+file+' -> '+target);checked++;
  }
  for(const ref of assetReferences(text)){
   if(ref.startsWith('/sjay-api/')||ref==='/sjay-api')continue;
   const target=ref.startsWith('/')?safeRelative(ref.slice(1)):safeRelative(path.posix.normalize(path.posix.join(path.posix.dirname(file),ref)));
   if(!files.has(target))throw Error('Missing frontend asset: '+file+' -> '+target);checked++;
  }
 }
 // Runtime-generated legacy coin image names are intentionally also enumerated.
 if(files.has('coin-feed.js'))for(const id of ['bonk','jup','pengu','popcat','ray','wif'])if(!files.has('assets/feed-coin-'+id+'.png'))throw Error('Missing generated coin asset: '+id);
 return {validatedReferences:checked,externalHosts:[...hosts].sort()};
}

export async function createReleasePlan({projectRoot=PROJECT_ROOT,frontendFiles=FRONTEND_FILES,serviceEntry='deploy/production-server.mjs'}={}){
 const root=await realpath(projectRoot),frontend=[],service=[];
 for(const file of [...frontendFiles].sort()){
  safeRelative(file);const original=await sourceFile(root,'dist/'+file);
  frontend.push({path:file,body:transformFrontend(file,original),sourceHash:sha(original)});
 }
 const validation=validateFrontend(frontend),queue=[serviceEntry],visited=new Set();
 while(queue.length){
  const file=queue.shift();if(visited.has(file))continue;visited.add(file);
  if(!(SERVICE_MODULES.has(file)||(file.startsWith('dist/')&&FRONTEND_FILES.includes(file.slice(5))&&codeFile(file))))throw Error('Service dependency is outside release source scope: '+file);
  const body=await sourceFile(root,file),text=body.toString('utf8');assertNoCredentials(text,file);
  service.push({path:file,body,sourceHash:sha(body)});
  for(const spec of moduleReferences(text)){const next=dependency(file,spec);if(next)queue.push(next);}
 }
 service.push({path:'package.json',body:Buffer.from('{\n  "private": true,\n  "type": "module",\n  "scripts": { "start": "node deploy/production-server.mjs" }\n}\n'),sourceHash:null});
 const entries=[...frontend.map(record=>({...record,group:'frontend'})),...service.map(record=>({...record,group:'service'}))].sort((a,b)=>(a.group+'/'+a.path).localeCompare(b.group+'/'+b.path));
 const files=entries.map(({group,path:relative,body,sourceHash})=>({path:group+'/'+relative,bytes:body.length,sha256:sha(body),sourceSha256:sourceHash}));
 const manifest={version:1,apiPrefix:'/sjay-api',serviceEntrypoint:'service/'+serviceEntry,transformations:['Frontend API literals use /sjay-api instead of /api.','Scanner initial snapshot completes before opening the session event stream.','Scanner service wording describes hosted browser-session operation; browser-local history and settings wording is preserved.'],...validation,files};
 manifest.releaseId=sha(JSON.stringify(manifest));
 return {entries,manifest};
}

export async function packageRelease({output,...options}={}){
 if(!output)throw Error('Choose a new release output directory.');
 const plan=await createReleasePlan(options),destination=path.resolve(output),root=await realpath(options.projectRoot||PROJECT_ROOT);
 if(destination===root||destination.startsWith(path.join(root,'dist')+path.sep)||destination===path.join(root,'dist'))throw Error('Release output must not replace source files.');
 await mkdir(path.dirname(destination),{recursive:true});
 // Exclusive creation prevents mixing a new release with stale assets or private files.
 await mkdir(destination);
 for(const {group,path:relative,body} of plan.entries){
  const file=path.join(destination,group,relative);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,body,{flag:'wx'});
 }
 await writeFile(path.join(destination,'release-manifest.json'),JSON.stringify(plan.manifest,null,2)+'\n',{flag:'wx'});
 return {output:destination,...plan.manifest};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const output=process.argv[2];
 if(!output){console.error('Usage: node soltech-refined/deploy/package-release.mjs <new-output-directory>');process.exitCode=1;}
 else packageRelease({output}).then(result=>console.log(JSON.stringify({output:result.output,releaseId:result.releaseId,files:result.files.length,validatedReferences:result.validatedReferences},null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
