import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../app/content.js',import.meta.url),'utf8');
const payload=updatedAt=>({schemaVersion:1,stories:[],tools:[],digests:{},tldrIssues:{},updatedAt,status:'ok'});
function harness(){
 let time=100000,calls=0,fail=false,release=null;
 const events={},updates=[],memory=new Map();
 const context={window:{navigator:{onLine:true},addEventListener:(n,f)=>events[n]=f},document:{hidden:false,baseURI:'https://example.com/inspiration/',addEventListener:(n,f)=>events[n]=f,dispatchEvent:e=>updates.push(e)},localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},Date:class extends Date{static now(){return time}},URL,AbortSignal,Event:class{},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}},fetch:async()=>{calls++;if(release)await new Promise(done=>release=done);if(fail)throw Error('offline');return {ok:true,json:async()=>payload(new Date(time).toISOString())}}};
 vm.runInNewContext(source,context);
 return {context,events,updates,memory,client:context.window.Content,calls:()=>calls,advance:ms=>time+=ms,fail:v=>fail=v,hold:()=>release=true,release:()=>{const done=release;release=null;done()},settle:()=>new Promise(done=>setImmediate(done))};
}
test('background restore fetches fresh content once for visibility, pageshow and focus',async()=>{
 const h=harness();await h.client.refresh();h.advance(60000);
 h.context.document.hidden=true;h.events.visibilitychange();assert.equal(h.calls(),1);
 h.context.document.hidden=false;h.events.visibilitychange();h.events.pageshow();h.events.focus();await h.settle();
 assert.equal(h.calls(),2);assert.equal(h.updates.at(-1).refreshReason,'resume');
 assert.equal(h.client.snapshot.updatedAt,new Date(160000).toISOString());
 h.events.focus();await h.settle();assert.equal(h.calls(),2);
});
test('cold starts and reconnects apply downloaded data even when an old shelf was restored from cache',async()=>{
 const h=harness();h.events.DOMContentLoaded();await h.settle();assert.equal(h.updates.at(-1).refreshReason,'resume');
 h.advance(60000);h.events.online();await h.settle();assert.equal(h.calls(),2);assert.equal(h.updates.at(-1).refreshReason,'resume');
});
test('concurrent refreshes share one request and a failed restore preserves cache and bookmarks',async()=>{
 const h=harness();await h.client.refresh();const before=h.client.snapshot.updatedAt;
 h.advance(60000);h.hold();const first=h.client.refresh(),second=h.client.refresh();assert.equal(first,second);assert.equal(h.calls(),2);h.release();await first;
 const updated=h.client.snapshot.updatedAt;assert.notEqual(updated,before);
 h.memory.set('inspiration:bookmarks','["saved"]');h.advance(60000);h.fail(true);h.events.focus();await h.settle();
 assert.equal(h.client.snapshot.updatedAt,updated);assert.equal(h.client.snapshot.status,'cached');assert.equal(h.memory.get('inspiration:bookmarks'),'["saved"]');
 h.advance(60000);h.context.window.navigator.onLine=false;h.events.focus();await h.settle();assert.equal(h.calls(),3);
});

const app=await readFile(new URL('../app/app.js',import.meta.url),'utf8');
function shelfHarness(){
 const events={},timers=new Map();let rendered=0,id=0;
 const c={newsLaunch:null,routeTransition:null,deckDrag:null,deckFrame:0,deckWheelTimer:0,pendingContent:null,pendingResumeRefresh:false,contentRefreshTimer:0,contentUpdatedAt:'old',contentStatus:'ok',shelfDate:'2026-11-17',shelfContent:[{}],document:{hidden:false,addEventListener:(n,f)=>events[n]=f},location:{hash:'#today'},NewsDates:{today:()=> '2026-11-18'},shelfKindForRoute:()=> 'today',$:()=>null,setTimeout:f=>{timers.set(++id,f);return id},clearTimeout:id=>timers.delete(id),applyContent:d=>{c.contentUpdatedAt=d.updatedAt},render:()=>rendered++};
 vm.runInNewContext(app.slice(app.indexOf('function contentRefreshBusy'),app.indexOf('\nfunction renderContent')),c);
 return {c,events,timers,rendered:()=>rendered,send:(reason='resume',updatedAt='new')=>events['content-update']({detail:{updatedAt,status:'ok'},refreshReason:reason}),flush:()=>{const f=[...timers.values()];timers.clear();f.forEach(x=>x())}};
}
test('restored News shelf applies fresh content, while unchanged historical shelves and articles remain stable',()=>{
 const h=shelfHarness();h.send();assert.equal(h.rendered(),1);
 h.c.shelfDate='2026-11-18';h.send();assert.equal(h.rendered(),1);
 h.c.location.hash='#news/2026-11-16';h.c.shelfDate='2026-11-16';h.send();assert.equal(h.rendered(),1);
 h.c.$=selector=>selector==='.article'?{}:null;h.send('resume','newer');assert.equal(h.rendered(),1);assert.equal(h.c.pendingContent.updatedAt,'newer');
});
test('resume waits for gestures and transitions to finish, then applies without requiring navigation',()=>{
 const h=shelfHarness();h.c.deckDrag={};h.send();assert.equal(h.rendered(),0);assert.equal(h.timers.size,1);
 h.c.deckDrag=null;h.c.routeTransition={};h.flush();assert.equal(h.rendered(),0);
 h.c.routeTransition=null;h.flush();assert.equal(h.rendered(),1);assert.equal(h.c.pendingContent,null);
 const regular=shelfHarness();regular.send('refresh');assert.equal(regular.rendered(),0,'ordinary in-session updates retain the existing shelf');
});
