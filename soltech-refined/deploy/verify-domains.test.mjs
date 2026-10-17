import test from 'node:test';
import assert from 'node:assert/strict';
import {CANONICAL_ORIGIN,ENTRY_URLS,createRequester,validateFrontend,validateHealth,validateRedirect,verifyDomains,verifyFrontend} from './verify-domains.mjs';

const canonical=CANONICAL_ORIGIN+'/';
const page=()=>({status:200,headers:{'strict-transport-security':'max-age=86400'},body:'<html>App</html>'});
const redirect=location=>({status:301,headers:{location},body:''});
const health=()=>({status:200,headers:{'content-type':'application/json'},body:JSON.stringify({status:'ok',service:'solventir-api'})});

test('checks all eight entry URLs and API with a separately labelled DNS mode',async()=>{
 const visited=[];
 const report=await verifyDomains({resolver:'1.1.1.1',request:async url=>{
  visited.push(url);
  if(url.endsWith('/sjay-api/health'))return health();
  return url===canonical?page():redirect(canonical);
 }});
 assert.equal(report.ok,true);assert.equal(report.dns,'1.1.1.1');
 assert.equal(report.frontend.length,8);assert.equal(new Set(ENTRY_URLS).size,8);
 for(const url of ENTRY_URLS)assert.ok(visited.includes(url));
 assert.equal(report.frontend.find(result=>result.url===canonical).redirects,0);
 assert.equal(report.health.service,'solventir-api');
 assert.equal(report.frontend.every(result=>result.hstsMaxAge===86400),true);
});

test('detects repeated URLs and permits at most five redirects',async()=>{
 let calls=0;
 await assert.rejects(verifyFrontend(canonical,{request:async()=>{calls++;return redirect(canonical);}}),/loop/);
 assert.equal(calls,1);
 calls=0;
 const result=await verifyFrontend('https://solventir.com/',{request:async()=>{
  calls++;return calls<=5?redirect(canonical+'?step='+calls):page();
 }});
 assert.equal(result.redirects,5);assert.equal(calls,6);
 calls=0;
 await assert.rejects(verifyFrontend(canonical,{request:async()=>redirect(canonical+'?step='+(++calls))}),/Exceeded 5/);
 assert.equal(calls,6);
});

test('rejects insecure or unapproved redirect destinations before requesting them',async()=>{
 for(const location of ['http://www.solventir.com/','https://unrelated.example/','https://user:pass@www.solventir.com/','https://www.solventir.com:8443/']){
  let calls=0;
  await assert.rejects(verifyFrontend('https://solventir.com/',{request:async()=>{calls++;return redirect(location);}}),/insecure|outside/);
  assert.equal(calls,1);
 }
 assert.equal(validateRedirect('http://solventir.com/',canonical).href,canonical);
 assert.throws(()=>validateRedirect(canonical,undefined),/Location/);
});

test('requires the canonical 200 response and meaningful non-duplicated HSTS',()=>{
 assert.throws(()=>validateFrontend(canonical,{...page(),status:404}),/HTTP 404/);
 assert.throws(()=>validateFrontend('https://solventir.com/',page()),/canonical/);
 assert.throws(()=>validateFrontend(CANONICAL_ORIGIN+'/lander',page()),/canonical/);
 for(const value of [undefined,'max-age=0','max-age=86399','max-age=86400x','max-age="86400','max-age=86400; max-age=0',['max-age=86400','max-age=0']]){
  assert.throws(()=>validateFrontend(canonical,{...page(),headers:{'Strict-Transport-Security':value}}),/HSTS/);
 }
 assert.equal(validateFrontend(canonical,{...page(),headers:{'Strict-Transport-Security':'max-age=31536000; includeSubDomains'}}).hstsMaxAge,31536000);
});

test('requires healthy API identity and does not treat redirects or HTML as health',()=>{
 assert.deepEqual(validateHealth(health()),{status:200,service:'solventir-api',health:'ok'});
 assert.throws(()=>validateHealth({...health(),status:301}),/HTTP 301/);
 assert.throws(()=>validateHealth({...health(),body:'<html>Parked</html>'}),/valid JSON/);
 for(const body of [{status:'error',service:'solventir-api'},{status:'ok',service:'other-service'},null]){
  assert.throws(()=>validateHealth({...health(),body:JSON.stringify(body)}),/healthy/);
 }
});

test('reports certificate and missing-header failures without hiding them behind healthy API',async()=>{
 const report=await verifyDomains({request:async url=>{
  if(url.endsWith('/sjay-api/health'))return health();
  if(url==='https://soventir.com/')throw Error('CERT_HAS_EXPIRED');
  return {...page(),headers:{}};
 }});
 assert.equal(report.dns,'system');assert.equal(report.ok,false);assert.equal(report.health.ok,true);
 assert.equal(report.frontend.find(result=>result.url==='https://soventir.com/').error,'CERT_HAS_EXPIRED');
 assert.match(report.frontend.find(result=>result.url===canonical).error,/HSTS/);
 assert.throws(()=>createRequester({resolver:'https://dns.example'}),/DNS server/);
});
