import {tldrSource} from '../server/config.mjs';
import {collect} from '../server/pipeline.mjs';
try {
 const newsOnly=process.argv.includes('--news-only');
 const tldrOnly=process.argv.includes('--tldr-only');
 const run=await collect(tldrOnly?{feedConfig:[],searchConfig:[],projectConfig:[],enrich:false,tldrConfig:tldrSource}:newsOnly?{searchConfig:[],enrich:false}:{});
 console.log(JSON.stringify(run,null,2));
 // A partial run is publishable; a fatal storage/task error never is.
 if(run.failures.length)process.exitCode=2;
}catch(e){console.error(e.message);process.exitCode=1}
