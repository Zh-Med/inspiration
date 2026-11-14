const PREFIX='inspiration-shell-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const SHELL=PREFIX+'v52';
const FILES=['./','index.html','style.css','app.js','provider-settings.js','content.js','runtime-config.js','news-dates.js','calendar.js','collection-motion.js','scene.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==SHELL).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const relative=new URL(event.request.url).pathname.slice(new URL(self.registration.scope).pathname.length);if(relative.startsWith('api/')||relative.startsWith('data/'))return;if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request).then(c=>c||new Response('当前离线，内容尚未缓存',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}}))))});
