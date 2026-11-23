import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../app/summary-client.js',import.meta.url),'utf8');
const item={id:'event-'+'a'.repeat(24),version:1,title:'Official title',summary:'Original excerpt',body:'Original excerpt',url:'https://example.com/news',publishedAt:'2026-11-15T00:00:00Z',evidence:'official-claim',collection:'news'};
const record={schemaVersion:1,id:item.id,version:1,title:item.title,sourceUrl:item.url,publishedAt:item.publishedAt,evidence:item.evidence,sourceText:item.body,basis:'source-excerpt',verification:'model-generated-not-independent-evidence',model:'deepseek-flash',text:'厂商声称改善性能。',generatedAt:new Date().toISOString()};
function setup(fetcher){const window={InspirationRuntime:{llmServiceUrl:'https://inspiration.landooomed.workers.dev'}};vm.runInNewContext(source,{window,fetch:fetcher,AbortSignal,Date});return window.SummaryClient}
test('only matching source revisions receive AI text; English originals and TLDR survive',async()=>{
 let calls=0;const client=setup(async(url,options)=>{calls++;assert.ok(url.endsWith('/summaries'));assert.equal(options.credentials,'omit');return {ok:true,json:async()=>({schemaVersion:1,items:[record]})}});
 const data={stories:[item,{...item,id:'tldr-test',collection:'tldr'}]},enriched=await client.enrich(data);
 assert.equal(enriched.stories[0].generatedSummary.text,record.text);assert.equal(enriched.stories[0].summary,item.summary);assert.equal(data.stories[0].generatedSummary,undefined);assert.equal(enriched.stories[1].generatedSummary,undefined);
 for(const changes of [{version:2},{body:'New excerpt'},{url:'https://other.example'},{publishedAt:'2026-11-14T00:00:00Z'}])assert.equal(client.matches({...item,...changes},record),false);
 assert.equal(client.matches(item,{...record,basis:'full-article'}),false);
 assert.equal(client.matches(item,{...record,text:'�'}),false);
 assert.equal(client.matches(item,{...record,generatedAt:'invalid'}),false);
 await client.enrich(data);assert.equal(calls,1);
});
test('network errors preserve reading data and service status is candid',async()=>{
 const client=setup(async()=>{throw Error('offline')});const data={stories:[item]};assert.equal(await client.enrich(data),data);assert.match(await client.status(),/暂时无法连接/);
 const disabled=setup(async()=>({ok:true,json:async()=>({mode:'news-summaries',enabled:false})}));assert.match(await disabled.status(),/尚未启用/);
});
test('article lookup accepts analysis only for this revision and falls back to the item endpoint',async()=>{
 const v2={...record,schemaVersion:2,collection:'news',basis:'article-passages',impact:'可能改变比较方法。'};
 const paths=[];
 const client=setup(async url=>{paths.push(url);return {ok:true,json:async()=>({schemaVersion:1,items:url.includes('?id=')?[v2]:[]})}});
 assert.equal((await client.lookup(item)).impact,v2.impact);
 assert.equal(client.cached(item).id,item.id);
 assert.ok(paths.at(-1).endsWith('?id='+item.id));
 assert.equal(client.matches({...item,sourceUpdatedAt:'2026-11-22'},v2),false);
 assert.equal(client.cached({...item,id:'other'}),undefined);
 assert.equal(client.matches(item,{...v2,model:'codex-preview'}),false);
 client.clear();assert.equal(client.cached(item),undefined);
});
