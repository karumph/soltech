import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createBundlerAPI,localBundlerRequestAllowed} from './bundler-api.mjs';
import {createBundlerSetup} from './bundler-setup.mjs';
const project=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(project,'dist');
const frame=path.join(project,'mobile-preview.html');
const port=Number(process.argv[2]||4175);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
let bundles=createBundlerAPI();
const setup=createBundlerSetup({port,setKey:key=>{process.env.SOLANATRACKER_API_KEY=key;bundles=createBundlerAPI();}});
const server=http.createServer(async(req,res)=>{
 let relative;
 try{relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 if(await setup(req,res,relative))return;
 if(relative==='/api/bundlers'){
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.writeHead(405,{Allow:'GET'});res.end(JSON.stringify({status:'error'}));return;}
  if(!localBundlerRequestAllowed(req,port)){res.writeHead(403);res.end(JSON.stringify({status:'error'}));return;}
  const query=new URL(req.url,'http://localhost').searchParams;
  const result=query.get('chain')==='solana'?await bundles(query.get('address')):{status:'unsupported'};
  res.end(JSON.stringify(result));return;
 }
 const file=relative==='/mobile-preview.html'?frame:path.resolve(root,'.'+relative);
 if(file!==frame&&file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 const target=file===root?path.join(root,'index.html'):file;
 fs.readFile(target,(error,body)=>{
  if(error){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 });
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. An existing preview may still be running.`:error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Soltech mobile preview: http://127.0.0.1:${port}/mobile-preview.html`));
