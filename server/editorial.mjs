import {latestDue,hash} from './domain.mjs';
import {newsPriority} from './news-priority.mjs';
import {retiredSourceIds} from './config.mjs';

export function weekStart(date){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10)}
const fingerprint=(kind,item)=>kind==='tools'?hash(item.id+'\n'+(item.pushedAt||'')):hash(item.id+'\n'+item.version+'\n'+item.fingerprint);
// Persist picks, rather than taking a changing top-N slice on every refresh.
// Recommendation dates never replace publishers' original publication dates.
export function selectEditions(state,now){
 const date=latestDue(now),week=weekStart(date);
 const editorial=state.editorial??={editions:{},seen:{}};
 const edition=editorial.editions[date]??={date,selectedAt:now,tools:[],medicine:[]};
 for(const kind of ['tools','medicine']){
  const weekly=Object.values(editorial.editions).filter(e=>e.date>=week&&e.date<=date).flatMap(e=>e[kind]);
  const daysLeft=7-Math.round((Date.parse(date)-Date.parse(week))/86400000);
  const dailyLimit=Math.min(2,Math.ceil((10-weekly.length+edition[kind].length)/daysLeft));
  const slots=Math.max(0,Math.min(dailyLimit-edition[kind].length,10-weekly.length));
  const candidates=kind==='tools'?Object.values(state.tools).filter(t=>t.scoring.total>=30&&t.firstSeenAt<=now):Object.values(state.events).filter(e=>e.collection==='medicine'&&e.evidence!=='title-only'&&!retiredSourceIds.includes(e.sourceId)&&e.publishedAt<=now);
  candidates.sort((a,b)=>kind==='tools'?b.scoring.total-a.scoring.total||a.id.localeCompare(b.id):newsPriority(b).score-newsPriority(a).score||b.publishedAt.localeCompare(a.publishedAt)||a.id.localeCompare(b.id));
  const chosen=candidates.filter(item=>!weekly.some(p=>p.id===item.id)&&editorial.seen[kind+':'+item.id]!==fingerprint(kind,item)).slice(0,slots);
  for(const item of chosen){const pick={id:item.id,fingerprint:fingerprint(kind,item),recommendedOn:date};edition[kind].push(pick);editorial.seen[kind+':'+item.id]=pick.fingerprint}
 }
 return editorial;
}
export function editionView(state,now){
 // Read-only exports of older stores get the same deterministic initial picks.
 const editorial=state.editorial||selectEditions({...state},now);
 const date=latestDue(now),week=weekStart(date),editions=Object.values(editorial.editions).filter(e=>e.date>=week&&e.date<=date).sort((a,b)=>b.date.localeCompare(a.date));
 const picks=kind=>editions.flatMap(e=>e[kind]);
 return {date,weekStart:week,timeZone:'Asia/Shanghai',tools:picks('tools'),medicine:picks('medicine'),today:{tools:editorial.editions[date]?.tools.length||0,medicine:editorial.editions[date]?.medicine.length||0},limits:{weekly:10,daily:2,newsDaily:5,tldrDaily:10}};
}
