// Run against an isolated, disposable Chrome CDP process. No personal profile.
// Generates only local UI material assets; never navigates to external sites.
const fs=require('node:fs/promises');
(async()=>{
 const port=process.env.CDP_PORT||9258;
 const tabs=await(await fetch(`http://127.0.0.1:${port}/json`)).json();
 const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,m=>m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result));ws.send(JSON.stringify({id:n,method,params}))});
 const css=await fs.readFile('app/style.css','utf8'),app=await fs.readFile('app/app.js','utf8');
 const palette=app.slice(app.indexOf('function paperMaterial('),app.indexOf('// Issues are keyed'));
 await send('Page.enable');await send('Page.navigate',{url:'about:blank'});
 await send('Emulation.setDeviceMetricsOverride',{width:447,height:800,deviceScaleFactor:1.5,mobile:false});
 await send('Emulation.setDefaultBackgroundColorOverride',{color:{r:0,g:0,b:0,a:0}});
 const fix='html,body{margin:0!important;background:transparent!important}body{overflow:hidden}.tunnel{position:relative;inset:auto;width:447px;height:800px;overflow:visible;isolation:auto}.tunnel .paper{left:48px!important;top:48px!important;width:351px!important;height:704px!important;transform:none!important;visibility:visible!important;opacity:1!important}.paper-material{opacity:.96!important}.paper-edge,.paper-shadow{opacity:1!important}';
 for(let i=0;i<7;i++){
  const breath=i===6;
  const extra=breath?'.tunnel .paper{left:0!important;top:0!important}.paper-breath{opacity:1!important}.paper-breath::before{animation:none!important;opacity:1!important;background:radial-gradient(ellipse 95% 105% at 56% 46%,#ffffffe6 0%,#ffffffb3 42%,#ffffff33 78%,transparent 100%)!important}':'';
  const content=breath?'<div class="paper-face"><div class="paper-breath"></div></div>':'<div class="paper-shadow"></div><div class="paper-face"><div class="paper-material"></div><div class="paper-edge"></div></div>';
  const expression=`(()=>{const shelfContent=[{}];${palette};document.head.innerHTML='';document.body.innerHTML='';const style=document.createElement('style');style.textContent=${JSON.stringify(css+fix+extra)};document.head.append(style);document.body.innerHTML='<div class="tunnel"><article class="paper" style="'+paperMaterial(${breath?0:i})+'">'+${JSON.stringify(content)}+'</article></div>';return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))})()`;
  const result=await send('Runtime.evaluate',{expression,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
  const shot=await send('Page.captureScreenshot',{format:'webp',quality:95,clip:{x:0,y:0,width:breath?351:447,height:breath?704:800,scale:1}});
  const name=breath?'paper-breath':i===0?'paper-gold':`paper-blank-${i}`;
  await fs.writeFile(`app/${name}.webp`,Buffer.from(shot.data,'base64'));
 }
 await send('Emulation.setDefaultBackgroundColorOverride',{});await send('Browser.close');ws.close();console.log('Generated six shared materials and one breath texture at DPR 1.5.');
})().catch(e=>{console.error(e);process.exit(1)});
