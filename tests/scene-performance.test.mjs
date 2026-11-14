import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const script=await readFile(new URL('../app/scene.js',import.meta.url),'utf8');
function harness(width=1512,height=982){
 let time=0,id=0,gradients=0,draws=0;const scheduled=new Map(),events={},classes=new Set(['collections-view']);
 const context={setTransform(){},clearRect(){draws++},createRadialGradient(){gradients++;return {addColorStop(){}}},fillRect(){},drawImage(){},beginPath(){},arc(){},fill(){}};
 const makeCanvas=()=>({dataset:{},setAttribute(){},getContext:()=>context,width:0,height:0,hidden:false});
 const doc={hidden:false,body:{prepend(){},classList:{contains:n=>classes.has(n)}},documentElement:{classList:{add(){},remove(){}}},createElement:makeCanvas,querySelector:()=>({}),querySelectorAll:()=>[],addEventListener:(n,f)=>events[n]=f};
 const motion={matches:false,addEventListener:(n,f)=>events.motion=f};
 const schedule=(fn,delay)=>{scheduled.set(++id,{fn,at:time+delay});return id};
 const sandbox={window:{},document:doc,innerWidth:width,innerHeight:height,devicePixelRatio:2,matchMedia:()=>motion,performance:{now:()=>time},MutationObserver:class{observe(){}},addEventListener:(n,f)=>events[n]=f,requestAnimationFrame:fn=>schedule(fn,1000/120),cancelAnimationFrame:n=>scheduled.delete(n),setTimeout:(fn,d)=>schedule(fn,d),clearTimeout:n=>scheduled.delete(n)};
 vm.runInNewContext(script,sandbox);
 function advance(ms){const end=time+ms;let count=0;while(scheduled.size){const [key,next]=[...scheduled].sort((a,b)=>a[1].at-b[1].at)[0];if(next.at>end)break;if(++count>10000)throw Error('Runaway animation');time=next.at;scheduled.delete(key);next.fn(time)}time=end}
 return {advance,events,doc,motion,classes,stats:()=>({...sandbox.window.ScenePerformance.snapshot(),gradients,draws,pending:scheduled.size})};
}
test('ambient rendering has a bounded retina backing store and reuses star textures',()=>{
 const h=harness();const initial=h.stats();h.advance(10000);const result=h.stats();
 assert.ok(result.backingPixels<=1_503_000);assert.equal(result.stars,650);
 assert.equal(result.gradients,initial.gradients,'No per-frame radial gradient creation');
 assert.ok(result.draws-initial.draws<=241);assert.ok(result.draws-initial.draws>=170);
 assert.ok(result.lightUpdates<=121);
 const oldPixels=1512*982*4;assert.ok(result.backingPixels<oldPixels*.26);
});
test('background, lost focus and reduced motion stop the scheduler; resume does not queue duplicate loops',()=>{
 const h=harness();h.advance(1000);h.doc.hidden=true;h.events.visibilitychange();const paused=h.stats();h.advance(5000);assert.equal(h.stats().draws,paused.draws);assert.equal(h.stats().pending,0);
 h.doc.hidden=false;h.events.visibilitychange();assert.equal(h.stats().pending,1);
 h.events.blur();const blurred=h.stats();h.advance(1000);assert.equal(h.stats().draws,blurred.draws);assert.equal(h.stats().pending,0);
 h.events.focus();h.events.focus();assert.equal(h.stats().pending,1);
 h.motion.matches=true;h.events.motion();const reduced=h.stats();h.advance(2000);assert.equal(h.stats().draws,reduced.draws);assert.equal(h.stats().pending,0);
});
test('shelf and navigation stop the star loop, reading retains slower movement, mobile stays sharp',()=>{
 const h=harness(390,844);assert.equal(h.stats().pixelRatio,1.5);
 h.classes.clear();h.events['collectionsceneupdate']();assert.equal(h.stats().pending,0);
 h.classes.add('collections-view');h.classes.add('collection-transition-active');h.events['collectionsceneupdate']();assert.equal(h.stats().pending,0);
 h.classes.clear();h.classes.add('news-reading');h.events['collectionsceneupdate']();assert.equal(h.stats().targetFPS,18);h.advance(1000);assert.ok(h.stats().draws>2);
});
