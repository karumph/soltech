import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createReleasePlan,packageRelease,transformFrontend,validateFrontend,moduleReferences} from './package-release.mjs';

const sourceScanner='export function subscribe(){if(listeners.size===1){void refresh().catch(()=>{});connect();}}\nconst url="/api/scanner";';
const sourceHeaders=await readFile(new URL('./customHttp.yml',import.meta.url),'utf8');
async function fixture(t){
 const root=await mkdtemp(path.join(os.tmpdir(),'solventir-release-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(path.join(root,'dist'));await mkdir(path.join(root,'deploy'));
 const files={
  'dist/index.html':'<link href="app.css" rel="stylesheet"><script type="module" src="app.js"></script>',
  'dist/app.css':'body {color: #123}',
  'dist/app.js':'import "./scanner-client.js"; fetch("/api/wallet"); const upstream="https://example.com/api/public";',
  'dist/scanner-client.js':sourceScanner,
  'deploy/production-server.mjs':'import {createWalletAPI} from "../wallet-api.mjs"; import http from "node:http"; export {createWalletAPI};',
  'deploy/customHttp.yml':sourceHeaders,
  'wallet-api.mjs':'export function createWalletAPI(){return "/api/wallet";}',
  'dist/private-notes.txt':'DO NOT PUBLISH',
  '.env':'PRIVATE_CONFIGURATION',
 };
 await Promise.all(Object.entries(files).map(([file,body])=>writeFile(path.join(root,file),body)));
 return {root,options:{projectRoot:root,frontendFiles:['index.html','app.css','app.js','scanner-client.js']}};
}

test('isolated release rewrites endpoints, orders session startup, preserves original and excludes unlisted data',async t=>{
 const {root,options}=await fixture(t),output=path.join(root,'output');
 const result=await packageRelease({...options,output});
 assert.equal(result.apiPrefix,'/sjay-api');
 const app=await readFile(path.join(output,'frontend/app.js'),'utf8');
 assert.match(app,/fetch\("\/sjay-api\/wallet"\)/);
 assert.match(app,/https:\/\/example.com\/api\/public/);
 const scanner=await readFile(path.join(output,'frontend/scanner-client.js'),'utf8');
 assert.match(scanner,/\.finally\(connect\)/);assert.match(scanner,/\/sjay-api\/scanner/);
 assert.equal(await readFile(path.join(root,'dist/scanner-client.js'),'utf8'),sourceScanner);
 assert.equal(await readFile(path.join(output,'service/wallet-api.mjs'),'utf8'),'export function createWalletAPI(){return "/api/wallet";}');
 assert.deepEqual((await readdir(path.join(output,'frontend'))).sort(),['app.css','app.js','customHttp.yml','index.html','scanner-client.js']);
 assert.deepEqual((await readdir(output)).sort(),['frontend','release-manifest.json','service']);
 assert.equal(result.files.length,8);assert.ok(result.validatedReferences>=3);
 const repeated=await createReleasePlan(options);assert.equal(result.releaseId,repeated.manifest.releaseId);
 await assert.rejects(packageRelease({...options,output}),/EEXIST/);
});

test('release preserves host-only HTTPS header configuration and records its source hash',async t=>{
 const {root,options}=await fixture(t),output=path.join(root,'output');
 const result=await packageRelease({...options,output});
 const packaged=await readFile(path.join(output,'frontend/customHttp.yml'),'utf8');
 assert.equal(packaged,sourceHeaders);
 assert.equal(await readFile(path.join(root,'deploy/customHttp.yml'),'utf8'),sourceHeaders);
 assert.match(packaged,/key: 'Strict-Transport-Security'/);
 assert.match(packaged,/value: 'max-age=86400'/);
 assert.doesNotMatch(packaged,/includeSubDomains|preload/i);
 const hash=createHash('sha256').update(sourceHeaders).digest('hex');
 const entry=result.files.find(file=>file.path==='frontend/customHttp.yml');
 assert.equal(entry.sha256,hash);assert.equal(entry.sourceSha256,hash);
 assert.equal(result.files.some(file=>file.path==='service/deploy/customHttp.yml'),false);
});

test('release fails on missing imported assets before output creation',async t=>{
 const {root,options}=await fixture(t);await writeFile(path.join(root,'dist/app.js'),'import "./missing.js";');
 await assert.rejects(createReleasePlan(options),/Missing frontend import/);
});

test('release rejects development service setup and missing source dependencies',async t=>{
 const {root,options}=await fixture(t);
 await writeFile(path.join(root,'deploy/production-server.mjs'),'import "../bundler-setup.mjs";');
 await assert.rejects(createReleasePlan(options),/outside release source scope/);
 await writeFile(path.join(root,'deploy/production-server.mjs'),'import "../signals-api.mjs";');
 await assert.rejects(createReleasePlan(options),/ENOENT/);
});

test('credential patterns and non-HTTPS runtime references stop packaging',()=>{
 const records=body=>[{path:'app.js',body:Buffer.from(body)}];
 assert.throws(()=>validateFrontend(records('const key="'+'AKIA'+'1'.repeat(16)+'";')),/Credential pattern/);
 assert.throws(()=>validateFrontend(records('fetch("http://127.0.0.1:4185/api/scanner")')),/Non-HTTPS/);
 assert.throws(()=>validateFrontend(records('fetch("http://example.com/api")')),/Non-HTTPS/);
 assert.doesNotThrow(()=>validateFrontend([{path:'icon.svg',body:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')}]));
});

test('API transformation handles concatenated, template and bare prefixes without touching external URLs',()=>{
 const input='const a="/api/scanner"; const b=\'/api\'; const c=`/api/wallet`; const d="https://upstream.example/api/wallet"; const e="/apiary";';
 const output=transformFrontend('app.js',Buffer.from(input)).toString();
 assert.equal(output,'const a="/sjay-api/scanner"; const b=\'/sjay-api\'; const c=`/sjay-api/wallet`; const d="https://upstream.example/api/wallet"; const e="/apiary";');
 assert.throws(()=>transformFrontend('scanner-client.js',Buffer.from('different implementation')),/bootstrap changed/);
});

test('module audit includes static exports and literal imports and rejects computed imports',()=>{
 assert.deepEqual(moduleReferences('import x from "node:fs"; export {a} from "./a.js"; import("./b.js");'),['node:fs','./a.js','./b.js']);
 assert.throws(()=>moduleReferences('import(destination)'),/Computed imports/);
});

test('hosted copy changes service descriptions without changing browser-local history',()=>{
 const source='Scanner results are stored by this local service; settings, drafts, and recent coin and wallet addresses stay in this browser, without account sync.';
 const result=transformFrontend('app.js',Buffer.from(source)).toString();
 assert.match(result,/hosted service for this browser session/);
 assert.match(result,/settings, drafts, and recent coin and wallet addresses stay in this browser, without account sync/);
 assert.equal(transformFrontend('wallet-recent.js',Buffer.from('Saved on this device.')).toString(),'Saved on this device.');
});
