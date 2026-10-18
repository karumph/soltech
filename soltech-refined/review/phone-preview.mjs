import http from 'node:http';
import {isIP} from 'node:net';
import {randomBytes, timingSafeEqual} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const apiMethods=new Map([
 ['/api/wallet','POST'],['/api/wallet/transactions','POST'],['/api/wallet/transaction','POST'],
 ['/api/signals','GET'],['/api/scanner','GET'],['/api/scanner/events','GET'],
 ['/api/scanner/start','POST'],['/api/scanner/pause','POST'],
]);
const same=(a,b)=>typeof a==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));

// A temporary, access-link-protected LAN window onto the existing preview.
// The original server and its loopback-only API protections are unchanged.
export function createPhonePreview({host,port,token,upstreamPort=4185}){
 const authority=host+':'+port,origin='http://'+authority;
 const send=(res,status,message)=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end(message);};
 return http.createServer(async(req,res)=>{
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  if(req.headers.host!==authority)return send(res,403,'Open the phone preview using its access link.');
  if(req.headers.origin&&req.headers.origin!==origin)return send(res,403,'Open this action inside the phone preview.');
  if(req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site']))return send(res,403,'Open the phone preview directly.');
  let url;
  try{url=new URL(req.url,origin);}catch{return send(res,400,'Invalid preview address.');}
  if(req.method==='GET'&&same(url.pathname,'/preview/'+token)){
   res.writeHead(303,{'Set-Cookie':`phone_preview=${token}; Path=/; HttpOnly; SameSite=Strict`,Location:'/original/index.html#check','Cache-Control':'no-store'});res.end();return;
  }
  const access=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('phone_preview='))?.slice(14);
  if(!same(access,token))return send(res,403,'Scan the phone preview QR code to open this app.');
  if(url.pathname==='/'){res.writeHead(303,{Location:'/original/index.html#check','Cache-Control':'no-store'});res.end();return;}
  const api=apiMethods.get(url.pathname);
  const asset=url.pathname.startsWith('/original/')&&/\.(?:html|js|css|svg|png|jpe?g|webp|gif|ico|woff2?|ttf)$/i.test(url.pathname);
  if(!api&&!asset)return send(res,404,'Not available in the phone preview.');
  if(req.method!==(api||'GET'))return send(res,405,'This preview action does not support that request.');
  let body;
  if(req.method==='POST'){
   if(String(req.headers['content-type']||'').split(';')[0].trim()!=='application/json')return send(res,415,'Use JSON for this preview action.');
   const chunks=[];let size=0;
   try{for await(const chunk of req.iterator({destroyOnReturn:false})){size+=chunk.length;if(size>16384){req.resume();return send(res,413,'This preview request is too large.');}chunks.push(chunk);}body=Buffer.concat(chunks);}catch{return send(res,400,'The preview request was interrupted.');}
  }
  const upstreamHost='127.0.0.1:'+upstreamPort;
  const headers={Host:upstreamHost,Origin:'http://'+upstreamHost,'Sec-Fetch-Site':'same-origin',Accept:req.headers.accept||'*/*'};
  if(body){headers['Content-Type']='application/json';headers['Content-Length']=body.length;}
  const upstream=http.request({hostname:'127.0.0.1',port:upstreamPort,path:url.pathname+url.search,method:req.method,headers},response=>{
   const forwarded={'Cache-Control':'no-store'};
   for(const name of ['content-type','retry-after','x-accel-buffering'])if(response.headers[name])forwarded[name]=response.headers[name];
   res.writeHead(response.statusCode,forwarded);res.flushHeaders();response.pipe(res);
   response.on('error',()=>res.destroy());
  });
  upstream.on('error',()=>{if(res.headersSent)res.destroy();else send(res,502,'The computer preview is offline. Reopen it on the computer.');});
  res.on('close',()=>upstream.destroy());
  upstream.end(body);
 });
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const host=process.argv[2],port=Number(process.argv[3]||4187);
 if(isIP(host||'')!==4||!/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)||!Number.isInteger(port)||port<1024||port>65535)throw Error('Choose a private IPv4 address and an unprivileged port.');
 const token=randomBytes(24).toString('hex');
 const runtime=new URL('../.runtime/',import.meta.url);await fs.mkdir(runtime,{recursive:true});
 const server=createPhonePreview({host,port,token});
 server.listen(port,host,async()=>{
  await fs.writeFile(new URL('phone-preview.json',runtime),JSON.stringify({url:`http://${host}:${port}/preview/${token}`,host,port,pid:process.pid,startedAt:new Date().toISOString()},null,2));
  console.log('Phone preview listening on local network. Access link saved in .runtime/phone-preview.json.');
 });
}
