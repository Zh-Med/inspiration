import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {emptyState} from '../server/store.mjs';
import {selectEditions,editionView,weekStart} from '../server/editorial.mjs';
import {buildDigest} from '../server/pipeline.mjs';
import {contentView} from '../server/api.mjs';
const now='2026-11-16T01:00:00.000Z';
function fixture(){const s=emptyState();for(let i=0;i<40;i++){
 s.tools['t'+i]={id:'t'+i,collection:'tools',firstSeenAt:now,pushedAt:now,scoring:{total:100-i}};
 s.events['m'+i]={id:'m'+i,collection:'medicine',title:'Brain study '+i,version:1,fingerprint:'v1',sourceId:'research',publishedAt:now,evidence:'publisher-curated'};
 }return s;}
test('weekly picks total ten with one or two daily, retries remain stable and week rolls over in Beijing',()=>{
 const s=fixture();assert.equal(weekStart('2026-11-22'),'2026-11-16');
 for(let i=0;i<7;i++){
  const t=new Date(Date.parse(now)+i*86400000).toISOString();selectEditions(s,t);
  const before=JSON.stringify(s.editorial);selectEditions(s,t);assert.equal(JSON.stringify(s.editorial),before);
  const v=editionView(s,t);for(const kind of ['tools','medicine']){assert.ok(v.today[kind]>=1&&v.today[kind]<=2);assert.ok(v[kind].length<=10);assert.equal(new Set(v[kind].map(p=>p.id)).size,v[kind].length)}
 }
 const sunday=editionView(s,'2026-11-22T01:00:00Z');assert.equal(sunday.tools.length,10);assert.equal(sunday.medicine.length,10);
 selectEditions(s,'2026-11-23T01:00:00Z');const next=editionView(s,'2026-11-23T01:00:00Z');assert.equal(next.tools.length,2);assert.ok(next.tools.every(p=>!sunday.tools.some(x=>x.id===p.id)));
 assert.equal(editionView(s,'2026-11-23T00:00:00Z').weekStart,'2026-11-23');assert.equal(editionView(s,'2026-11-22T23:59:59Z').weekStart,'2026-11-16');
});
test('empty candidates never invent content, late starts stay under daily limit, future content is excluded',()=>{
 const empty=emptyState();selectEditions(empty,now);assert.equal(editionView(empty,now).tools.length,0);
 const s=fixture();s.tools.future={id:'future',firstSeenAt:'2027-01-01T00:00:00Z',scoring:{total:1000}};selectEditions(s,'2026-11-22T01:00:00Z');assert.equal(editionView(s,'2026-11-22T01:00:00Z').tools.length,2);assert.ok(!s.editorial.editions['2026-11-22'].tools.some(p=>p.id==='future'));
});
test('new versions can be recommended next week; star changes alone cannot repeat a tool',()=>{
 const s=fixture();s.tools=Object.fromEntries(Object.entries(s.tools).slice(0,2));selectEditions(s,now);
 selectEditions(s,'2026-11-23T01:00:00Z');assert.equal(editionView(s,'2026-11-23T01:00:00Z').tools.length,0);
 s.tools.t0.pushedAt='2026-11-23T01:00:00Z';selectEditions(s,'2026-11-23T01:00:00Z');assert.equal(editionView(s,'2026-11-23T01:00:00Z').tools.length,1);
});
test('News contains at most five and Medicine is kept in its weekly edition, including legacy digests',()=>{
 const s=fixture();for(let i=0;i<15;i++)s.events['n'+i]={id:'n'+i,collection:'news',title:'AI update '+i,publishedAt:'2026-11-15T14:00:00Z',evidence:'official-claim',version:1,sourceId:'s'+i};
 const d=buildDigest(s,'2026-11-16',now,[]);assert.equal(d.items.length,5);assert.ok(d.items.every(i=>i.eventId.startsWith('n')));
 d.items.push(...Object.values(s.events).map(e=>({eventId:e.id,version:1})));selectEditions(s,now);
 const view=contentView(s,now);assert.equal(view.digests['2026-11-16'].items.length,5);assert.equal(view.stories.filter(e=>e.collection==='medicine').length,2);assert.equal(view.tools.length,2);
});
test('any content paper opens its own detail; blank pages do not navigate',async()=>{
 const src=await readFile(new URL('../app/app.js',import.meta.url),'utf8');const start=src.indexOf("document.addEventListener('click',e=>{const card=e.target.closest('[data-deck]')");const end=src.indexOf('\ndocument.addEventListener',start);let click;
 const context={document:{addEventListener:(type,f)=>{click=f}},deckCards:[{id:'first',collection:'news'},{id:'rear',collection:'news'},{id:'tool',collection:'tools'},{blank:true}],location:{hash:'#today'}};
 vm.runInNewContext(src.slice(start,end),context);
 for(const [index,expected] of [[1,'story/rear'],[2,'tool/tool'],[0,'story/first']]){click({target:{closest:()=>({dataset:{deck:String(index)}})}});assert.equal(context.location.hash,expected)}
 click({target:{closest:()=>({dataset:{deck:'3'}})}});assert.equal(context.location.hash,'story/first');
});
