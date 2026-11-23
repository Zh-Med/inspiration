(()=>{
 const panel=document.querySelector('#news-calendar'),trigger=document.querySelector('#calendar-button');
 const native=typeof panel.showPopover==='function';
 let config={today:()=>NewsDates.today(),selected:()=>NewsDates.today(),available:()=>[]},view='',focusDate='';
 const opened=()=>native?panel.matches(':popover-open'):!panel.hidden;
 if(!native)panel.hidden=true;
 function close(focus=false){if(opened()){if(native)panel.hidePopover();else panel.hidden=true}trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus({preventScroll:true})}
 function render(){
  const date=NewsDates.parse(view),year=date.getUTCFullYear(),month=date.getUTCMonth(),first=new Date(Date.UTC(year,month,1,12)),start=(first.getUTCDay()+6)%7;
  const count=new Date(Date.UTC(year,month+1,0)).getUTCDate(),selected=config.selected(),today=config.today(),available=new Set(config.available());
  const title=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(first);
  const cells=Array.from({length:42},(_,i)=>{const day=i-start+1;if(day<1||day>count)return '<td aria-hidden="true"></td>';const key=`${view.slice(0,7)}-${String(day).padStart(2,'0')}`;return `<td aria-selected="${key===selected}"><button type="button" data-news-date="${key}" tabindex="${key===focusDate?0:-1}" class="calendar-day${available.has(key)?' has-news':''}${key===today?' is-today':''}" ${key===today?'aria-current="date"':''} aria-label="${key}${available.has(key)?'，有日报样本':''}">${day}</button></td>`});
  panel.innerHTML=`<div class="calendar-heading"><button type="button" data-month-shift="-1" aria-label="上个月"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><h2 id="calendar-month">${title}</h2><button type="button" data-month-shift="1" aria-label="下个月"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg></button></div><table role="grid" aria-labelledby="calendar-month"><thead><tr>${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<th scope="col">${d}</th>`).join('')}</tr></thead><tbody>${Array.from({length:6},(_,i)=>`<tr>${cells.slice(i*7,i*7+7).join('')}</tr>`).join('')}</tbody></table><div class="calendar-footer"><span><i aria-hidden="true"></i>News</span><button type="button" data-calendar-today>Today</button></div>`;
 }
 function prepare(){document.dispatchEvent(new Event('news-calendar-open'));const key=NewsDates.parse(config.selected())?config.selected():config.today();view=key.slice(0,7)+'-01';focusDate=key;render();trigger.setAttribute('aria-expanded','true')}
 function focusDay(){panel.querySelector(`[data-news-date="${focusDate}"]`)?.focus({preventScroll:false})}
 function open(){if(opened()){close(true);return}if(native)panel.showPopover();else{prepare();panel.hidden=false;requestAnimationFrame(focusDay)}}
 function choose(key){if(!NewsDates.parse(key))return;close(false);document.dispatchEvent(new CustomEvent('news-date-selected',{detail:{date:key}}))}
 panel.addEventListener('beforetoggle',e=>{if(e.newState==='open')prepare()});
 panel.addEventListener('toggle',e=>{trigger.setAttribute('aria-expanded',String(e.newState==='open'));if(e.newState==='open')requestAnimationFrame(()=>{if(opened())focusDay()})});
 trigger.addEventListener('click',e=>{e.preventDefault();open()});
 document.addEventListener('click',e=>{if(e.target.closest('[data-calendar-open]'))open()});
 document.addEventListener('pointerdown',e=>{if(!native&&opened()&&!panel.contains(e.target)&&!trigger.contains(e.target))close(false)},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened()){e.preventDefault();e.stopImmediatePropagation();close(true)}},true);
 panel.addEventListener('click',e=>{
  const day=e.target.closest('[data-news-date]');if(day){choose(day.dataset.newsDate);return}
  const shift=e.target.closest('[data-month-shift]');if(shift){const d=NewsDates.parse(view);view=NewsDates.month(d.getUTCFullYear(),d.getUTCMonth()+Number(shift.dataset.monthShift));focusDate=view;render();panel.querySelector(`[data-month-shift="${shift.dataset.monthShift}"]`).focus();return}
  if(e.target.closest('[data-calendar-today]'))choose(config.today());
 });
 panel.addEventListener('keydown',e=>{
  const day=e.target.closest('[data-news-date]');if(!day)return;
  if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();choose(day.dataset.newsDate);return}
  const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};let next;
  if(e.key in offsets)next=NewsDates.add(day.dataset.newsDate,offsets[e.key]);
  else if(e.key==='Home'||e.key==='End'){const weekday=(NewsDates.parse(day.dataset.newsDate).getUTCDay()+6)%7;next=NewsDates.add(day.dataset.newsDate,e.key==='Home'?-weekday:6-weekday)}
  else if(e.key==='PageUp'||e.key==='PageDown'){const d=NewsDates.parse(day.dataset.newsDate),delta=(e.key==='PageUp'?-1:1)*(e.shiftKey?12:1),m=NewsDates.parse(NewsDates.month(d.getUTCFullYear(),d.getUTCMonth()+delta));m.setUTCDate(Math.min(d.getUTCDate(),new Date(Date.UTC(m.getUTCFullYear(),m.getUTCMonth()+1,0)).getUTCDate()));next=m.toISOString().slice(0,10)}
  if(next){e.preventDefault();e.stopPropagation();focusDate=next;view=next.slice(0,7)+'-01';render();focusDay()}
 });
 window.NewsCalendar={configure(value){config=value},close,isOpen:opened};
})();
