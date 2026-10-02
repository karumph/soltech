import test from 'node:test';
import assert from 'node:assert/strict';
import {historyWindow,historySeries,nearestPoint,historyHTML,marketCapFactor,chartGeometry,axisMoney,rangeAvailable} from '../dist/coin-history.js';
const hour=3600000;
const points=[0,1,2,30,60,190].map(n=>({timestamp:1800000000000+n*hour,close:1+n/100}));
const h={points,from:points[0].timestamp,through:points.at(-1).timestamp,observedHigh:3,pair:'pool'};
test('market-cap estimates require finite positive current data and remain explicitly estimates',()=>{
 assert.equal(marketCapFactor({marketCap:100000,price:.01}),10000000);
 for(const market of [{marketCap:null,price:.01},{marketCap:1,price:0},{marketCap:Infinity,price:1},{marketCap:1e308,price:1e-100}])assert.equal(marketCapFactor(market),null);
 assert.equal(marketCapFactor({marketCap:1e308,price:1},h),null);
 assert.match(historyHTML({status:'ready',data:h},{marketCap:100000,price:.01}),/Market cap \(est\.\)/);
 assert.match(historyHTML({status:'ready',data:h},{}),/value="cap" disabled/);
});
test('chart ranges preserve real timestamps and choose an actual candle across missing hours',()=>{
 assert.deepEqual(historyWindow(h,'day'),[points[5]]);
 assert.deepEqual(historyWindow(h,'week'),points.slice(3));
 assert.deepEqual(historyWindow(h,'all'),points);
 assert.equal(nearestPoint(points,points[0].timestamp+25*hour),3);
 assert.equal(nearestPoint(points,-Infinity),0);
});
test('chart presents current market cap separately from historical close and preserves missing cap',()=>{
 const html=historyHTML({status:'ready',data:h},{marketCap:250000,retrievedAt:1800000000000});
 assert.match(html,/Current market cap/);assert.match(html,/\$250K/);assert.match(html,/Selected close/);assert.match(html,/Historical market cap is unavailable/);
 assert.match(html,/type="range"/);assert.match(html,/data-history-range="week"/);
 assert.match(historyHTML({status:'ready',data:h},{marketCap:null}),/Current market cap<\/span><strong>Unavailable/);
});

test('responsive chart preserves time spacing, gaps and isolated observations',()=>{
 const data=[0,1,4,5,9].map((n,i)=>({timestamp:1800000000000+n*hour,close:i+1}));
 const g=chartGeometry(data,1,240,236);
 assert.ok(Math.abs((g.x(data[2].timestamp)-g.left)/(g.right-g.left)-4/9)<1e-10);
 assert.equal((g.path.match(/M/g)||[]).length,3);
 assert.equal((g.area.match(/Z/g)||[]).length,2);
 assert.equal(g.isolated.length,1);
 assert.equal(g.isolated[0][0],g.right);
});

test('flat, single and extreme finite prices stay visible inside plot bounds',()=>{
 for(const prices of [[5],[5,5],[9e307,1e308],[1e-309,2e-309]]){
  const data=prices.map((close,i)=>({timestamp:1800000000000+i*hour,close}));
  for(const width of [170,850]){
   const g=chartGeometry(data,1,width,236);
   for(const v of g.ticks)assert.ok(Number.isFinite(v));
   for(const p of data){assert.ok(Number.isFinite(g.x(p.timestamp)));assert.ok(Number.isFinite(g.y(p.close)));assert.ok(g.y(p.close)>=g.top&&g.y(p.close)<=g.bottom);}
   if(data.length===1)assert.equal(g.x(data[0].timestamp),(g.left+g.right)/2);
   else {assert.equal(g.x(data[0].timestamp),g.left);assert.equal(g.x(data.at(-1).timestamp),g.right);}
   assert.doesNotMatch(g.path,/NaN|Infinity/);
  }
 }
});

test('tiny axis labels retain significant digits without scientific notation or zero rounding',()=>{
 assert.equal(axisMoney(.0000000123),'$0.0₇123');
 assert.equal(axisMoney(1e-309),'$0.0₃₀₈1');
 assert.equal(axisMoney(0),'$0');
 assert.equal(axisMoney(1200000),'$1.2M');
});

test('short histories still expose day, week and all available ranges',()=>{
 const data={...h,points:points.slice(0,3),through:points[2].timestamp};
 const html=historyHTML({status:'ready',data},{});
 for(const range of ['day','week','all'])assert.match(html,new RegExp('data-history-range="'+range+'"'));
 assert.match(html,/All available history/);
 assert.deepEqual(historyWindow(data,'day'),data.points);
 assert.equal(rangeAvailable(data,'day'),false);
 assert.equal(rangeAvailable(data,'week'),false);
 assert.equal(rangeAvailable(data,'all'),true);
 assert.equal(rangeAvailable(data,'hour'),true);
 assert.deepEqual(historyWindow(data,'hour'),data.points.slice(1));
});

test('short ranges enable only distinct views with at least two actual points',()=>{
 const data={...h,points:Array.from({length:8},(_,n)=>({timestamp:1800000000000+n*hour,close:n+1})),from:1800000000000,through:1800000000000+7*hour};
 assert.equal(rangeAvailable(data,'hour'),true);assert.equal(rangeAvailable(data,'six'),true);
 assert.equal(rangeAvailable(data,'day'),false);assert.equal(rangeAvailable(data,'week'),false);
 assert.equal(historyWindow(data,'hour').length,2);assert.equal(historyWindow(data,'six').length,7);
 assert.equal(rangeAvailable({...data,points:[data.points[0],data.points[7]]},'hour'),false);
});
test('one-hour view uses actual minute observations and is anchored to retrieval, not last trade',()=>{
 const recentPoints=Array.from({length:181},(_,n)=>({timestamp:1800000000000+n*60000,close:n+1}));
 const recent={...h,interval:'minute',intervalMs:60000,rawCount:181,windowStart:recentPoints[0].timestamp-60000,points:recentPoints,from:recentPoints[0].timestamp,through:recentPoints.at(-1).timestamp};
 const data={...h,recent,retrievedAt:recent.through+30000};
 assert.equal(historySeries(data,'hour'),recent);assert.equal(historyWindow(data,'hour').length,60);
 const stale={...data,retrievedAt:recent.through+2*hour};
 assert.equal(historyWindow(stale,'hour').length,0);assert.equal(rangeAvailable(stale,'hour'),false);
 assert.equal(historyWindow(stale,'all').length,recentPoints.length);
 const g=chartGeometry([recentPoints[0],recentPoints[1],recentPoints[4]],1,300,236,60000);
 assert.equal((g.path.match(/M/g)||[]).length,2);assert.equal(g.isolated.length,1);
});
test('older full histories retain hourly coverage while recent views use minutes',()=>{
 const recent={...h,interval:'minute',points:points.slice(-2),from:points.at(-2).timestamp};
 const data={...h,recent};
 assert.equal(historySeries(data,'all'),data);assert.equal(historySeries(data,'hour'),recent);
 assert.equal(marketCapFactor({marketCap:1e308,price:1},{...h,observedHigh:1,points:[{close:1}],recent:{...recent,observedHigh:2}}),null);
});
test('All never replaces the earliest hourly coverage with a truncated minute response',()=>{
 const recent={...h,interval:'minute',rawCount:1000,windowStart:h.from+11*60000,points:points.slice(1),from:points[1].timestamp};
 for(const rawCount of [999,1000])assert.equal(historySeries({...h,recent:{...recent,rawCount}},'all').interval,undefined);
 assert.equal(historySeries({...h,recent:{...recent,rawCount:999,windowStart:h.from}},'all').interval,'minute');
});
