import http from 'node:http';
import https from 'node:https';
import {Resolver} from 'node:dns/promises';
import {isIP} from 'node:net';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const HOSTS=Object.freeze(['solventir.com','www.solventir.com','soventir.com','www.soventir.com']);
export const ENTRY_URLS=Object.freeze(HOSTS.flatMap(host=>['http:','https:'].map(protocol=>`${protocol}//${host}/`)));
export const CANONICAL_ORIGIN='https://www.solventir.com';
const REDIRECTS=new Set([301,302,303,307,308]);

function header(headers,name){
 const entry=Object.entries(headers||{}).find(([key])=>key.toLowerCase()===name);
 return entry?.[1];
}

export function approvedURL(value){
 const url=new URL(value);
 if(!['http:','https:'].includes(url.protocol)||!HOSTS.includes(url.hostname)||url.port||url.username||url.password){
  throw Error('Redirect URL is outside the approved domain/protocol scope.');
 }
 url.hash='';
 return url;
}

export function validateRedirect(current,location){
 if(typeof location!=='string'||!location.trim())throw Error('Redirect is missing a single Location header.');
 const from=approvedURL(current),to=approvedURL(new URL(location,from));
 if(from.protocol==='https:'&&to.protocol!=='https:')throw Error('HTTPS redirects to insecure HTTP.');
 return to;
}

export function validateFrontend(url,response){
 const final=approvedURL(url);
 if(final.origin!==CANONICAL_ORIGIN||final.pathname!=='/')throw Error('Final page is not the canonical HTTPS app homepage.');
 if(response.status!==200)throw Error(`Final page returned HTTP ${response.status}; expected 200.`);
 const hsts=header(response.headers,'strict-transport-security');
 const ageDirectives=typeof hsts==='string'?hsts.split(';').filter(part=>/^\s*max-age\s*=/i.test(part)):[];
 const match=ageDirectives.length===1?ageDirectives[0].match(/^\s*max-age\s*=\s*(?:"(\d+)"|(\d+))\s*$/i):null;
 const maxAge=match?Number(match[1]||match[2]):NaN;
 if(!Number.isSafeInteger(maxAge)||maxAge<86400)throw Error('Final page needs a valid HSTS max-age of at least 86400 seconds.');
 return {finalUrl:final.href,status:response.status,hstsMaxAge:maxAge};
}

export function validateHealth(response){
 if(response.status!==200)throw Error(`API health returned HTTP ${response.status}; expected 200.`);
 let body;
 try{body=JSON.parse(response.body);}catch{throw Error('API health did not return valid JSON.');}
 if(body?.status!=='ok'||body?.service!=='solventir-api')throw Error('API health did not identify a healthy solventir-api service.');
 return {status:response.status,service:body.service,health:body.status};
}

// A diagnostic resolver changes only address lookup. HTTPS still validates the
// certificate and SNI against the requested hostname, never the resolved IP.
export function createRequester({resolver,timeoutMs=15000,maxBytes=262144}={}){
 let lookup;
 if(resolver){
  if(!isIP(resolver))throw Error('--resolver must be an IPv4 or IPv6 DNS server address.');
  const dns=new Resolver({timeout:4000,tries:1});dns.setServers([resolver]);
  lookup=(hostname,options,callback)=>{
   const settings=typeof options==='number'?{family:options}:options||{};
   const families=settings.family?[settings.family]:[4,6];
   Promise.allSettled(families.map(async family=>{
    const addresses=await (family===6?dns.resolve6(hostname):dns.resolve4(hostname));
    return addresses.map(address=>({address,family}));
   })).then(results=>{
    const addresses=results.flatMap(result=>result.status==='fulfilled'?result.value:[]);
    if(!addresses.length){callback(results.find(result=>result.status==='rejected')?.reason||Error('DNS returned no addresses.'));return;}
    if(settings.all)callback(null,addresses);else callback(null,addresses[0].address,addresses[0].family);
   }).catch(callback);
  };
 }
 return input=>new Promise((accept,reject)=>{
  const url=approvedURL(input),secure=url.protocol==='https:';
  const client=secure?https:http;
  const req=client.request(url,{
   method:'GET',agent:false,lookup,
   ...(secure?{rejectUnauthorized:true,servername:url.hostname}:{}),
   headers:{Accept:'text/html, application/json','User-Agent':'Solventir-domain-verifier/1.0'},
  },res=>{
   const chunks=[];let length=0;
   res.on('data',chunk=>{
    length+=chunk.length;
    if(length>maxBytes){req.destroy(Error('Response exceeded the verifier size limit.'));return;}
    chunks.push(chunk);
   });
   res.on('end',()=>accept({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString('utf8')}));
   res.on('error',reject);
  });
  const timer=setTimeout(()=>req.destroy(Error('Request exceeded the verifier time limit.')),timeoutMs);
  timer.unref();req.once('close',()=>clearTimeout(timer));req.on('error',reject);req.end();
 });
}

export async function verifyFrontend(initial,{request,maxRedirects=5}={}){
 let current=approvedURL(initial),redirects=0;
 const seen=new Set();
 while(true){
  if(seen.has(current.href))throw Error('Redirect loop detected.');
  seen.add(current.href);
  const response=await request(current.href);
  if(!REDIRECTS.has(response.status))return {...validateFrontend(current,response),redirects};
  if(redirects>=maxRedirects)throw Error(`Exceeded ${maxRedirects} redirects.`);
  current=validateRedirect(current,header(response.headers,'location'));redirects++;
 }
}

export async function verifyDomains({resolver,request}={}){
 const fetchResponse=request||createRequester({resolver});
 const frontend=await Promise.all(ENTRY_URLS.map(async url=>{
  try{return {url,ok:true,...await verifyFrontend(url,{request:fetchResponse})};}
  catch(error){return {url,ok:false,error:error.message};}
 }));
 const healthUrl=CANONICAL_ORIGIN+'/sjay-api/health';
 let health;
 try{health={url:healthUrl,ok:true,...validateHealth(await fetchResponse(healthUrl))};}
 catch(error){health={url:healthUrl,ok:false,error:error.message};}
 return {ok:frontend.every(result=>result.ok)&&health.ok,dns:resolver||'system',frontend,health};
}

async function main(args){
 if(args.includes('--help')){
  console.log('Usage: node deploy/verify-domains.mjs [--resolver=1.1.1.1]\nRead-only DNS, HTTPS, redirect, HSTS and API checks. No browser data is changed.');return;
 }
 if(args.length>1||args.some(arg=>!arg.startsWith('--resolver=')))throw Error('Use --help for verifier options.');
 const resolver=args[0]?.slice('--resolver='.length);
 if(args.length&&!resolver)throw Error('--resolver needs a DNS server IP address.');
 const report=await verifyDomains({resolver});
 console.log(resolver?`DNS: ${resolver} (diagnostic; other resolvers may still have stale records).`:'DNS: system (normal visitor resolution).');
 for(const result of report.frontend){
  console.log(result.ok?`PASS ${result.url} -> ${result.finalUrl} | HTTP ${result.status}, ${result.redirects} redirects, HSTS max-age=${result.hstsMaxAge}`:`FAIL ${result.url} | ${result.error}`);
 }
 console.log(report.health.ok?`PASS ${report.health.url} | HTTP 200, solventir-api: ok`:`FAIL ${report.health.url} | ${report.health.error}`);
 console.log(report.ok?'All domain checks passed for this DNS mode.':'Domain checks failed for this DNS mode; no configuration was changed.');
 process.exitCode=report.ok?0:1;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 main(process.argv.slice(2)).catch(error=>{console.error(`Domain verifier: ${error.message}`);process.exitCode=1;});
}
