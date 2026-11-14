// Editorial priority is separate from evidence: these rules never verify claims.
export function newsPriority(event) {
 const title=event.title;
 const official=event.evidence==='official-claim';
 const leadership=/\b(ceo|chief executive|founder|president)\b/i.test(title)&&/\b(transition|resign\w*|steps? down|appoint\w*|success\w*|depart\w*)\b/i.test(title);
 const release=/\b(introduc\w*|launch\w*|releas\w*|announc\w*|available|rolling out)\b/i.test(title)&&/\b(claude|opus|sonnet|haiku|fable|mythos|gpt|gemini|llama|deepseek|model)\b/i.test(title);
 const major=official&&(leadership||release);
 const topical=/\b(model|agent|chip|gpu|neuro\w*|brain|research|skill|ai)\b/i.test(title);
 return {major,score:(major?100:0)+(leadership?30:0)+(release?25:0)+(official?10:0)+(topical?10:0)+(event.collection==='medicine'?12:0),reason:major?(leadership?'official-leadership-change':'official-model-release'):'topic-relevance'};
}
export function selectNews(events,limit=10){
 const ranked=events.map(event=>({event,...newsPriority(event)})).sort((a,b)=>b.score-a.score||b.event.publishedAt.localeCompare(a.event.publishedAt)||a.event.id.localeCompare(b.event.id));
 const selected=[],sources=new Map();let medicine=0;
 for(const item of ranked){
  const e=item.event;
  if(!item.major&&((sources.get(e.sourceId)||0)>=3||(e.collection==='medicine'&&medicine>=3)))continue;
  selected.push(e);sources.set(e.sourceId,(sources.get(e.sourceId)||0)+1);if(e.collection==='medicine')medicine++;
  if(selected.length===limit)break;
 }
 return selected;
}
