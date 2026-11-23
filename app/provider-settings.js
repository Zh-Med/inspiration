(()=>{
 const panel=document.querySelector('#provider-panel'), trigger=document.querySelector('#provider-button');
 const status=panel.querySelector('[role=status]');
 const result=document.querySelector('#reading-result');
 const native=typeof panel.showPopover==='function';
 let generation=0;
 if(!native)panel.hidden=true;
 const opened=()=>native?panel.matches(':popover-open'):!panel.hidden;
 function close(focus=false){
  generation++;if(opened()){if(native)panel.hidePopover();else panel.hidden=true}
  trigger.setAttribute('aria-expanded','false');
  if(focus)trigger.focus({preventScroll:true});
 }
 function paragraph(text){
  const p=document.createElement('p');p.textContent=text;result.append(p);
 }
 function sourceExcerpt(item){
  const text=item.readmeExcerpt||item.body||item.summary;
  if(text)paragraph(text);
 }
 function display(record){
  result.replaceChildren();
  if(!record)return;
  paragraph(record.text);
  if(record.impact)paragraph(record.impact);
  if(record.model==='codex-preview'&&record.excerptSummary){
   const details=document.createElement('details'),label=document.createElement('summary'),p=document.createElement('p');
   label.textContent='查看 DeepSeek 来源摘录摘要';p.textContent=record.excerptSummary;
   details.append(label,p);result.append(details);
  }
 }
 async function open(){
  if(opened()){close(true);return}
  NewsCalendar.close(false);document.dispatchEvent(new Event('news-calendar-open'));
  const ticket=++generation,route=location.hash,item=currentReadingItem();
  result.replaceChildren();status.textContent='';
  if(native)panel.showPopover();else panel.hidden=false;
  panel.scrollTop=0;trigger.setAttribute('aria-expanded','true');
  panel.querySelector('[data-provider-close]').focus({preventScroll:true});
  if(!item){status.textContent='请打开一篇新闻、工具或论文，再点大脑查看解读。';return}
  const client=window.SummaryClient;
  const previous=client.cached(item)||item.generatedSummary;
  display(previous);
  status.textContent=previous?'':'正在读取这篇内容的解读…';
  const current=()=>ticket===generation&&opened()&&location.hash===route&&currentReadingItem()?.id===item.id;
  try{
   const record=await client.lookup(item);
   if(!current())return;
   display(record||previous);
   if(!record&&!previous)sourceExcerpt(item);
   status.textContent=record||previous?'':'这篇内容还没有中文解读。';
  }catch{
   if(!current())return;
   if(!previous)sourceExcerpt(item);
   status.textContent=previous?'当前显示已缓存的解读。':'暂时无法读取解读，联网后可重新打开。';
  }
 }
 trigger.addEventListener('click',open);
 panel.querySelector('[data-provider-close]').addEventListener('click',()=>close(true));
 panel.addEventListener('toggle',e=>{trigger.setAttribute('aria-expanded',String(e.newState==='open'))});
 document.addEventListener('news-calendar-open',()=>{if(opened())close(false)});
 document.addEventListener('pointerdown',e=>{if(!native&&opened()&&!panel.contains(e.target)&&!trigger.contains(e.target))close(false)},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened()){e.preventDefault();close(true)}});
 window.addEventListener('hashchange',()=>close(false));document.addEventListener('visibilitychange',()=>{if(document.hidden)close(false)});
 window.ProviderSettings={close,isOpen:opened};
})();
