import test from 'node:test';
import assert from 'node:assert/strict';
import {historyWindow,historySeries,nearestPoint,historyHTML,marketCapFactor,chartGeometry,axisMoney,rangeAvailable,normalizeHistoryRange} from '../dist/coin-history.js';
import {chartData,finitePrice} from '../dist/coin-history-chart.js';
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
 assert.deepEqual(historyWindow(h,'week'),points);
 assert.deepEqual(historyWindow(h,'all'),points);
 assert.equal(nearestPoint(points,points[0].timestamp+25*hour),3);
 assert.equal(nearestPoint(points,-Infinity),0);
});
test('chart presents current market cap separately from historical close and preserves missing cap',()=>{
 const html=historyHTML({status:'ready',data:h},{marketCap:250000,retrievedAt:1800000000000});
 assert.match(html,/Current market cap/);assert.match(html,/\$250K/);assert.match(html,/Selected close/);assert.match(html,/Historical market cap is unavailable/);
 assert.match(html,/type="range"/);assert.match(html,/data-history-range="day"/);
 assert.match(html,/data-history-range="six"/);assert.doesNotMatch(html,/data-history-range="week"/);
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

test('short histories expose exactly hour, six hours, day and all available ranges',()=>{
 const data={...h,points:points.slice(0,3),through:points[2].timestamp};
 const html=historyHTML({status:'ready',data},{});
 assert.deepEqual([...html.matchAll(/data-history-range="([^"]+)"/g)].map(match=>match[1]),['hour','six','day','all']);
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

test('retired or unknown ranges normalize to All while supported ranges stay intact',()=>{
 for(const range of ['hour','six','day','all'])assert.equal(normalizeHistoryRange(range),range);
 for(const range of ['week',undefined,null,'live','__proto__'])assert.equal(normalizeHistoryRange(range),'all');
});

test('canvas series split genuine gaps and preserve empty intervals on a regular time axis',()=>{
 const data=[0,1,4,5,9].map((n,i)=>({timestamp:1800000000000+n*hour,close:i+1}));
 const model=chartData(data,hour);
 assert.equal(model.segments.length,2);assert.equal(model.isolated.length,1);
 assert.equal(model.timeline.length,10);
 assert.equal(model.timeline[4].time-model.timeline[0].time,4*3600);
 assert.deepEqual(model.segments.map(segment=>segment.map(point=>point.value)),[[1,2],[3,4]]);
 assert.deepEqual(model.isolated,[{time:data[4].timestamp/1000,value:5}]);
 assert.ok(model.timeline.every(point=>!Object.hasOwn(point,'value')),'whitespace must not fabricate prices');
});

test('provider returned quiet candles remain continuous but no prices are invented',()=>{
 const data=[{timestamp:1800000000000,close:4},{timestamp:1800000060000,close:4,zeroVolume:true},{timestamp:1800000120000,close:5}];
 const model=chartData(data,60000);
 assert.equal(model.segments.length,1);assert.equal(model.isolated.length,0);
 assert.deepEqual(model.segments[0].map(point=>point.value),[4,4,5]);
 const html=historyHTML({status:'ready',data:{...h,emptyIntervalPolicy:'previous-close'}},{});
 assert.match(html,/previous close into periods without swaps/);
 assert.match(html,/Intervals still missing from the source stay empty/);
});

test('canvas numeric normalization handles flat, single and extreme finite prices',()=>{
 for(const values of [[5],[0,0],[5,5],[9e307,1e308],[1e-309,2e-309]]){
  const data=values.map((close,i)=>({timestamp:1800000000000+i*hour,close}));
  const model=chartData(data,hour);
  assert.ok(Number.isFinite(model.unit)&&model.unit>0);
  const rendered=model.groups.flat().map(point=>point.value);
  assert.ok(rendered.every(Number.isFinite));
  if(values[0]!==values[1]&&values.length>1)assert.notEqual(rendered[0],rendered[1]);
  assert.ok(Number.isFinite(finitePrice(2,model.unit)),'axis overshoot must remain finite');
 }
 assert.deepEqual(chartData([],hour),{unit:1,timeline:[],groups:[],isolated:[],segments:[]});
});

test('chart exposes slider exploration without gesture or reset instructions',()=>{
 const html=historyHTML({status:'ready',data:h},{marketCap:250000,price:1});
 assert.doesNotMatch(html,/data-history-reset|Reset view|Pinch to zoom|Hold to inspect|Drag to move/);
 assert.match(html,/Slide to explore/);
 assert.match(html,/type="range"/);assert.match(html,/arrow keys/);
 assert.match(html,/Snapshot/);assert.match(html,/not a streaming feed/);
 assert.match(html,/All means available history, not lifetime history/);
 assert.match(html,/https:\/\/www.tradingview.com\//);
 assert.match(html,/TradingView Lightweight Charts/);
});

test('six-hour view uses minute coverage without replacing an incomplete window',()=>{
 const through=1800000000000+48*hour,from=through-48*hour;
 const hourly={...h,from,through,retrievedAt:through+30000,points:Array.from({length:49},(_,n)=>({timestamp:from+n*hour,close:n+1}))};
 const minutePoints=Array.from({length:601},(_,n)=>({timestamp:through-10*hour+n*60000,close:n+1}));
 const recent={...hourly,interval:'minute',intervalMs:60000,rawCount:601,windowStart:through-10*hour,points:minutePoints,from:minutePoints[0].timestamp,through};
 const data={...hourly,recent};
 assert.equal(historySeries(data,'six'),recent);
 assert.equal(historyWindow(data,'six').length,360);
 assert.ok(historyWindow(data,'six').every(p=>p.timestamp>=data.retrievedAt-6*hour));
 assert.equal(historySeries({...data,recent:{...recent,windowStart:through-2*hour}},'six').points,hourly.points);
 assert.equal(historySeries({...data,recent:undefined},'six').points,hourly.points);
 assert.equal(rangeAvailable(data,'six'),true);
});
