import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createPhonePreview} from './phone-preview.mjs';

test('Phone access is authenticated, restricted, and forwarded to the fixed local preview',async t=>{
 const seen=[];
 const upstream=http.createServer((req,res)=>{seen.push({url:req.url,method:req.method,headers:req.headers});res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');});
 await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
 const port=upstream.address().port,token='test-preview-access-token';
 // Obtain an available port before configuring the exact permitted authority.
 const reservation=http.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
 const phonePort=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 const phone=createPhonePreview({host:'127.0.0.1',port:phonePort,token,upstreamPort:port});
 await new Promise(resolve=>phone.listen(phonePort,'127.0.0.1',resolve));
 t.after(()=>{phone.closeAllConnections();upstream.closeAllConnections();phone.close();upstream.close();});
 const base='http://127.0.0.1:'+phonePort,cookie='phone_preview='+token;
 const request=(route,options={})=>fetch(base+route,{redirect:'manual',...options});
 assert.equal((await request('/original/index.html')).status,403);
 const entry=await request('/preview/'+token);assert.equal(entry.status,303);assert.match(entry.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);assert.equal(entry.headers.get('location'),'/original/index.html#check');
 for(const route of ['/tests/coin-chart-ui.html','/api/setup','/.env','/review/phone-preview.mjs','/original/../../.env'])assert.equal((await request(route,{headers:{cookie}})).status,404,route);
 assert.equal((await request('/api/scanner',{headers:{cookie,origin:'https://elsewhere.example'}})).status,403);
 const badHostStatus=await new Promise((resolve,reject)=>{http.get(base+'/api/scanner',{headers:{cookie,host:'elsewhere.example'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});
 assert.equal(badHostStatus,403);
 assert.equal((await request('/api/scanner',{headers:{cookie,'sec-fetch-site':'cross-site'}})).status,403);
 assert.equal((await request('/api/scanner',{headers:{cookie:'phone_preview='+ 'é'.repeat(token.length)}})).status,403);
 assert.equal((await request('/original/index.html',{headers:{cookie}})).status,200);
 assert.equal((await request('/api/wallet',{headers:{cookie}})).status,405);
 assert.equal((await request('/api/wallet',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:'{}'})).status,200);
 assert.equal((await request('/api/wallet',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:'x'.repeat(16385)})).status,413);
 assert.equal((await request('/api/scanner/events',{headers:{cookie}})).status,200);
 assert.equal(seen.length,3);assert.equal(seen[1].headers.host,'127.0.0.1:'+port);assert.equal(seen[1].headers.origin,'http://127.0.0.1:'+port);assert.equal(seen[1].headers.cookie,undefined);
});
