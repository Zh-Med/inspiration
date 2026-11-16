import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {collect,parseFeed} from '../server/pipeline.mjs';
import {tldrSource} from '../server/config.mjs';
import {contentView} from '../server/api.mjs';
import {readState,writeState} from '../server/store.mjs';
import {buildPages} from '../scripts/build-pages.mjs';

const uuid=i=>`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
const row=(i,extra='')=>`<article data-click-target="story" class="kf-row ${extra}"><h3 class="kf-row-title"><a href="https://example.org/${i}">Story ${i}</a></h3><a href="/story/${uuid(i)}">Copy</a></article>`;
const home=Array.from({length:13},(_,i)=>row(i+1)).join('');
const detail=i=>`<article class="kf-story-body"><h1>Story ${i}</h1><p class="kf-row-summary">${Array.from({length:60},(_,j)=>'word'+j).join(' ')} <a href="https://example.org/${i}">Open article \u2192</a></p><section><p>Unrelated comments must not be collected</p></section></article>`;
const now='2026-11-15T01:00:00.000Z';

test('TLDR selects first ten unique non-sponsored cards and preserves the complete publisher summary',async()=>{
 const list=await parseFeed(row(99,'kf-ad')+row(1)+home,'tldr-home',tldrSource.url);
 assert.deepEqual(list.map(r=>r.title),Array.from({length:13},(_,i)=>'Story '+(i+1)));
 const [story]=await parseFeed(detail(1),'tldr-story',list[0].url);
 assert.equal(story.excerpt,Array.from({length:60},(_,j)=>'word'+j).join(' '));
 assert.equal(story.excerptTruncated,false);assert.ok(!story.excerpt.includes('comments'));
 await assert.rejects(parseFeed('<html>Access denied</html>','tldr-home',tldrSource.url));
 await assert.rejects(parseFeed('<article class="kf-story-body"><h1>No summary</h1></article>','tldr-story',list[0].url));
});

test('daily retries preserve ordering, fill failures, refresh at Beijing 08:00, and remain separate from News',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'inspiration-tldr-'));let fail=true,calls=[];
 const request=async(url,options)=>{calls.push({url,options});if(url===tldrSource.url)return {body:home};const i=Number(url.slice(-12));if(fail&&i===3)throw Error('HTTP 403');return {body:detail(i)}};
 const args={dir,request,now,feedConfig:[],searchConfig:[],enrich:false,tldrConfig:tldrSource};
 try{
  await collect(args);let state=await readState(dir);assert.equal(state.tldrIssues['2026-11-15'].items.length,9);assert.equal(state.tldrIssues['2026-11-15'].status,'partial');
  fail=false;calls=[];await collect(args);state=await readState(dir);
  assert.equal(calls.length,1);assert.equal(calls[0].options.etag,null);assert.equal(calls[0].options.lastModified,null);
  const issue=state.tldrIssues['2026-11-15'];assert.equal(issue.status,'ready');assert.deepEqual(issue.items.map(x=>x.title),Array.from({length:10},(_,i)=>'Story '+(i+1)));
  assert.ok(issue.items.every(x=>x.publishedAt===null&&x.collection==='tldr'));
  const legacy=issue.items[4];legacy.summary='Story 5 truncated';legacy.excerptTruncated=true;await writeState(state,dir);
  calls=[];await collect(args);state=await readState(dir);
  assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith(uuid(5)));
  const completed=state.tldrIssues['2026-11-15'].items[4];
  assert.equal(completed.summary,Array.from({length:60},(_,j)=>'word'+j).join(' '));assert.equal(completed.excerptTruncated,false);
  assert.deepEqual(state.tldrIssues['2026-11-15'].items.map(x=>x.title),Array.from({length:10},(_,i)=>'Story '+(i+1)));
  const linkLabel=state.tldrIssues['2026-11-15'].items[6];linkLabel.summary+=' Open article \u2192';linkLabel.excerptTruncated=false;await writeState(state,dir);
  calls=[];await collect(args);state=await readState(dir);
  assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith(uuid(7)));
  assert.equal(state.tldrIssues['2026-11-15'].items[6].summary,Array.from({length:60},(_,j)=>'word'+j).join(' '));
  assert.equal(state.tldrIssues['2026-11-15'].items[6].excerptTruncated,false);
  calls=[];await collect({...args,now:'2026-11-15T23:59:59.000Z'});assert.equal(calls.length,0);
  const nextDate='2026-11-16';
  const legacyItems=state.tldrIssues['2026-11-15'].items.slice(0,2);
  state.tldrIssues[nextDate]={date:nextDate,status:'ready',candidates:legacyItems,items:legacyItems};
  delete state.tldrHistory;
  await writeState(state,dir);
  const alternate=row(14).replace('https://example.org/14','https://example.org/1?utm_source=tldr');
  const nextRequest=(url,options)=>url===tldrSource.url?request(url,options).then(()=>({body:alternate+home})):request(url,options);
  await collect({...args,request:nextRequest,now:'2026-11-16T00:00:00.000Z'});assert.equal(calls.length,4);
  state=await readState(dir);assert.equal(Object.keys(state.tldrIssues).length,2);assert.equal(Object.keys(state.events).length,0);assert.equal(Object.keys(state.digests).length,0);
  const view=contentView(state);assert.equal(view.stories.length,0);
  assert.deepEqual(view.tldrIssues[nextDate].items.map(item=>item.title),['Story 11','Story 12','Story 13']);
  await buildPages({dir,out:join(dir,'dist')});
  const item=state.tldrIssues['2026-11-16'].items[0];
  assert.equal(JSON.parse(await readFile(join(dir,'dist/data/items/'+item.id+'.json'))).summary,item.summary);
  assert.equal(JSON.parse(await readFile(join(dir,'dist/data/content.json'))).tldrIssues[nextDate].items.length,3);
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('TLDR survives independent offline cache and bookmarks',async()=>{
 const data={schemaVersion:1,stories:[{id:'news',title:'Existing news'}],tools:[],digests:{},updatedAt:now,status:'ok',tldrIssues:Object.fromEntries(['12','13','14','15'].map(d=>['2026-11-'+d,{date:'2026-11-'+d,items:[{id:'tldr-'+d,collection:'tldr',title:'Original title',summary:'Original excerpt',url:'https://tldr.tech/story/'+uuid(1)}]}]))};
 const memory=new Map(),events={};
 const context=vm.createContext({window:{addEventListener(){},InspirationRuntime:{}},document:{baseURI:'http://localhost/',addEventListener:(n,cb)=>events[n]=cb,dispatchEvent(){}},localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},Event:class{},CustomEvent:class{},AbortSignal,URL,fetch:async()=>({ok:true,json:async()=>data})});
 vm.runInContext(await readFile('app/content.js','utf8'),context);await context.window.Content.refresh();
 const cache=JSON.parse(memory.get('inspiration:content-v1'));assert.equal(Object.keys(cache.tldrIssues).length,3);assert.ok(cache.tldrIssues['2026-11-15']);
 context.window.Content.remember('tldr-15',true);assert.equal(context.window.Content.saved[0].id,'tldr-15');
});
