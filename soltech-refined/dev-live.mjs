// Local preview of the hosted site.
// Serves dist/ like Amplify, answers /api/finds from the scan in ../soltech-api (run here every minute),
// and forwards every other /api route to the deployed Lambda, the same way the Amplify rewrite does.
//
//   node dev-live.mjs [port] [--remote-scan]
//
// --remote-scan uses the deployed scan instead of running one locally.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runScan,lookupCoins} from '../soltech-api/scan.mjs';
import {checkWallet} from '../soltech-api/wallet.mjs';

const project=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(project,'dist');
const port=Number(process.argv.find(arg=>/^\d+$/.test(arg))||4190);
const remoteScan=process.argv.includes('--remote-scan');
const api=(process.env.SOLTECH_LAMBDA_URL||'https://leqqde6fwsmo7iqf7w5ihiwzea0sohtb.lambda-url.us-east-1.on.aws').replace(/\/$/,'');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp','.jpg':'image/jpeg','.txt':'text/plain; charset=utf-8'};

let latest=null,scanning=null;
const postJson=async(url,body)=>{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error(`${r.status} ${url}`);return r.json();};
const rpcUrl=process.env.SOLANA_RPC_URL||undefined;
const fetchJson=async url=>{const r=await fetch(url,{headers:{accept:'application/json','user-agent':'Soltech/1.0'},signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error(`${r.status} ${url}`);return r.json();};
async function scan(){
 if(scanning)return scanning;
 scanning=runScan({fetchJson,postJson,rpcUrl,previous:latest}).then(item=>{if(item.coins.length||!latest)latest=item;console.log(`scan: ${item.coins.length} coins, ${item.run.newCount} new, ${item.run.durationMs} ms`);}).catch(error=>console.error('scan failed',error.message)).finally(()=>{scanning=null;});
 return scanning;
}
if(!remoteScan){scan();setInterval(scan,60000);}

const send=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){
  const route=url.pathname.slice(4);
  if(!remoteScan&&route==='/finds'){
   if(!latest)await scan();
   if(!latest)return send(res,503,{error:'The scan has not run yet.'});
   const since=url.searchParams.get('since');
   return send(res,200,since&&since===latest.updatedAt?{unchanged:true,updatedAt:latest.updatedAt,run:latest.run}:latest);
  }
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  if(!remoteScan&&route==='/wallet'&&req.method==='POST'){
   let body={};try{body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{}
   try{const result=await checkWallet({fetchJson,postJson,rpcUrl,address:body.address});return send(res,result.supported?200:400,result.supported?result:{error:'Wallet checks cover Solana for now. Base wallets are coming.'});}catch(error){return send(res,502,{error:'That wallet couldn’t be read right now. Try again in a minute.'});}
  }
  if(!remoteScan&&route==='/lookup'&&req.method==='POST'){
   let body={};try{body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{}
   return send(res,200,{coins:await lookupCoins({fetchJson,postJson,rpcUrl,coins:(body.coins||[]).slice(0,30)})});
  }
  const headers={};for(const key of ['authorization','content-type'])if(req.headers[key])headers[key]=req.headers[key];
  try{
   const upstream=await fetch(api+route+url.search,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
   const out={};upstream.headers.forEach((value,key)=>{if(!['content-encoding','content-length','transfer-encoding','connection'].includes(key))out[key]=value;});
   res.writeHead(upstream.status,out);res.end(Buffer.from(await upstream.arrayBuffer()));
  }catch(error){send(res,502,{error:String(error.message||error)});}
  return;
 }
 let relative;
 try{relative=decodeURIComponent(url.pathname);}catch{res.writeHead(400);return res.end();}
 const file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 fs.readFile(file,(error,body)=>{
  if(error){res.writeHead(404);return res.end('Not found');}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 });
}).listen(port,'127.0.0.1',()=>console.log(`Soltech hosted preview: http://127.0.0.1:${port}/  (scan: ${remoteScan?'deployed':'local, every minute'})`));
