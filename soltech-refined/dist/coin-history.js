import {formatMoney} from './coin-checker-data.js';
import {mountTouchChart} from './coin-history-chart.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=n=>new Date(n).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const day=86400000;
const hour=3600000;
const ranges=[['hour','1H','Last hour'],['six','6H','Last six hours'],['day','1D','Last day'],['all','All','All available history']];
export const normalizeHistoryRange=range=>ranges.some(([key])=>key===range)?range:'all';
const durationFor=range=>({hour,six:6*hour,day}[normalizeHistoryRange(range)]??Infinity);
const intervalOf=h=>h.intervalMs||(h.interval==='minute'?60000:hour);
const intervalLabel=h=>intervalOf(h)===60000?'1-minute':'Hourly';
const anchorOf=h=>h.retrievedAt??h.through;
export function historySeries(history,range='all'){
 const recent=history.recent;
 if(!recent?.points.length)return history;
 // Use a single resolution per view; never stitch incompatible candles together.
 const completeRecent=recent.rawCount<1000&&recent.windowStart<=history.from;
 const preset=normalizeHistoryRange(range);
 const coveredSixHours=preset==='six'&&recent.windowStart<=anchorOf(history)-6*hour;
 return preset==='hour'||coveredSixHours||completeRecent?recent:history;
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
 if(normalizeHistoryRange(range)!==range)return false;
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
export function historyAttributionHTML(){
 return '<p class="section-note history-attribution"><a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">TradingView Lightweight Charts™</a> · Copyright (с) 2025 TradingView, Inc.</p>';
}
export function historyHTML(part,market,{compact=false,attribution=true}={}){
 if(!part||part.status==='waiting'||part.status==='loading')return '<div class="check-pending"><p>Getting price history…</p></div>';
 if(part.status==='error')return `<details class="check-more" data-view-key="history"><summary>Price history unavailable</summary><p>${esc(part.message)}</p></details>`;
 if(part.status!=='ready')return '<p class="section-note history-empty">Price history is not available for this pool yet.</p>';
 const h=part.data,series=historySeries(h),last=series.points.at(-1),canEstimate=marketCapFactor(market,h)!==null;
 const readout=`<div class="history-readout"><span data-history-label>Selected close</span><strong data-history-price>${chartMoney(last.close)}</strong><time data-history-time${compact?' hidden':''}>${esc(time(last.timestamp))}</time></div>`;
 const coverage=coverageText(h)+' · '+intervalLabel(series)+' closes';
 return `<div class="price-history"><div class="history-heading"><h3 data-history-heading>${canEstimate?'Market cap history':'Price history'}</h3><select class="history-mode" data-view-key="history-mode" aria-label="Chart metric"><option value="price" ${canEstimate?'':'selected'}>Price</option><option value="cap" ${canEstimate?'selected':'disabled'}>Market cap (est.)</option></select></div>
 ${compact?'':readout}
 <p class="history-coverage">${esc(coverage)} · Snapshot</p><div class="history-controls"><div class="history-ranges" role="group" aria-label="Price history range">${ranges.map(([key,label,name])=>`<button type="button" data-history-range="${key}" data-view-key="history-${key}" aria-label="${name}" aria-pressed="${key==='all'}" ${rangeAvailable(h,key)?'':'disabled title="Not enough history for a distinct view"'}>${label}</button>`).join('')}</div></div>
 <div class="history-plot"><div class="history-canvas" data-history-plot role="group" aria-label="Interactive price history"></div></div><div class="history-dates"><span data-history-from>${esc(time(h.from))}</span><span data-history-through>${esc(time(h.through))}</span></div>
 ${compact?readout:''}
 <input class="history-scrubber" data-view-key="history-scrubber" type="range" min="0" max="${series.points.length-1}" value="${series.points.length-1}" step="1" aria-label="Explore closing prices" aria-describedby="history-help" ${series.points.length===1?'disabled':''}>
 <p class="section-note history-help" id="history-help">Slide to explore</p>
 ${compact?'':`<div class="history-current"><span>Current market cap</span><strong>${formatMoney(market?.marketCap??null)}</strong><small>${market?.retrievedAt?'Checked '+esc(time(market.retrievedAt)):'Unavailable'}</small></div>
 <dl class="history-high"><div><dt data-history-high-label>Highest observed price</dt><dd data-history-high>${chartMoney(h.observedHigh)}</dd></div></dl>`}
 ${attribution?historyAttributionHTML():''}</div>`;
}

export function mountHistoryChart(root,history,view,market){
 if(!root||!history?.points.length)return ()=>{};
 const plot=root.querySelector('[data-history-plot]'),slider=root.querySelector('.history-scrubber'),mode=root.querySelector('.history-mode'),factor=marketCapFactor(market,history);
 const price=root.querySelector('[data-history-price]'),date=root.querySelector('[data-history-time]'),label=root.querySelector('[data-history-label]');
 let metricValue=factor===null?'price':view.metric==='price'?'price':'cap',points,index,series,touchChart=null,disposed=false;
 view.metric=metricValue;view.range=normalizeHistoryRange(view.range);
 const valueOf=point=>metricValue==='cap'?point.close*factor:point.close;
 function select(next,fromChart=false){
  index=Math.max(0,Math.min(points.length-1,next));const point=points[index];view.selected=point.timestamp;
  const value=valueOf(point),quiet=point.zeroVolume===true;
  slider.value=String(index);slider.setAttribute('aria-valuetext',`${time(point.timestamp)}, ${chartMoney(value)} ${metricValue==='cap'?'estimated market cap':'closing price'}${quiet?', zero volume':''}`);
  price.textContent=chartMoney(value);date.textContent=time(point.timestamp);date.dateTime=new Date(point.timestamp).toISOString();
  label.textContent=(metricValue==='cap'?'Estimated market cap':'Selected close')+(quiet?' · No swaps':'');
  if(!fromChart)touchChart?.select(index);
 }
 const viewport=range=>{
  if(!range)return;
  root.querySelector('[data-history-from]').textContent=time(range.from*1000);
  root.querySelector('[data-history-through]').textContent=time(range.to*1000);
 };
 function draw(){
  touchChart?.dispose();touchChart=null;
  if(!rangeAvailable(history,view.range))view.range='all';
  series=historySeries(history,view.range);
  points=historyWindow(history,view.range);if(!points.length)points=history.points;
  mode.value=metricValue;
  root.querySelector('[data-history-heading]').textContent=metricValue==='cap'?'Market cap history':'Price history';
  const highLabel=root.querySelector('[data-history-high-label]'),highValue=root.querySelector('[data-history-high]');
  if(highLabel)highLabel.textContent=metricValue==='cap'?'Highest estimate in history':'Highest observed price';
  if(highValue)highValue.textContent=chartMoney(history.observedHigh*(metricValue==='cap'?factor:1));
  slider.setAttribute('aria-label',metricValue==='cap'?'Explore estimated market cap':'Explore closing prices');
  slider.max=String(points.length-1);slider.disabled=points.length<2;
  root.querySelector('.history-coverage').textContent=coverageText(history)+' · '+intervalLabel(series)+' closes · Snapshot';
  const stale=anchorOf(history)-points.at(-1).timestamp>Math.max(300000,intervalOf(series)*2);
  const help=root.querySelector('#history-help');
  help.textContent=stale?'Latest candle: '+time(points.at(-1).timestamp)+' · Slide to explore':points.length<2?'One observation available · USD':'Slide to explore';
  root.querySelector('[data-history-from]').textContent=time(points[0].timestamp);root.querySelector('[data-history-through]').textContent=time(points.at(-1).timestamp);
  for(const button of root.querySelectorAll('[data-history-range]'))button.setAttribute('aria-pressed',String(button.dataset.historyRange===view.range));
  // A connected container is required by the canvas engine. A detached report
  // still exposes its prices through the accessible readout and slider.
  plot.setAttribute('aria-label',metricValue==='cap'?'Interactive estimated market cap history':'Interactive closing price history');
  if(root.isConnected){
   try{
    touchChart=mountTouchChart(plot,{points,intervalMs:intervalOf(series),factor:metricValue==='cap'?factor:1,formatPrice:axisMoney,formatTime:time,view,onSelect:next=>select(next,true),onGap:timestamp=>{label.textContent='No observation';price.textContent='—';date.textContent=time(timestamp);date.dateTime=new Date(timestamp).toISOString();},onClear:()=>{if(index!=null)select(index,true);},onViewport:viewport});
    delete plot.dataset.historyError;
   }catch(error){
    plot.replaceChildren();plot.dataset.historyError=error?.message||'unavailable';
    const message=document.createElement('p');message.className='history-chart-error';message.textContent='The interactive chart could not load. Use the slider below to explore the saved prices.';plot.append(message);
    // A chart problem must not remove the rest of a valid coin report.
   }
  }
  select(view.selected==null?points.length-1:nearestPoint(points,view.selected));
 }
 const input=()=>select(Number(slider.value));
 const range=event=>{const button=event.target.closest('[data-history-range]');if(!button||button.disabled)return;view.range=button.dataset.historyRange;draw();};
 const metric=()=>{view.metric=metricValue=mode.value;draw();};
 draw();
 slider.addEventListener('input',input);root.addEventListener('click',range);mode.addEventListener('change',metric);
 return ()=>{if(disposed)return;disposed=true;touchChart?.dispose();slider.removeEventListener('input',input);root.removeEventListener('click',range);mode.removeEventListener('change',metric);};
}
