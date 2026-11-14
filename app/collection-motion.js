// A collection and its shelf share one viewport-sized, continuously clipped scene.
// Native structure informed the relationship; these motion curves are Web authored.
window.CollectionMotion=(()=>{
 const clamp=x=>Math.max(0,Math.min(1,x));
 const smooth=(a,b,x)=>{const p=clamp((x-a)/(b-a));return p*p*(3-2*p)};
 function capture(){
  const app=document.querySelector('body > .app');
  const copy=app.cloneNode(true),style=getComputedStyle(app);
  copy.classList.add('navigation-snapshot');
  copy.style.padding=style.padding;
  copy.style.width=`${app.getBoundingClientRect().width}px`;
  copy.style.opacity='1';copy.style.visibility='visible';
  // Freeze the source layout before body route classes change.
  for(const selector of ['.masthead','.brand','main']){
   const from=app.querySelector(selector),to=copy.querySelector(selector),s=getComputedStyle(from);
   for(const property of ['height','min-height','padding','font-size','font-weight','letter-spacing','transform','opacity'])to.style.setProperty(property,s.getPropertyValue(property));
  }
  const nav=app.querySelector('#navigation-button'),navCopy=copy.querySelector('#navigation-button'),navStyle=getComputedStyle(nav);
  for(const property of ['display','position','left','top','right','width','height','color'])navCopy.style.setProperty(property,navStyle.getPropertyValue(property));
  const navIcon=nav.querySelector('svg'),iconStyle=getComputedStyle(navIcon);
  navCopy.querySelector('svg').style.cssText=`width:${iconStyle.width};height:${iconStyle.height}`;
  for(const el of [copy,...copy.querySelectorAll('[id]')])el.removeAttribute('id');
  copy.querySelector('main').classList.remove('page-enter');
  copy.inert=true;copy.setAttribute('aria-hidden','true');
  const clocks=[...app.querySelectorAll('.brand,.paper')].map(el=>el.getAnimations().map(a=>a.currentTime));
  return {copy,clocks,time:performance.now()};
 }
 function card(el){
  if(!el)return null;
  const r=el.getBoundingClientRect(),s=getComputedStyle(el);
  return {rect:{left:r.left,top:r.top,width:r.width,height:r.height},radius:parseFloat(s.borderRadius),copy:el.cloneNode(true)};
 }
 function syncClocks(snapshot){
  [...snapshot.copy.querySelectorAll('.brand,.paper')].forEach((el,i)=>{
   el.getAnimations().forEach((a,j)=>{const t=snapshot.clocks[i]?.[j];if(typeof t==='number')a.currentTime=t+performance.now()-snapshot.time});
  });
 }
 function play({overview,shelf,source,entering,onFinish}){
  const width=innerWidth,height=innerHeight,r=source.rect;
  const root=document.createElement('div');root.className='collection-transition';root.inert=true;root.setAttribute('aria-hidden','true');
  const backdrop=document.createElement('div');backdrop.className='collection-transition-backdrop';backdrop.append(overview.copy);
  overview.copy.querySelector(`.collection-card[href="${source.copy.getAttribute('href')}"]`)?.style.setProperty('visibility','hidden');
  const frame=document.createElement('div');frame.className='collection-transition-frame';
  const base=document.createElement('div');base.className='collection-transition-base';
  const scene=document.createElement('div');scene.className='collection-transition-scene';scene.append(shelf.copy);
  // Inspiration stays anchored while the collection opens underneath it.
  const headerLayer=shelf.copy.cloneNode(false),header=shelf.copy.querySelector('.masthead').cloneNode(true);
  headerLayer.classList.add('collection-transition-masthead');headerLayer.append(header);
  const brand=header.querySelector('.brand'),nav=header.querySelector('button');
  const fromBrand=parseFloat(overview.copy.querySelector('.brand').style.fontSize),toBrand=parseFloat(brand.style.fontSize);
  const headerShift=(parseFloat(overview.copy.querySelector('.masthead').style.height)-parseFloat(header.style.height))/2;
  overview.copy.querySelector('.masthead').style.visibility='hidden';shelf.copy.querySelector('.masthead').style.visibility='hidden';
  const glass=source.copy.cloneNode(false);glass.removeAttribute('href');glass.removeAttribute('id');glass.className='collection-card collection-transition-glass';glass.style.viewTransitionName='none';
  for(const [key,offset] of [['--lamp-x',r.left],['--lamp-y',r.top],['--reflection-x',r.left],['--reflection-y',r.top]])glass.style.setProperty(key,`${(parseFloat(source.copy.style.getPropertyValue(key))||0)+offset}px`);
  const labels=document.createElement('div');labels.className='collection-transition-labels';
  labels.style.cssText=`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
  for(const child of source.copy.children)labels.append(child.cloneNode(true));
  frame.append(base,scene,glass,labels);root.append(backdrop,frame,headerLayer);document.body.append(root);
  syncClocks(overview);syncClocks(shelf);
  brand.getAnimations().forEach((a,i)=>{const t=shelf.clocks[0]?.[i];if(typeof t==='number')a.currentTime=t+performance.now()-shelf.time});
  const actual=document.querySelector('body > .app'),main=actual.querySelector('main'),actualNav=actual.querySelector('#navigation-button'),wasInert=main.inert;
  // Paper leaves explicitly set visibility, so hide their entire compositing layer.
  // Keep the live back button available during the movement.
  actual.style.opacity='0';actual.style.pointerEvents='none';main.inert=true;actualNav.style.pointerEvents='auto';
  const duration=entering?720:560,steps=60,frames={mask:[],scene:[],glass:[],base:[],backdrop:[],labels:[],header:[],brand:[],nav:[]};
  const scale=Math.max(r.width/width,r.height/height),dx=r.left+r.width/2-width/2,dy=r.top+r.height/2-height/2;
  // Critically damped, monotonic settling; each layer samples the same progress.
  const settle=t=>(1-(1+8.5*t)*Math.exp(-8.5*t))/(1-9.5*Math.exp(-8.5));
  for(let i=0;i<=steps;i++){
   const offset=i/steps,p=entering?settle(offset):1-settle(offset),q=1-p;
   frames.mask.push({offset,clipPath:`inset(${r.top*q}px ${(width-r.left-r.width)*q}px ${(height-r.top-r.height)*q}px ${r.left*q}px round ${source.radius*q+12*Math.sin(Math.PI*p)}px)`});
   frames.scene.push({offset,transform:`translate3d(${dx*q}px,${dy*q}px,0) scale(${scale+(1-scale)*p})`,opacity:smooth(.035,.60,p)});
   frames.glass.push({offset,opacity:1-smooth(.06,.64,p)});
   frames.base.push({offset,opacity:smooth(.08,.62,p)});
   frames.backdrop.push({offset,opacity:1-smooth(.08,.84,p)});
   frames.labels.push({offset,opacity:1-smooth(0,.24,p),transform:`translate3d(${-r.left*p}px,${-r.top*p}px,0)`});
   frames.header.push({offset,transform:`translateY(${headerShift*q}px)`});
   frames.brand.push({offset,fontSize:`${fromBrand+(toBrand-fromBrand)*p}px`});
   frames.nav.push({offset,opacity:smooth(.25,.8,p)});
  }
  const nodes={mask:frame,scene,glass,base,backdrop,labels,header,brand,nav};
  const animations=Object.entries(frames).map(([key,keyframes])=>nodes[key].animate(keyframes,{duration,fill:'both',easing:'linear'}));
  const start=document.timeline.currentTime;animations.forEach(a=>a.startTime=start);
  let disposed=false;
  function dispose(){
   if(disposed)return;disposed=true;
   animations.forEach(a=>a.cancel());root.remove();actual.style.removeProperty('opacity');actual.style.removeProperty('pointer-events');main.inert=wasInert;actualNav.style.removeProperty('pointer-events');
   document.body.classList.remove('collection-transition-active');onFinish();
  }
  animations[0].finished.then(dispose).catch(()=>{});
  return {finish:dispose,reverse(){animations.forEach(a=>a.reverse())},animations,root};
 }
 return {capture,card,play};
})();
