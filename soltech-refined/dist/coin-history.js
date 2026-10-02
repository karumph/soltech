import {formatMoney} from './coin-checker-data.js';
import {NETWORKS} from './coin-networks.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=n=>new Date(n).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const day=86400000;
const hour=3600000;
const ranges=[['hour','1H','Last hour'],['six','6H','Last six hours'],['day','1D','Last day'],['week','1W','Last week'],['all','All','All available history']];
const durationFor=range=>({hour,six:6*hour,day,week:7*day}[range]??Infinity);
const intervalOf=h=>h.intervalMs||(h.interval==='minute'?60000:hour);
const intervalLabel=h=>intervalOf(h)===60000?'1-minute':'Hourly';
const anchorOf=h=>h.retrievedAt??h.through;
export function historySeries(history,range='all'){
 const recent=history.recent;
 if(!recent?.points.length)return history;
 // Use a single resolution per view; never stitch incompatible candles together.
 const completeRecent=recent.rawCount<1000&&recent.windowStart<=history.from;
 return range==='hour'||range==='six'||completeRecent?recent:history;
}
const coverageText=h=>{
 const minutes=Math.floor((h.through-h.from)/60000);
 return (minutes<60?minutes+'m':minutes<2880?Math.floor(minutes/60)+'h':Math.floor(minutes/1440)+'d')+' available';
};
const chartMoney=value=>value==null?'Unavailable':value>=10000?formatMoney(value):new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'standard',maximumSignificantDigits:value<1?5:6}).format(value);
export const axisMoney=value=>{
 if(value>0&&value<.000001){const [mantissa,exponent]=value.toExponential(2).split('e');const zeros=-Number(exponent)-1;const sub=String(zeros).replace(/\d/g,d=>'₀₁₂₃₄₅₆₇₈₉'[Number(d)]);return '$0.0'+sub+mantissa.replace('.','').replace(/0+$/,'');}
 return value>=10000?formatMoney(value):new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'standard',maximumSignificantDigits:3}).format(value);
};
export function marketCapFactor(market,history){
 const {marketCap,price}=market||{};
 const factor=typeof marketCap==='number'&&Number.isFinite(marketCap)&&marketCap>0&&typeof price==='number'&&Number.isFinite(price)&&price>0&&Number.isFinite(marketCap/price)?marketCap/price:null;
 return factor!==null&&(!history||[history,history.recent].filter(Boolean).every(h=>Number.isFinite(h.observedHigh*factor)&&h.points.every(p=>Number.isFinite(p.close*factor))))?factor:null;
}
export function historyWindow(history,range='all'){
 const series=historySeries(history,range),duration=durationFor(range),anchor=anchorOf(history);
 return series.points.filter(p=>p.timestamp>=anchor-duration&&p.timestamp<=anchor);
}
export function rangeAvailable(history,range){
 if(range==='all')return true;
 const shown=historyWindow(history,range);
 return shown.length>=2&&anchorOf(history)-Math.min(history.from,history.recent?.from??Infinity)>durationFor(range);
}
export function nearestPoint(points,timestamp){
 return points.reduce((best,p,i)=>Math.abs(p.timestamp-timestamp)<Math.abs(points[best].timestamp-timestamp)?i:best,0);
}
// Coordinates keep real time spacing. Each gap starts a separate line and shaded area.
export function chartGeometry(points,factor=1,width=300,height=236,intervalMs=hour){
 const left=7,right=Math.max(left,width-7),top=18,bottom=Math.max(top,height-18);
 const from=points[0].timestamp,through=points.at(-1).timestamp,values=points.map(p=>p.close*factor),low=Math.min(...values),high=Math.max(...values);
 const x=t=>points.length===1?(left+right)/2:left+(t-from)/Math.max(through-from,1)*(right-left);
 const y=v=>high===low?(top+bottom)/2:bottom-(v-low)/(high-low)*(bottom-top);
 const groups=[];
 points.forEach((p,i)=>{if(!i||p.timestamp-points[i-1].timestamp>intervalMs*1.5)groups.push([]);groups.at(-1).push(`${x(p.timestamp).toFixed(2)},${y(p.close*factor).toFixed(2)}`);});
 const path=groups.map(g=>'M'+g.join(' L')).join(' ');
 const area=groups.filter(g=>g.length>1).map(g=>`M${g.join(' L')} L${g.at(-1).split(',')[0]},${height} L${g[0].split(',')[0]},${height} Z`).join(' ');
 return {left,right,top,bottom,from,through,x,y,path,area,isolated:groups.filter(g=>g.length===1).map(g=>g[0].split(',').map(Number)),ticks:high===low?[low]:[high,low+(high-low)/2,low]};
}
export function historyHTML(part,market){
 if(!part||part.status==='waiting'||part.status==='loading')return '<div class="check-pending"><p>Getting price history…</p></div>';
 if(part.status==='error')return `<details class="check-more" data-view-key="history"><summary>Price history unavailable</summary><p>${esc(part.message)}</p></details>`;
 if(part.status!=='ready')return '<p class="section-note history-empty">Price history is not available for this pool yet.</p>';
 const h=part.data,series=historySeries(h),last=series.points.at(-1),canEstimate=marketCapFactor(market,h)!==null;
 const coverage=coverageText(h)+' · '+intervalLabel(series)+' closes';
 return `<div class="price-history"><div class="history-heading"><h3 data-history-heading>${canEstimate?'Market cap history':'Price history'}</h3><select class="history-mode" data-view-key="history-mode" aria-label="Chart metric"><option value="price" ${canEstimate?'':'selected'}>Price</option><option value="cap" ${canEstimate?'selected':'disabled'}>Market cap (est.)</option></select></div>
 <div class="history-readout"><span data-history-label>Selected close</span><strong data-history-price>${chartMoney(last.close)}</strong><time data-history-time>${esc(time(last.timestamp))}</time></div>
 <p class="history-coverage">${esc(coverage)}</p><div class="history-ranges" role="group" aria-label="Price history range">${ranges.map(([key,label,name])=>`<button type="button" data-history-range="${key}" data-view-key="history-${key}" aria-label="${name}" aria-pressed="${key==='all'}" ${rangeAvailable(h,key)?'':'disabled title="Not enough history for a distinct view"'}>${label}</button>`).join('')}</div>
 <div class="history-plot"><div class="history-canvas" data-history-plot></div><div class="history-axis" aria-hidden="true"></div></div><div class="history-dates"><span data-history-from>${esc(time(h.from))}</span><span data-history-through>${esc(time(h.through))}</span></div>
 <input class="history-scrubber" data-view-key="history-scrubber" type="range" min="0" max="${series.points.length-1}" value="${series.points.length-1}" step="1" aria-label="Explore closing prices" aria-describedby="history-help" ${series.points.length===1?'disabled':''}>
 <p class="section-note history-help" id="history-help">Drag to explore · USD</p><p class="section-note history-estimate" data-history-estimate hidden>Estimate using today’s market-cap-to-price ratio.</p>
 <div class="history-current"><span>Current market cap</span><strong>${formatMoney(market?.marketCap??null)}</strong><small>${market?.retrievedAt?'Checked '+esc(time(market.retrievedAt)):'Unavailable'}</small></div>
 <dl class="history-high"><div><dt data-history-high-label>Highest observed price</dt><dd data-history-high>${chartMoney(h.observedHigh)}</dd></div></dl>
 <details class="check-more" data-view-key="history"><summary>About this chart</summary><p>GeckoTerminal · ${esc(time(h.from))}–${esc(time(h.through))}. The high covers this pool’s returned candles, not the coin’s all-time high. The line shows closes; timestamps mark the start of each candle.</p><p>Up to 1,000 hourly and 1,000 recent minute candles. Short views use minute data when available; otherwise they show hourly data. All means available history, not lifetime history. Ranges without a distinct view or two observations are unavailable. Gaps stay empty; the unfinished candle can change.</p><p>Historical market cap is unavailable. The estimate uses today’s market-cap-to-price ratio. Supply changes can make it inaccurate.</p><p>Checked ${esc(time(h.retrievedAt??h.through))}. This is a snapshot, not a streaming feed. Sources may cache prices.</p>${marketCapFactor(market,h)===null?'<p>Market-cap estimates need a current price and market cap.</p>':''}<a class="text-link" data-view-key="history-source" href="https://www.geckoterminal.com/${NETWORKS[h.chainId||'solana'].gecko}/pools/${esc(h.pair)}" target="_blank" rel="noopener noreferrer">View price history <span aria-hidden="true">↗</span></a></details></div>`;
}

let chartSequence=0;
export function mountHistoryChart(root,history,view,market){
 if(!root||!history?.points.length)return ()=>{};
 const plot=root.querySelector('[data-history-plot]'),axis=root.querySelector('.history-axis'),slider=root.querySelector('.history-scrubber'),mode=root.querySelector('.history-mode'),factor=marketCapFactor(market,history);
 const gradientId='history-fill-'+(++chartSequence);
 let metricValue=factor===null?'price':view.metric||'cap';
 mode.value=metricValue;
 const valueOf=p=>metricValue==='cap'?p.close*factor:p.close;
 let points,index,down=false,geometry,series;
 const price=root.querySelector('[data-history-price]'),date=root.querySelector('[data-history-time]');
 function select(next){
  index=Math.max(0,Math.min(points.length-1,next));const p=points[index];view.selected=p.timestamp;
  slider.value=String(index);slider.setAttribute('aria-valuetext',`${time(p.timestamp)}, ${chartMoney(valueOf(p))} ${metricValue==='cap'?'estimated market cap':'closing price'}`);
  price.textContent=chartMoney(valueOf(p));date.textContent=time(p.timestamp);date.dateTime=new Date(p.timestamp).toISOString();
  const px=geometry.x(p.timestamp),py=geometry.y(valueOf(p));
  const cursor=plot.querySelector('.history-cursor'),level=plot.querySelector('.history-level'),dot=plot.querySelector('.history-point'),halo=plot.querySelector('.history-point-halo');
  cursor.setAttribute('x1',px);cursor.setAttribute('x2',px);level.setAttribute('y1',py);level.setAttribute('y2',py);
  for(const point of [dot,halo]){point.setAttribute('cx',px);point.setAttribute('cy',py);}
 }
 function draw(){
  if(!rangeAvailable(history,view.range||'all'))view.range='all';
  series=historySeries(history,view.range);
  points=historyWindow(history,view.range);if(!points.length)points=history.points;
  const values=points.map(valueOf),low=Math.min(...values),high=Math.max(...values),maxLabel=Math.max(...[low,high,low+(high-low)/2].map(v=>axisMoney(v).length));
  root.style.setProperty('--history-axis-width',Math.max(65,Math.min(132,maxLabel*6.6+8))+'px');
  const width=plot.clientWidth||300,height=plot.clientHeight||236;
  geometry=chartGeometry(points,metricValue==='cap'?factor:1,width,height,intervalOf(series));
  const {x,y,left,right,top,bottom,from,through,path,area,ticks,isolated}=geometry;
  plot.innerHTML=`<svg viewBox="0 0 ${width} ${height}" class="history-chart" role="img" aria-label="${metricValue==='cap'?'Estimated market cap using today’s market-cap-to-price ratio':intervalLabel(series)+' closing prices'}. Use the slider below to explore."><defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7ea9f4" stop-opacity=".24"/><stop offset="100%" stop-color="#b8cfff" stop-opacity=".02"/></linearGradient></defs>${ticks.map(v=>`<path d="M0 ${y(v)} H${width}" class="history-baseline"/>`).join('')}<path d="${area}" fill="url(#${gradientId})"/><path d="${path}" class="history-line"/>${isolated.map(([px,py])=>`<circle cx="${px}" cy="${py}" r="2.5" class="history-isolated"/>`).join('')}<line class="history-level" x1="${left}" x2="${width}"/><line class="history-cursor" y1="${top}" y2="${bottom}"/><circle class="history-point-halo" r="8"/><circle class="history-point" r="4"/></svg>`;
  axis.innerHTML=ticks.map(v=>`<span style="top:${y(v)}px" title="${esc(chartMoney(v))}">${esc(axisMoney(v))}</span>`).join('');
  root.querySelector('[data-history-heading]').textContent=metricValue==='cap'?'Market cap history':'Price history';
  root.querySelector('[data-history-label]').textContent=metricValue==='cap'?'Estimated market cap':'Selected close';
  root.querySelector('[data-history-estimate]').hidden=metricValue!=='cap';
  root.querySelector('[data-history-high-label]').textContent=metricValue==='cap'?'Highest estimate in history':'Highest observed price';
  root.querySelector('[data-history-high]').textContent=chartMoney(history.observedHigh*(metricValue==='cap'?factor:1));
  slider.setAttribute('aria-label',metricValue==='cap'?'Explore estimated market cap':'Explore closing prices');
  slider.max=String(points.length-1);slider.disabled=points.length<2;
  root.querySelector('.history-coverage').textContent=coverageText(history)+' · '+intervalLabel(series)+' closes';
  const stale=anchorOf(history)-points.at(-1).timestamp>Math.max(300000,intervalOf(series)*2);
  root.querySelector('#history-help').textContent=(stale?'Latest candle: '+time(points.at(-1).timestamp):points.length<3?points.length+' '+(points.length===1?'point':'points'):'Drag to explore')+' · USD · '+intervalLabel(series);
  root.querySelector('[data-history-from]').textContent=time(from);root.querySelector('[data-history-through]').textContent=time(through);
  for(const b of root.querySelectorAll('[data-history-range]'))b.setAttribute('aria-pressed',String(b.dataset.historyRange===(view.range||'all')));
  select(view.selected==null?points.length-1:nearestPoint(points,view.selected));
 }
 function pointAt(e){
  const rect=plot.getBoundingClientRect(),position=Math.max(0,Math.min(1,(e.clientX-rect.left-geometry.left)/(geometry.right-geometry.left)));
  select(nearestPoint(points,points[0].timestamp+position*(points.at(-1).timestamp-points[0].timestamp)));
 }
 const start=e=>{if(e.button!==0)return;down=true;plot.setPointerCapture(e.pointerId);pointAt(e);};
 const move=e=>{if(down||e.pointerType==='mouse')pointAt(e);};
 const end=()=>{down=false;};
 const input=()=>select(Number(slider.value));
 const range=e=>{const button=e.target.closest('[data-history-range]');if(!button||button.disabled)return;view.range=button.dataset.historyRange;draw();};
 const metric=()=>{view.metric=metricValue=mode.value;draw();};
 draw();
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(()=>{if(plot.clientWidth&&plot.clientHeight)draw();}):null;observer?.observe(plot);
 plot.addEventListener('pointerdown',start);plot.addEventListener('pointermove',move);plot.addEventListener('pointerup',end);plot.addEventListener('pointercancel',end);plot.addEventListener('lostpointercapture',end);slider.addEventListener('input',input);root.addEventListener('click',range);mode.addEventListener('change',metric);
 return ()=>{observer?.disconnect();plot.removeEventListener('pointerdown',start);plot.removeEventListener('pointermove',move);plot.removeEventListener('pointerup',end);plot.removeEventListener('pointercancel',end);plot.removeEventListener('lostpointercapture',end);slider.removeEventListener('input',input);root.removeEventListener('click',range);mode.removeEventListener('change',metric);};
}
