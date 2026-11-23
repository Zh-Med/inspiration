import {get} from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,symlink,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPhonePreview} from '../scripts/preview-phone.mjs';
test('phone preview serves only static build files and rejects mutations, other hosts and escaped files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'phone-preview-')),root=join(dir,'dist');await mkdir(root);await writeFile(join(root,'index.html'),'preview');await writeFile(join(dir,'outside.txt'),'outside');await symlink(join(dir,'outside.txt'),join(root,'link.txt'));
 const server=createPhonePreview({root});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
 try{
  assert.equal(await (await fetch(url)).text(),'preview');
  for(const path of ['/api/provider','/.git/config','/link.txt','/%2e%2e/outside.txt'])assert.equal((await fetch(url+path)).status,404);
  assert.equal((await fetch(url,{method:'POST'})).status,405);
  assert.equal(await new Promise((resolve,reject)=>{get(url,{headers:{Host:'attacker.example'}},res=>{res.resume();resolve(res.statusCode)}).on('error',reject)}),403);
  assert.equal((await fetch(url,{headers:{Origin:'http://attacker.example'}})).status,403);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
});
test('LAN reads through fixed public API and preserves the live excerpt alongside preview analysis',async()=>{
 const paths=[],id='event-'+'f'.repeat(24);
 const getSummary=async path=>{paths.push(path);return {schemaVersion:1,items:[{id,schemaVersion:1}]}};
 const server=createPhonePreview({getSummary,examples:[{id,schemaVersion:2}]});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const data=await (await fetch(base+'/reading-api/summaries')).json();
  assert.deepEqual(data.items.map(i=>i.schemaVersion),[2,1]);
  await fetch(base+'/reading-api/summaries');assert.deepEqual(paths,['/summaries']);
  assert.equal((await fetch(base+'/reading-api/summaries?id=bad')).status,400);
  await fetch(base+'/reading-api/summaries?id='+id);assert.equal(paths.at(-1),'/summaries?id='+id);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
});
