// Small reading cache, separate from bookmarks and preferences. External text never becomes executable markup.
window.Content=(()=>{
 const key='inspiration:content-v1',savedKey='inspiration:saved-content-v1';
 const empty=()=>({schemaVersion:1,mode:'live',updatedAt:null,stories:[],tools:[],digests:{},tldrIssues:{},status:'loading'});
 const valid=x=>x?.schemaVersion===1&&Array.isArray(x.stories)&&Array.isArray(x.tools)&&x.digests&&typeof x.digests==='object';
 function read(k,f){try{return JSON.parse(localStorage.getItem(k))||f}catch{return f}}
 let snapshot=read(key,null);if(!valid(snapshot))snapshot=empty();
 let saved=read(savedKey,{});if(!saved||typeof saved!=='object'||Array.isArray(saved))saved={};
 function persist(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{document.dispatchEvent(new Event('content-storage-warning'))}}
 function cache(data){const dates=Object.keys(data.digests).sort().slice(-3),digests=Object.fromEntries(dates.map(d=>[d,data.digests[d]])),ids=new Set(Object.values(digests).flatMap(d=>d.items.map(i=>i.eventId)));const tldrDates=Object.keys(data.tldrIssues||{}).sort().slice(-3);const tldrIssues=Object.fromEntries(tldrDates.map(d=>[d,data.tldrIssues[d]]));const reduced={...data,tldrIssues,digests,stories:data.stories.filter(x=>ids.has(x.id)||(data.recommendations?.medicine||[]).some(p=>p.id===x.id)),tools:data.tools.slice(0,40)};if(JSON.stringify(reduced).length<1_500_000)persist(key,reduced)}
 function notify(reason='refresh'){const event=new CustomEvent('content-update',{detail:snapshot});event.refreshReason=reason;document.dispatchEvent(event)}
 async function enrich(){if(!window.SummaryClient)return;const before=snapshot,data=await window.SummaryClient.enrich(before);if(snapshot!==before||data===before)return;snapshot=data;cache(snapshot);notify()}
 async function json(path){const target=window.InspirationRuntime?.contentMode==='static'?new URL('data/'+path.replace(/^\/api\//,'')+'.json',document.baseURI):new URL('.'+path,document.baseURI);const response=await fetch(target,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Content unavailable');return response.json()}
 let refreshing=null,lastAttempt=0,resumeRequested=false;
 function refresh({reason='refresh'}={}){
  if(reason==='resume')resumeRequested=true;
  if(refreshing)return refreshing;
  lastAttempt=Date.now();
  refreshing=(async()=>{try{const data=await json('/api/content');if(!valid(data))throw Error('Invalid content');snapshot=data;cache(snapshot);notify(resumeRequested?'resume':reason);void enrich()}catch{snapshot={...snapshot,status:snapshot.updatedAt?'cached':'unavailable'};notify(resumeRequested?'resume':reason)}finally{refreshing=null;resumeRequested=false}})();
  return refreshing;
 }
 function refreshVisible(reason='resume'){
  if(document.hidden||window.navigator?.onLine===false||(!refreshing&&Date.now()-lastAttempt<30000))return;
  return refresh({reason});
 }
 const loading=new Set();
 async function ensure(route){
  let path;if(/^news\/\d{4}-\d{2}-\d{2}$/.test(route)&&!snapshot.digests[route.slice(5)])path='/api/digests/'+route.slice(5);
  else if(/^(story|tool)\/[\w-]+$/.test(route)&&![...snapshot.stories,...snapshot.tools,...Object.values(snapshot.tldrIssues||{}).flatMap(i=>i.items),...Object.values(saved)].some(x=>x.id===route.split('/')[1]))path='/api/items/'+route.split('/')[1];
  if(!path||loading.has(path))return;loading.add(path);
  try{const data=await json(path);if(path.includes('/digests/')){snapshot.digests[data.date]=data;for(const s of data.stories)if(!snapshot.stories.some(x=>x.id===s.id))snapshot.stories.push(s)}else{const list=data.collection==='tools'?snapshot.tools:snapshot.stories;list.push(data)}notify();void enrich()}catch{/* Missing/uncached dates remain explicit empty states. */}finally{loading.delete(path)}
 }
 function remember(id,on){const item=[...snapshot.stories,...snapshot.tools,...Object.values(snapshot.tldrIssues||{}).flatMap(i=>i.items)].find(x=>x.id===id);if(on&&item)saved[id]=item;if(!on)delete saved[id];persist(savedKey,saved)}
 function clear(){window.SummaryClient?.clear();try{localStorage.removeItem(key)}catch{};snapshot=empty()}
 function reset(){clear();saved={};persist(savedKey,saved)}
 document.addEventListener('DOMContentLoaded',()=>void refresh({reason:'resume'}),{once:true});window.addEventListener('online',()=>void refresh({reason:'resume'}));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshVisible()});
 window.addEventListener('pageshow',()=>void refreshVisible());window.addEventListener('focus',()=>void refreshVisible());
 window.setInterval?.(()=>void refreshVisible('resume'),300000);
 return {get snapshot(){return snapshot},get saved(){return Object.values(saved)},refresh,ensure,remember,clear,reset};
})();
