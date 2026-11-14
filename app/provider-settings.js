(()=>{
 const panel=document.querySelector('#provider-panel'),trigger=document.querySelector('#provider-button'),status=panel.querySelector('[role=status]');
 const native=typeof panel.showPopover==='function';
 if(!native)panel.hidden=true;
 const opened=()=>native?panel.matches(':popover-open'):!panel.hidden;
 function close(focus=false){if(opened()){if(native)panel.hidePopover();else panel.hidden=true}trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus({preventScroll:true});document.dispatchEvent(new Event('calendar-surface-change'))}
 async function open(){if(opened()){close(true);return}NewsCalendar.close(false);document.dispatchEvent(new Event('news-calendar-open'));if(native)panel.showPopover();else panel.hidden=false;trigger.setAttribute('aria-expanded','true');document.dispatchEvent(new Event('calendar-surface-change'));status.textContent='尚未连接独立服务';panel.querySelector('[data-provider-close]').focus({preventScroll:true})}
 trigger.addEventListener('click',open);
 panel.querySelector('[data-provider-close]').addEventListener('click',()=>close(true));
 panel.addEventListener('toggle',e=>{trigger.setAttribute('aria-expanded',String(e.newState==='open'));document.dispatchEvent(new Event('calendar-surface-change'))});
 document.addEventListener('news-calendar-open',()=>{if(opened())close(false)});
 document.addEventListener('pointerdown',e=>{if(!native&&opened()&&!panel.contains(e.target)&&!trigger.contains(e.target))close(false)},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened()){e.preventDefault();close(true)}});
 window.addEventListener('hashchange',()=>close(false));document.addEventListener('visibilitychange',()=>{if(document.hidden)close(false)});
 window.ProviderSettings={close,isOpen:opened};
})();
