import {createServer} from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {networkInterfaces} from 'node:os';
import {fileURLToPath} from 'node:url';

export function phoneAddresses(){return Object.values(networkInterfaces()).flat().filter(a=>a.family==='IPv4'&&!a.internal&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)).map(a=>a.address)}
const run=promisify(execFile);
const worker='https://inspiration.landooomed.workers.dev';
// Bridge only these public GETs. iPhone LAN origins are outside the production CORS allowlist.
async function publicSummary(path){
 const {stdout}=await run('/usr/bin/curl',['-q','-fsS','--max-time','7',worker+path],{maxBuffer:512*1024});
 return JSON.parse(stdout);
}
export function createPhonePreview({root=resolve('dist'),host='127.0.0.1',getSummary=publicSummary,examples=[]}={}){
 let recent=null,expires=0,pending;
 async function readings(){
  if(recent&&expires>Date.now())return recent;
  if(!pending)pending=getSummary('/summaries').then(data=>{
   if(data.schemaVersion!==1||!Array.isArray(data.items))throw Error('Invalid response');
   const enriched=examples.filter(e=>!data.items.some(r=>r.id===e.id&&r.schemaVersion===2));
   recent={schemaVersion:1,items:[...enriched,...data.items].slice(0,30)};expires=Date.now()+60000;
   return recent;
  }).finally(()=>{pending=null});
  return pending;
 }
 const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
 return createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  try{
   if(new URL('http://'+req.headers.host).hostname!==host){res.writeHead(403).end();return}
   if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403).end();return}
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return}
   const path=decodeURIComponent(new URL(req.url,'http://preview').pathname);
   if(path==='/runtime-config.js'){
    res.writeHead(200,{'Content-Type':'text/javascript'});
    res.end(req.method==='HEAD'?undefined:`window.InspirationRuntime=Object.freeze({contentMode:'static',llmServiceUrl:'${worker}',phonePreview:true});`);
    return;
   }
   if(path==='/reading-api/summaries'||path==='/reading-api/health'){
    const id=new URL(req.url,'http://preview').searchParams.get('id');
    if(id!==null&&!/^(event|repo|tldr)-[a-f0-9]{24}$/.test(id)){res.writeHead(400).end();return}
    try{
     let data;
     if(path.endsWith('/health'))data=await getSummary('/health');
     else if(id)data=await getSummary('/summaries?id='+id);
     else data=await readings();
     res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
     res.end(req.method==='HEAD'?undefined:JSON.stringify(data));
    }catch{res.writeHead(503).end()}
    return;
   }
   if(path.split('/').some(p=>p.startsWith('.')||p.includes('\\'))){res.writeHead(404).end();return}
   const base=await realpath(root),candidate=resolve(base,'.'+path);
   if(candidate!==base&&!candidate.startsWith(base+sep)){res.writeHead(404).end();return}
   let file=await realpath(candidate);
   if((await stat(file)).isDirectory())file=await realpath(resolve(file,'index.html'));
   if(!file.startsWith(base+sep)){res.writeHead(404).end();return}
   const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404).end()}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const addresses=phoneAddresses(),host=process.env.PREVIEW_HOST||addresses[0],port=Number(process.env.PREVIEW_PORT||4174);
 if(!host||!addresses.includes(host))throw Error('Set PREVIEW_HOST to this Mac’s private Wi-Fi IPv4 address.');
 const root=resolve(process.env.PREVIEW_ROOT||'dist');
 await stat(resolve(root,'index.html'));
 const examples=process.env.PREVIEW_READINGS?JSON.parse(await readFile(process.env.PREVIEW_READINGS,'utf8')):[];
 const server=createPhonePreview({host,root,examples});server.on('error',e=>{console.error(e.message);process.exitCode=1});
 server.listen(port,host,()=>console.log(`iPhone preview: http://${host}:${server.address().port}/ — same Wi-Fi; Ctrl-C to stop`));
}
