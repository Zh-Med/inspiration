// Both endpoints expose public, precomputed results. No clicks start a model job.
window.SummaryClient=(()=>{
 const origin='https://inspiration.landooomed.workers.dev';
 const cacheKey='inspiration:article-readings-v2';
 const bases=new Set(['source-excerpt','article-passages','readme-excerpt','paper-abstract']);
 let pending=null,records=[],loadedAt=0;
 let cache=[];
 try {
  const saved=JSON.parse(localStorage.getItem(cacheKey));
  if(Array.isArray(saved))cache=saved.slice(0,30);
 }catch{}
 function preview(){return window.InspirationRuntime?.phonePreview===true}
 async function get(path){
  if(window.InspirationRuntime?.llmServiceUrl!==origin)throw Error('Summary service not configured');
  const target=preview()?'./reading-api'+path:origin+path;
  const response=await fetch(target,{cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Summary service unavailable');
  return response.json();
 }
 function unpack(data){
  if(data?.schemaVersion!==1||!Array.isArray(data.items)||data.items.length>30)throw Error('Invalid summaries');
  return data.items;
 }
 async function list(){
  if(Date.now()-loadedAt<60000)return records;
  if(!pending)pending=get('/summaries').then(data=>{records=unpack(data);loadedAt=Date.now();return records}).finally(()=>{pending=null});
  return pending;
 }
 function matches(item,r){
  if(!item||!r||r.id!==item.id||r.verification!=='model-generated-not-independent-evidence')return false;
  const tool=item.collection==='tools',tldr=item.collection==='tldr';
  const text=String(tool?item.readmeExcerpt||item.summary||'':item.body||item.summary||'').trim().slice(0,2200);
  const version=tool?item.pushedAt:tldr?item.selectionDate:item.version;
  if(r.version!==version||r.title!==String(item.title||item.fullName||item.name||'').slice(0,300)||
     r.sourceUrl!==(tldr?item.originalUrl||item.url:item.url)||r.sourceText!==text||
     r.publishedAt!==(item.publishedAt||null)||r.evidence!==item.evidence)return false;
  const age=Date.now()-Date.parse(r.generatedAt);
  if(!Number.isFinite(age)||age < -300000||age>=30*86400000||typeof r.text!=='string'||
     !r.text.trim()||r.text.includes('\ufffd')||r.text.length>2000)return false;
  if(r.schemaVersion===1)return !tool&&!tldr&&r.model==='deepseek-flash'&&r.basis==='source-excerpt';
  return r.schemaVersion===2&&r.collection===item.collection&&(r.revision||null)===(tool?item.readmeSha||null:item.sourceUpdatedAt||null)&&bases.has(r.basis)&&
    (r.model==='deepseek-flash'||(preview()&&r.model==='codex-preview'))&&
    typeof r.impact==='string'&&r.impact.length<=900&&!r.impact.includes('\ufffd');
 }
 function best(item,items){return items.filter(r=>matches(item,r)).sort((a,b)=>b.schemaVersion-a.schemaVersion||Date.parse(b.generatedAt)-Date.parse(a.generatedAt))[0]}
 function remember(record){
  cache=[record,...cache.filter(r=>r.id!==record.id)].slice(0,30);
  try{localStorage.setItem(cacheKey,JSON.stringify(cache))}catch{}
 }
 function cached(item){return best(item,cache)}
 async function lookup(item){
  const batch=await list();
  let result=best(item,batch);
  if(!result)result=best(item,unpack(await get('/summaries?id='+encodeURIComponent(item.id))));
  result=best(item,[result,cached(item)]);
  if(result?.model==='codex-preview'){
   const excerpt=best(item,batch.filter(r=>r.schemaVersion===1));
   if(excerpt)result={...result,excerptSummary:excerpt.text};
  }
  if(result)remember(result);
  return result;
 }
 function clear(){records=[];cache=[];loadedAt=0;try{localStorage.removeItem(cacheKey)}catch{}}
 async function enrich(data){
  try{
   const items=await list();let changed=false;
   const stories=data.stories.map(item=>{
    const record=best(item,items.filter(r=>r.schemaVersion===1));
    if(!record||item.generatedSummary?.text===record.text)return item;
    changed=true;return {...item,generatedSummary:{text:record.text,model:record.model,generatedAt:record.generatedAt,basis:record.basis}};
   });
   return changed?{...data,stories}:data;
  }catch{return data}
 }
 async function status(){try{const h=await get('/health');if(!h.enabled)return '独立服务已连接，新闻摘要尚未启用';return h.lastRun?.status==='provider-failed'?'生成暂时中断，仍可阅读已有摘要':'中文摘要服务已连接'}catch{return '暂时无法连接摘要服务，仍可阅读来源摘录'}}
 return {enrich,status,matches,cached,lookup,clear};
})();
