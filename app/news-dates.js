window.NewsDates=(()=>{
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
 function today(now=new Date()){const p=Object.fromEntries(formatter.formatToParts(now).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`}
 function parse(key){if(!/^\d{4}-\d{2}-\d{2}$/.test(key))return null;const d=new Date(`${key}T12:00:00Z`);return Number.isFinite(+d)&&d.toISOString().slice(0,10)===key?d:null}
 function route(value){if(typeof value!=='string')return null;return value==='today'?today():value.startsWith('news/')&&parse(value.slice(5))?value.slice(5):null}
 function add(key,days){const d=parse(key);if(!d)return null;d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
 function month(year,index){const d=new Date(Date.UTC(year,index,1,12));return d.toISOString().slice(0,10)}
 return {today,parse,route,add,month};
})();
