import test from 'node:test';
import assert from 'node:assert/strict';
import {createBundlerSetup} from '../bundler-setup.mjs';

const port=4175,host='127.0.0.1:'+port,origin='http://'+host;
const dummyKey='dummy-key-for-local-tests-only';

function request({method='GET',headers={},chunks=[]}={}){
 return {method,headers:{host,...headers},async *[Symbol.asyncIterator](){
  for(const chunk of chunks)yield Buffer.from(chunk);
 }};
}

async function invoke(setup,pathname,options={}){
 const response={status:null,headers:{},body:''};
 const handled=await setup(request(options),{
  writeHead(status,headers){response.status=status;response.headers=headers;},
  end(body=''){response.body+=body;}
 },pathname);
 return {handled,...response};
}

async function fixture(setKey=()=>{}){
 const setup=createBundlerSetup({port,setKey});
 const page=await invoke(setup,'/setup/bundlers');
 const token=page.body.match(/'X-Soltech-Setup':'([a-f0-9]{64})'/)?.[1];
 assert.ok(token,'setup page supplies a session token');
 const post=({headers={},chunks=[JSON.stringify({key:dummyKey})],method='POST'}={})=>invoke(setup,'/api/bundlers/configure',{
  method,headers:{origin,'content-type':'application/json','x-soltech-setup':token,...headers},chunks
 });
 return {setup,page,token,post};
}

test('setup page protects the password form and does not cache or allow external resources',async()=>{
 const {setup,page,token}=await fixture();
 assert.equal(page.handled,true);assert.equal(page.status,200);
 assert.equal(page.headers['Cache-Control'],'no-store');
 assert.equal(page.headers['Referrer-Policy'],'no-referrer');
 assert.equal(page.headers['X-Frame-Options'],'DENY');
 assert.equal(page.headers['X-Content-Type-Options'],'nosniff');
 const csp=page.headers['Content-Security-Policy'];
 for(const directive of ["default-src 'none'","connect-src 'self'","frame-ancestors 'none'","base-uri 'none'"])assert.ok(csp.includes(directive));
 const nonce=csp.match(/script-src 'nonce-([^']+)'/)?.[1];
 assert.ok(nonce);assert.ok(csp.includes("style-src 'nonce-"+nonce+"'"));
 assert.ok(page.body.includes('<script nonce="'+nonce+'">'));
 assert.ok(page.body.includes('<style nonce="'+nonce+'">'));
 assert.doesNotMatch(page.body,/<(?:script|iframe|img)[^>]+src=/i);
 const input=page.body.match(/<input\b[^>]*id="api-key"[^>]*>/)?.[0];
 assert.ok(input);assert.match(input,/type="password"/);assert.match(input,/autocomplete="off"/);assert.doesNotMatch(input,/\bvalue=/);
 const nextPage=await invoke(setup,'/setup/bundlers');
 assert.notEqual(nextPage.headers['Content-Security-Policy'],csp,'each page response gets a new CSP nonce');
 assert.notEqual((await fixture()).token,token,'separate setup sessions get separate CSRF tokens');
});

test('configuration rejects hostile hosts, cross-origin or absent origins, and invalid tokens without changing the key',async()=>{
 const keys=[];const {post,token}=await fixture(key=>keys.push(key));
 const wrongToken=(token[0]==='0'?'1':'0')+token.slice(1);
 for(const headers of [
  {host:'evil.example'},
  {host:'127.0.0.1:4176'},
  {origin:'https://evil.example'},
  {origin:undefined},
  {origin:'null'},
  {origin:'http://localhost:'+port},
  {'sec-fetch-site':'cross-site'},
  {'x-soltech-setup':undefined},
  {'x-soltech-setup':wrongToken},
  {'x-soltech-setup':'short'},
  {'x-soltech-setup':'é'.repeat(64)},
  {'x-soltech-setup':['a'.repeat(64)]}
 ]){
  const result=await post({headers});
  assert.equal(result.status,403);assert.equal(result.headers['Cache-Control'],'no-store');
  assert.ok(!result.body.includes(dummyKey));
 }
 assert.deepEqual(keys,[]);
});

test('configuration requires POST and JSON, and bounds declared and streamed body sizes',async()=>{
 const keys=[];const {post}=await fixture(key=>keys.push(key));
 assert.equal((await post({method:'GET'})).status,405);
 for(const contentType of [undefined,'text/plain','application/x-www-form-urlencoded']){
  assert.equal((await post({headers:{'content-type':contentType}})).status,415);
 }
 assert.equal((await post({headers:{'content-length':'2049'}})).status,413);
 assert.equal((await post({chunks:['x'.repeat(1024),'x'.repeat(1024),'x']})).status,413);
 assert.equal((await post({chunks:['é'.repeat(1100)]})).status,413,'streaming limit counts bytes');
 assert.deepEqual(keys,[]);
});

test('malformed JSON and invalid key values never reach configuration or leak submitted data',async()=>{
 const keys=[];const {post}=await fixture(key=>keys.push(key));
 const invalidKeys=[null,{},42,'short','x'.repeat(513),'leading space','line\nbreak','é'.repeat(20)];
 const bodies=['','{invalid-json','null','{}',...invalidKeys.map(key=>JSON.stringify({key}))];
 for(const body of bodies){
  const result=await post({chunks:[body]});
  assert.equal(result.status,400);assert.ok(JSON.parse(result.body).error);
 }
 const malformedWithDummy=await post({chunks:['{"key":"'+dummyKey+'"']});
 assert.equal(malformedWithDummy.status,400);assert.ok(!malformedWithDummy.body.includes(dummyKey));
 assert.deepEqual(keys,[]);
});

test('valid dummy key is passed once to the callback without appearing in responses or later setup pages',async()=>{
 const keys=[];const {setup,post}=await fixture(key=>keys.push(key));
 const result=await post({chunks:['{"key":"',dummyKey,'"}']});
 assert.equal(result.status,200);assert.deepEqual(JSON.parse(result.body),{status:'configured'});
 assert.equal(result.headers['Cache-Control'],'no-store');
 assert.deepEqual(keys,[dummyKey]);assert.ok(!result.body.includes(dummyKey));
 assert.ok(!(await invoke(setup,'/setup/bundlers')).body.includes(dummyKey));
 const throwing=await fixture(()=>{throw new Error(dummyKey);});
 const failure=await throwing.post();assert.equal(failure.status,400);assert.ok(!failure.body.includes(dummyKey));
});

test('setup handler rejects inappropriate setup-page requests and leaves unrelated routes alone',async()=>{
 const {setup}=await fixture();
 assert.equal((await invoke(setup,'/setup/bundlers',{method:'POST'})).status,405);
 assert.equal((await invoke(setup,'/setup/bundlers',{headers:{host:'evil.example'}})).status,403);
 const unrelated=await invoke(setup,'/api/bundlers');
 assert.equal(unrelated.handled,false);assert.equal(unrelated.status,null);assert.equal(unrelated.body,'');
});
