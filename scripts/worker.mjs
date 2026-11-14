import {collect} from '../server/pipeline.mjs';
import {readState} from '../server/store.mjs';
import {latestDue} from '../server/domain.mjs';
// Explicit foreground worker; not installed as a system service. Hosted scheduling is a later deployment step.
let stopping=false;
process.on('SIGINT',()=>{stopping=true});process.on('SIGTERM',()=>{stopping=true});
console.log('Inspiration collector: hourly refresh + Asia/Shanghai 08:00 issue; Ctrl+C to stop.');
while(!stopping){
 try{const state=await readState(),now=new Date();const due=latestDue(now);if(!state.updatedAt||+now-Date.parse(state.updatedAt)>=3600000||!state.digests[due])console.log(JSON.stringify(await collect()))}catch(e){console.error(e.message)}
 if(!stopping)await new Promise(resolve=>{const timer=setTimeout(done,30000);function done(){clearTimeout(timer);process.off('SIGINT',done);process.off('SIGTERM',done);resolve()}process.once('SIGINT',done);process.once('SIGTERM',done)});
}
