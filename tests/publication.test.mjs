import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionScope,assertCurrentPublication} from '../server/publication.mjs';
import {windowFor} from '../server/domain.mjs';

test('any later schedule catches up a missed morning full collection exactly once per Beijing business day',()=>{
 const state={runs:[]};assert.equal(collectionScope(state,'2026-11-18T02:47:00Z'),'full');
 state.runs.push({scope:'full',businessDate:'2026-11-18',finishedAt:'2026-11-18T02:48:00Z'});
 assert.equal(collectionScope(state,'2026-11-18T03:17:00Z'),'news');
 assert.equal(collectionScope(state,'2026-11-18T23:59:59Z'),'news');
 assert.equal(collectionScope(state,'2026-11-19T00:00:00Z'),'full');
 state.runs=[{scope:'news',businessDate:'2026-11-19',finishedAt:'2026-11-19T00:18:00Z'}];
 assert.equal(collectionScope(state,'2026-11-19T01:00:00Z'),'full');
 state.lastFullCollection={businessDate:'2026-11-18',finishedAt:'2026-11-18T02:48:00Z'};state.runs=[];assert.equal(collectionScope(state,'2026-11-18T23:59:59Z'),'news');
 state.runs=[{scope:'full',businessDate:'2026-11-19'}];assert.equal(collectionScope(state,'2026-11-19T01:00:00Z'),'full');
});
test('publication rejects stale/missing daily content but accepts explicit empty News without inventing stories',()=>{
 const now='2026-11-18T01:40:00Z',date='2026-11-18';
 const view={updatedAt:now,digests:{[date]:{date,coverage:windowFor(date),status:'empty',items:[]}},tldrIssues:{[date]:{items:[]}}};
 assert.equal(assertCurrentPublication(view,now).newsItems,0);
 assert.throws(()=>assertCurrentPublication({...view,digests:{}},now),/Missing current News/);
 assert.throws(()=>assertCurrentPublication({...view,tldrIssues:{}},now),/Missing current TLDR/);
 assert.throws(()=>assertCurrentPublication({...view,updatedAt:'2026-11-17T22:00:00Z'},now),/predates/);
 assert.throws(()=>assertCurrentPublication(view,now,{collectedAfter:'2026-11-18T02:00:00Z'}),/older collection/);
 view.digests[date].status='unavailable';assert.throws(()=>assertCurrentPublication(view,now),/No healthy/);
});
