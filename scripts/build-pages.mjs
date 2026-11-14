import {mkdir,readFile,writeFile,copyFile,rm,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readState,dataDir} from '../server/store.mjs';
import {contentView,publicEvent,publicTool} from '../server/api.mjs';
// Explicit asset list: never recursively copy the workspace or runtime data.
export const assets=['index.html','style.css','app.js','provider-settings.js','content.js','runtime-config.js','news-dates.js','calendar.js','collection-motion.js','scene.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','sw.js'];
export async function buildPages({dir=dataDir,out=resolve('dist')}={}){
 const state=await readState(dir),view=contentView(state);
 if(!state.updatedAt||!view.stories.length)throw Error('No collected reading content; refusing to publish an empty replacement');
 const root=resolve(out);
 if(root===resolve('.')||!['dist','site'].includes(root.split('/').pop()))throw Error('Build output must be a dedicated dist or site directory');
 await rm(root,{recursive:true,force:true});await mkdir(root,{recursive:true});
 for(const name of assets){const source=resolve('app',name);if(!(await lstat(source)).isFile())throw Error('Build assets must be regular files');await copyFile(source,join(root,name))}
 await writeFile(join(root,'runtime-config.js'),"window.InspirationRuntime=Object.freeze({contentMode:'static',llmServiceUrl:''});\n");
 const json=async(path,value)=>{const target=join(root,'data',path+'.json');await mkdir(resolve(target,'..'),{recursive:true});await writeFile(target,JSON.stringify(value))};
 await json('content',view);
 await json('health',{updatedAt:state.updatedAt,status:view.status,sources:Object.values(state.sources).map(({id,status,lastCheckedAt,lastSuccessAt,error})=>({id,status,lastCheckedAt,lastSuccessAt,error})),paidCalls:0});
 for(const [date,digest] of Object.entries(view.digests))await json('digests/'+date,{...digest,stories:digest.items.map(i=>state.events[i.eventId]).filter(Boolean).map(publicEvent)});
 for(const e of view.stories)await json('items/'+e.id,e);
 for(const t of view.tools)await json('items/'+t.id,publicTool(t));
 // Shell version follows source bytes; news-only changes do not reinstall the PWA.
 const hash=createHash('sha256');for(const name of assets)hash.update(await readFile(join(root,name)));
 const sw=await readFile(join(root,'sw.js'),'utf8');await writeFile(join(root,'sw.js'),sw.replace("PREFIX+'v49'",`PREFIX+'${hash.digest('hex').slice(0,16)}'`));
 await writeFile(join(root,'.nojekyll'),'');
 const report={builtAt:new Date().toISOString(),contentUpdatedAt:state.updatedAt,stories:view.stories.length,tools:view.tools.length,issues:Object.keys(view.digests).length,status:view.status,llmConfigured:false};
 await writeFile(join(root,'build-info.json'),JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(await buildPages(),null,2))}catch(e){console.error(e.message);process.exitCode=1}}
