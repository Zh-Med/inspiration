import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const awaitCss=await readFile(new URL('../app/style.css',import.meta.url),'utf8');
const source=await readFile(new URL('../app/app.js',import.meta.url),'utf8');
function harness(){
 let queries=0,reads=0,writes=0,width=390,resize,time=0,id=0;const frames=new Map(),timers=new Map(),events={};
 const node=()=>{const classes=new Set(),attrs={};return {classes,attrs,style:new Proxy({},{set(target,key,value){writes++;target[key]=value;return true}}),classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),toggle(k,v){v?classes.add(k):classes.delete(k)}},setAttribute(k,v){attrs[k]=v}}};
 const pages=Array.from({length:105},()=>{const el=node(),children={};el.querySelector=selector=>{queries++;return children[selector]??=node()};el.children=children;return el});
 const stage={...node(),isConnected:true,dataset:{},get clientWidth(){reads++;return width},querySelectorAll(){queries++;return pages}};
 const ctx=vm.createContext({performance:{now:()=>time},requestAnimationFrame:cb=>{frames.set(++id,cb);return id},cancelAnimationFrame:id=>frames.delete(id),setTimeout:cb=>{timers.set(++id,cb);return id},clearTimeout:id=>timers.delete(id),document:{addEventListener:(name,cb)=>events[name]=cb,documentElement:{classList:{toggle(){}}}},location:{search:''},URLSearchParams,matchMedia:()=>({matches:false}),$:()=>stage,deckCards:pages.map(()=>({title:'Title'})),shelfContent:Array(100),deckProgress:0,deckVelocity:0,deckGlow:0,deckPointerY:.45,deckIndex:0,deckFrame:0,deckPaintFrame:0,deckWheelTimer:0,deckDrag:null,reduceMotion:()=>false,queueDeckPaint(){},ResizeObserver:class{constructor(cb){resize=cb}observe(){}disconnect(){}}});
 vm.runInContext(source.slice(source.indexOf('function bookshelfEffect'),source.indexOf('function dragCoordinate')),ctx);
 const wheelStart=source.indexOf("document.addEventListener('wheel',");vm.runInContext(source.slice(wheelStart,source.indexOf('\nmatchMedia',wheelStart)),ctx);
 return {pages,stage,ctx,paint:p=>{ctx.deckProgress=p;vm.runInContext('paintDeck()',ctx)},resize:w=>{width=w;resize()},stats:()=>({queries,reads,writes}),reset:()=>vm.runInContext('resetDeckPaintCache()',ctx),at:t=>{time=t},frames,events,flush:t=>{time=t;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(cb=>cb(t))}};
}
test('long shelves update only visible pages, with one foreground and reusable layout/node caches',()=>{
 const h=harness();h.paint(0);const first=h.stats();h.paint(0);assert.deepEqual(h.stats(),first,'stationary paint should not rewrite styles or read layout/nodes');
 for(const p of [.49,.51,1.2,50,99,104,103.5,0]){
  h.paint(p);const visible=h.pages.filter(e=>e.attrs['aria-hidden']==='false');
  assert.ok(visible.length<=9);assert.equal(h.pages.filter(e=>e.classes.has('is-front')).length,1);
  assert.equal(h.pages[Math.round(p)].classes.has('is-front'),true);
  assert.ok(visible.every(e=>!e.inert));
 }
 assert.equal(h.stats().queries,first.queries);assert.equal(h.stats().reads,first.reads);
});
test('resize and replacement invalidate cached geometry and page references',()=>{
 const h=harness();h.paint(2);const before=h.stats();h.resize(430);h.paint(2);assert.ok(h.stats().writes>before.writes);assert.equal(h.stats().reads,before.reads+1);
 h.reset();h.paint(2);assert.ok(h.stats().queries>before.queries);
});

test('moving sheets change only transform/opacity, never inherited variables or shadow paint',()=>{
 const h=harness();h.paint(1);h.paint(1.3);
 for(const page of h.pages.filter(e=>e.attrs['aria-hidden']==='false')){
  assert.deepEqual(Object.keys(page.style).sort(),['opacity','transform','visibility','zIndex']);
  for(const [selector,child] of Object.entries(page.children))for(const property of Object.keys(child.style))assert.ok(['opacity','transform'].includes(property),selector+': '+property);
 }
 const css=awaitCss;
 assert.match(css, /16\.666667%,33\.333333%\{opacity:1\}/);
 assert.ok(!css.includes('--breath-peak'));
});

test('rear sheets never update hidden light, reflection or shade layers while moving',()=>{
 const h=harness();h.paint(2);const rear=h.pages[5];
 const before=JSON.stringify(['.paper-light','.paper-reflection','.paper-shade'].map(k=>rear.children[k].style));
 for(const p of [2.1,2.2,2.4])h.paint(p);
 assert.equal(JSON.stringify(['.paper-light','.paper-reflection','.paper-shade'].map(k=>rear.children[k].style)),before);
 assert.ok(h.pages[2].children['.paper-light'].style.transform);
 h.paint(5);assert.ok(rear.children['.paper-light'].style.transform,'new foreground receives live light');
});

test('120 Hz motion keeps its cadence while material sampling stays at or below 18 Hz',()=>{
 const h=harness();h.ctx.deckDrag={moved:true};h.ctx.materialCalls=0;
 vm.runInContext('const originalMaterials=paintDeckMaterials;paintDeckMaterials=(...args)=>{materialCalls++;return originalMaterials(...args)}',h.ctx);
 let prior='',motionChanges=0;
 for(let n=0;n<=120;n++){
  h.at(n*1000/120);h.paint(2+n*.2/120);
  const transform=h.pages[2].style.transform;if(transform!==prior)motionChanges++;prior=transform;
 }
 assert.equal(motionChanges,121);assert.ok(h.ctx.materialCalls<=19);assert.ok(h.ctx.materialCalls>=15);
 const count=h.ctx.materialCalls;h.at(1001);h.ctx.deckDrag=null;h.paint(2.2);assert.equal(h.ctx.materialCalls,count+1,'rest always samples final material');
});
test('new foreground initializes immediately between material ticks; boundary fade stays continuous',()=>{
 const h=harness();h.ctx.deckDrag={moved:true};h.at(0);h.paint(2.49);
 h.at(8);h.paint(2.65);assert.ok(h.pages[3].children['.paper-light'].style.transform);
 const oldFade=h.pages[2].children['.paper-material'].style.opacity;
 const oldLight=h.pages[3].children['.paper-light'].style.transform;
 h.at(16);h.paint(2.7);
 assert.notEqual(h.pages[2].children['.paper-material'].style.opacity,oldFade);
 assert.equal(h.pages[3].children['.paper-light'].style.transform,oldLight);
});
test('a wheel event burst uses one queued paint and cached width',()=>{
 const h=harness();h.paint(2);const before=h.stats(),transform=h.pages[2].style.transform;
 for(let i=0;i<20;i++)h.events.wheel({target:{closest:()=>h.stage},deltaX:1,deltaY:0,deltaMode:0,shiftKey:false,preventDefault(){}});
 assert.equal(h.frames.size,1);assert.equal(h.stats().reads,before.reads);
 assert.equal(h.pages[2].style.transform,transform,'wheel does not paint synchronously');
 h.flush(16);assert.equal(h.frames.size,0);assert.notEqual(h.pages[2].style.transform,transform);
});

test('decoded rear textures receive only fade while CSS material resumes on foreground promotion',()=>{
 const h=harness();h.pages.forEach(p=>p.hasRasterTexture=true);h.paint(2);
 const rear=h.pages[5],layers=rear.children;
 assert.equal(layers['.paper-raster'].style.opacity,'1.0000');
 assert.equal(layers['.paper-material'].style.opacity,undefined);
 assert.equal(layers['.paper-shadow'].style.opacity,undefined);
 h.paint(5);assert.equal(layers['.paper-material'].style.opacity,'0.9600');assert.equal(layers['.paper-shadow'].style.opacity,'1.0000');
});

test('foreground material is stable at selection midpoints without changing selection',()=>{
 const h=harness();h.ctx.deckDrag={moved:true};h.paint(2.49);
 for(const p of [2.51,2.48,2.52,2.5]){
  h.paint(p);assert.ok(h.pages[2].classes.has('is-front'));
  assert.equal(h.pages[Math.round(p)].children['[data-deck]'].attrs['aria-pressed'],'true');
 }
 h.paint(2.65);assert.ok(h.pages[3].classes.has('is-front'));
 h.paint(2.49);assert.ok(h.pages[3].classes.has('is-front'));
 h.ctx.deckDrag=null;h.paint(2.49);assert.ok(h.pages[2].classes.has('is-front'),'rest restores the exact nearest foreground');
});
