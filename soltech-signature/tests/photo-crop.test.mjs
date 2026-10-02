import test from 'node:test';
import assert from 'node:assert/strict';
import {photoCropRect,zoomPhotoCrop} from '../dist/photo-crop.js';
import {loadProfilePhoto} from '../dist/profile-store.js';

test('centered crop preserves the largest square in portrait and landscape images',()=>{
 const portrait=photoCropRect(600,1200),landscape=photoCropRect(1200,600);
 assert.deepEqual([portrait.sx,portrait.sy,portrait.side],[0,300,600]);
 assert.deepEqual([landscape.sx,landscape.sy,landscape.side],[300,0,600]);
});
test('zoomed and off-center crop never reveals an area outside the source',()=>{
 for(const [w,h] of [[600,1200],[1200,600],[1024,1024],[1,10],[8000,8000]])
 for(const zoom of [0,1,1.3,2.5,4,100])
 for(const x of [-10,0,.25,.5,1,20])for(const y of [-5,0,.5,1,10]){
  const r=photoCropRect(w,h,{zoom,x,y});
  assert.ok(r.sx>=-1e-8&&r.sy>=-1e-8);
  assert.ok(r.sx+r.side<=w+1e-8&&r.sy+r.side<=h+1e-8);
  assert.ok(r.zoom>=1&&r.zoom<=4);
 }
});
test('zoom preserves a valid off-center position and safely resets invalid input',()=>{
 const r=photoCropRect(1000,1000,{zoom:4,x:.25,y:.75});
 assert.deepEqual([r.sx,r.sy,r.side],[125,625,250]);
 const reset=photoCropRect(1000,1000,{zoom:NaN,x:Infinity,y:NaN});
 assert.deepEqual([reset.sx,reset.sy,reset.side],[0,0,1000]);
 for(const [w,h] of [[0,20],[20,-1],[Infinity,20],[20,NaN]])assert.throws(()=>photoCropRect(w,h));
});

test('pinching keeps the source point beneath an off-center finger midpoint',()=>{
 const before=photoCropRect(1200,1800,{zoom:1.5,x:.4,y:.55}),anchor={x:.3,y:.65};
 const after=zoomPhotoCrop(1200,1800,before,3,anchor);
 assert.ok(Math.abs(before.sx+anchor.x*before.side-after.sx-anchor.x*after.side)<1e-8);
 assert.ok(Math.abs(before.sy+anchor.y*before.side-after.sy-anchor.y*after.side)<1e-8);
});
test('a two-finger translation pans the same source point with the fingers',()=>{
 const before=photoCropRect(1600,1000,{zoom:2}),anchor={x:.5,y:.5},target={x:.65,y:.6};
 const after=zoomPhotoCrop(1600,1000,before,2.5,anchor,target);
 assert.ok(Math.abs(before.sx+anchor.x*before.side-after.sx-target.x*after.side)<1e-8);
 assert.ok(Math.abs(before.sy+anchor.y*before.side-after.sy-target.y*after.side)<1e-8);
});
test('pinch limits and extreme movement keep the photo covering the crop',()=>{
 for(const z of [.1,1,4,20])for(const position of [-3,.5,4]){
  const r=zoomPhotoCrop(600,1200,{zoom:2},z,{x:.5,y:.5},{x:position,y:position});
  assert.ok(r.zoom>=1&&r.zoom<=4);
  assert.ok(r.sx>=-1e-8&&r.sy>=-1e-8&&r.sx+r.side<=600+1e-8&&r.sy+r.side<=1200+1e-8);
 }
 const restored=zoomPhotoCrop(600,1200,{zoom:4,x:.2,y:.8},1);
 assert.equal(restored.side,600);
});
test('decoded source stays available until the editor releases it exactly once',async()=>{
 const originalImage=globalThis.Image,originalURL=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
 let image,revocations=0;
 globalThis.Image=class{constructor(){image=this;this.naturalWidth=1200;this.naturalHeight=600;}set src(v){this.value=v;}};
 URL.createObjectURL=()=> 'blob:crop-test';URL.revokeObjectURL=()=>revocations++;
 try{
  const result=loadProfilePhoto({type:'image/png',size:123});image.onload();const source=await result;
  assert.equal(revocations,0);assert.equal(image.value,'blob:crop-test');assert.equal(source.width,1200);
  source.dispose();source.dispose();assert.equal(revocations,1);assert.equal(image.value,'');
 }finally{globalThis.Image=originalImage;URL.createObjectURL=originalURL;URL.revokeObjectURL=originalRevoke;}
});
test('oversized decoded images fail and release their source',async()=>{
 const originalImage=globalThis.Image,originalURL=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
 let image,revocations=0;
 globalThis.Image=class{constructor(){image=this;this.naturalWidth=9000;this.naturalHeight=9000;}set src(v){}};
 URL.createObjectURL=()=> 'blob:crop-test';URL.revokeObjectURL=()=>revocations++;
 try{const result=loadProfilePhoto({type:'image/png',size:123});image.onload();await assert.rejects(result,/smaller photo/);assert.equal(revocations,1);}
 finally{globalThis.Image=originalImage;URL.createObjectURL=originalURL;URL.revokeObjectURL=originalRevoke;}
});
