import {createChart,AreaSeries,LineSeries,CrosshairMode,LineStyle} from './vendor/lightweight-charts-5.2.1/lightweight-charts.standalone.production.js';

// A separate area for each contiguous run prevents the charting library from
// drawing a price movement across missing observations. A whitespace backbone
// keeps those missing intervals on the time axis instead of compressing them.
export function chartData(points,intervalMs,factor=1){
 const values=points.map(point=>point.close*factor);
 const maximum=Math.max(...values,0);
 const unit=maximum>1e12||(maximum>0&&maximum<1e-6)?maximum:1;
 const groups=[];
 points.forEach((point,index)=>{
  if(!index||point.timestamp-points[index-1].timestamp>intervalMs*1.5)groups.push([]);
  groups.at(-1).push({time:point.timestamp/1000,value:values[index]/unit});
 });
 const timeline=[];
 if(points.length){
  const from=points[0].timestamp,through=points.at(-1).timestamp;
  // Normalized source windows contain at most 1,000 intervals. Keep malformed
  // external/legacy data from allocating an unbounded whitespace series.
  if((through-from)/intervalMs<=10000){
   for(let at=from;at<=through;at+=intervalMs)timeline.push({time:at/1000});
  }else for(const point of points)timeline.push({time:point.timestamp/1000});
 }
 return {unit,timeline,groups,isolated:groups.filter(group=>group.length===1).flat(),segments:groups.filter(group=>group.length>1)};
}

export const finitePrice=(value,unit)=>{
 const amount=value*unit;
 return Number.isFinite(amount)?amount:Math.sign(value)*Number.MAX_VALUE;
};
const validRange=range=>range&&Number.isFinite(range.from)&&Number.isFinite(range.to)&&range.from<range.to;

export function mountTouchChart(host,{points,intervalMs,factor=1,formatPrice,formatTime,view,onSelect,onViewport}){
 const data=chartData(points,intervalMs,factor),unit=data.unit;
 const css=typeof getComputedStyle==='function'?getComputedStyle(host):null;
 const color=(name,fallback)=>css?.getPropertyValue(name).trim()||fallback;
 const forced=typeof matchMedia==='function'&&matchMedia('(forced-colors: active)').matches;
 const ink=forced?'#000000':color('--theme-ink','#273445');
 const muted=forced?'#333333':color('--theme-muted','#526071');
 const line=forced?'#000000':color('--theme-focus','#547797');
 const grid=forced?'#d0d0d0':color('--theme-line','#e5e9ef');
 const priceFormat=value=>formatPrice(finitePrice(value,unit));
 const chart=createChart(host,{
  width:host.clientWidth||300,height:host.clientHeight||236,autoSize:true,
  layout:{background:{type:'solid',color:'#ffffff'},textColor:muted,fontFamily:css?.fontFamily||'sans-serif',fontSize:11,attributionLogo:false},
  localization:{priceFormatter:priceFormat,timeFormatter:timestamp=>formatTime(timestamp*1000)},
  grid:{vertLines:{visible:false},horzLines:{color:grid,style:LineStyle.Solid}},
  rightPriceScale:{borderVisible:false,autoScale:true,scaleMargins:{top:.12,bottom:.12},minimumWidth:64},
  leftPriceScale:{visible:false},
  timeScale:{borderVisible:false,timeVisible:true,secondsVisible:false,rightOffset:0,barSpacing:6,minBarSpacing:.05,fixLeftEdge:true,fixRightEdge:true,lockVisibleTimeRangeOnResize:true,shiftVisibleRangeOnNewBar:false,tickMarkFormatter:(timestamp,type)=>new Date(timestamp*1000).toLocaleString([],type<3?{month:'short',day:'numeric'}:{hour:'numeric',minute:'2-digit'})},
  crosshair:{mode:CrosshairMode.Magnet,vertLine:{color:line,width:1,style:LineStyle.Dashed,labelBackgroundColor:ink},horzLine:{visible:false,labelVisible:false}},
  handleScroll:false,
  handleScale:false,
  kineticScroll:{mouse:false,touch:false},
 });
 try{
 // Exploration belongs to the native slider below. The renderer must neither
 // move a cursor on hover nor intercept touch/scroll gestures meant for the page.
 chart.chartElement().style.pointerEvents='none';
 host.dataset.historyEngine='lightweight';
 delete view.viewport;
 const common={priceLineVisible:false,lastValueVisible:false,baseLineVisible:false,crosshairMarkerVisible:true,crosshairMarkerRadius:4,crosshairMarkerBackgroundColor:ink,crosshairMarkerBorderColor:'#ffffff',priceFormat:{type:'custom',formatter:priceFormat,minMove:.00000001},lastPriceAnimation:0};
 const backbone=chart.addSeries(LineSeries,{...common,lineVisible:false,pointMarkersVisible:false,crosshairMarkerVisible:false});
 backbone.setData(data.timeline);
 const available=[];
 for(const segment of data.segments){
  const series=chart.addSeries(AreaSeries,{...common,lineColor:ink,lineWidth:2,topColor:forced?'rgba(0,0,0,0)':'rgba(111,151,193,.17)',bottomColor:'rgba(111,151,193,0)',pointMarkersVisible:false});
  series.setData(segment);available.push({series,points:segment});
 }
 if(data.isolated.length){
  const series=chart.addSeries(LineSeries,{...common,color:ink,lineVisible:false,pointMarkersVisible:true,pointMarkersRadius:3});
  series.setData(data.isolated);available.push({series,points:data.isolated});
 }
 const timeScale=chart.timeScale(),priceScale=chart.priceScale('right');
 const signature=`${intervalMs}:${points[0]?.timestamp}:${points.at(-1)?.timestamp}`,rangeKey=view.range,metricKey=view.metric;
 let disposed=false,selectedIndex=null;
 const capture=()=>{
  if(disposed)return;
  const logical=timeScale.getVisibleLogicalRange(),time=timeScale.getVisibleRange(),price=priceScale.getVisibleRange();
  view.viewport={signature,range:rangeKey,metric:metricKey,logical:validRange(logical)?{...logical}:null,time:validRange(time)?{...time}:null,price:validRange(price)?{from:finitePrice(price.from,unit),to:finitePrice(price.to,unit)}:null,autoScale:priceScale.options().autoScale};
  host.dataset.historyViewport=logical?`${logical.from.toFixed(3)}:${logical.to.toFixed(3)}`:'';
  host.dataset.historyPriceScale=price?`${price.from}:${price.to}`:'';
  onViewport?.(time);
 };
 // Always fit the selected preset. Old gesture zoom/scale state is deliberately
 // discarded; only the selected timestamp and metric survive a report remount.
 priceScale.applyOptions({autoScale:true});
 timeScale.fitContent();
 const syncSelected=()=>{
  const point=points[selectedIndex];if(!point||disposed)return;
  const at=point.timestamp/1000,visible=timeScale.getVisibleRange();
  if(!visible||at<visible.from||at>visible.to){
   // The library clamps synthetic cursors to the visible edge. Hide an offscreen
   // selection instead, so its visible marker never contradicts the readout.
   chart.clearCrosshairPosition();
  }else{
   const entry=available.find(item=>item.points.some(p=>p.time===at));
   if(entry)chart.setCrosshairPosition(point.close*factor/unit,at,entry.series);
  }
  onSelect(selectedIndex);
 };
 timeScale.subscribeVisibleLogicalRangeChange(capture);
 const eventWindow=host.ownerDocument.defaultView;
 let resizeFrame=null;
 const resize=typeof ResizeObserver==='function'?new ResizeObserver(()=>{
  if(!host.clientWidth||!host.clientHeight)return;
  if(resizeFrame!==null)eventWindow.cancelAnimationFrame(resizeFrame);
  resizeFrame=eventWindow.requestAnimationFrame(()=>{resizeFrame=null;capture();syncSelected();});
 }):null;
 resize?.observe(host);
 capture();
 return {
  select(index){
   selectedIndex=index;syncSelected();
  },
  capture,
  dispose(){
   if(disposed)return;capture();disposed=true;resize?.disconnect();timeScale.unsubscribeVisibleLogicalRangeChange(capture);
   if(resizeFrame!==null)eventWindow.cancelAnimationFrame(resizeFrame);
   chart.remove();delete host.dataset.historyEngine;
  },
 };
 }catch(error){chart.remove();delete host.dataset.historyEngine;throw error;}
}
