import {limits} from './config.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export function createFetcher({fetchImpl=fetch,sleep=wait}={}){
 return async function request(url,{etag,lastModified,maxBytes=limits.requestBytes}={}){
  const original=new URL(url);if(original.protocol!=='https:')throw Error('HTTPS source required');
  for(let attempt=0;attempt<3;attempt++){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),limits.timeoutMs);
   try{
    const headers={'User-Agent':'Inspiration/0.3 (personal read-only research radar)','Accept':original.hostname==='api.github.com'?'application/vnd.github+json':'application/atom+xml, application/rss+xml, application/xml, text/xml, text/html'};
    if(etag)headers['If-None-Match']=etag;if(lastModified)headers['If-Modified-Since']=lastModified;
    if(original.hostname==='api.github.com'){headers['X-GitHub-Api-Version']='2022-11-28';if(process.env.GITHUB_TOKEN)headers.Authorization=`Bearer ${process.env.GITHUB_TOKEN}`}
    // Only same-host HTTPS redirects; never forward credentials to another origin.
    let current=url,response;
    for(let hops=0;hops<4;hops++){
     response=await fetchImpl(current,{headers,signal:controller.signal,redirect:'manual'});
     if(![301,302,303,307,308].includes(response.status))break;
     await response.body?.cancel();const next=new URL(response.headers.get('location'),current);
     if(next.origin!==original.origin)throw Error('Cross-origin redirect needs source configuration review');current=next.href;
    }
    const meta={etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified')};
    if(response.status===304)return {notModified:true,...meta};
    if(response.status===429||response.status===403){await response.body?.cancel();const e=Error(`HTTP ${response.status}: source access/rate limited`);const reset=Number(response.headers.get('x-ratelimit-reset'))*1000;const retry=Number(response.headers.get('retry-after'))*1000;e.retryAt=new Date(Math.max(Date.now()+3600000,Number.isFinite(reset)?reset:0,Date.now()+(Number.isFinite(retry)?retry:0))).toISOString();throw e}
    if(response.status>=500&&attempt<2){await response.body?.cancel();clearTimeout(timer);await sleep(500*2**attempt);continue}
    if(!response.ok){await response.body?.cancel();throw Error(`HTTP ${response.status}`)}
    let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>maxBytes){controller.abort();throw Error('Source response too large')}chunks.push(chunk)}
    return {body:Buffer.concat(chunks).toString('utf8'),...meta};
   }catch(e){if((e.name==='AbortError'||e instanceof TypeError)&&attempt<2){clearTimeout(timer);await sleep(500*2**attempt);continue}if(e instanceof TypeError&&e.cause?.code)throw Error(`Network ${e.cause.code}`);throw e}finally{clearTimeout(timer)}
  }
 };
}
