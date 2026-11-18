import {tldrSource} from '../server/config.mjs';
import {collect} from '../server/pipeline.mjs';
import {readState} from '../server/store.mjs';
import {collectionScope} from '../server/publication.mjs';
try {
 const now=new Date().toISOString();
 const newsOnly=process.argv.includes('--news-only')||(process.argv.includes('--scheduled')&&collectionScope(await readState(),now)==='news');
 const tldrOnly=process.argv.includes('--tldr-only');
 const run=await collect(tldrOnly?{now,scope:'tldr',feedConfig:[],searchConfig:[],projectConfig:[],enrich:false,tldrConfig:tldrSource}:newsOnly?{now,scope:'news',searchConfig:[],enrich:false}:{now,scope:'full'});
 console.log(JSON.stringify(run,null,2));
 // A partial run is publishable; a fatal storage/task error never is.
 if(run.failures.length)process.exitCode=2;
}catch(e){console.error(e.message);process.exitCode=1}
