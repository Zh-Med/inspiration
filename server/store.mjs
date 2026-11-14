import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
export const dataDir=resolve(process.env.INSPIRATION_DATA_DIR||'data');
export const emptyState=()=>({schemaVersion:1,events:{},tools:{},sources:{},digests:{},runs:[],updatedAt:null});
export async function readState(dir=dataDir){try{const s=JSON.parse(await readFile(resolve(dir,'state.json'),'utf8'));if(s.schemaVersion!==1)throw Error('Unsupported store version');return s}catch(e){if(e.code==='ENOENT')return emptyState();throw e}}
export async function writeState(state,dir=dataDir){await mkdir(dir,{recursive:true});const tmp=resolve(dir,`state.${process.pid}.tmp`);await writeFile(tmp,JSON.stringify(state),{mode:0o600});await rename(tmp,resolve(dir,'state.json'))}
export async function withLock(fn,dir=dataDir){
 await mkdir(dir,{recursive:true});const lock=resolve(dir,'writer.lock');
 try{await writeFile(lock,String(process.pid),{flag:'wx',mode:0o600})}catch(e){if(e.code!=='EEXIST')throw e;const pid=Number(await readFile(lock,'utf8'));if(!Number.isInteger(pid)||pid<=0)throw Error('Invalid writer.lock; inspect it before recovery');try{process.kill(pid,0)}catch(err){if(err.code==='ESRCH'){
 const recovery=resolve(dir,'recovery.lock');
 try{await mkdir(recovery)}catch{throw Error('Another process is recovering the writer lock')}
 try{const current=Number(await readFile(lock,'utf8'));if(!Number.isInteger(current)||current<=0)throw Error('Invalid writer lock');let alive=true;try{process.kill(current,0)}catch(check){if(check.code==='ESRCH')alive=false;else throw check}if(alive)throw Error('A collection job is already running');await rm(lock)}finally{await rm(recovery,{recursive:true,force:true})}
 return withLock(fn,dir)
 }throw err}throw Error('A collection job is already running')}
 try{return await fn()}finally{await rm(lock,{force:true})}
}
