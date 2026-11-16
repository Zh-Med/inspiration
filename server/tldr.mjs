import {hash,latestDue,canonical} from './domain.mjs';

const needsExcerptRefresh=item=>!!item?.excerptTruncated||/\s+Open article\s*(?:\u2192|->)\s*$/i.test(item?.summary||'');

const identities=row=>[canonical(row.url),canonical(row.originalUrl)].filter(Boolean);

function rememberArticles(history, date, items) {
 for(const item of items)for(const url of identities(item)){
  if(!history[url]||date<history[url])history[url]=date;
 }
}

// A separate, idempotent daily selection. The first successful list fixes the
// day's order; retries fill missing details without replacing the selection.
export async function collectTldr({state,now,config,source,parse}){
 const date=latestDue(now);
 state.tldrIssues??={};
 state.tldrHistory??={};
 const history=state.tldrHistory;
 for(const [day,edition] of Object.entries(state.tldrIssues)){
  if(day<date)rememberArticles(history,day,edition.items);
 }
 let issue=state.tldrIssues[date];
 // Legacy issues created under the former 25-word limit, plus summaries that
 // retained the publisher's link label, are repaired without changing selection.
 if(issue?.crossDayDedup&&issue.status==='ready'&&!issue.items.some(needsExcerptRefresh))return;
 if(!issue?.crossDayDedup)await source(config.id,config.url,async html=>{
  const rows=await parse(html,'tldr-home',config.url);
  const candidates=rows.filter(r=>{
   const u=canonical(r.url);return u&&new URL(u).origin==='https://tldr.tech'&&/^\/story\/[a-f0-9-]{36}$/.test(new URL(u).pathname)&&canonical(r.originalUrl);
  });
  if(!candidates.length)throw Error('No valid TLDR story links');
  const selected=[];
  const seen=new Set();
  for(const row of candidates){
   const urls=identities(row);
   if(urls.some(url=>seen.has(url)||(history[url]&&history[url]<date)))continue;
   selected.push(row);
   for(const url of urls)seen.add(url);
   if(selected.length===10)break;
  }
  const selectedUrls=new Set(selected.map(row=>row.url));
  const items=(issue?.items||[]).filter(item=>selectedUrls.has(item.url));
  issue=state.tldrIssues[date]={date,timeZone:'Asia/Shanghai',selectedAt:now,updatedAt:now,status:'partial',crossDayDedup:true,candidates:selected,items};
 },{etag:null,lastModified:null});
 if(!issue?.crossDayDedup)return;
 for(const row of issue.candidates){
  const existing=issue.items.find(i=>i.url===row.url);
  if(existing&&!needsExcerptRefresh(existing))continue;
  await source('tldr-story-'+hash(row.url),row.url,async html=>{
   const detail=(await parse(html,'tldr-story',row.url))[0];
   if(!detail?.title)throw Error('TLDR detail missing');
   const item={id:'tldr-'+hash(date+'\n'+row.url),collection:'tldr',source:'TLDR',sourceId:'tldr',title:detail.title,english:detail.title,summary:detail.excerpt,excerptTruncated:detail.excerptTruncated,url:row.url,originalUrl:canonical(row.originalUrl),publishedAt:null,collectedAt:now,selectionDate:date,evidence:'aggregator-excerpt'};
   if(existing)Object.assign(existing,item);else issue.items.push(item);
  },{etag:null,lastModified:null});
 }
 const rank=new Map(issue.candidates.map((r,i)=>[r.url,i]));
 issue.items.sort((a,b)=>rank.get(a.url)-rank.get(b.url));
 issue.status=issue.items.length===issue.candidates.length?'ready':'partial';
 issue.updatedAt=now;
 rememberArticles(history,date,issue.items);
 // Keep a small independent archive, preserving the existing News history.
 for(const old of Object.keys(state.tldrIssues).sort().slice(0,-30))delete state.tldrIssues[old];
}

export function publicTldrIssues(state){
 return Object.fromEntries(Object.entries(state.tldrIssues||{}).sort(([a],[b])=>a.localeCompare(b)).slice(-30).map(([date,{candidates,crossDayDedup,...issue}])=>[date,issue]));
}
