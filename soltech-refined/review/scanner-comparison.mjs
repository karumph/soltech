import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createWalletHandler} from '../wallet-api.mjs';
import {createWalletTransactionsHandler} from '../wallet-transactions-api.mjs';
import {createSignalsHandler} from '../signals-api.mjs';
import {createScannerHandler} from '../scanner-api.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const hosted = 'https://soltech.d3ilz6ab0hx4y4.amplifyapp.com/#scanner';
const walletHandler=createWalletHandler({port:4185});
const walletTransactionsHandler=createWalletTransactionsHandler({port:4185});
const signalsHandler=createSignalsHandler({port:4185});
const scannerHandler=createScannerHandler({port:4185});
const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.json':'application/json','.woff2':'font/woff2'};
const phone = (title, note, src) => `<section class="version"><header><h1>${title}</h1><p>${note}</p></header><iframe src="${src}" title="${title} mobile scanner" referrerpolicy="no-referrer"></iframe></section>`;
const page = (mode,view='scanner') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${mode==='mine'?'Your Solventir':mode==='his'?'Co-developer version':'Solventir comparison'}</title><style>
*{box-sizing:border-box}body{margin:0;background:#eef0f4;color:#171c26;font:14px/1.5 'Segoe UI',sans-serif}nav{display:flex;justify-content:center;gap:18px;padding:12px;flex-wrap:wrap}nav a{color:#495565;text-underline-offset:3px;font-size:12px}main{display:flex;align-items:flex-start;justify-content:center;gap:24px;flex-wrap:wrap;padding:0 14px 18px}.version{width:390px;max-width:100%}header{padding:0 4px 10px}h1{font-size:15px;font-weight:650;margin:0}p{font-size:12px;color:#596574;margin:2px 0 0}iframe{display:block;width:100%;height:min(844px,calc(100dvh - 106px));min-height:440px;border:1px solid #b9c2cf;border-radius:26px;background:white;box-shadow:0 12px 35px #17394d12}@media(max-width:840px){main{gap:24px}iframe{height:760px;max-height:calc(100dvh - 110px)}}
</style></head><body><nav aria-label="Comparison views"><a href="/?view=${view}">Both versions</a><a href="/mine?view=${view}">Your version</a><a href="/his?view=${view}">Co-developer version</a></nav><main>${mode!=='his'?phone('Your version','Updated local preview','/original/index.html#'+view):''}${mode!=='mine'?phone('Co-developer version','Current hosted site',hosted.replace('#scanner','#'+view)):''}</main></body></html>`;

http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1'),pathname=decodeURIComponent(url.pathname);
    if(await walletHandler(req,res,pathname))return;
    if(await walletTransactionsHandler(req,res,pathname))return;
    if(await signalsHandler(req,res,pathname))return;
    if(await scannerHandler(req,res,pathname))return;
    res.setHeader('Cache-Control','no-store');
    if(['/tests/coin-recent-ui.html','/tests/wallet-layout.html','/tests/coin-network-ui.html','/tests/scanner-feed-ui.html','/tests/coin-report-layout-ui.html','/tests/coin-chart-ui.html'].includes(pathname)){
      let body=await fs.readFile(path.join(root,'..',pathname.slice(1)));
      if(pathname==='/tests/coin-network-ui.html')body=body.toString().replaceAll("from '/coin-","from '/original/coin-");
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(body);return;
    }
    if(['/','/mine','/his'].includes(pathname)){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
      res.end(page(pathname.slice(1),['scanner','check','wallet','signals','finds','profile'].includes(url.searchParams.get('view'))?url.searchParams.get('view'):'scanner'));return;
    }
    if(!pathname.startsWith('/original/')){res.writeHead(404);res.end('Not found');return;}
    const file=path.resolve(root,pathname.slice('/original/'.length));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Not allowed');return;}
    const body=await fs.readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(body);
  }catch(error){res.writeHead(error.code==='ENOENT'?404:500);res.end('Preview file unavailable');}
}).listen(4185,'127.0.0.1',()=>console.log('Scanner comparison: http://127.0.0.1:4185/'));
