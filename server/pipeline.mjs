import {selectEditions} from './editorial.mjs';
import {collectTldr} from './tldr.mjs';
import {spawn} from 'node:child_process';
import {selectNews} from './news-priority.mjs';
import {fileURLToPath} from 'node:url';
import {feeds,searches,limits,retiredSourceIds,projectSources,tldrSource} from './config.mjs';
import {normalizeArticle,normalizeRepo,hash,day,windowFor,latestDue,plain,iso} from './domain.mjs';
import {createFetcher} from './http.mjs';
import {readState,writeState,withLock,dataDir} from './store.mjs';
export function parseFeed(xml,format='rss',url=''){return new Promise((resolve,reject)=>{
 const page=['kimi','deepseek','nature-cover','nature-abstract','github-trending','tldr-home','tldr-story'].includes(format);
 const child=spawn('python3',[fileURLToPath(new URL(page?'../scripts/parse-source-page.py':format.startsWith('newsroom')?'../scripts/parse-newsroom.py':'../scripts/parse-feed.py',import.meta.url)),...(page?[format,url]:format.startsWith('newsroom')?[url,...(format==='newsroom-article'?['--article']:[])]:[])],{stdio:['pipe','pipe','pipe']});let output='',error='';
 const timer=setTimeout(()=>{child.kill();reject(Error('XML parse timeout'))},5000);
 child.on('error',e=>{clearTimeout(timer);reject(e)});child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>error+=x);child.stdin.on('error',()=>{});
 child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(Error(page?'Publisher page format changed or required evidence missing':'Invalid or unsupported RSS/Atom XML'));try{resolve(JSON.parse(output))}catch{reject(Error('Invalid feed parser output'))}});child.stdin.end(xml);
})}
const titleKey=t=>t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function mergeArticle(state,item){
 // Conservative clustering: canonical URL or exact normalized title near the same publication date.
 // Deliberately retained anchors identify independent changelog entries, even
 // when a publisher repeats the same heading on adjacent dates.
 let old=state.events[item.id]||Object.values(state.events).find(e=>!item.url.includes('#')&&!e.url.includes('#')&&titleKey(e.title)===titleKey(item.title)&&Math.abs(Date.parse(e.publishedAt)-Date.parse(item.publishedAt))<3*86400000);
 const evidence={sourceId:item.sourceId,source:item.source,url:item.url,publishedAt:item.publishedAt,collectedAt:item.collectedAt,status:item.evidence,excerpt:item.excerpt,...(item.coverConfirmed?{coverEvidenceUrl:item.coverEvidenceUrl,issuePublishedAt:item.issuePublishedAt}: {})};
 if(!old){state.events[item.id]={...item,evidenceSources:[evidence],revisions:[]};return 'new'}
 const sameSource=old.url===item.url;
 if(sameSource&&old.fingerprint!==item.fingerprint){
  const changedAt=item.sourceUpdatedAt||item.collectedAt;
  const revisions=[...old.revisions,{version:old.version,fingerprint:old.fingerprint,changedAt}].slice(-10);
  const id=old.id,firstSeenAt=old.firstSeenAt,evidenceSources=old.evidenceSources;
  Object.assign(old,item,{id,firstSeenAt,version:old.version+1,changedAt,revisions,evidenceSources});
 }
 old.collectedAt=item.collectedAt;
 const n=old.evidenceSources.findIndex(e=>e.url===item.url);if(n>=0)old.evidenceSources[n]=evidence;else old.evidenceSources.push(evidence);
 return 'seen';
}
export function buildDigest(state,date,now,feedConfig=feeds){
 const coverage=windowFor(date);if(Date.parse(coverage.end)>Date.parse(now))throw Error('Cannot publish a future 08:00 digest');
 const within=t=>t&&t>=coverage.start&&t<coverage.end;
 const eligible=Object.values(state.events).filter(e=>e.issuePrecision!=='month'&&!retiredSourceIds.includes(e.sourceId)&&e.evidence!=='title-only'&&within(e.publishedAt));
 const selected=selectNews(eligible.filter(e=>e.collection!=='medicine'),limits.digestItems).map(e=>({eventId:e.id,version:e.version,isUpdate:false}));
 const statuses=feedConfig.map(f=>state.sources[f.id]);
 const ok=statuses.filter(s=>s?.status==='ok'&&s?.lastSuccessAt&&Date.parse(now)-Date.parse(s.lastSuccessAt)<2*3600000).length;
 const status=ok===0?'unavailable':ok<feedConfig.length?'partial':selected.length?'ready':'empty';
 const fingerprint=hash(JSON.stringify({selected,status})),previous=state.digests[date];
 const digest={date,timeZone:'Asia/Shanghai',coverage,items:selected,status,sourceHealth:{healthy:ok,total:feedConfig.length},updatedAt:previous?.fingerprint===fingerprint?previous.updatedAt:now,fingerprint,revision:(previous?.revision||0)+(previous?.fingerprint===fingerprint?0:1)};
 state.digests[date]=digest;return digest;
}
export async function collect({dir=dataDir,request=createFetcher(),now=new Date().toISOString(),feedConfig=feeds,searchConfig=searches,projectConfig=searchConfig===searches?projectSources:[],enrich=true,tldrConfig=feedConfig===feeds?tldrSource:null,scope='full'}={}){
 return withLock(async()=>{
 const state=await readState(dir);const run={id:hash(now),scope,businessDate:latestDue(now),startedAt:now,feeds:0,repositories:0,newEvents:0,sourceCounts:{},failures:[]};
 async function source(id,url,consume,options={}){
  const prev=state.sources[id]||{};
  if(url.startsWith('https://api.github.com/')&&state.githubRetryAt>now){run.failures.push({source:id,error:'GitHub rate-limit cooldown'});return}
  if(prev.retryAt&&prev.retryAt>now){run.failures.push({source:id,error:'Waiting for rate-limit reset'});return}
  try{
   const result=await request(url,{etag:prev.url===url?prev.etag:null,lastModified:prev.url===url?prev.lastModified:null,...options});
   if(!result.notModified)await consume(result.body);
   state.sources[id]={id,url,etag:result.etag||(prev.url===url?prev.etag:null),lastModified:result.lastModified||(prev.url===url?prev.lastModified:null),lastCheckedAt:now,lastSuccessAt:now,status:'ok',error:null,retryAt:null};
  }catch(e){if(e.retryAt&&url.startsWith('https://api.github.com/'))state.githubRetryAt=e.retryAt;const error=String(e.message).replace(/Bearer\s+\S+/gi,'Bearer [redacted]').slice(0,180);state.sources[id]={...prev,id,url,lastCheckedAt:now,status:'error',error,retryAt:e.retryAt||null};run.failures.push({source:id,error})}
 }
 for(const feed of feedConfig){let detailRequests=0;await source(feed.id,feed.url,async body=>{
  const records=await parseFeed(body,feed.format,feed.url);if(feed.format==='newsroom'&&!records.length)throw Error('Source returned no parseable dated records; review source format');let accepted=0;
  for(const raw of records.slice(0,limits.feedItems)){
   let item=normalizeArticle(raw,feed,now);if(!item||(!item.coverConfirmed&&Date.parse(item.publishedAt)<Date.parse(now)-limits.lookbackDays*86400000))continue;
   if(feed.requireAbstract){
    let detail;
    await source('abstract-'+hash(item.url),item.url,async html=>{detail=(await parseFeed(html,'nature-abstract',item.url))[0]},{publicNatureRedirects:true});
    if(!detail){const old=state.events[item.id];if(old?.excerptKind==='abstract')detail={excerpt:old.excerpt,articlePublishedAt:old.articlePublishedAt,excerptKind:'abstract'};else continue;}
    raw.coverExcerpt=raw.excerpt;Object.assign(raw,detail);
    if(raw.issuePrecision==='month')raw.publishedAt=detail.articlePublishedAt;
    item=normalizeArticle(raw,feed,now);if(!item)continue;
   }
   if((feed.format==='newsroom'||feed.enrichDescription)&&!raw.excerpt){
    raw.excerpt=state.events[item.id]?.excerpt||'';
    if(!raw.excerpt&&detailRequests<6&&new URL(item.url).origin===new URL(feed.url).origin){
     detailRequests++;
     await source('article-'+hash(item.url),item.url,async html=>{
      const detail=await parseFeed(html,'newsroom-article',item.url);
      if(!detail[0]?.excerpt)throw Error('Article has no extractable publisher description');
      raw.excerpt=detail[0].excerpt;
     });
    }
    item=normalizeArticle(raw,feed,now);
   }
   if(mergeArticle(state,item)==='new')run.newEvents++;accepted++;
  }
  run.sourceCounts[feed.id]={parsed:records.length,accepted};run.feeds++;return accepted;
 },{publicNatureRedirects:!!feed.publicNatureRedirects})}
 if(tldrConfig){await collectTldr({state,now,config:tldrConfig,source,parse:parseFeed});const issue=state.tldrIssues?.[latestDue(now)];run.sourceCounts[tldrConfig.id]={date:latestDue(now),selected:issue?.candidates.length||0,accepted:issue?.items.length||0,status:issue?.status||'unavailable'};}
 const found=new Map();
 function acceptRepo(r){
    const id='repo-'+hash((r.full_name||'').toLowerCase()),previous=state.tools[id];const normalized=normalizeRepo(r,previous?.baseline||previous,now);if(!normalized)return;
    const baseline=previous?.baseline||(previous?{stars:previous.stars,observedAt:previous.observedAt,firstSeenAt:previous.firstSeenAt}:null);
    const next={...normalized,defaultBranch:r.default_branch,category:previous?.skillFiles?.length?'Skill 仓库':normalized.category,firstSeenAt:previous?.firstSeenAt||now,baseline:baseline&&Date.parse(now)-Date.parse(baseline.observedAt)<7*86400000?baseline:{stars:normalized.stars,observedAt:now,firstSeenAt:previous?.firstSeenAt||now},skillFiles:previous?.skillFiles||[],skillInspection:previous?.skillInspection||'not-inspected',skillFileCount:previous?.skillFileCount||0,release:previous?.release||null,readmeExcerpt:previous?.readmeExcerpt||null,inspectionAt:previous?.inspectionAt||null};
    state.tools[id]=next;found.set(id,{...r,normalized:next});
 }
 for(const search of searchConfig){const url=new URL('https://api.github.com/search/repositories');url.searchParams.set('q',search.query);url.searchParams.set('sort','stars');url.searchParams.set('order','desc');url.searchParams.set('per_page',String(limits.discoveryPerQuery));
  await source('github-'+search.id,url.href,async body=>{
   const data=JSON.parse(body);if(!Array.isArray(data.items)||data.incomplete_results)throw Error('Incomplete GitHub search results');
   for(const r of data.items)acceptRepo(r);
  });
 }
 for(const project of projectConfig){await source(project.id,project.url,async html=>{
   const rows=await parseFeed(html,project.format,project.url);
   for(const row of rows.slice(0,limits.discoveryPerQuery))await source('trending-'+hash(row.fullName),'https://api.github.com/repos/'+row.fullName,async body=>{
    const r=JSON.parse(body);if(r.full_name?.toLowerCase()!==row.fullName.toLowerCase())throw Error('Trending repository identity mismatch');
    const text=[r.full_name,r.description,...(r.topics||[])].join(' ');
    if(/\b(ai|llm|agent|research|neuroscience|medical|skill|workflow|machine.learning)\b/i.test(text)){acceptRepo(r);const t=state.tools['repo-'+hash(r.full_name.toLowerCase())];if(t)t.discovery={source:project.name,url:project.url,observedAt:now};}
   });
 })}
 run.repositories=found.size;
 const inspectionQueue=Object.values(state.tools).filter(t=>t.defaultBranch).sort((a,b)=>Number(!!a.inspectionAt)-Number(!!b.inspectionAt)||(a.inspectionAt||'').localeCompare(b.inspectionAt||'')||b.scoring.total-a.scoring.total).slice(0,limits.enrichRepos);
 if(enrich)for(const item of inspectionQueue){
  const r={full_name:item.fullName,default_branch:item.defaultBranch};
  const base=`https://api.github.com/repos/${r.full_name}`;
  await source('readme-'+item.id,base+'/readme',async body=>{const data=JSON.parse(body);if(data.encoding!=='base64')throw Error('Unsupported README');item.readmeExcerpt=plain(Buffer.from(data.content,'base64').toString('utf8'),900);item.readmeUrl=data.html_url;item.inspectionAt=now});
  await source('tree-'+item.id,base+'/git/trees/'+encodeURIComponent(r.default_branch)+'?recursive=1',async body=>{const data=JSON.parse(body);if(!Array.isArray(data.tree))throw Error('Missing file tree');item.skillFiles=data.tree.filter(x=>x.type==='blob'&&/(^|\/)SKILL\.md$/.test(x.path)).slice(0,25).map(x=>({path:plain(x.path,300),url:`https://github.com/${r.full_name}/blob/${encodeURIComponent(r.default_branch)}/${x.path.split('/').map(encodeURIComponent).join('/')}`}));item.skillInspection=data.truncated?'partial':'complete';item.skillFileCount=data.tree.filter(x=>x.type==='blob'&&/(^|\/)SKILL\.md$/.test(x.path)).length;item.inspectionAt=now;if(item.skillFiles.length)item.category='Skill 仓库'},{maxBytes:8_000_000});
  await source('release-'+item.id,base+'/releases?per_page=1',async body=>{const data=JSON.parse(body);if(!Array.isArray(data))throw Error('Invalid releases');const release=data.find(x=>!x.draft);item.release=release?{tag:plain(release.tag_name,120),url:release.html_url,publishedAt:iso(release.published_at),prerelease:!!release.prerelease}:null});
 }
 // Backfill only the collected publication dates and the latest due issue. Never relabel old news as today's.
 const dates=new Set([latestDue(now)]);
 for(const e of Object.values(state.events)){if(e.issuePrecision==='month')continue;const d=day(new Date(Date.parse(e.publishedAt)+16*3600000));if(windowFor(d).end<=now)dates.add(d)}
 for(const date of feedConfig.length?[...dates].sort():[])buildDigest(state,date,now,feedConfig);
 selectEditions(state,now);
 run.finishedAt=new Date().toISOString();if(scope==='full')state.lastFullCollection={businessDate:latestDue(now),finishedAt:run.finishedAt};state.runs=[run,...state.runs].slice(0,30);state.updatedAt=now;
 await writeState(state,dir);return run;
 },dir);
}
