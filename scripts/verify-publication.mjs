import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {assertCurrentPublication} from '../server/publication.mjs';

const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
try{
 if(args.includes('--local')){
  const view=JSON.parse(await readFile(resolve('dist/data/content.json'),'utf8'));
  console.log(JSON.stringify(assertCurrentPublication(view,new Date().toISOString())));
 }else{
  const base=new URL(option('--url'));
  if(base.protocol!=='https:'||base.username||base.password)throw Error('Public HTTPS site required');
  const expected=JSON.parse(await readFile(option('--expected'),'utf8'));
  let lastError;
  for(let attempt=0;attempt<12;attempt++){
   try{
    const get=async path=>{const url=new URL(path,base);url.searchParams.set('verify',Date.now());const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error(`Publication HTTP ${response.status}`);return response.json()};
    const view=await get('data/content.json');
    const report=assertCurrentPublication(view,new Date().toISOString(),{collectedAfter:expected.contentUpdatedAt});
    const issue=await get(`data/digests/${report.date}.json`);
    if(issue.fingerprint!==view.digests[report.date].fingerprint)throw Error('Live digest and reading snapshot do not match');
    console.log(JSON.stringify(report));lastError=null;break;
   }catch(error){lastError=error;if(attempt<11)await new Promise(done=>setTimeout(done,5000))}
  }
  if(lastError)throw lastError;
 }
}catch(error){console.error(error.message);process.exitCode=1}
