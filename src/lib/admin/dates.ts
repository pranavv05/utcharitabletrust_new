/** All book-bank calendar dates follow the trust's operating timezone. */
export function trustDate(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const part=(type:string)=>parts.find(p=>p.type===type)!.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}
export function renewalMin(due:unknown,now=new Date()){
 const today=trustDate(now);
 if(typeof due!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(due))return today;
 const date=new Date(due+'T00:00:00Z');if(!Number.isFinite(date.getTime()))return today;
 date.setUTCDate(date.getUTCDate()+1);const next=date.toISOString().slice(0,10);return next>today?next:today;
}
export function clampRecordPage(page:number,total:number){return Math.min(Math.max(1,page),Math.max(1,Math.ceil(total/25)))}
