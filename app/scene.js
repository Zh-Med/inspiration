// One sky, one moving area light. The glass samples a common screen-space field.
(()=>{
 const canvas=document.createElement('canvas');canvas.id='night-sky';canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let width=0,height=0,stars=[],panels=[],frame=0,timer=0,last=0,elapsed=0,skyDrawTime=0,lastLight=-Infinity,inactive=false;
 const stats={draws:0,lightUpdates:0,pixelRatio:1};
 const sprites=new Map();
 function sprite(rgb,halo){
  const key=rgb+halo;if(sprites.has(key))return sprites.get(key);
  const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');
  if(halo){const glow=g.createRadialGradient(48,48,0,48,48,36);glow.addColorStop(0,`rgba(${rgb},.19)`);glow.addColorStop(.3,`rgba(${rgb},.065)`);glow.addColorStop(1,`rgba(${rgb},0)`);g.fillStyle=glow;g.fillRect(12,12,72,72)}
  g.fillStyle=`rgb(${rgb})`;g.beginPath();g.arc(48,48,8,0,Math.PI*2);g.fill();sprites.set(key,c);return c;
 }
 for(const rgb of ['244,229,199','204,222,245','237,240,242']){sprite(rgb,true);sprite(rgb,false)}
 const spillTexture=document.createElement('canvas');spillTexture.width=spillTexture.height=128;
 const spillContext=spillTexture.getContext('2d'),spill=spillContext.createRadialGradient(64,64,0,64,64,64);
 spill.addColorStop(0,'rgba(180,175,154,.035)');spill.addColorStop(1,'rgba(180,175,154,0)');spillContext.fillStyle=spill;spillContext.fillRect(0,0,128,128);
 let seed=7241;const random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};
 function measure(){
  panels=[...document.querySelectorAll('body > .app .collection-card, #news-calendar, #provider-panel')].map(el=>({el,rect:el.getBoundingClientRect()})).filter(p=>p.rect.width>0);
 }
 function resize(){
  width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1_500_000/Math.max(1,width*height)));stats.pixelRatio=dpr;
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  seed=7241;
  const focal=Math.max(width,height)*.62;
  stars=Array.from({length:Math.min(650,Math.round(width*height/1100))},()=>{
   const z=1.1+Math.sqrt(random())*8;
   return {x:(random()*width-width*.5)*z/focal,y:(random()*height-height*.45)*z/focal,z,initialZ:z,size:.28+Math.pow(random(),5)*1.35,alpha:.32+random()*.64,tint:random()};
  });
  skyDrawTime=elapsed;
  measure();sync();
 }
 function draw(forceLight=false){
  if(document.hidden)return;
  // Continuous orbital movement of a broad light in front of the display plane.
  const t=elapsed/1000,lampX=width*(.48+.44*Math.sin(t*.30)),lampY=height*.17+height*.15*Math.sin(t*.23+.6),lampZ=190;
  if(!canvas.hidden){
  ctx.clearRect(0,0,width,height);
  stats.draws++;ctx.drawImage(spillTexture,lampX-width*.8,lampY-width*.8,width*1.6,width*1.6);
  // Project a 3D stellar field through a slowly advancing, laterally moving camera.
  // Depth changes angular velocity and apparent size; no flat wrapping or blinking.
  const dt=motion.matches?0:Math.max(0,Math.min(.1,(elapsed-skyDrawTime)/1000));skyDrawTime=elapsed;
  const focal=Math.max(width,height)*.62;
  for(const star of stars){
   star.z-=dt*.12;star.x+=dt*.018;star.y+=dt*.004;
   let x=width*.5+star.x*focal/star.z,y=height*.45+star.y*focal/star.z;
   if(star.z<.65||x< -24||x>width+24||y< -24||y>height+24){
    star.z=8+random()*2;star.initialZ=star.z;
    // New distant stars enter softly, instead of jumping to the opposite edge.
    star.x=(random()*width-width*.5)*star.z/focal;
    star.y=(random()*height-height*.45)*star.z/focal;star.birth=elapsed;
    x=width*.5+star.x*focal/star.z;y=height*.45+star.y*focal/star.z;
   }
   const fade=star.birth===undefined?1:Math.min(1,(elapsed-star.birth)/1800);
   const radius=Math.min(2.3,star.size*Math.sqrt(star.initialZ/star.z));
   const alpha=Math.min(.98,star.alpha*Math.pow(star.initialZ/star.z,.25))*fade;
   const rgb=star.tint>.82?'244,229,199':star.tint<.25?'204,222,245':'237,240,242';
   ctx.globalAlpha=alpha;ctx.drawImage(sprite(rgb,radius>.8),x-radius*6,y-radius*6,radius*12,radius*12);

  }
  }
  ctx.globalAlpha=1;skyDrawTime=elapsed;
  if(!forceLight&&elapsed-lastLight<1000/12)return;lastLight=elapsed;stats.lightUpdates++;
  for(const {el,rect:r} of panels){
   const dx=lampX-(r.left+r.width/2),dy=lampY-(r.top+r.height/2);
   const distance=Math.hypot(dx,dy,lampZ),incidence=lampZ/distance;
   // Inverse-square falloff and incidence couple all three panes to the same light.
   const power=Math.min(.68,.08+.58*incidence*incidence*incidence);
   el.style.setProperty('--lamp-x',`${(lampX-r.left).toFixed(2)}px`);
   el.style.setProperty('--lamp-y',`${(lampY-r.top).toFixed(2)}px`);
   el.style.setProperty('--lamp-power',power.toFixed(4));
   el.style.setProperty('--reflection-x',`${(r.width*.5+dx*.36).toFixed(2)}px`);
   el.style.setProperty('--reflection-y',`${(r.height*.5+dy*.36).toFixed(2)}px`);
   el.style.setProperty('--edge-light',(.10+.36*incidence*incidence).toFixed(4));

  }
 }
 const skyVisible=()=>document.body.classList.contains('news-reading')||document.body.classList.contains('collections-view')||document.body.classList.contains('collection-transition-active');
 const visible=()=>skyVisible()||!!window.NewsCalendar?.isOpen()||!!window.ProviderSettings?.isOpen();
 const transitioning=()=>document.body.classList.contains('collection-transition-active');
 const active=()=>!document.hidden&&!inactive&&visible()&&!motion.matches&&!transitioning();
 const interval=()=>1000/(document.body.classList.contains('news-reading')?18:24);
 function cancel(){cancelAnimationFrame(frame);clearTimeout(timer);frame=0;timer=0}
 function schedule(){timer=setTimeout(()=>{timer=0;frame=requestAnimationFrame(tick)},interval())}
 function tick(now){
  frame=0;if(!active()){last=0;canvas.dataset.running='false';return}
  elapsed+=last?Math.min(now-last,100):0;last=now;draw();
  canvas.dataset.running='true';schedule();
 }
 function sync(){
  cancel();last=0;measure();
  canvas.hidden=!skyVisible();canvas.dataset.running='false';
  if(!document.hidden&&visible())draw(true);
  if(active()){last=performance.now();schedule()}
 }
 new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
 new MutationObserver(sync).observe(document.querySelector('#main'),{childList:true,subtree:true});
 document.addEventListener('collectionsceneupdate',sync);
 document.addEventListener('calendar-surface-change',sync);
 addEventListener('resize',resize);addEventListener('scroll',measure,{passive:true});
 addEventListener('blur',()=>{inactive=true;document.documentElement.classList.add('window-inactive');sync()});
 addEventListener('focus',()=>{inactive=false;document.documentElement.classList.remove('window-inactive');sync()});
 document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);
 window.ScenePerformance={snapshot:()=>({...stats,backingPixels:canvas.width*canvas.height,stars:stars.length,running:active(),targetFPS:1000/interval()})};
 resize();
})();
