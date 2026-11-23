const icons={settings:'<path d="M4 6h16M4 12h16M4 18h16"/>',today:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h4"/>',tools:'<path d="M12 3v18M3 12h18M6 6l12 12M6 18L18 6"/>',bookmark:'<path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4Z"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',back:'<path d="m14 5-7 7 7 7"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',check:'<path d="m5 12 4 4L19 6"/>',external:'<path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',book:'<path d="M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z"/>',chart:'<path d="M4 3v17h17M8 15l4-5 4 2 5-7"/>',pen:'<path d="m4 16 12-12 4 4L8 20H4Zm9-9 4 4"/>'};
document.addEventListener('load',e=>{const image=e.target;if(!image.classList?.contains('paper-raster'))return;image.decode().then(()=>{if(!image.isConnected||image.closest('.collection-transition'))return;const page=image.closest('.paper');image.style.opacity=page.querySelector('.paper-select').style.opacity||'1';page.hasRasterTexture=true;page.classList.add('has-raster');queueDeckPaint()}).catch(()=>{})},true);
const breathTexture=new Image();breathTexture.src='paper-breath.webp';breathTexture.decode().then(()=>document.documentElement.classList.add('has-breath-texture')).catch(()=>{});
const icon=n=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[n]||icons.tools}</svg>`;
// Live source records; the empty state never falls back to fictional news.
const stories=[],tools=[];
let contentStatus='loading',contentUpdatedAt=null,pendingContent=null,pendingResumeRefresh=false,contentRefreshTimer=0;
const issueMetadata={};
let tldrIssue=null;
const $=s=>document.querySelector(s);const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let persistence=true;function load(k,fallback){try{return JSON.parse(localStorage.getItem('inspiration:'+k))??fallback}catch{return fallback}}function save(k,v){try{localStorage.setItem('inspiration:'+k,JSON.stringify(v));return true}catch{persistence=false;toast('浏览器存储不可用，本次更改仅在当前页面保留');return false}}
let bookmarks=load('bookmarks',[]),prefs=load('prefs',{theme:'system',large:false}),reading=load('reading',[]),active='today',filter='全部',query='',positions={},returnRoute='today',toastTimer;
if(!Array.isArray(bookmarks))bookmarks=[];if(!Array.isArray(reading))reading=[];if(!prefs||typeof prefs!=='object')prefs={theme:'system',large:false};
function applyPrefs(){document.documentElement.dataset.theme=prefs.theme;document.body.classList.toggle('reading-large',!!prefs.large)}applyPrefs();
$('#navigation-button').innerHTML=icon('arrow');$('#settings .sheet-head button').innerHTML=icon('close');
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2500)}
function bookmark(id){const on=bookmarks.includes(id);return `<button class="icon-button ${on?'saved':''}" data-save="${id}" aria-label="${on?'取消收藏':'收藏'}" aria-pressed="${on}">${icon('bookmark')}</button>`}
function row(s){return `<article class="story"><div class="story-top"><span class="category">${esc(s.category)}</span>${bookmark(s.id)}</div><a class="story-link" href="#story/${s.id}"><h3>${esc(s.title)}</h3><p>${esc(s.summary)}</p></a><div class="meta"><span>${esc(s.source)}</span><span>·</span><span>${esc(s.read)}</span></div></article>`}
function toolRow(t){return `<article class="tool-row"><a href="#tool/${t.id}"><div class="tool-title"><div class="tool-mark">${icon(t.mark)}</div><div><h3>${esc(t.name)}</h3><span>${esc(t.english)}</span></div></div><p>${esc(t.summary)}</p></a><div class="tool-row-footer"><span class="tag">${esc(t.category)} · 未实测</span>${bookmark(t.id)}</div></article>`}
function intro(title,desc){return `<section class="intro"><div class="date">Inspiration <span></span> 阅读与收藏</div><h1>${title}</h1><p>${desc}</p></section>`}
const contentCards=[...stories,...tools];
let shelfKind='today',shelfDate=null,shelfContent=contentCards;
const shelfPositions={today:0,tools:0};
let deckCards=[];
function selectShelf(kind,date=null){
 if(kind!=='today')date=null;
 const oldKey=shelfKind==='today'?`news/${shelfDate}`:shelfKind,nextKey=kind==='today'?`news/${date}`:kind;
 if(nextKey!==oldKey){shelfPositions[oldKey]=deckProgress;stopDeck();deckDrag=null;shelfKind=kind;shelfDate=date;deckProgress=shelfPositions[nextKey]||0;deckIndex=Math.round(deckProgress);deckGlow=0}
 shelfContent=kind==='today'?(newsByDate[date]||[]):(collections.find(c=>c.id===kind)?.items||[]);
 deckCards=[...shelfContent,...Array.from({length:5},(_,i)=>({id:`blank-${i}`,blank:true}))];
 deckProgress=Math.max(0,Math.min(deckCards.length-1,deckProgress));
}
let deckIndex=0,deckProgress=0,deckFrame=0,deckPaintFrame=0,deckDrag=null,deckVelocity=0,deckLastTime=0,deckTarget=null,suppressUntil=0,deckWheelTimer=0,deckGlow=0,deckPointerY=.45;
const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
// Restore the previous champagne palette; blank leaves gradually lose warmth.
function paperMaterial(index){
 const fade=index<shelfContent.length?0:[.12,.32,.55,.8,1][index-shelfContent.length];
 const gold=[[150,139,122],[206,192,169],[228,216,195],[182,165,138]];
 const white=[[179,181,179],[229,232,229],[251,252,248],[205,210,207]];
 const tones=gold.map((rgb,i)=>rgb.map((v,c)=>Math.round(v+(white[i][c]-v)*fade)).join(','));
 const tint=[.55,.64,.68,.56],milk=[.68,.78,.82,.70];
 return tones.map((rgb,i)=>`--paper-${i}:rgba(${rgb},${(tint[i]+(milk[i]-tint[i])*fade).toFixed(3)})`).join(';')+`;--paper-solid:rgb(${tones[1]})`;
}
// Issues are keyed by their Beijing 08:00 coverage window.
const newsByDate={};
function shelfKindForRoute(route){return NewsDates.route(route)?'today':collections.some(c=>c.id===route)?route:null}
NewsCalendar.configure({today:()=>NewsDates.today(),selected:()=>NewsDates.route(location.hash.slice(1)||'today')||shelfDate||NewsDates.today(),available:()=>Object.keys(newsByDate)});
document.addEventListener('news-date-selected',e=>{const date=e.detail?.date;if(!NewsDates.parse(date))return;const next=`news/${date}`;if(location.hash.slice(1)===next)$('#main').focus({preventScroll:true});else location.hash=next});

const collections=[
 {id:'today',name:'News',keywords:'日报 新闻 Hardware People Models Interactions Apps 显卡 芯片 算力 行业人物 新模型 新交互 趣味应用',items:stories},
 {id:'tools',name:'Skills',keywords:'科研 工具 Workflows 工作流',items:tools},
 {id:'medicine',name:'Medicine',keywords:'AI 医学 Neuroscience Psychology 神经生物学 脑科学 心理学',items:[]},
 {id:'tldr',name:'TLDR',keywords:'English Technology Daily',items:[]}
].map(c=>({...c,updatedAt:null}));
function collectionCards(){
 const matches=collections.filter(c=>(c.name+' '+(c.keywords||'')).toLowerCase().includes(query.trim().toLowerCase()));
 return matches.length?matches.map(c=>`<a class="collection-card" href="#${c.id}" style="view-transition-name:shelf-${c.id}"><h2>${esc(c.name)}</h2><div class="collection-updated">${c.updatedAt?`<time datetime="${c.updatedAt}" aria-label="内容最后更新 ${new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit'}).format(new Date(c.updatedAt))}">${new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit'}).format(new Date(c.updatedAt))}</time>`:'<span class="no-update" aria-label="尚无内容更新">—</span>'}</div></a>`).join(''):'<p class="collection-empty" role="status">没有匹配的收藏夹</p>';
}
function collectionOverview(){return `<section class="collection-overview" aria-label="收藏夹总览"><label class="search collection-search">${icon('search')}<input type="search" id="collection-search" placeholder="搜索" aria-label="搜索收藏夹" value="${esc(query)}"></label><div class="collection-grid" id="collection-results">${collectionCards()}</div></section>`}
function emptyNewsMessage(date){const issue=issueMetadata[date];if(contentStatus==='loading')return '正在读取日报…';if(contentStatus==='unavailable')return '暂时无法连接内容服务，且本机没有缓存。';if(contentStatus==='not-collected')return '尚未完成首次采集。';if(issue?.status==='unavailable')return '本期来源采集失败，暂时无法生成日报。';if(issue?.status==='partial')return '部分来源采集失败，暂未收录有效条目。';if(issue?.status==='empty')return '本期覆盖时段内没有符合条件的新内容。';return '这一天尚未生成日报。'}
function today(){
 const dateLabel=shelfKind==='tldr'&&tldrIssue?`<time class="news-date-label" datetime="${tldrIssue.date}" aria-label="TLDR collection ${tldrIssue.date}">${tldrIssue.date.slice(5).replace('-','/')}</time>`:shelfKind==='today'?`<time class="news-date-label" datetime="${shelfDate}" aria-label="News ${shelfDate}">${shelfDate.slice(5).replace('-','/')}</time>`:'';
 if(shelfKind==='tldr'&&!shelfContent.length)return `<section class="deck-page" aria-label="TLDR"><div class="news-empty"><h1>TLDR</h1><p>${contentStatus==='loading'?'Loading…':contentStatus==='unavailable'?'Unable to load. Connect and try again.':'No collected stories yet.'}</p>${safeLink('https://tldr.tech/','Open TLDR')}</div></section>`;
 if(shelfKind==='today'&&!shelfContent.length)return `<section class="deck-page" aria-label="News ${shelfDate}">${dateLabel}<div class="news-empty"><h1>News</h1><time datetime="${shelfDate}">${shelfDate.replaceAll('-','/')}</time><p>${esc(emptyNewsMessage(shelfDate))}</p><button type="button" data-calendar-open>选择日期</button></div></section>`;
 return `<section class="deck-page" style="view-transition-name:shelf-${shelfKind}" aria-label="${collections.find(c=>c.id===shelfKind)?.name||'News'}">${dateLabel}<div class="deck-stage tunnel" tabindex="0" aria-label="拖动浏览书架，左右方向键切换，点选金色纸面阅读">${deckCards.map((t,i)=>`<article class="paper${t.blank?' is-empty':''}" data-card="${i}" style="${paperMaterial(i)};--wave-order:${i}"><img class="paper-raster" src="${i<shelfContent.length?'paper-gold.webp':`paper-blank-${i-shelfContent.length+1}.webp`}" alt="" aria-hidden="true" decoding="async" draggable="false"><div class="paper-shadow"></div><div class="paper-face"><div class="paper-material"></div><div class="paper-shade"></div><div class="paper-light"></div><div class="paper-reflection"></div><div class="paper-breath"></div><div class="paper-edge"></div><button class="paper-select" data-deck="${i}" aria-label="${t.blank?'空白纸页，没有内容':esc(t.title||t.name)}">${t.blank?'':`<span class="paper-spine">${esc(t.name||t.english)}</span>`}</button></div></article>`).join('')}</div></section>`
}
// Web adaptation of REA's position response: user-requested gentler angles.
// Spacing, lighting, translucency and damping are authored for this PWA.
function bookshelfEffect(minX,extent){
 const offset=Math.min(-minX*.8,-minX*1.4);
 return {scale:Math.max(.38,1+offset/(extent*4.4)),angle:offset/46};
}
// Rebuilt only when the live shelf is replaced; snapshots never share this cache.
let deckPaintCache=null;
document.documentElement.classList.toggle('paper-blur-off',new URLSearchParams(location.search).get('paper-blur')==='off');
function resetDeckPaintCache(){deckPaintCache?.observer?.disconnect();deckPaintCache=null}
function getDeckPaintCache(){
 if(deckPaintCache?.stage.isConnected)return deckPaintCache;
 resetDeckPaintCache();const stage=$('.tunnel');if(!stage)return null;
 const pages=[...stage.querySelectorAll('.paper')].map((el,i)=>{
  el.style.zIndex=String(100-i);el.style.opacity='1';el.style.visibility='hidden';el.inert=true;el.setAttribute('aria-hidden','true');
  const button=el.querySelector('[data-deck]');button.setAttribute('aria-pressed','false');
  const layers={paper:el,select:button};for(const name of ['material','shade','light','reflection','breath','edge','shadow','raster'])layers[name]=el.querySelector('.paper-'+name);
  return {el,button,layers,values:Object.create(null)};
 });
 const cache={stage,pages,width:stage.clientWidth,visible:new Set(),front:null,selected:null,observer:null,moving:false,lastMaterialTime:-Infinity,solid:matchMedia('(prefers-reduced-transparency: reduce)')};
 if(typeof ResizeObserver!=='undefined'){
  cache.observer=new ResizeObserver(()=>{if(deckPaintCache!==cache)return;const width=stage.clientWidth;if(width!==cache.width){cache.width=width;queueDeckPaint()}});
  cache.observer.observe(stage);
 }
 return deckPaintCache=cache;
}
const DECK_MATERIAL_INTERVAL=1000/18;
function setDeckLayer(page,layer,property,value){
 const key=layer+'.'+property;
 if(page.values[key]!==value){page.values[key]=value;page.layers[layer].style[property]=value}
}
// Lighting samples latest geometry at 18 Hz; no independent timer or animation loop.
function paintDeckMaterials(cache,indices){
 for(const i of indices){
  const page=cache.pages[i],{q,effect}=page.pose;
  if(i===cache.front){
   const phase=q*.6+deckProgress*.42;
   setDeckLayer(page,'light','transform',`translate(${((Math.sin(phase)*8+deckGlow*5)/1.36).toFixed(3)}%,${((deckPointerY*15+Math.cos(q*.5)*4-7)/1.36).toFixed(3)}%)`);
   setDeckLayer(page,'reflection','transform',`translateX(${((Math.sin(phase)*6+deckGlow*5)/1.7).toFixed(3)}%) rotate(${(effect.angle*.45+deckGlow*4).toFixed(3)}deg)`);
   page.lightGain=.22+.14*Math.exp(-Math.pow((q-1.8)/2.5,2));
   page.shadeGain=.12+.08*Math.min(1,Math.abs(q-1.5)/4);
  }
  const boost=1+.5*(1-Math.min(Math.max(q,0),Math.max(1,shelfContent.length-1))/Math.max(1,shelfContent.length-1));
  page.breathGain=.58*boost*2/3;
 }
}
// Visibility fade belongs to motion: retain smooth entry/exit between light samples.
function paintDeckFade(cache,i){
 const page=cache.pages[i],fade=page.pose.fade;
 const alpha=value=>value.toFixed(4);
 const raster=page.el.hasRasterTexture&&!cache.solid.matches&&i!==cache.front;
 if(raster)setDeckLayer(page,'raster','opacity',alpha(fade));
 else{
  setDeckLayer(page,'material','opacity',alpha((cache.solid.matches?1:.96)*fade));
  for(const layer of ['edge','shadow'])setDeckLayer(page,layer,'opacity',alpha(fade));
 }
 setDeckLayer(page,'select','opacity',alpha(fade));
 if(i===cache.front){
  setDeckLayer(page,'light','opacity',alpha(page.lightGain*fade));
  setDeckLayer(page,'reflection','opacity',alpha(.34*fade));
  setDeckLayer(page,'shade','opacity',alpha(page.shadeGain*fade));
 }
 setDeckLayer(page,'breath','opacity',alpha(page.breathGain*fade));
}
function paintDeck(time=performance.now()){
 const cache=getDeckPaintCache();if(!cache||!cache.pages.length)return;
 const {stage,pages}=cache,w=cache.width;
 const nearest=Math.max(0,Math.min(deckCards.length-1,Math.round(deckProgress)));
 const speed=reduceMotion()?0:Math.max(-1,Math.min(1,deckVelocity*85));
 deckGlow+=(speed-deckGlow)*.24;
 const trailingShift=Math.max(0,3-(deckCards.length-1-deckProgress))*.18;
 const moving=!!deckDrag?.moved||!!deckFrame||!!deckWheelTimer;
 if(cache.moving!==moving){stage.classList.toggle('is-moving',moving);cache.moving=moving}
 const first=Math.max(0,Math.ceil(deckProgress-.85)),last=Math.min(pages.length-1,Math.floor(deckProgress+7.5));
 const visible=new Set();for(let i=first;i<=last;i++)visible.add(i);
 for(const i of cache.visible){if(!visible.has(i)){const el=pages[i].el;el.style.visibility='hidden';el.inert=true;el.setAttribute('aria-hidden','true')}}
 // Keep one real-blur surface stable while a finger jitters across the selection midpoint.
 // Selection still follows the original nearest-page rule; only material ownership has hysteresis.
 const foreground=moving&&cache.front!==null&&visible.has(cache.front)&&Math.abs(deckProgress-cache.front)<=.62?cache.front:nearest;
 const foregroundChanged=cache.front!==foreground;
 if(foregroundChanged){
  if(cache.front!==null)pages[cache.front].el.classList.remove('is-front');
  pages[foreground].el.classList.add('is-front');cache.front=foreground;
 }
 if(cache.selected!==nearest){
  if(cache.selected!==null)pages[cache.selected].button.setAttribute('aria-pressed','false');
  pages[nearest].button.setAttribute('aria-pressed','true');cache.selected=nearest;
 }
 const fresh=[];
 for(const i of visible){
  const page=pages[i],el=page.el,q=i-deckProgress,depth=Math.max(-1.8,q);
  if(!cache.visible.has(i)){el.style.visibility='visible';el.inert=false;el.setAttribute('aria-hidden','false');fresh.push(i)}
  const effect=bookshelfEffect(depth*w*.19,w);
  const x=w*(-.78+depth*.19+trailingShift),y=depth*13;
  setDeckLayer(page,'paper','transform',`translate3d(${x.toFixed(3)}px,${y.toFixed(3)}px,0) rotateZ(${effect.angle.toFixed(4)}deg) scale(${effect.scale.toFixed(5)})`);
  // Keep this backdrop ancestor opaque: crossing opacity 1 changes its backdrop root.
  const fade=Math.min(1,Math.max(0,1+(q+.4)/.45),Math.max(0,(7.5-q)/.75));
  page.pose={q,effect,fade};
 }
 if(!moving||time-cache.lastMaterialTime>=DECK_MATERIAL_INTERVAL){
  paintDeckMaterials(cache,visible);cache.lastMaterialTime=time;
 }else{
  // A newly exposed foreground must not inherit another page's stale lighting.
  if(foregroundChanged&&!fresh.includes(foreground))fresh.push(foreground);
  if(fresh.length)paintDeckMaterials(cache,fresh);
 }
 for(const i of visible)paintDeckFade(cache,i);
 cache.visible=visible;
 if(deckIndex!==nearest||!stage.dataset.selection){
  deckIndex=nearest;stage.dataset.selection=String(nearest+1);
  const t=deckCards[nearest],label=t.blank?'空白纸页，没有内容':(t.title||t.name).replace('\n','');
  stage.setAttribute('aria-label',`书架，第 ${nearest+1} 项，共 ${deckCards.length} 项：${label}。左右方向键切换，点选金色纸面阅读`);
 }
}
function queueDeckPaint(){if(!deckPaintFrame)deckPaintFrame=requestAnimationFrame(time=>{deckPaintFrame=0;paintDeck(time)})}
function stopDeck(){cancelAnimationFrame(deckFrame);cancelAnimationFrame(deckPaintFrame);clearTimeout(deckWheelTimer);deckWheelTimer=0;deckFrame=0;deckPaintFrame=0;deckVelocity=0;deckTarget=null;if(deckPaintCache?.moving){deckPaintCache.stage.classList.remove('is-moving');deckPaintCache.moving=false;}}
// Drag starts in the uncompressed coordinate so interrupting an edge spring is continuous.
function dragCoordinate(position,max){return position<0?position/.18:position>max?max+(position-max)/.18:position}
function rubberBand(position,max){return position<0?position*.18:position>max?max+(position-max)*.18:position}
function freezeDeck(){
 const drag=deckDrag;deckDrag=null;
 if(drag?.stage.hasPointerCapture(drag.id))drag.stage.releasePointerCapture(drag.id);
 if(drag?.moved)suppressUntil=performance.now()+350;
 stopDeck();
}
function animateDeck(time){
 if(!$('.tunnel')){stopDeck();return}
 const dt=Math.min(32,time-deckLastTime||16);deckLastTime=time;
 if(deckTarget!==null){
  // Critically damped settling preserves release velocity and remains interruptible.
  const displacement=deckProgress-deckTarget,tau=105,decay=Math.exp(-dt/tau);
  const c=deckVelocity+displacement/tau;
  deckProgress=deckTarget+(displacement+c*dt)*decay;
  deckVelocity=(deckVelocity-c*dt/tau)*decay;
  if(Math.abs(deckProgress-deckTarget)<.001&&Math.abs(deckVelocity)<.00002){
   deckProgress=deckTarget;deckVelocity=0;deckTarget=null;deckFrame=0;deckGlow=0;paintDeck(time);return;
  }
 }else{
  deckProgress+=deckVelocity*dt;deckVelocity*=Math.exp(-dt/270);
  if(deckProgress<0||deckProgress>deckCards.length-1)deckTarget=Math.max(0,Math.min(deckCards.length-1,deckProgress));
  else if(Math.abs(deckVelocity)<.0003)deckTarget=Math.round(deckProgress);
 }
 paintDeck(time);deckFrame=requestAnimationFrame(animateDeck);
}
function turnDeck(index){stopDeck();const next=Math.max(0,Math.min(deckCards.length-1,index));if(reduceMotion()){deckProgress=next;paintDeck();return}deckTarget=next;deckLastTime=performance.now();deckFrame=requestAnimationFrame(animateDeck);}
function list(kind){const saved=kind==='saved';return intro(saved?'留下值得再看的。':'把好工具，用在对的地方。',saved?'收藏你的线索，让下一次查找更轻松。':'从文献到写作，每次只改进一个步骤。')+`<label class="search">${icon('search')}<input type="search" id="search" aria-label="${saved?'搜索收藏':'搜索工作流'}" placeholder="${saved?'搜索已收藏内容':'搜索任务或工作流'}" value="${esc(query)}"></label><div class="filters" aria-label="筛选">${(saved?['全部','新闻','工具']:['全部','文献','分析','写作']).map(x=>`<button data-filter="${x}" aria-pressed="${filter===x}">${x}</button>`).join('')}</div><div id="results">${results(kind)}</div>`}
function results(kind){const match=t=>(t.title||t.name)+t.summary+t.english;const news=stories.filter(t=>bookmarks.includes(t.id)&&match(t).toLowerCase().includes(query.toLowerCase()));const ts=tools.filter(t=>(kind!=='saved'||bookmarks.includes(t.id))&&match(t).toLowerCase().includes(query.toLowerCase())&&(kind==='saved'||filter==='全部'||filter===t.category));let html=kind==='saved'?(filter!=='工具'?news.map(row).join(''):'')+(filter!=='新闻'?ts.map(toolRow).join(''):''):ts.map(toolRow).join('');return html||`<div class="empty">${icon(kind==='saved'?'bookmark':'search')}<h2>${query?'没有找到匹配内容':kind==='saved'?'好内容，留给下次。':'这个分类暂时没有内容'}</h2><p>${query?'换个关键词，再试一次。':'轻点文章或工具旁的收藏按钮，就能在这里找到。'}</p>${!query&&kind==='saved'?'<a class="primary" href="#today">去看看今日</a>':''}</div>`}
const evidenceLabels={'official-claim':'官方主张 · 未独立验证','publisher-claim':'发布方主张','publisher-curated':'官方封面关联 · 研究类型待核对','media-report':'媒体报道 · 非独立核实','author-commentary':'作者实践与观点','community-observation':'社区讨论 · 未经核实','preprint':'预印本 · 未经同行评议','title-only':'仅标题 · 待核实','repository-metadata':'GitHub 元数据 · 未实测'};
function safeLink(url,label,showIcon=true){try{const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)return '';return `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(label)}${showIcon?' '+icon('external'):''}</a>`}catch{return ''}}
function dateText(value){return value?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'未提供'}
function newsDateText(value){return value&&Number.isFinite(Date.parse(value))?NewsDates.today(new Date(value)):'未提供日期'}
function readmeSummary(excerpt){
 if(!excerpt)return '';
 let text=excerpt;
 const heading=text.search(/(?:^|\s)#{1,2}\s/);if(heading>=0&&heading<250)text=text.slice(heading);
 text=text.replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\*\*|__|`|#{1,6}\s|(?:^|\s)>\s*/g,' ').replace(/&middot;/g,'·').replace(/\s+/g,' ').trim();
 text=text.split(/\b(?:Languages|Table of Contents):/i)[0].trim();
 const summary=text.split(/(?<=[.!?])\s+(?=[A-Z])/).slice(0,3).join(' ').trim();
 return summary.length>650?summary.slice(0,647).trimEnd()+'…':summary;
}
function currentReadingItem(){
 const route=location.hash.slice(1)||'today';
 const [kind,id]=route.split('/');
 if(kind==='story'||kind==='tool')return (kind==='tool'?tools:stories).find(item=>item.id===id);
 if(shelfKindForRoute(route))return shelfContent[Math.round(deckProgress)];
}
function detail(id,isTool){
 const t=(isTool?tools:stories).find(x=>x.id===id);
 if(!t)return intro('这条内容尚未载入。','联网后可重新打开；离线时仅保留已缓存与收藏的内容。')+'<a class="primary" href="#today">返回今日</a>';
 if(!reading.includes(id)){reading.push(id);save('reading',reading)}
 if(t.collection==='tldr')return `<article class="article news-article" lang="en"><h1>${esc(t.title)}</h1><div class="news-byline"><span class="news-source">${safeLink(t.url,'TLDR',false)}</span><time datetime="${esc(t.collectedAt)}">Collected ${esc(t.selectionDate)}</time></div><section class="news-summary" aria-label="Original excerpt"><h2>Original excerpt</h2><p>${esc(t.summary||'Open TLDR to read this story.')}${t.excerptTruncated&&t.summary?'…':''}</p><p>${safeLink(t.url,'Read on TLDR')} · ${safeLink(t.originalUrl,'Original article')}</p></section></article>`;
 if(!isTool)return `<article class="article news-article"><h1>${esc(t.title)}</h1><div class="news-byline"><span class="news-source">${safeLink(t.url,t.source,false)||esc(t.source)}</span><time datetime="${esc((t.coverConfirmed?t.articlePublishedAt:t.publishedAt)||'')}">${t.coverConfirmed?'论文发表于 ':''}${esc(newsDateText(t.coverConfirmed?t.articlePublishedAt:t.publishedAt))}</time>${t.coverConfirmed?`<span>${safeLink(t.coverEvidenceUrl,'封面 · '+(t.issueMonth||newsDateText(t.issuePublishedAt)),false)}</span>`:''}</div><section class="news-summary" aria-label="摘要"><h2>${t.generatedSummary?'AI 摘要 · 基于来源摘录':'来源摘录'}</h2><p>${esc(t.generatedSummary?.text||t.summary||'来源暂未提供摘要。')}</p>${t.generatedSummary?`<h2>来源摘录</h2><p>${esc(t.summary||t.body||'')}</p>`:''}</section></article>`;
 const repo=t.fullName||t.name||t.english;
 const title=t.title||repo.split('/').pop();
 const updated=t.pushedAt||t.publishedAt;
 const number=value=>Number.isFinite(value)?new Intl.NumberFormat('en-US').format(value):'—';
 const trend=t.scoring?.deltaDays&&Number.isFinite(t.scoring.starDelta)?`${t.scoring.deltaDays} 天内 ${t.scoring.starDelta>0?'+':''}${number(t.scoring.starDelta)} Stars`:'尚无跨日观测，暂不能判断趋势。';
 const readme=readmeSummary(t.readmeExcerpt);
 return `<article class="article news-article skill-article"><div class="skill-heading"><h1>${esc(title)}</h1>${bookmark(t.id)}</div><div class="news-byline skill-byline"><span class="news-source">${safeLink(t.url,repo,false)||esc(repo)}</span><time datetime="${esc(updated||'')}" aria-label="最近代码更新 ${esc(newsDateText(updated))}">${esc(newsDateText(updated))}</time></div><dl class="repo-counts"><div><dt>Stars</dt><dd>${number(t.stars)}</dd></div><div><dt>Forks</dt><dd>${number(t.forks)}</dd></div></dl><section class="star-trend" aria-label="Star 趋势"><h2>Star 趋势</h2><p>${esc(trend)}</p></section><section class="news-summary readme-summary" aria-label="README 摘要"><h2>README 摘要</h2><p>${esc(readme||'尚未收录此仓库的 README 摘要。')}</p>${!readme&&t.summary?`<p class="repo-description">${esc(t.summary)}</p>`:''}</section></article>`;
}
function applyContent(data){
 contentStatus=data.status;contentUpdatedAt=data.updatedAt;
 const saved=Content.saved;
 stories.splice(0,stories.length,...data.stories,...Object.values(data.tldrIssues||{}).flatMap(i=>i.items),...saved.filter(x=>x.collection!=='tools'&&!data.stories.some(s=>s.id===x.id)&&!Object.values(data.tldrIssues||{}).some(i=>i.items.some(s=>s.id===x.id))));
 tools.splice(0,tools.length,...data.tools,...saved.filter(x=>x.collection==='tools'&&!data.tools.some(t=>t.id===x.id)));
 for(const key of Object.keys(newsByDate))delete newsByDate[key];
 for(const key of Object.keys(issueMetadata))delete issueMetadata[key];
 for(const [date,issue] of Object.entries(data.digests)){issueMetadata[date]=issue;newsByDate[date]=issue.items.map(i=>stories.find(s=>s.id===i.eventId)).filter(Boolean)}
 tldrIssue=Object.values(data.tldrIssues||{}).sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
 collections[3].items=tldrIssue?.items||[];
 collections[0].items=stories.filter(s=>s.collection!=='tldr');collections[1].items=data.tools;collections[2].items=data.recommendations?data.recommendations.medicine.map(p=>stories.find(s=>s.id===p.id)).filter(Boolean):stories.filter(s=>s.collection==='medicine');
 for(const c of collections)c.updatedAt=c.items.length?(c.id==='tldr'?tldrIssue?.updatedAt:data.updatedAt):null;
}
applyContent(Content.snapshot);
document.addEventListener('content-storage-warning',()=>toast('本机存储空间不足，部分内容未能离线保存；请导出重要收藏'));
function contentRefreshBusy(){return newsLaunch||routeTransition||deckDrag||deckFrame||deckWheelTimer}
function flushResumedContent(){
 clearTimeout(contentRefreshTimer);contentRefreshTimer=0;
 if(!pendingContent||!pendingResumeRefresh||document.hidden||$('.article'))return;
 if(contentRefreshBusy()){contentRefreshTimer=setTimeout(flushResumedContent,200);return}
 const data=pendingContent;pendingContent=null;pendingResumeRefresh=false;applyContent(data);render(true);
}
document.addEventListener('content-update',e=>{
 const data=e.detail,resumed=e.refreshReason==='resume';
 const route=location.hash.slice(1)||'today';
 if(resumed&&data.updatedAt===contentUpdatedAt&&data.status===contentStatus&&!(route==='today'&&shelfDate!==NewsDates.today()))return;
 if(contentRefreshBusy()||$('.article')||(!resumed&&route!=='collections'&&shelfKindForRoute(route)&&shelfContent.length)){
  pendingContent=data;pendingResumeRefresh=pendingResumeRefresh||resumed;
  if(pendingResumeRefresh)flushResumedContent();return;
 }
 pendingContent=null;pendingResumeRefresh=false;applyContent(data);render(true);
});
function renderContent(restore=false){freezeDeck();resetDeckPaintCache();if(pendingContent&&!deckDrag){applyContent(pendingContent);pendingContent=null;pendingResumeRefresh=false}const route=location.hash.slice(1)||'today';Content.ensure(route);const parts=route.split('/');const kind=shelfKindForRoute(route),isShelf=!!kind;document.documentElement.classList.toggle('navigation-locked',isShelf||route==='collections');document.body.classList.toggle('deck-view',isShelf);document.body.classList.toggle('collections-view',route==='collections');document.body.classList.toggle('news-reading',['story','tool'].includes(parts[0]));if(isShelf){selectShelf(kind,NewsDates.route(route));returnRoute=route}const nav=$('#navigation-button');nav.hidden=route==='collections';nav.innerHTML=icon('back');nav.setAttribute('aria-label',isShelf?'返回收藏夹总览':'返回书架');nav.title=nav.getAttribute('aria-label');$('.brand').textContent='Inspiration';active=['today','tools','saved'].includes(parts[0])?parts[0]:active;$('#main').innerHTML=parts[0]==='news'&&!isShelf?intro('Invalid date','请选择一个有效日期。')+'<button type="button" data-calendar-open>选择日期</button>':parts[0]==='story'?detail(parts[1],false):parts[0]==='tool'?detail(parts[1],true):route==='collections'?collectionOverview():isShelf?today():list(active);$('#main').classList.remove('page-enter');void $('#main').offsetWidth;if(!document.body.classList.contains('collection-transition-active'))$('#main').classList.add('page-enter');if(isShelf)paintDeck();else stopDeck();if(!navigator.onLine&&!isShelf)$('#main').insertAdjacentHTML('afterbegin','<div class="offline" role="status">当前离线 · 正在阅读已缓存内容</div>');requestAnimationFrame(()=>{window.scrollTo(0,restore?positions[route]||0:0);if(parts.length>1)$('#main').focus({preventScroll:true})});}
let renderedRoute=null,routeTransition=null,newsLaunch=null;
function cancelNewsLaunch(){newsLaunch?.motion.finish()}
function render(restore=false){
 const next=location.hash.slice(1)||'today';
 // Never detach the captured surface or reset material animations during a gesture.
 if(next===renderedRoute&&$('.tunnel')&&(deckDrag||deckFrame||deckWheelTimer))return;
 if(next!==renderedRoute)window.NewsCalendar?.close(false);
 if(newsLaunch){
  if(renderedRoute===next)return;
  if(next===newsLaunch.from||next===newsLaunch.to){
   renderContent(restore);renderedRoute=next;
   if(newsLaunch.destination!==next){newsLaunch.destination=next;newsLaunch.motion.reverse()}
   return;
  }
  cancelNewsLaunch();
 }
 if(routeTransition&&renderedRoute===next)return;
 const previous=renderedRoute;
 const entering=previous==='collections'&&!!shelfKindForRoute(next);
 const leaving=next==='collections'&&!!shelfKindForRoute(previous);
 routeTransition?.skipTransition();
 if((entering||leaving)&&!reduceMotion()&&window.CollectionMotion&&Element.prototype.animate){
  const kind=shelfKindForRoute(entering?next:previous);
  const before=CollectionMotion.capture();
  let source=entering?CollectionMotion.card($(`.collection-card[href="#${kind}"]`)):null;
  document.body.classList.add('collection-transition-active');
  renderContent(restore);renderedRoute=next;
  document.dispatchEvent(new Event('collectionsceneupdate'));
  if(leaving)source=CollectionMotion.card($(`.collection-card[href="#${kind}"]`));
  if(source){
   const after=CollectionMotion.capture(),launch={from:previous,to:next,destination:next};
   newsLaunch=launch;
   try{
    launch.motion=CollectionMotion.play({overview:entering?before:after,shelf:entering?after:before,source,entering,onFinish(){
     if(newsLaunch!==launch)return;
     newsLaunch=null;
     if(!document.hidden&&!window.NewsCalendar?.isOpen())(renderedRoute==='collections'?$(`.collection-card[href="#${kind}"]`):$('#main'))?.focus({preventScroll:true});
    }});
   }catch(error){
    newsLaunch=null;document.body.classList.remove('collection-transition-active');
    $('.app').style.removeProperty('opacity');$('.app').style.removeProperty('pointer-events');$('#main').inert=false;$('#navigation-button').style.removeProperty('pointer-events');
    const overlay=document.querySelector('.collection-transition');overlay?.getAnimations({subtree:true}).forEach(a=>a.cancel());overlay?.remove();
    console.error('Collection transition failed',error);
   }
   return;
  }
  document.body.classList.remove('collection-transition-active');
  return;
 }
 const changingShelf=previous!==null&&previous!==next&&(previous==='collections'||next==='collections');
 if(changingShelf&&!reduceMotion()&&document.startViewTransition){
  routeTransition=document.startViewTransition(()=>renderContent(restore));
  const transition=routeTransition;
  transition.finished.catch(()=>{}).finally(()=>{if(routeTransition===transition)routeTransition=null});
 }else renderContent(restore);
 renderedRoute=next;
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&newsLaunch){e.preventDefault();history.back()}});
window.addEventListener('resize',()=>cancelNewsLaunch());
let currentRoute=location.hash.slice(1)||'today';window.addEventListener('scroll',()=>{positions[currentRoute]=scrollY},{passive:true});window.addEventListener('hashchange',()=>{const next=location.hash.slice(1)||'today';if(!next.includes('/')){if(next!==currentRoute){filter='全部';query=''}}else if(!currentRoute.includes('/'))returnRoute=currentRoute;currentRoute=next;if(next!==renderedRoute)render(true)});
function settings(){$('#settings .sheet-head h2').textContent='偏好设置';const s=$('#settings-content');s.innerHTML=`${document.documentElement.dataset.cacheStatus==='unavailable'?'<p class="setting-note">离线缓存暂不可用，在线阅读正常。</p>':''}<p class="setting-note">为你的阅读习惯，留一点空间。</p><p class="setting-label">阅读</p><label class="setting-row"><span>正文纸张</span><select id="theme" aria-label="外观">${[['system','暖色纸张'],['light','浅色纸张'],['dark','深色阅读']].map(([v,l])=>`<option value="${v}" ${prefs.theme===v?'selected':''}>${l}</option>`).join('')}</select></label><label class="setting-row"><span>更大文字<small>让长文阅读更轻松</small></span><input id="large" class="switch" type="checkbox" ${prefs.large?'checked':''}></label><p class="setting-label">存储</p><button class="setting-row setting-action" data-action="clear"><span>清理阅读缓存<small>${reading.length} 条阅读记录 · 保留收藏与偏好</small></span>${icon('arrow')}</button><button class="setting-row setting-action" data-action="export"><span>导出收藏<small>${bookmarks.length} 条，保存为 JSON 文件</small></span>${icon('external')}</button><p class="setting-note">阅读缓存保留最近三期日报和有限工具档案；收藏内容单独保留。清理缓存不删除收藏与偏好。</p><p class="setting-label">通知与费用</p><button class="setting-row setting-action" data-action="notify"><span>预览重大消息<small>只显示应用内演示，不发送系统通知</small></span>${icon('arrow')}</button><div class="setting-row"><span>日报 08:00 · 重大消息直接提醒<small>计划设置，尚未接入推送服务</small></span></div><div class="setting-row"><span>本原型没有付费调用<small>正式版预算低于 ¥15／月，尚未验证用量</small></span></div><button class="setting-row setting-action" data-action="install"><span>添加到主屏幕<small>安装方法与本地预览限制</small></span>${icon('arrow')}</button><div id="install-info"></div><button class="setting-row setting-action danger" data-action="reset"><span>重置本机数据</span>${icon('arrow')}</button><div id="reset-confirm"></div>`;}
document.addEventListener('click',e=>{const saveButton=e.target.closest('[data-save]');if(saveButton){const id=saveButton.dataset.save;bookmarks=bookmarks.includes(id)?bookmarks.filter(x=>x!==id):[...bookmarks,id];save('bookmarks',bookmarks);Content.remember(id,bookmarks.includes(id));document.querySelectorAll(`[data-save="${id}"]`).forEach(b=>{b.classList.toggle('saved',bookmarks.includes(id));b.setAttribute('aria-pressed',bookmarks.includes(id));b.setAttribute('aria-label',bookmarks.includes(id)?'取消收藏':'收藏')});if(active==='saved'&&!location.hash.includes('/'))$('#results').innerHTML=results('saved');toast(bookmarks.includes(id)?'已加入收藏':'已取消收藏');return}const f=e.target.closest('[data-filter]');if(f){filter=f.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.filter===filter));$('#results').innerHTML=results(active);return}if(e.target.closest('#settings a'))$('#settings').close();const action=e.target.closest('[data-action]')?.dataset.action;if(action==='navigate')location.hash=shelfKindForRoute(location.hash.slice(1)||'today')?'collections':returnRoute;if(action==='settings'){settings();$('#settings').showModal()}if(action==='close')$('#settings').close();if(action==='back'){if(history.state?.prototypeDetail)history.back();else location.hash=returnRoute}if(action==='clear'){Content.clear();reading=[];save('reading',reading);settings();toast('阅读缓存已清理，收藏与偏好已保留')}if(action==='export'){const blob=new Blob([JSON.stringify({version:1,prototype:false,items:bookmarks.map(id=>[...stories,...tools].find(x=>x.id===id)).filter(Boolean)},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='inspiration-bookmarks.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}if(action==='notify'){toast('重大消息预览：你的新一期晨报已准备好（演示）')}if(action==='install')$('#install-info').innerHTML='<p class="setting-note">在 iPhone Safari 中打开，选择分享 → 添加到主屏幕。局域网 HTTP 只能预览界面；安装与离线能力需要安全上下文，真机完整 PWA 验证留待 HTTPS 阶段。</p>';if(action==='reset')$('#reset-confirm').innerHTML='<div class="confirm"><p>将删除本原型的收藏、阅读记录和偏好。此操作不可撤销；需要保留收藏时请先导出。</p><button data-action="cancel-reset">取消</button><button class="danger" data-action="confirm-reset">确认重置</button></div>';if(action==='cancel-reset')$('#reset-confirm').innerHTML='';if(action==='confirm-reset'){Content.reset();bookmarks=[];reading=[];prefs={theme:'system',large:false};save('bookmarks',bookmarks);save('reading',reading);save('prefs',prefs);applyPrefs();settings();render(true);toast('本机原型数据已重置')}});
document.addEventListener('input',e=>{if(e.target.id==='collection-search'){query=e.target.value;$('#collection-results').innerHTML=collectionCards()}if(e.target.id==='search'){query=e.target.value;$('#results').innerHTML=results(active)}});document.addEventListener('change',e=>{if(e.target.id==='theme')prefs.theme=e.target.value;if(e.target.id==='large')prefs.large=e.target.checked;if(['theme','large'].includes(e.target.id)){save('prefs',prefs);applyPrefs()}});
// Native hash history supports Safari back/forward without capturing edge gestures.
document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#story/"],a[href^="#tool/"]');if(a){e.preventDefault();const hash=a.getAttribute('href');if(location.hash===hash)return;positions[currentRoute]=scrollY;if(!currentRoute.includes('/'))returnRoute=currentRoute;history.pushState({prototypeDetail:true},'',hash);currentRoute=hash.slice(1);render()}});
window.addEventListener('popstate',()=>{currentRoute=location.hash.slice(1)||'today';if(currentRoute!==renderedRoute)render(true)});
function updateConnection(){
 document.documentElement.dataset.connection=navigator.onLine?'online':'offline';
 // Status changes must not replace the shelf, release pointer capture or restart its lights.
 if($('.tunnel')||shelfKindForRoute(location.hash.slice(1)||'today'))return;
 const banner=$('#main > .offline');
 if(navigator.onLine)banner?.remove();
 else if(!banner)$('#main').insertAdjacentHTML('afterbegin','<div class="offline" role="status">当前离线 · 正在阅读已缓存内容</div>');
}
window.addEventListener('online',updateConnection);window.addEventListener('offline',updateConnection);render();
if('serviceWorker'in navigator&&window.isSecureContext){navigator.serviceWorker.register('sw.js').catch(()=>{document.documentElement.dataset.cacheStatus='unavailable'})}

document.addEventListener('click',e=>{const card=e.target.closest('[data-deck]');if(!card)return;const index=Number(card.dataset.deck),item=deckCards[index];if(!item||item.blank)return;location.hash=`${item.collection==='tools'?'tool':'story'}/${item.id}`;});
document.addEventListener('pointerdown',e=>{
 const stage=e.target.closest('.tunnel');
 if(!stage||deckDrag||!e.isPrimary||e.target.closest('[data-save]')||e.button!==0||e.clientX<24||e.clientX>innerWidth-24)return;
 stopDeck();const rect=stage.getBoundingClientRect();
 deckDrag={id:e.pointerId,x:e.clientX,y:e.clientY,start:dragCoordinate(deckProgress,deckCards.length-1),last:e.clientX,time:performance.now(),moved:false,stage,width:stage.clientWidth,rect,span:Math.max(70,stage.clientWidth*.24)};
});
document.addEventListener('pointermove',e=>{
 const d=deckDrag;if(!d||d.id!==e.pointerId||d.vertical)return;
 const dx=e.clientX-d.x,dy=e.clientY-d.y;
 if(!d.moved){if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){d.vertical=true;return}if(Math.abs(dx)<5)return;d.moved=true;d.stage.setPointerCapture(e.pointerId)}
 const now=performance.now(),dt=Math.max(1,now-d.time),raw=d.start-dx/d.span;
 const next=rubberBand(raw,deckCards.length-1),positionChanged=Math.abs(next-deckProgress)>.00001;
 const blend=1-Math.exp(-dt/40);
 deckVelocity+=( (next-deckProgress)/dt-deckVelocity)*blend;
 deckProgress=next;deckPointerY=Math.max(0,Math.min(1,(e.clientY-d.rect.top)/d.rect.height));
 d.last=e.clientX;d.time=now;if(positionChanged)queueDeckPaint();
});
function releaseDeck(e,cancelled=false){
 const d=deckDrag;if(!d||d.id!==e.pointerId)return;
 deckDrag=null;if(d.stage.hasPointerCapture(e.pointerId))d.stage.releasePointerCapture(e.pointerId);
 if(d.vertical){suppressUntil=performance.now()+350;return}
 if(!d.moved)return;
 suppressUntil=performance.now()+350;cancelAnimationFrame(deckPaintFrame);deckPaintFrame=0;
 if(cancelled||performance.now()-d.time>90)deckVelocity=0;
 deckVelocity=Math.max(-.014,Math.min(.014,deckVelocity));
 const edge=deckProgress<0?0:deckProgress>deckCards.length-1?deckCards.length-1:null;
 if(edge!==null){deckVelocity=0;deckTarget=edge}
 else deckTarget=Math.abs(deckVelocity)<.0004?Math.round(deckProgress):null;
 if(reduceMotion()){deckProgress=Math.max(0,Math.min(deckCards.length-1,Math.round(deckProgress)));deckVelocity=0;deckTarget=null;paintDeck();return}
 paintDeck();deckLastTime=performance.now();deckFrame=requestAnimationFrame(animateDeck);
}
function cancelDeckGesture(){if(deckDrag)releaseDeck({pointerId:deckDrag.id},true)}
document.addEventListener('pointerup',e=>releaseDeck(e));document.addEventListener('pointercancel',e=>releaseDeck(e,true));
document.addEventListener('lostpointercapture',e=>{if(deckDrag?.moved&&deckDrag.id===e.pointerId&&!deckDrag.stage.hasPointerCapture(e.pointerId))releaseDeck(e,true)});
window.addEventListener('blur',()=>{freezeDeck();paintDeck()});
document.addEventListener('news-calendar-open',()=>{cancelDeckGesture();stopDeck();paintDeck()});
document.addEventListener('click',e=>{if(performance.now()<suppressUntil&&e.target.closest('.tunnel,.collection-card')){e.preventDefault();e.stopImmediatePropagation()}},true);
document.addEventListener('keydown',e=>{if(!e.target.closest('.tunnel')||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();turnDeck(Math.round(deckProgress)+(e.key==='ArrowRight'?1:-1));});
window.addEventListener('resize',()=>{if(deckPaintCache)deckPaintCache.width=deckPaintCache.stage.clientWidth;if(deckDrag&&Math.abs(deckDrag.stage.clientWidth-deckDrag.width)>1)cancelDeckGesture();paintDeck()});
$('.skip').addEventListener('click',e=>{e.preventDefault();$('#main').focus({preventScroll:true});$('#main').scrollIntoView({behavior:'auto',block:'start'})});
document.addEventListener('wheel',e=>{
 const stage=e.target.closest('.tunnel');if(!stage||(!e.shiftKey&&Math.abs(e.deltaX)<=Math.abs(e.deltaY)))return;
 e.preventDefault();if(deckDrag)return;
 // Stop inertia without cancelling an already queued wheel paint.
 cancelAnimationFrame(deckFrame);deckFrame=0;deckTarget=null;deckVelocity=0;clearTimeout(deckWheelTimer);
 const cache=getDeckPaintCache();if(!cache)return;
 const w=cache.width,delta=(e.shiftKey&&Math.abs(e.deltaX)<Math.abs(e.deltaY)?e.deltaY:e.deltaX)*(e.deltaMode===1?16:e.deltaMode===2?w:1);
 deckProgress=Math.max(0,Math.min(deckCards.length-1,deckProgress+delta/Math.max(70,w*.24)));
 queueDeckPaint();
 deckWheelTimer=setTimeout(()=>{deckWheelTimer=0;if(!deckDrag&&cache.stage.isConnected)turnDeck(Math.round(deckProgress))},180);
},{passive:false});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{if(e.matches){cancelDeckGesture();cancelNewsLaunch();routeTransition?.skipTransition();stopDeck();deckProgress=Math.max(0,Math.min(deckCards.length-1,Math.round(deckProgress)));paintDeck()}});

document.addEventListener('visibilitychange',()=>{document.documentElement.classList.toggle('page-hidden',document.hidden);if(document.hidden){freezeDeck();cancelNewsLaunch();routeTransition?.skipTransition();paintDeck()}});

matchMedia('(prefers-reduced-transparency: reduce)').addEventListener('change',()=>queueDeckPaint());

// A swipe on a collection tile is not a tap, even though the page no longer scrolls.
let collectionPress=null;
document.addEventListener('pointerdown',e=>{if(e.isPrimary&&e.pointerType==='touch'&&e.target.closest('.collection-card'))collectionPress={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false}});
document.addEventListener('pointermove',e=>{if(collectionPress?.id===e.pointerId&&(Math.abs(e.clientX-collectionPress.x)>10||Math.abs(e.clientY-collectionPress.y)>10))collectionPress.moved=true});
document.addEventListener('pointerup',e=>{if(collectionPress?.id===e.pointerId){if(collectionPress.moved)suppressUntil=performance.now()+350;collectionPress=null}});
document.addEventListener('pointercancel',e=>{if(collectionPress?.id===e.pointerId)collectionPress=null});
