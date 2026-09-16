export type Task = { id:string; title:string; date:string; category:string; priority:'alta'|'media'|'baja'; notes:string; done:boolean; deleted:boolean; version:number; completed_at:string|null; recurrence:'daily'|'none'; series_id:string|null; repeat_until:string|null };
export type Patch = Partial<Pick<Task,'title'|'date'|'category'|'priority'|'notes'|'done'|'deleted'|'recurrence'|'series_id'|'repeat_until'>>;
export type Operation = {id:string; taskId:string; patch:Patch; version:number};
export type Box = {tasks:Task[]; queue:Operation[]};
export const emptyBox = ():Box => ({tasks:[],queue:[]});
export function dateKey(d?:Date):string {
  if(!d){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return `${parts.find(p=>p.type==='year')!.value}-${parts.find(p=>p.type==='month')!.value}-${parts.find(p=>p.type==='day')!.value}`;}
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function parseDate(s:string):Date {return new Date(`${s}T12:00:00`);}
export function addDays(s:string,n:number):string {const d=parseDate(s);d.setDate(d.getDate()+n);return dateKey(d);}
export function validDate(s:string):boolean {return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number(s.slice(0,4))>=2000 && Number(s.slice(0,4))<=2100 && !Number.isNaN(+parseDate(s)) && dateKey(parseDate(s))===s;}
export function validatePatch(p:Patch,creating=false):void {
  if(creating && (!p.title || !p.date)) throw new Error('Escribe un título y elige una fecha.');
  if(p.title!==undefined && (!p.title.trim() || p.title.length>160)) throw new Error('El título debe tener entre 1 y 160 caracteres.');
  if(p.date!==undefined && !validDate(p.date)) throw new Error('Elige una fecha válida entre 2000 y 2100.');
  if(p.category!==undefined && (!p.category.trim() || p.category.length>40)) throw new Error('La lista debe tener entre 1 y 40 caracteres.');
  if(p.notes!==undefined && p.notes.length>2000) throw new Error('Las notas admiten hasta 2.000 caracteres.');
  if(p.priority!==undefined && !['alta','media','baja'].includes(p.priority)) throw new Error('Prioridad inválida.');
  for(const k of ['done','deleted'] as const) if(p[k]!==undefined && typeof p[k]!=='boolean') throw new Error('Estado inválido.');
  if(p.recurrence!==undefined&&!['daily','none'].includes(p.recurrence))throw new Error('Repetición inválida.');
  if(p.repeat_until!==undefined&&p.repeat_until!==null&&!validDate(p.repeat_until))throw new Error('Fecha de fin inválida.');
  if(p.series_id!==undefined&&p.series_id!==null&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.series_id))throw new Error('Rutina inválida.');
}
export function taskFrom(id:string,p:Patch):Task {return {id,title:p.title??'',date:p.date??dateKey(),category:'Personal',priority:'media',notes:'',done:false,deleted:false,version:0,completed_at:null,recurrence:'none',series_id:p.recurrence==='daily'?(p.series_id??id):null,repeat_until:null,...p};}
export function projectAll(box:Box):Task[] {
  const map=new Map(box.tasks.map(t=>[t.id,{...t}]));
  for(const op of box.queue) {
    const t=map.get(op.taskId)??taskFrom(op.taskId,op.patch);
    map.set(op.taskId,{...t,...op.patch,version:op.version+1});
  }
  return [...map.values()];
}
export function project(box:Box):Task[] {return projectAll(box).filter(t=>!t.deleted);}
export async function dailyId(series:string,date:string):Promise<string>{
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${series}:${date}`))).slice(0,16);
  bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
  const h=[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export async function dailyDrafts(box:Box,today:string):Promise<{id:string;patch:Patch}[]>{
  const all=projectAll(box),drafts:{id:string;patch:Patch}[]=[];
  for(const root of all.filter(t=>t.recurrence==='daily'&&t.series_id===t.id&&!t.deleted)){
    const end=root.repeat_until&&root.repeat_until<today?root.repeat_until:today;
    const members=all.filter(t=>t.series_id===root.id).sort((a,b)=>a.date.localeCompare(b.date));
    const dates=new Set(members.map(t=>t.date));let source=root;
    for(let day=addDays(root.date,1);day<=end;day=addDays(day,1)){
      const current=members.find(t=>t.date===day);if(current){if(!current.deleted)source=current;continue;}
      const id=await dailyId(root.id,day);
      drafts.push({id,patch:{title:source.title,date:day,category:source.category,priority:source.priority,notes:source.notes,recurrence:'daily',series_id:root.id,done:false}});
      dates.add(day);
    }
  }
  return drafts;
}
export function enqueue(box:Box,taskId:string,patch:Patch):Box {
  const existing=project(box).find(t=>t.id===taskId);
  validatePatch(patch,!existing);
  if(!existing && !(patch.title && patch.date)) throw new Error('La tarea ya no está disponible.');
  return {...box,queue:[...box.queue,{id:crypto.randomUUID(),taskId,patch,version:existing?.version??0}]};
}
export function applyLocal(box:Box,id:string,p:Patch):Box {
  const existing=box.tasks.find(t=>t.id===id&&!t.deleted); validatePatch(p,!existing);
  if(!existing && !(p.title&&p.date)) throw new Error('La tarea ya no está disponible.');
  const t={...(existing??taskFrom(id,p)),...p,version:(existing?.version??0)+1};
  if(p.done!==undefined)t.completed_at=p.done?new Date().toISOString():null;
  return {tasks:[...box.tasks.filter(t=>t.id!==id),t],queue:[]};
}
export function periodDates(today:string,period:'dia'|'semana'|'mes'):string[] {
  if(period==='dia')return [today];
  const d=parseDate(today);
  if(period==='semana'){const first=addDays(today,-((d.getDay()+6)%7));return Array.from({length:7},(_,i)=>addDays(first,i));}
  const first=dateKey(new Date(d.getFullYear(),d.getMonth(),1,12));
  return Array.from({length:new Date(d.getFullYear(),d.getMonth()+1,0).getDate()},(_,i)=>addDays(first,i));
}
export function metrics(tasks:Task[],dates:string[]) {
  const keys=new Set(dates);const list=tasks.filter(t=>!t.deleted&&keys.has(t.date));
  const done=list.filter(t=>t.done).length;
  return {total:list.length,done,pending:list.length-done,percent:list.length?Math.round(done/list.length*100):0};
}
export function perfectDay(tasks:Task[],date:string):boolean {const m=metrics(tasks,[date]);return m.total>0 && m.done===m.total;}
export function streaks(tasks:Task[],today:string) {
  const perfect=[...new Set(tasks.filter(t=>!t.deleted&&t.date<=today).map(t=>t.date))].filter(d=>perfectDay(tasks,d)).sort();
  let best=0,run=0,prev='';for(const d of perfect){run=prev&&addDays(prev,1)===d?run+1:1;best=Math.max(best,run);prev=d;}
  let current=0;let day=perfectDay(tasks,today)?today:addDays(today,-1);
  const set=new Set(perfect);while(set.has(day)){current++;day=addDays(day,-1);}
  return {current,best,perfect};
}
export function readBox(key:string):Box {
  const raw=localStorage.getItem(key);if(!raw)return emptyBox();
  const b=JSON.parse(raw) as Box;
  if(!Array.isArray(b.tasks)||!Array.isArray(b.queue))throw new Error('No se pudo leer tu almacenamiento local.');
  // Version 1 checklists become daily routines; original completions remain untouched.
  b.tasks=b.tasks.map(t=>t.recurrence===undefined?{...t,recurrence:'daily',series_id:t.id,repeat_until:null}:t);
  b.queue=b.queue.map(o=>o.version===0&&o.patch.recurrence===undefined?{...o,patch:{...o.patch,recurrence:'daily'}}:o);
  return b;
}
