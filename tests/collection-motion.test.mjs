import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../app/collection-motion.js',import.meta.url),'utf8');
const framesCode=source.slice(source.indexOf('  const duration='),source.indexOf('  const nodes='));
function frames(entering,width,height){
 const r={left:22,top:150,width:82.5,height:73.7};
 const smooth=(a,b,x)=>{const p=Math.max(0,Math.min(1,(x-a)/(b-a)));return p*p*(3-2*p)};
 return vm.runInNewContext(framesCode+';({duration,frames})',{entering,width,height,r,source:{radius:10},fromBrand:26,toBrand:23,brandSize:26,headerShift:4,smooth});
}
test('title size is expressed only by scale; transition endpoints, timing and geometry remain intact',()=>{
 for(const [w,h] of [[320,568],[390,844],[800,900]])for(const entering of [true,false]){
  const result=frames(entering,w,h),f=result.frames;
  assert.equal(result.duration,entering?720:560);
  assert.equal(f.frame.length,241);assert.equal(f.compensation.length,241);assert.equal(f.brand.length,61);
  for(const keyframe of f.brand){assert.equal('fontSize' in keyframe,false);assert.match(keyframe.transform,/^scale\(/)}
  const visualSize=frame=>Number(frame.transform.match(/scale\(([^)]+)/)[1])*26;
  assert.ok(Math.abs(visualSize(f.brand[0])-(entering?26:23))<1e-8);
  assert.ok(Math.abs(visualSize(f.brand.at(-1))-(entering?23:26))<1e-8);
  const transform=frame=>{const [x,y,,sx,sy]=frame.transform.match(/-?[\d.]+(?:e[+-]?\d+)?/g).slice(1).map(Number);return {x,y,sx,sy}};
  const closed=transform(f.frame[entering?0:240]),open=transform(f.frame[entering?240:0]);
  for(const [actual,expected] of [[closed.x,22],[closed.y,150],[closed.sx*w,82.5],[closed.sy*h,73.7],[open.x,0],[open.y,0],[open.sx,1],[open.sy,1]])assert.ok(Math.abs(actual-expected)<1e-8);
  for(let i=0;i<f.frame.length;i++){
   assert.equal('clipPath' in f.frame[i],false);
   const outer=transform(f.frame[i]),inner=transform(f.compensation[i]);
   assert.ok(Math.abs(outer.sx*inner.sx-1)<1e-10);assert.ok(Math.abs(outer.sy*inner.sy-1)<1e-10);
   assert.ok(Math.abs(outer.x+outer.sx*inner.x)<1e-8);assert.ok(Math.abs(outer.y+outer.sy*inner.y)<1e-8);
   const [rx,ry]=f.frame[i].borderRadius.match(/-?[\d.]+(?:e[+-]?\d+)?/g).map(Number);
   assert.ok(Math.abs(rx*outer.sx-ry*outer.sy)<1e-8,'screen-space corner stays circular');
  }
  assert.equal(f.glass[entering?0:60].opacity,1);assert.equal(f.glass[entering?60:0].opacity,0);
 }
});

test('inverse compensation stays subpixel between samples and preserves the original trajectory',()=>{
 const transform=k=>{const [x,y,,sx,sy]=k.transform.match(/-?[\d.]+(?:e[+-]?\d+)?/g).slice(1).map(Number);return {x,y,sx,sy}};
 const settle=t=>(1-(1+8.5*t)*Math.exp(-8.5*t))/(1-9.5*Math.exp(-8.5));
 let worst=0;
 for(const [w,h] of [[320,568],[390,844],[800,900]])for(const entering of [true,false]){
  const f=frames(entering,w,h).frames;
  for(let i=0;i<f.frame.length;i++){
   const outer=transform(f.frame[i]),segment=Math.min(59,Math.floor(i/4)),fraction=i/4-segment;
   const p0=entering?settle(segment/60):1-settle(segment/60),p1=entering?settle((segment+1)/60):1-settle((segment+1)/60),p=p0+(p1-p0)*fraction;
   assert.ok(Math.abs(outer.x-22*(1-p))<1e-8);assert.ok(Math.abs(outer.y-150*(1-p))<1e-8);
   assert.ok(Math.abs(outer.sx*w-(82.5+(w-82.5)*p))<1e-8);assert.ok(Math.abs(outer.sy*h-(73.7+(h-73.7)*p))<1e-8);
   if(i===f.frame.length-1)continue;
   const next=transform(f.frame[i+1]),inner=transform(f.compensation[i]),innerNext=transform(f.compensation[i+1]);
   for(const t of [.25,.5,.75]){
    const mix=(a,b)=>a+(b-a)*t;
    for(const [pos,scale,size] of [['x','sx',w],['y','sy',h]]){
     const x=mix(outer[pos],next[pos]),s=mix(outer[scale],next[scale]),ix=mix(inner[pos],innerNext[pos]),is=mix(inner[scale],innerNext[scale]);
     for(const at of [x,x+s*size])worst=Math.max(worst,Math.abs(x+s*ix+(s*is-1)*at));
    }
   }
  }
 }
 assert.ok(worst<.25,`visible compensation error ${worst}px`);
});
