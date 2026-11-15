import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {feeds,journalWatchlist,retiredSourceIds,projectSources,pendingSources} from '../server/config.mjs';
import {parseFeed,collect,buildDigest,mergeArticle} from '../server/pipeline.mjs';
import {normalizeArticle,canonical} from '../server/domain.mjs';
import {contentView,publicEvent} from '../server/api.mjs';
import {emptyState,readState,writeState} from '../server/store.mjs';
import {createFetcher} from '../server/http.mjs';
import {buildPages} from '../scripts/build-pages.mjs';

const now='2026-11-15T01:00:00.000Z';
const kimi=feeds.find(f=>f.id==='kimi'),deepseek=feeds.find(f=>f.id==='deepseek'),nature=feeds.find(f=>f.id==='nature-cover');
const card=(url='/en/blog/new-model',date='2026-11-12')=>`<div class="menu-card group"><a href="${url}" aria-label="New Kimi"></a><div class="card-body"><h4>New Kimi</h4><p class="card-date">${date}</p></div></div>`;
const changelog=`<aside><h2>Date: 2026-11-14</h2><h3 id="fake">Sidebar entry</h3></aside><article><div class="theme-doc-markdown markdown"><div class="row"><div class="col"><h1>Change Log</h1><h2 id="date-2026-11-12">Date: 2026-11-12</h2><h3 id="model-release">DeepSeek model release<a href="#model-release">​</a></h3><p>A publisher description of the first update.</p><h3 id="api-update">DeepSeek API update</h3><p>A publisher description of the second update.</p><h2>Date: 2026-11-13</h2><h3 id="tool-update">New tools</h3><p>A third independently dated update.</p></div></div></div></article>`;
const issue=(links='<a href="https://doi.org/10.1038/s41586-026-test">See article</a>')=>`<html><head><link rel="canonical" href="https://www.nature.com/nature/volumes/659/issues/8140"></head><body><h1>Volume 659 Issue 8140, 12 November 2026</h1><div data-test="issue-description"><h2>Cover theme</h2><p>The publisher explicitly describes its cover here. ${links}</p><p data-test="issue-image-credit"><a href="https://doi.org/10.1038/credit-only">Cover artist</a></p></div><article><h3><a href="/articles/s41586-026-test">The linked cover paper</a></h3><time datetime="2026-11-09"></time></article><article><h3><a href="/articles/ordinary">Unrelated research about cover crops</a></h3></article><article><h3><a href="/articles/credit-only">Not a cover paper</a></h3></article><script>throw Error('never executed')</script></body></html>`;

test('Kimi dated overlay cards deduplicate desktop/mobile; missing dates and external links are excluded',async()=>{
 const rows=await parseFeed(card()+card()+card('https://outside.example/news')+card('/en/blog/undated',''),kimi.format,kimi.url);
 assert.equal(rows.length,1);assert.equal(rows[0].publishedAt,'2026-11-12');assert.equal(rows[0].url,'https://www.kimi.com/en/blog/new-model');
 await assert.rejects(parseFeed('<html>Consent or challenge page</html>',kimi.format,kimi.url),/format/);
});

test('DeepSeek updates on the same page keep distinct anchor identities and dates',async()=>{
 const rows=await parseFeed(changelog,deepseek.format,deepseek.url);
 assert.equal(rows.length,3);assert.equal(rows[0].title,'DeepSeek model release');assert.equal(rows[2].publishedAt,'2026-11-13');
 const events=rows.map(r=>normalizeArticle(r,deepseek,now));
 assert.equal(new Set(events.map(e=>e.id)).size,3);assert.ok(events[0].url.endsWith('#model-release'));
 assert.equal(canonical(events[0].url),'https://api-docs.deepseek.com/updates');
 const state=emptyState();for(const e of events)mergeArticle(state,e);assert.equal(Object.keys(state.events).length,3);
 const repeated=emptyState();
 for(const row of rows.slice(0,2))mergeArticle(repeated,normalizeArticle({...row,title:'API update'},deepseek,now));
 assert.equal(Object.keys(repeated.events).length,2,'repeated headings with different anchors are independent updates');
 assert.equal(buildDigest(state,'2026-11-13',now,[]).items.length,2);
 assert.equal(buildDigest(state,'2026-11-14',now,[]).items.length,1);
});

test('Nature requires explicit cover-to-paper membership and retains both issue and article dates',async()=>{
 const rows=await parseFeed(issue(),nature.format,nature.url);assert.equal(rows.length,1);
 assert.equal(rows[0].title,'The linked cover paper');assert.equal(rows[0].articlePublishedAt,'2026-11-09');assert.equal(rows[0].publishedAt,'2026-11-12');
 const e=normalizeArticle(rows[0],nature,now),pub=publicEvent(e);
 assert.equal(pub.coverConfirmed,true);assert.equal(pub.issuePublishedAt,'2026-11-12T00:00:00.000Z');assert.equal(pub.articlePublishedAt,'2026-11-09T00:00:00.000Z');assert.equal(pub.evidence,'publisher-curated');assert.equal(pub.category,'期刊封面');assert.equal(pub.coverEvidenceUrl,'https://www.nature.com/nature/volumes/659/issues/8140');
 assert.equal(normalizeArticle({...rows[0],coverConfirmed:false},nature,now),null);
 assert.equal(normalizeArticle({...rows[0],coverEvidenceUrl:'https://outside.example/nature/volumes/659/issues/8140'},nature,now),null);
 // No guess from table-of-contents order, cover-related words, image credits,
 // unlinked DOI text, lookalike hosts, or links with the wrong protocol.
 for(const links of ['','10.1038/s41586-026-test','<a href="https://doi.org.evil.example/10.1038/s41586-026-test">See article</a>','<a href="http://doi.org/10.1038/s41586-026-test">See article</a>']){
  assert.deepEqual(await parseFeed(issue(links),nature.format,nature.url),[]);
 }
 await assert.rejects(parseFeed('<html>Access limited</html>',nature.format,nature.url),/format/);
});

test('all four unconfirmed journals stay outside the active collector; retired arXiv stays out of reading exports',async()=>{
 assert.ok(retiredSourceIds.includes('arxiv-neuro'));assert.ok(!feeds.some(f=>f.id==='arxiv-neuro'));
 assert.equal(journalWatchlist.length,4);assert.ok(journalWatchlist.every(j=>!feeds.some(f=>f.id===j.id)));
 const temp=await mkdtemp(join(tmpdir(),'inspiration-retired-'));
 try{
  const state=emptyState(),rows=await parseFeed(issue(),nature.format,nature.url),cover=normalizeArticle(rows[0],nature,now);
  const old=normalizeArticle({title:'Archived preprint',url:'https://arxiv.org/abs/example',publishedAt:'2026-11-12',excerpt:'Previously collected abstract.'},{id:'arxiv-neuro',name:'arXiv',evidence:'preprint',collection:'medicine'},now);
  mergeArticle(state,old);mergeArticle(state,cover);state.updatedAt=now;
  const digest=buildDigest(state,'2026-11-13',now,[]);assert.deepEqual(digest.items.map(i=>i.eventId),[cover.id]);
  // Also exercise a stored digest created before retirement.
  digest.items.push({eventId:old.id,version:1});assert.equal(contentView(state,now).stories.length,1);
  await writeState(state,temp);await buildPages({dir:temp,out:join(temp,'dist')});
  const exported=JSON.parse(await readFile(join(temp,'dist/data/content.json')));assert.equal(exported.stories.length,1);assert.equal(exported.stories[0].coverConfirmed,true);
  const issueExport=JSON.parse(await readFile(join(temp,'dist/data/digests/2026-11-13.json')));assert.equal(issueExport.stories.length,1);
  assert.equal(Object.keys((await readState(temp)).events).length,2,'retirement does not destroy historical records');
 }finally{await rm(temp,{recursive:true,force:true})}
});

test('new sources collect, enrich Kimi, persist cover evidence, and replay without duplicates',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'inspiration-new-sources-'));
 try{
  const calls=[];
  const request=async(url,options)=>{calls.push({url,options});return {body:url===kimi.url?card():url===deepseek.url?changelog:url===nature.url?issue():'<meta name="description" content="An official description of this Kimi model.">'}};
  const args={dir:temp,request,now,feedConfig:[kimi,deepseek,nature],searchConfig:[],enrich:false};
  const first=await collect(args);assert.equal(first.newEvents,5);assert.equal(first.failures.length,0);
  assert.equal(calls.find(c=>c.url===nature.url).options.publicNatureRedirects,true);
  const replay=await collect(args);assert.equal(replay.newEvents,0);
  const state=await readState(temp);assert.equal(Object.keys(state.events).length,5);
  const cover=Object.values(state.events).find(e=>e.coverConfirmed);assert.equal(cover.evidenceSources[0].coverEvidenceUrl,cover.coverEvidenceUrl);
  assert.ok(contentView(state,now).stories.some(e=>e.sourceId==='kimi'));
  const failure=await collect({...args,request:async()=>({body:'<html>Access limited</html>'})});assert.equal(failure.failures.length,3);assert.equal(Object.keys((await readState(temp)).events).length,5);
 }finally{await rm(temp,{recursive:true,force:true})}
});

test('Nature public cookie redirects are tightly scoped and never carry credentials',async()=>{
 const start=nature.url,authorize='https://idp.nature.com/authorize?response_type=cookie&client_id=grover&redirect_uri='+encodeURIComponent(start),transit='https://idp.nature.com/transit?redirect_uri='+encodeURIComponent(start)+'&code=example';
 const destinations=[authorize,transit,start+'?error=cookies_not_supported'];let count=0;
 const request=createFetcher({fetchImpl:async(url,options)=>{
  assert.ok(!options.headers.Cookie);assert.ok(!options.headers.Authorization);assert.equal(options.redirect,'manual');
  return count<destinations.length?new Response(null,{status:302,headers:{location:destinations[count++]}}):new Response('public issue');
 }});
 assert.equal((await request(start,{publicNatureRedirects:true})).body,'public issue');
 for(const location of [authorize.replace('response_type=cookie','response_type=code'),authorize.replace('www.nature.com','outside.example'),authorize.replace('/authorize?','/login?'),'https://outside.example/']){
  const denied=createFetcher({fetchImpl:async()=>new Response(null,{status:302,headers:{location}})});
  await assert.rejects(denied(start,{publicNatureRedirects:true}),/Cross-origin/);
 }
 const defaultDenied=createFetcher({fetchImpl:async()=>new Response(null,{status:302,headers:{location:authorize}})});
 await assert.rejects(defaultDenied(start),/Cross-origin/);
 const loop=createFetcher({fetchImpl:async()=>new Response(null,{status:302,headers:{location:start}})});
 await assert.rejects(loop(start,{publicNatureRedirects:true}),/Too many/);
});

test('Nature subjournal and article cookie redirects stay within the requested resource scope',async()=>{
 for(const path of ['/neuro/current-issue','/natmachintell/current-issue','/articles/s41593-026-example']){
  const start='https://www.nature.com'+path;
  const make=back=>createFetcher({fetchImpl:async url=>url===start?new Response(null,{status:303,headers:{location:'https://idp.nature.com/authorize?response_type=cookie&client_id=grover&redirect_uri='+encodeURIComponent(back)}}):new Response('public metadata')});
  assert.equal((await make(start)(start,{publicNatureRedirects:true})).body,'public metadata');
  await assert.rejects(make('https://www.nature.com/other-journal/current-issue')(start,{publicNatureRedirects:true}),/Cross-origin/);
  if(path.startsWith('/articles/'))await assert.rejects(make(start+'-other')(start,{publicNatureRedirects:true}),/Cross-origin/);
 }
});

test('monthly Nature covers retain original online dates and Abstracts without inventing daily news',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'inspiration-monthly-'));
 try{
  const source=feeds.find(f=>f.id==='nature-neuroscience-cover');
  const html=issue().replaceAll('/nature/volumes/','/neuro/volumes/').replace('Volume 659 Issue 8140, 12 November 2026','Volume 29 Issue 11, November 2026').replace('2026-11-09','2026-09-10');
  const rows=await parseFeed(html,source.format,source.url);assert.equal(rows[0].issueMonth,'2026-11');assert.equal(rows[0].issuePublishedAt,null);assert.equal(rows[0].publishedAt,'2026-09-10');
  const detail='<meta name="citation_online_date" content="2026/09/10"><div id="Abs1-content"><p>An abstract sufficiently long to be distinct from the cover description.</p></div><section>Paid body must not be included.</section>';
  let count=0;const request=async url=>{count++;return {body:url===source.url?html:detail}};
  const args={dir:temp,now,request,feedConfig:[source],searchConfig:[],enrich:false};
  const run=await collect(args);assert.equal(run.failures.length,0);assert.equal(run.newEvents,1);
  const state=await readState(temp),e=Object.values(state.events)[0];assert.equal(e.publishedAt,'2026-09-10T00:00:00.000Z');assert.equal(e.issuePublishedAt,null);assert.equal(e.issuePrecision,'month');assert.equal(e.excerptKind,'abstract');assert.ok(!e.excerpt.includes('Paid body'));
  const view=contentView(state,now);assert.equal(view.stories.length,1);assert.equal(view.stories[0].issueMonth,'2026-11');assert.equal(view.stories[0].articlePublishedAt,e.publishedAt);assert.equal(state.digests['2026-11-15'].items.length,0);
  const storage=new Map(),context={window:{addEventListener(){}},document:{baseURI:'https://example.com/',addEventListener(){},dispatchEvent(){}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},URL,AbortSignal,Event:class{},CustomEvent:class{},fetch:async()=>({ok:true,json:async()=>view})};
  vm.runInNewContext(await readFile('app/content.js','utf8'),context);await context.window.Content.refresh();
  assert.equal(JSON.parse(storage.get('inspiration:content-v1')).stories[0].id,e.id,'offline cache keeps current monthly covers even without a daily digest item');
  assert.equal((await collect(args)).newEvents,0);
  const failed=await collect({...args,request:async url=>{if(url===source.url)return {body:html};throw Error('HTTP 403')}});assert.equal(failed.failures.length,1);assert.equal(Object.values((await readState(temp)).events)[0].excerpt,e.excerpt);
  assert.equal(normalizeArticle({...rows[0],issueMonth:'2027-01'},source,now),null);
 }finally{await rm(temp,{recursive:true,force:true})}
});

test('Trending uses repository API metadata; no creation dates or popularity are inferred from a rank',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'inspiration-trending-'));
 try{
  const html='<article class="Box-row"><a href="/login">Login</a><h2><a href="/example/ai-research">example / ai-research</a></h2></article><h2><a href="https://evil.example/owner/repo">Ignore</a></h2>';
  const rows=await parseFeed(html,'github-trending','https://github.com/trending');assert.deepEqual(rows,[{fullName:'example/ai-research'}]);
  const calls=[],repo={full_name:'example/ai-research',html_url:'https://github.com/example/ai-research',description:'AI research agent workflow',topics:['ai'],stargazers_count:123,pushed_at:'2026-11-12T01:00:00Z',created_at:'2025-01-01T00:00:00Z',default_branch:'main'};
  await collect({dir,now,feedConfig:[],searchConfig:[],projectConfig:projectSources,enrich:false,request:async url=>{calls.push(url);return {body:url==='https://github.com/trending'?html:JSON.stringify(repo)}}});
  const state=await readState(dir),t=Object.values(state.tools)[0];assert.equal(t.stars,123);assert.equal(t.publishedAt,'2025-01-01T00:00:00.000Z');assert.equal(t.verification,'未实测');assert.equal(t.discovery.source,'GitHub Trending');assert.equal(calls.length,2);assert.equal(Object.keys(state.events).length,0);
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('user source list deduplicates official feeds, separates media and commentary, and leaves failed communities inactive',()=>{
 assert.equal(new Set(feeds.map(f=>f.url)).size,feeds.length);
 for(const id of ['the-decoder','ars-ai','mit-technology-review','techcrunch-ai'])assert.equal(feeds.find(f=>f.id===id).evidence,'media-report');
 assert.equal(feeds.find(f=>f.id==='simon-willison').evidence,'author-commentary');
 assert.equal(pendingSources.length,3);assert.ok(pendingSources.every(p=>!feeds.some(f=>f.id===p.id)));
});
