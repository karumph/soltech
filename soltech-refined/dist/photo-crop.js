const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;

// One source rectangle drives both the circular preview and the saved image.
export function photoCropRect(width,height,{zoom=1,x=.5,y=.5}={}) {
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('This photo has invalid dimensions.');
 zoom=clamp(finite(zoom,1),1,4);
 const side=Math.min(width,height)/zoom;
 x=clamp(finite(x,.5),side/(2*width),1-side/(2*width));
 y=clamp(finite(y,.5),side/(2*height),1-side/(2*height));
 return {sx:x*width-side/2,sy:y*height-side/2,side,zoom,x,y};
}

// Keep the photo point under the fingers steady while pinching and panning.
export function zoomPhotoCrop(width,height,crop,nextZoom,anchor={x:.5,y:.5},target=anchor) {
 const before=photoCropRect(width,height,crop),after=photoCropRect(width,height,{...crop,zoom:nextZoom});
 return photoCropRect(width,height,{zoom:after.zoom,
  x:(before.sx+anchor.x*before.side+(.5-target.x)*after.side)/width,
  y:(before.sy+anchor.y*before.side+(.5-target.y)*after.side)/height});
}

export function exportPhotoCrop(source,crop={}) {
 const {sx,sy,side}=photoCropRect(source.width,source.height,crop);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const context=canvas.getContext('2d');if(!context)throw Error('Photo processing is unavailable in this browser.');
 context.fillStyle='#fff';context.fillRect(0,0,256,256);
 context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
 context.drawImage(source.image,sx,sy,side,side,0,0,256,256);
 const photo=canvas.toDataURL('image/jpeg',.86);
 if(photo.length>220000||!photo.startsWith('data:image/jpeg;base64,'))throw Error('Choose a smaller photo.');
 return photo;
}

export function choosePhotoCrop(source,{signal}={}) {
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new DOMException('Cancelled','AbortError'));return;}
  const dialog=document.createElement('dialog'),previousFocus=document.activeElement,events=new AbortController();
  dialog.className='photo-crop-dialog';dialog.setAttribute('aria-labelledby','photo-crop-title');
  dialog.innerHTML=`<div class="photo-crop-heading"><h2 id="photo-crop-title">Adjust photo</h2><button type="button" class="text-link" data-crop="reset">Reset</button></div><p id="photo-crop-help">Drag to move. Pinch to zoom.</p><div class="photo-crop-stage" tabindex="0" role="group" aria-label="Photo position" aria-describedby="photo-crop-help"><canvas width="512" height="512" aria-hidden="true"></canvas><span class="photo-crop-mask" aria-hidden="true"></span></div><details class="photo-crop-controls"><summary>More controls</summary><div class="photo-crop-move" role="group" aria-label="Move photo"><button type="button" class="icon-button" data-crop="left" aria-label="Move photo left">←</button><button type="button" class="icon-button" data-crop="up" aria-label="Move photo up">↑</button><button type="button" class="icon-button" data-crop="down" aria-label="Move photo down">↓</button><button type="button" class="icon-button" data-crop="right" aria-label="Move photo right">→</button></div><div class="photo-crop-zoom"><label for="photo-crop-zoom">Zoom <output for="photo-crop-zoom">1×</output></label><input id="photo-crop-zoom" type="range" min="1" max="4" step=".01" value="1"></div></details><p class="photo-crop-error" role="status" aria-live="polite"></p><div class="personal-form-actions"><button type="button" class="button secondary" data-crop="cancel">Cancel</button><button type="button" class="button glass" data-crop="apply">Use photo</button></div>`;
  if(window.matchMedia('(min-width:801px)').matches){dialog.querySelector('details').open=true;dialog.querySelector('#photo-crop-help').textContent='Drag to move. Adjust zoom below.';}
  const stage=dialog.querySelector('.photo-crop-stage'),canvas=dialog.querySelector('canvas'),zoom=dialog.querySelector('input'),output=dialog.querySelector('output'),error=dialog.querySelector('.photo-crop-error');
  const context=canvas.getContext('2d'),pointers=new Map();let crop={zoom:1,x:.5,y:.5},pinch=null,settled=false;
  const finish=(value,reason)=>{
   if(settled)return;settled=true;events.abort();signal?.removeEventListener('abort',abort);
   if(dialog.open)dialog.close();dialog.remove();
   if(!reason&&previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
   reason?reject(reason):resolve(value);
  };
  const abort=()=>finish(null,new DOMException('Cancelled','AbortError'));
  const render=()=>{
   crop=photoCropRect(source.width,source.height,crop);
   context.fillStyle='#fff';context.fillRect(0,0,512,512);
   context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
   context.drawImage(source.image,crop.sx,crop.sy,crop.side,crop.side,0,0,512,512);
   zoom.value=String(crop.zoom);output.textContent=`${Number(crop.zoom.toFixed(2))}×`;
   zoom.setAttribute('aria-valuetext',`${Number(crop.zoom.toFixed(2))} times`);
  };
  const move=(dx,dy)=>{
   const size=stage.getBoundingClientRect().width;if(!size)return;
   crop.x-=dx*crop.side/(size*source.width);crop.y-=dy*crop.side/(size*source.height);render();
  };
  const directions={left:[-12,0],right:[12,0],up:[0,-12],down:[0,12]};
  dialog.addEventListener('click',event=>{
   const action=event.target.closest('[data-crop]')?.dataset.crop;
   if(action==='cancel')finish(null);
   if(action==='reset'){pinch=null;pointers.clear();stage.classList.remove('is-dragging');crop={zoom:1,x:.5,y:.5};render();}
   if(directions[action])move(...directions[action]);
   if(action==='apply'){try{finish(exportPhotoCrop(source,crop));}catch(err){error.textContent=err.message;}}
  },{signal:events.signal});
  zoom.addEventListener('input',()=>{crop.zoom=Number(zoom.value);render();},{signal:events.signal});
  stage.addEventListener('keydown',event=>{
   const direction=event.key.replace('Arrow','').toLowerCase();
   if(directions[direction]){event.preventDefault();const scale=event.shiftKey?3:1;move(...directions[direction].map(n=>n*scale));}
   if(['+','=','-'].includes(event.key)){event.preventDefault();crop=zoomPhotoCrop(source.width,source.height,crop,crop.zoom+(event.key==='-'?-.1:.1));render();}
  },{signal:events.signal});
  const gesture=()=>{
   const [a,b]=[...pointers.values()],rect=stage.getBoundingClientRect();
   return {distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),point:{x:((a.x+b.x)/2-rect.left)/rect.width,y:((a.y+b.y)/2-rect.top)/rect.height}};
  };
  stage.addEventListener('pointerdown',event=>{
   if(pointers.size>=2||event.button!==0)return;
   stage.focus({preventScroll:true});stage.setPointerCapture(event.pointerId);
   pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});stage.classList.add('is-dragging');
   if(pointers.size===2)pinch={...gesture(),crop:{...crop}};
  },{signal:events.signal});
  stage.addEventListener('pointermove',event=>{
   const pointer=pointers.get(event.pointerId);if(!pointer)return;
   const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
   pointer.x=event.clientX;pointer.y=event.clientY;
   if(pinch&&pointers.size===2){const current=gesture();crop=zoomPhotoCrop(source.width,source.height,pinch.crop,pinch.crop.zoom*current.distance/pinch.distance,pinch.point,current.point);render();}
   else move(dx,dy);
  },{signal:events.signal});
  const stop=event=>{if(!pointers.delete(event.pointerId))return;pinch=null;if(!pointers.size)stage.classList.remove('is-dragging');};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(event,stop,{signal:events.signal});
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);},{signal:events.signal});
  dialog.addEventListener('close',()=>finish(null),{signal:events.signal});
  signal?.addEventListener('abort',abort,{once:true});
  try{if(!context)throw Error('Photo processing is unavailable in this browser.');document.body.append(dialog);dialog.showModal();render();stage.focus({preventScroll:true});}
  catch(err){finish(null,err);}
 });
}
