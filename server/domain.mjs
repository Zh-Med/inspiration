import {createHash} from 'node:crypto';
export const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,24);
export function plain(s,max=500){return String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|lt|gt|quot|apos);/g,x=>({'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[x])).replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):+n;return c>0&&c<=0x10ffff?String.fromCodePoint(c):''}).replace(/\s+/g,' ').trim().slice(0,max)}
export function canonical(raw){try{const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname))return null;u.hash='';for(const key of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid)/i.test(key))u.searchParams.delete(key);u.searchParams.sort();u.pathname=u.pathname.replace(/\/$/,'')||'/';return u.href}catch{return null}}
export function iso(s){const t=Date.parse(s);return Number.isFinite(t)?new Date(t).toISOString():null}
export function day(now){return new Date(+new Date(now)+8*3600000).toISOString().slice(0,10)}
export function validDay(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&iso(s+'T00:00:00Z')?.slice(0,10)===s}
export function windowFor(date){if(!validDay(date))throw Error('Invalid date');const end=Date.parse(`${date}T08:00:00+08:00`);return {start:new Date(end-86400000).toISOString(),end:new Date(end).toISOString()}}
export function latestDue(now){const d=new Date(now);return day(new Date(+d-8*3600000))}
export function classify(text,source={}){
 if(/\b(ceo|chief executive|founder)\b/i.test(text)&&/transition|resign|appoint|step.{0,3}down/i.test(text))return {collection:'news',category:'人物与行业'};
 if(source.collection==='medicine'||/neuro|brain|psycholog|medical|clinical|medicine|biomed|eeg|fmri/i.test(text))return {collection:'medicine',category:'医学与脑科学'};
 if(/gpu|chip|cuda|compute|blackwell|semiconductor/i.test(text))return {collection:'news',category:'算力与芯片'};
 if(/model|llm|gpt|gemini|claude|deepseek|reasoning/i.test(text))return {collection:'news',category:'模型进展'};
 if(/agent|skill|interface|interaction/i.test(text))return {collection:'news',category:'交互与工作流'};
 return {collection:'news',category:'AI 动态'};
}
export function normalizeArticle(raw,source,now){
 const url=canonical(raw.url),publishedAt=iso(raw.publishedAt),title=plain(raw.title,240),excerpt=plain(raw.excerpt,500);
 if(!url||!title||!publishedAt||Date.parse(publishedAt)>+new Date(now)+300000)return null;
 const updatedAt=iso(raw.updatedAt);
 const safeUpdated=updatedAt&&updatedAt>=publishedAt&&Date.parse(updatedAt)<=+new Date(now)+300000?updatedAt:null;
 return {id:'event-'+hash(url),url,title,english:title,excerpt,publishedAt,publishedPrecision:raw.publishedPrecision||(/^\d{4}-\d{2}-\d{2}$/.test(raw.publishedAt)?'day':'instant'),sourceUpdatedAt:safeUpdated,eventOccurredAt:null,collectedAt:now,firstSeenAt:now,sourceId:source.id,source:source.name,evidence:excerpt?source.evidence:'title-only',...classify(title+' '+excerpt,source),fingerprint:hash(title+'\n'+excerpt),version:1};
}
export function scoreRepo(repo,previous,now){
 const text=[repo.full_name,repo.description,...(repo.topics||[])].join(' ');
 const interests=[/research|scientific/i,/neuro|brain|psycholog|eeg|fmri/i,/medical|medicine|clinical|biomed/i,/literature|paper|citation|zotero/i,/skill|workflow|agent/i];
 const relevance=Math.min(30,interests.filter(p=>p.test(text)).length*10);
 const age=Math.max(0,(+new Date(now)-Date.parse(repo.pushed_at))/86400000);
 const maintenance=repo.archived||repo.disabled?0:age<=30?25:age<=90?18:age<=180?10:age<=365?4:0;
 const popularity=Math.min(20,Math.round(Math.log10(Math.max(1,repo.stargazers_count))*4));
 const transparency=(repo.license?.spdx_id&&repo.license.spdx_id!=='NOASSERTION'?10:0)+(repo.description?5:0);
 const days=previous?Math.max(0,(+new Date(now)-Date.parse(previous.observedAt))/86400000):0;
 const starDelta=previous?repo.stargazers_count-previous.stars:null;
 const momentum=days>=1?Math.min(10,Math.max(0,Math.round(starDelta/days))):0;
 return {total:relevance+maintenance+popularity+transparency+momentum,parts:{relevance,maintenance,popularity,transparency,momentum},starDelta,deltaDays:days>=1?Math.round(days*10)/10:null,version:'radar-v1',meaning:'发现优先级，不是质量、安全性或科学有效性评分'};
}
export function normalizeRepo(r,previous,now){
 if(!/^[\w.-]+\/[\w.-]+$/.test(r.full_name||'')||r.archived||r.disabled||r.fork||r.private)return null;
 const url=canonical(r.html_url);if(!url||new URL(url).hostname!=='github.com')return null;
 const scoring=scoreRepo(r,previous,now);
 return {id:'repo-'+hash(r.full_name.toLowerCase()),fullName:r.full_name,name:r.full_name,english:r.full_name,url,summary:plain(r.description,500),category:/skill/i.test([r.description,...(r.topics||[])].join(' '))?'Skill 候选':'科研工具',collection:'tools',topics:(r.topics||[]).map(x=>plain(x,60)).slice(0,20),stars:r.stargazers_count||0,forks:r.forks_count||0,language:r.language||'未声明',license:r.license?.spdx_id||'未声明',pushedAt:iso(r.pushed_at),publishedAt:iso(r.created_at),collectedAt:now,observedAt:now,firstSeenAt:previous?.firstSeenAt||now,scoring,evidence:'repository-metadata',verification:'未实测',environment:'待核对项目文档',cost:'仓库公开；运行成本与外部 API 费用待核对',dataDestination:'待核对；尚未向此项目发送研究数据',task:'以仓库说明为准',input:'待核对',output:'待核对',skillFiles:[],skillInspection:'not-inspected',release:null};
}
