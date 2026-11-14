import {createServer} from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {networkInterfaces} from 'node:os';
import {fileURLToPath} from 'node:url';

export function phoneAddresses(){return Object.values(networkInterfaces()).flat().filter(a=>a.family==='IPv4'&&!a.internal&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)).map(a=>a.address)}
export function createPhonePreview({root=resolve('dist'),host='127.0.0.1'}={}){
 const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
 return createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  try{
   if(new URL('http://'+req.headers.host).hostname!==host){res.writeHead(403).end();return}
   if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403).end();return}
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return}
   const path=decodeURIComponent(new URL(req.url,'http://preview').pathname);
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
 await stat(resolve('dist/index.html'));
 const server=createPhonePreview({host});server.on('error',e=>{console.error(e.message);process.exitCode=1});
 server.listen(port,host,()=>console.log(`iPhone preview: http://${host}:${server.address().port}/ — same Wi-Fi; Ctrl-C to stop`));
}
