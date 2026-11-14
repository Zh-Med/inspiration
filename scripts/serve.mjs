import {createServer} from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createProviderSettings} from '../server/provider-settings.mjs';
import {createApi} from '../server/api.mjs';
const root=resolve('app'),api=createApi(),providerSettings=createProviderSettings();
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 // A local read-only service; reject cross-site browser access and DNS rebinding.
 if(!['localhost','127.0.0.1','[::1]'].includes(new URL('http://'+req.headers.host).hostname)){res.writeHead(403).end();return}
 if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403).end();return}
 if(await providerSettings(req,res,url))return;
 if(await api(req,res,url))return;
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return}
 const path=resolve(root,'.'+decodeURIComponent(url.pathname));if(path!==root&&!path.startsWith(root+'/')){res.writeHead(403).end();return}
 const file=await realpath(path===root?root+'/index.html':path);if(!file.startsWith(root+'/')){res.writeHead(403).end();return}
 const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404).end('Not found')}});
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log(`Inspiration: http://localhost:${server.address().port}`));
