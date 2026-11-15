import {editionView} from './editorial.mjs';
import {publicTldrIssues} from './tldr.mjs';
import {readState,dataDir} from './store.mjs';
import {day,validDay,canonical} from './domain.mjs';
import {retiredSourceIds} from './config.mjs';
export function publicEvent(e){return {id:e.id,title:e.title,english:e.english,summary:e.excerpt||'仅有标题，待核实。',category:e.category,collection:e.collection,source:e.source,sourceId:e.sourceId,url:e.url,publishedAt:e.publishedAt,publishedPrecision:e.publishedPrecision,sourceUpdatedAt:e.sourceUpdatedAt,eventOccurredAt:e.eventOccurredAt,collectedAt:e.collectedAt,firstSeenAt:e.firstSeenAt,evidence:e.evidence,evidenceSources:e.evidenceSources,version:e.version,changedAt:e.changedAt,...(e.coverConfirmed?{contentKind:e.contentKind,coverConfirmed:true,coverEvidenceUrl:e.coverEvidenceUrl,coverTitle:e.coverTitle,issuePublishedAt:e.issuePublishedAt,issueMonth:e.issueMonth,issuePrecision:e.issuePrecision,articlePublishedAt:e.articlePublishedAt,excerptKind:e.excerptKind,doi:e.doi}:{}),read:'来源摘录',limit:e.coverConfirmed?(e.excerptKind==='abstract'?'官方已确认封面关联；来源为论文Abstract，临床意义仍需结合研究设计核对。':'官方已确认封面关联；摘录为封面介绍，研究设计、适用范围与临床意义须另行核对。'):'保留发布方原文摘录，未进行独立评测或模型摘要。',body:e.excerpt,why:'请结合原始出处与适用条件判断。'};}
// Hide retired subscriptions from reading views without destroying old records
// or breaking an existing saved item's direct URL.
export function publicDigest(state,digest){return {...digest,items:digest.items.filter(i=>state.events[i.eventId]&&!retiredSourceIds.includes(state.events[i.eventId].sourceId)&&state.events[i.eventId].collection!=='medicine').slice(0,5)};}
export function publicTool(t){const {baseline,...out}=t;return {...out,mark:'book',readmeUrl:canonical(t.readmeUrl),release:t.release?{...t.release,url:canonical(t.release.url)}:null};}
export function contentView(state,now=new Date().toISOString()){
 const dates=Object.keys(state.digests).sort().slice(-30),digests=Object.fromEntries(dates.map(d=>[d,publicDigest(state,state.digests[d])]));
 const ids=new Set(Object.values(digests).flatMap(d=>d.items.map(i=>i.eventId)));
 const recommendations=editionView(state,now);
 for(const pick of recommendations.medicine)if(state.events[pick.id])ids.add(pick.id);
 return {schemaVersion:1,mode:'live',updatedAt:state.updatedAt,serverDate:day(now),stories:[...ids].map(id=>state.events[id]).filter(Boolean).map(publicEvent),tldrIssues:publicTldrIssues(state),tools:recommendations.tools.map(p=>state.tools[p.id]).filter(Boolean).map(publicTool),recommendations,digests,status:!state.updatedAt?'not-collected':state.runs[0]?.failures.length?'partial':'ok',lastRun:state.runs[0]?{startedAt:state.runs[0].startedAt,failures:state.runs[0].failures.length}:null};
}
export function createApi({dir=dataDir}={}){return async function api(req,res,url){
 if(!url.pathname.startsWith('/api/'))return false;
 const json=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))};
 if(req.method!=='GET'){json(405,{error:'Read-only API'});return true}
 try{
 const state=await readState(dir),path=url.pathname;
 if(path==='/api/content')json(200,contentView(state));
 else if(path==='/api/health')json(200,{status:!state.updatedAt?'not-collected':state.runs[0]?.failures.length?'partial':'ok',updatedAt:state.updatedAt,sources:Object.values(state.sources).filter(s=>!retiredSourceIds.includes(s.id)).map(({id,status,error,lastSuccessAt,lastCheckedAt,retryAt})=>({id,status,error,lastSuccessAt,lastCheckedAt,retryAt})),counts:{events:Object.keys(state.events).length,tools:Object.keys(state.tools).length,digests:Object.keys(state.digests).length},paidCalls:0});
 else if(path==='/api/digests'){json(200,{dates:Object.keys(state.digests).sort().reverse()})}
 else if(path.startsWith('/api/digests/')){const date=path.slice(13);if(!validDay(date))json(400,{error:'Invalid date'});else {const digest=state.digests[date]?publicDigest(state,state.digests[date]):null;json(digest?200:404,digest?{...digest,stories:digest.items.map(i=>state.events[i.eventId]).filter(Boolean).map(publicEvent)}:{error:'No collected issue for this date'})}}
 else if(path.startsWith('/api/items/')){const id=path.slice(11),item=state.events[id]||state.tools[id]||Object.values(state.tldrIssues||{}).flatMap(i=>i.items).find(i=>i.id===id);json(item?200:404,item?(state.events[id]?publicEvent(item):item.collection==='tldr'?item:publicTool(item)):{error:'Item not found'})}
 else if(path==='/api/tools'){let items=contentView(state).tools;const q=(url.searchParams.get('q')||'').slice(0,200).toLowerCase();if(q)items=items.filter(t=>[t.name,t.summary,...t.topics].join(' ').toLowerCase().includes(q));if(url.searchParams.get('kind')==='skill')items=items.filter(t=>t.skillFiles.length);json(200,{items,scoring:'radar-v1',verification:'未实测'})}
 else json(404,{error:'Unknown API route'});
 }catch{json(503,{error:'Content store unavailable'})}
 return true;
}}
