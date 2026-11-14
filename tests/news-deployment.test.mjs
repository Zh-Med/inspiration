import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,readdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {parseFeed,mergeArticle,buildDigest} from '../server/pipeline.mjs';
import {normalizeArticle} from '../server/domain.mjs';
import {newsPriority,selectNews} from '../server/news-priority.mjs';
import {emptyState,writeState} from '../server/store.mjs';
import {buildPages,assets} from '../scripts/build-pages.mjs';
const now='2026-11-14T04:00:00.000Z';
const source={id:'official',name:'Publisher',evidence:'official-claim'};
const event=(title,i,extra={})=>normalizeArticle({title,url:`https://example.com/${i}`,publishedAt:'2026-11-12T13:48:00Z',excerpt:'Publisher announcement.',...extra},source,now);
test('official leadership and model launches survive a crowded research day',()=>{
 const ceo=event('NVIDIA Announces CEO Transition',1);
 const release=event('Introducing Claude Fable 5.2 and Claude Mythos 5.2',2);
 const papers=Array.from({length:25},(_,i)=>({...event('New brain research model '+i,i+3),sourceId:'papers',collection:'medicine',evidence:'preprint'}));
 const selected=selectNews([...papers,ceo,release]);
 assert.equal(selected[0].id,ceo.id);assert.ok(selected.some(e=>e.id===release.id));assert.equal(selected.filter(e=>e.collection==='medicine').length,3);
 assert.equal(newsPriority({...ceo,evidence:'title-only'}).major,false);
 assert.equal(newsPriority({...release,evidence:'publisher-claim'}).major,false);
});
test('newsroom parser retains card dates, excludes cross-origin links and ignores executable text',async()=>{
 const html=`<html><script>throw new Error('never run')</script><section><article><header><time>Nov 9, 2026</time></header><a href="/models/new"><h2>Introducing Model</h2><p>A publisher description sufficiently long for extraction.</p></a></article><article><time>Nov 10, 2026</time><a href="https://other.example.com/news"><h2>Other domain</h2></a></article><a href="/undated"><h2>Missing date</h2></a></section></html>`;
 const rows=await parseFeed(html,'newsroom','https://example.com/news');
 assert.equal(rows.length,1);assert.equal(rows[0].publishedAt,'2026-11-09');assert.equal(rows[0].publishedPrecision,'day');
 assert.equal(rows[0].url,'https://example.com/models/new');
 const detail=await parseFeed('<meta name="description" content="Publisher &amp; summary">','newsroom-article','https://example.com/news');assert.equal(detail[0].excerpt,'Publisher & summary');
});
test('late discovery backfills the original issue, not the current day',()=>{
 const state=emptyState(),e=event('Introducing Claude Fable 5.2',1,{publishedAt:'2026-11-09',publishedPrecision:'day'});mergeArticle(state,e);
 assert.equal(buildDigest(state,'2026-11-10',now).items[0].eventId,e.id);
 assert.equal(buildDigest(state,'2026-11-14',now).items.length,0);
 assert.equal(e.publishedPrecision,'day');
});
test('static export copies only public assets and records; works under a repository subpath',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'inspiration-pages-'));
 try{
  const state=emptyState(),e=event('NVIDIA Announces CEO Transition',1);mergeArticle(state,e);state.updatedAt=now;buildDigest(state,'2026-11-13',now);await writeState(state,temp);
  // An unrelated private file must never be read or copied by export.
  await writeFile(join(temp,'unrelated-private.txt'),'DO-NOT-PUBLISH');
  const out=join(temp,'dist');await buildPages({dir:temp,out});
  const files=await readdir(out);assert.ok(!files.includes('state.json'));assert.ok(!files.includes('unrelated-private.txt'));
  const payload=JSON.parse(await readFile(join(out,'data/content.json')));assert.equal(payload.stories[0].id,e.id);assert.ok(!('sources' in payload));
  const manifest=JSON.parse(await readFile(join(out,'manifest.webmanifest')));assert.equal(new URL(manifest.scope,'https://user.github.io/Inspiration/manifest.webmanifest').pathname,'/Inspiration/');
  let requested;const listeners={};const context={window:{InspirationRuntime:{contentMode:'static'},addEventListener(){}},document:{baseURI:'https://user.github.io/Inspiration/',addEventListener(n,f){listeners[n]=f},dispatchEvent(){}},localStorage:{getItem(){return null},setItem(){}},URL,AbortSignal,CustomEvent:class{},fetch:async url=>{requested=String(url);return {ok:true,json:async()=>payload}}};
  vm.runInNewContext(await readFile('app/content.js','utf8'),context);await context.window.Content.refresh();assert.equal(requested,'https://user.github.io/Inspiration/data/content.json');
  await context.window.Content.ensure('news/2026-11-12');assert.equal(requested,'https://user.github.io/Inspiration/data/digests/2026-11-12.json');
  const sw=await readFile(join(out,'sw.js'),'utf8');assert.ok(sw.includes("relative.startsWith('data/')"));assert.ok(!/PREFIX\+'v\d+'/.test(sw));
  for(const asset of assets)assert.ok(files.includes(asset));
 }finally{await rm(temp,{recursive:true,force:true})}
});
test('empty collection cannot replace a working deployment',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'inspiration-empty-'));
 try{await assert.rejects(buildPages({dir:temp,out:join(temp,'dist')}),/No collected reading content/)}finally{await rm(temp,{recursive:true,force:true})}
});
