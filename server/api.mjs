import {readState,dataDir} from './store.mjs';
import {day,validDay,canonical} from './domain.mjs';
export function publicEvent(e){return {id:e.id,title:e.title,english:e.english,summary:e.excerpt||'仅有标题，待核实。',category:e.category,collection:e.collection,source:e.source,sourceId:e.sourceId,url:e.url,publishedAt:e.publishedAt,publishedPrecision:e.publishedPrecision,sourceUpdatedAt:e.sourceUpdatedAt,eventOccurredAt:e.eventOccurredAt,collectedAt:e.collectedAt,firstSeenAt:e.firstSeenAt,evidence:e.evidence,evidenceSources:e.evidenceSources,version:e.version,changedAt:e.changedAt,read:'来源摘录',limit:'保留发布方原文摘录，未进行独立评测或模型摘要。',body:e.excerpt,why:'请结合原始出处与适用条件判断。'};}
export function publicTool(t){const {baseline,...out}=t;return {...out,mark:'book',readmeUrl:canonical(t.readmeUrl),release:t.release?{...t.release,url:canonical(t.release.url)}:null};}
export function contentView(state,now=new Date().toISOString()){
 const dates=Object.keys(state.digests).sort().slice(-30),digests=Object.fromEntries(dates.map(d=>[d,state.digests[d]]));
 const ids=new Set(Object.values(digests).flatMap(d=>d.items.map(i=>i.eventId)));
 return {schemaVersion:1,mode:'live',updatedAt:state.updatedAt,serverDate:day(now),stories:[...ids].map(id=>state.events[id]).filter(Boolean).map(publicEvent),tools:Object.values(state.tools).filter(t=>t.scoring.total>=30).sort((a,b)=>b.scoring.total-a.scoring.total||a.id.localeCompare(b.id)).slice(0,60).map(publicTool),digests,status:!state.updatedAt?'not-collected':state.runs[0]?.failures.length?'partial':'ok',lastRun:state.runs[0]?{startedAt:state.runs[0].startedAt,failures:state.runs[0].failures.length}:null};
}
export function createApi({dir=dataDir}={}){return async function api(req,res,url){
 if(!url.pathname.startsWith('/api/'))return false;
 const json=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))};
 if(req.method!=='GET'){json(405,{error:'Read-only API'});return true}
 try{
 const state=await readState(dir),path=url.pathname;
 if(path==='/api/content')json(200,contentView(state));
 else if(path==='/api/health')json(200,{status:!state.updatedAt?'not-collected':state.runs[0]?.failures.length?'partial':'ok',updatedAt:state.updatedAt,sources:Object.values(state.sources).map(({id,status,error,lastSuccessAt,lastCheckedAt,retryAt})=>({id,status,error,lastSuccessAt,lastCheckedAt,retryAt})),counts:{events:Object.keys(state.events).length,tools:Object.keys(state.tools).length,digests:Object.keys(state.digests).length},paidCalls:0});
 else if(path==='/api/digests'){json(200,{dates:Object.keys(state.digests).sort().reverse()})}
 else if(path.startsWith('/api/digests/')){const date=path.slice(13);if(!validDay(date))json(400,{error:'Invalid date'});else {const digest=state.digests[date];json(digest?200:404,digest?{...digest,stories:digest.items.map(i=>state.events[i.eventId]).filter(Boolean).map(publicEvent)}:{error:'No collected issue for this date'})}}
 else if(path.startsWith('/api/items/')){const id=path.slice(11),item=state.events[id]||state.tools[id];json(item?200:404,item?(state.events[id]?publicEvent(item):publicTool(item)):{error:'Item not found'})}
 else if(path==='/api/tools'){let items=contentView(state).tools;const q=(url.searchParams.get('q')||'').slice(0,200).toLowerCase();if(q)items=items.filter(t=>[t.name,t.summary,...t.topics].join(' ').toLowerCase().includes(q));if(url.searchParams.get('kind')==='skill')items=items.filter(t=>t.skillFiles.length);json(200,{items,scoring:'radar-v1',verification:'未实测'})}
 else json(404,{error:'Unknown API route'});
 }catch{json(503,{error:'Content store unavailable'})}
 return true;
}}
