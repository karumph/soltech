import test from 'node:test';
import assert from 'node:assert/strict';

const memory=()=>{const map=new Map();return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),map};};
globalThis.window={SOLTECH_API:'/api'};
const {createAccount}=await import('../dist/account.js');

function server(handlers){
 const calls=[];
 const fetchImpl=async(url,init={})=>{
  calls.push({url,method:init.method||'GET',auth:init.headers?.authorization||'',body:init.body?JSON.parse(init.body):null});
  const handler=handlers[`${init.method||'GET'} ${url}`];
  const [status,body]=handler?handler(calls.at(-1)):[404,{error:'not found'}];
  return {ok:status<400,status,json:async()=>body};
 };
 return {calls,fetchImpl};
}
function fresh(){globalThis.localStorage=memory();globalThis.sessionStorage=memory();}

test('sign in keeps the session on this device and sends the token',async()=>{
 fresh();
 const {calls,fetchImpl}=server({
  'POST /api/auth/login':()=>[200,{accessToken:'A1',refreshToken:'R1',expiresIn:3600,email:'me@example.com'}],
  'GET /api/account':call=>[call.auth==='Bearer A1'?200:401,{profile:null}],
 });
 const account=createAccount({fetchImpl});
 await account.login('me@example.com','Password1');
 assert.equal(account.email(),'me@example.com');
 assert.ok(localStorage.getItem('soltech.auth'),'kept across browser restarts');
 await account.load();
 assert.equal(calls.at(-1).auth,'Bearer A1');
});

test('"keep me signed in" off uses this tab only',async()=>{
 fresh();
 const {fetchImpl}=server({'POST /api/auth/login':()=>[200,{accessToken:'A1',refreshToken:'R1',expiresIn:3600}]});
 const account=createAccount({fetchImpl});
 await account.login('me@example.com','Password1',{remember:false});
 assert.equal(localStorage.getItem('soltech.auth'),null);
 assert.ok(sessionStorage.getItem('soltech.auth'));
});

test('an expiring token is refreshed before the request, and a 401 retries once after refresh',async()=>{
 fresh();
 let current='A1',next=2;
 const {calls,fetchImpl}=server({
  'POST /api/auth/login':()=>[200,{accessToken:'A1',refreshToken:'R1',expiresIn:60}],
  'POST /api/auth/refresh':call=>{assert.equal(call.body.refreshToken,'R1');current=`A${next++}`;return [200,{accessToken:current,expiresIn:3600}];},
  'GET /api/account':call=>[call.auth===`Bearer ${current}`?200:401,{ok:true}],
 });
 const account=createAccount({fetchImpl});
 await account.login('me@example.com','Password1');
 await account.load();
 assert.deepEqual(calls.map(c=>c.url),['/api/auth/login','/api/auth/refresh','/api/account']);
 // The server revokes the token early: the next call gets a 401, refreshes, and retries.
 current='revoked';calls.length=0;
 const answers=[];
 const revoked=createAccount({fetchImpl:async(url,init)=>{if(url==='/api/auth/refresh'){current='A9';}const r=await fetchImpl(url,init);answers.push(`${url} ${r.status}`);return r;}});
 await revoked.load();
 assert.deepEqual(answers,['/api/account 401','/api/auth/refresh 200','/api/account 200']);
});

test('a rejected refresh ends the session; sign-out clears this device',async()=>{
 fresh();
 const {fetchImpl}=server({
  'POST /api/auth/login':()=>[200,{accessToken:'A1',refreshToken:'R1',expiresIn:3600}],
  'GET /api/account':()=>[401,{error:'Your session ended.',code:'session'}],
  'POST /api/auth/refresh':()=>[401,{error:'Your session ended.',code:'session'}],
  'POST /api/auth/logout':()=>[200,{}],
 });
 const account=createAccount({fetchImpl});
 let changes=0;account.onChange(()=>changes++);
 await account.login('me@example.com','Password1');
 await assert.rejects(account.load(),err=>err.code==='session');
 assert.equal(account.signedIn(),false);
 await account.login('me@example.com','Password1');
 localStorage.setItem('soltech.profile.v1','{"name":"Me"}');localStorage.setItem('soltech.scanner.v1','{}');localStorage.setItem('soltech.workspace.v1','{}');localStorage.setItem('soltech.other','keep');
 await account.logout();
 assert.equal(account.signedIn(),false);
 for(const key of ['soltech.profile.v1','soltech.scanner.v1','soltech.workspace.v1'])assert.equal(localStorage.getItem(key),null);
 assert.equal(localStorage.getItem('soltech.other'),'keep');
 assert.ok(changes>=3);
});

test('server errors come back as readable messages with a code',async()=>{
 fresh();
 const {fetchImpl}=server({'POST /api/auth/login':()=>[403,{error:'Confirm your email first.',code:'unconfirmed'}]});
 const account=createAccount({fetchImpl});
 await assert.rejects(account.login('me@example.com','Password1'),err=>err.code==='unconfirmed'&&/Confirm/.test(err.message));
 const offline=createAccount({fetchImpl:async()=>{throw new TypeError('fetch failed');}});
 await assert.rejects(offline.forgot('me@example.com'),err=>err.code==='network');
});
