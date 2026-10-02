import {randomBytes,timingSafeEqual} from 'node:crypto';
import {localBundlerRequestAllowed} from './bundler-api.mjs';

// This page belongs to the local development server, not the public app.
export function createBundlerSetup({port,setKey}={}){
 const token=randomBytes(32).toString('hex');
 const headers={'Cache-Control':'no-store','Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
 const result=(res,status,body)=>{res.writeHead(status,{'Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
 return async(req,res,pathname)=>{
  if(!['/setup/bundlers','/api/bundlers/configure'].includes(pathname))return false;
  if(!localBundlerRequestAllowed(req,port)){result(res,403,{error:'Open setup from the local Soltech preview.'});return true;}
  if(pathname==='/setup/bundlers'){
   if(req.method!=='GET'){result(res,405,{error:'Method not allowed.'});return true;}
   const nonce=randomBytes(18).toString('base64');
   res.writeHead(200,{...headers,'Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`});
   res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect bundle data · Soltech</title>
<style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;padding:28px 20px;font:16px/1.55 system-ui,sans-serif;background:#f5f7fb;color:#202534}main{max-width:470px;margin:6vh auto;background:white;border:1px solid #d8deea;border-radius:24px;padding:28px}h1{font-size:26px;line-height:1.2;letter-spacing:-.03em}p{color:#526074}label{display:block;font-weight:600;margin:24px 0 8px}input{display:block;width:100%;padding:14px;border:1px solid #8998b0;border-radius:12px;font:inherit;min-height:48px}button,a{min-height:48px}button{display:block;width:100%;padding:12px;margin:16px 0;border:1px solid #879bb8;border-radius:14px;background:linear-gradient(135deg,#fff,#eaf3ff);color:#253b66;font:600 16px system-ui;cursor:pointer}button:disabled{opacity:.6;cursor:wait}a{color:#284da2;display:inline-flex;align-items:center}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #4e69b1;outline-offset:3px}small{display:block;color:#526074}#status{min-height:25px}.error{color:#a1273e}form[hidden],section[hidden]{display:none}@media(max-width:420px){main{padding:22px;margin:2vh auto}}</style>
<main><small>Soltech · Local preview setup</small><h1>Connect bundle data.</h1><p>Copy your key from Solana Tracker’s Data API page, then paste it below.</p><form id="setup"><label for="api-key">Data API key</label><input id="api-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="512" required aria-describedby="privacy"><button type="submit">Connect</button><small id="privacy">Kept only in this preview server’s memory. Sent to Solana Tracker for lookups. Not saved to project files; enter it again after restarting the server.</small></form><p id="status" role="status" aria-live="polite"></p><section id="done" hidden><p>The key is added. A coin lookup will confirm access.</p><a href="/mobile-preview.html">Open mobile preview</a></section><a href="https://www.solanatracker.io/account/data-api?plan=free" target="_blank" rel="noopener noreferrer">Open Solana Tracker</a></main>
<script nonce="${nonce}">const form=document.getElementById('setup'),input=document.getElementById('api-key'),status=document.getElementById('status'),button=form.querySelector('button');form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;status.className='';status.textContent='Connecting…';const key=input.value.trim();input.value='';try{const response=await fetch('/api/bundlers/configure',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Soltech-Setup':'${token}'},body:JSON.stringify({key})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to connect. Try again.');form.hidden=true;document.getElementById('done').hidden=false;status.textContent='Key added for this session.';}catch(error){status.className='error';status.textContent=error.message||'Unable to connect. Try again.';input.focus();}finally{button.disabled=false;}});</script></html>`);
   return true;
  }
  if(req.method!=='POST'){result(res,405,{error:'Method not allowed.'});return true;}
  const submitted=req.headers['x-soltech-setup'];
  if(req.headers.origin!=='http://'+req.headers.host||typeof submitted!=='string'||!/^[a-f0-9]{64}$/.test(submitted)||!timingSafeEqual(Buffer.from(submitted),Buffer.from(token))){result(res,403,{error:'Refresh the setup page and try again.'});return true;}
  if(req.headers['content-type']!=='application/json'){result(res,415,{error:'Unsupported request.'});return true;}
  if(Number(req.headers['content-length'])>2048){result(res,413,{error:'The key is too long.'});return true;}
  try{
   let body='',bytes=0;
   for await(const chunk of req){bytes+=Buffer.byteLength(chunk);if(bytes>2048){result(res,413,{error:'The key is too long.'});return true;}body+=chunk.toString('utf8');}
   const key=JSON.parse(body)?.key;
   if(typeof key!=='string'||!/^[\x21-\x7e]{8,512}$/.test(key)){result(res,400,{error:'Paste the complete Data API key.'});return true;}
   setKey(key);result(res,200,{status:'configured'});
  }catch{result(res,400,{error:'Unable to read the key. Try again.'});}
  return true;
 };
}
