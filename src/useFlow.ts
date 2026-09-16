import {useCallback,useEffect,useRef,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import {supabase} from './supabase';
import {addDays,applyLocal,dailyDrafts,dateKey,emptyBox,enqueue,project,projectAll,readBox,type Box,type Patch,type Task} from './model';
const GUEST='flow:v1:guest';
export function useFlow(){
  const [user,setUser]=useState<User|null>(null);
  const [authReady,setAuthReady]=useState(!supabase);
  const [box,setBox]=useState<Box>(()=>{try{return readBox(GUEST);}catch{return emptyBox();}});
  const [error,setError]=useState('');
  const [conflict,setConflict]=useState<Task|null>(null);
  const [online,setOnline]=useState(navigator.onLine);
  const [syncing,setSyncing]=useState(false);
  const [lastSync,setLastSync]=useState<string|null>(null);
  const [day,setDay]=useState(dateKey());
  const rolling=useRef(false);
  const ref=useRef(box),scope=useRef(GUEST),generation=useRef(0),busy=useRef(false),paused=useRef(false);
  const commit=useCallback((b:Box)=>{localStorage.setItem(scope.current,JSON.stringify(b));ref.current=b;setBox(b);},[]);
  const setMessage=useCallback((e:unknown)=>setError(e instanceof Error?e.message:'No se pudo guardar el cambio. Inténtalo nuevamente.'),[]);
  useEffect(()=>{
    if(!supabase)return;
    let active=true;
    supabase.auth.getSession().then(({data,error})=>{if(active){if(error)setError('No pudimos verificar tu sesión. Vuelve a iniciar sesión.');setUser(data.session?.user??null);setAuthReady(true);}});
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>{if(active){setUser(session?.user??null);setAuthReady(true);}});
    return()=>{active=false;data.subscription.unsubscribe();};
  },[]);
  useEffect(()=>{
    generation.current++;scope.current=user?`flow:v1:${user.id}`:GUEST;paused.current=false;setConflict(null);setLastSync(null);setError('');
    try{const b=readBox(scope.current);ref.current=b;setBox(b);}catch(e){ref.current=emptyBox();setBox(emptyBox());setMessage(e);}
  },[user?.id,setMessage]);
  const sync=useCallback(async()=>{
    if(!supabase||!user||!authReady||!navigator.onLine||busy.current||paused.current)return;
    const client=supabase;const epoch=generation.current;const key=scope.current;
    const work=async()=>{
      if(epoch!==generation.current||busy.current)return;
      busy.current=true;setSyncing(true);
      try{
        // One persistent envelope keeps the cache and pending writes atomic.
        const latest=readBox(key);ref.current=latest;setBox(latest);
        while(ref.current.queue.length){
          const op=ref.current.queue[0];
          const {data,error}=await client.rpc('flow_mutate',{p_operation_id:op.id,p_task_id:op.taskId,p_expected_version:op.version,p_patch:op.patch});
          if(epoch!==generation.current)return;
          if(error){
            if(error.message.includes('FLOW_CONFLICT')){
              const {data:current,error:readError}=await client.from('flow_tasks').select('*').eq('id',op.taskId).single();
              if(epoch!==generation.current)return;
              if(readError)throw readError;
              paused.current=true;setConflict(current as Task);setError('Esta tarea cambió en otro dispositivo. Elige qué versión conservar.');return;
            }
            throw error;
          }
          const row=data as Task;
          // Another tab can append while this request is in flight.
          const now=readBox(key);
          commit({tasks:[...now.tasks.filter(t=>t.id!==row.id),row],queue:now.queue.filter(q=>q.id!==op.id)});
        }
        const all:Task[]=[];
        for(let from=0;;from+=500){
          const {data,error}=await client.from('flow_tasks').select('*').order('id',{ascending:true}).range(from,from+499);
          if(epoch!==generation.current)return;
          if(error)throw error;
          all.push(...data as Task[]);if(data.length<500)break;
        }
        const now=readBox(key);commit({tasks:all,queue:now.queue});setError('');setLastSync(new Date().toISOString());
      }catch(e){if(epoch===generation.current){setError(e instanceof Error?e.message:'La nube no está disponible. Tus cambios siguen pendientes en este dispositivo.');}}
      finally{busy.current=false;if(epoch===generation.current)setSyncing(false);}
    };
    // Serializes outbox writes across tabs; database operation IDs protect retries.
    if(navigator.locks)await navigator.locks.request(`flow-sync:${key}`,work);else await work();
  },[user?.id,authReady,commit]);
  const mutate=useCallback((id:string,p:Patch)=>{
    if(!authReady)throw new Error('Espera mientras verificamos tu cuenta.');
    if(scope.current!==(user?`flow:v1:${user.id}`:GUEST))throw new Error('Tu cuenta está cambiando. Inténtalo en un momento.');
    try{const now=readBox(scope.current);const existing=projectAll(now).find(t=>t.id===id);const patch=!existing&&p.date&&p.sort_order===undefined?{...p,sort_order:Math.max(0,...project(now).filter(t=>t.date===p.date).map(t=>t.sort_order))+1024}:p;commit(user?enqueue(now,id,patch):applyLocal(now,id,patch));if(!paused.current)setError('');}
    catch(e){setMessage(e);throw e;}
    void sync();
  },[user?.id,authReady,commit,setMessage,sync]);
  const reorder=useCallback((orderedIds:string[])=>{
    if(!authReady)throw new Error('Espera mientras verificamos tu cuenta.');
    try{
      let now=readBox(scope.current);const visible=project(now);const requested=new Set(orderedIds);const dates=[...new Set(visible.filter(t=>requested.has(t.id)).map(t=>t.date))];
      for(const date of dates){
        const desired=orderedIds.filter(id=>visible.some(t=>t.id===id&&t.date===date));
        const desiredSet=new Set(desired);let cursor=0;
        const complete=visible.filter(t=>t.date===date).sort((a,b)=>a.sort_order-b.sort_order||a.id.localeCompare(b.id)).map(t=>desiredSet.has(t.id)?desired[cursor++]:t.id);
        complete.forEach((id,index)=>{const task=project(now).find(t=>t.id===id);const sort_order=(index+1)*1024;if(task&&task.sort_order!==sort_order)now=user?enqueue(now,id,{sort_order}):applyLocal(now,id,{sort_order});});
      }
      commit(now);if(!paused.current)setError('');void sync();
    }catch(e){setMessage(e);throw e;}
  },[user?.id,authReady,commit,setMessage,sync]);
  useEffect(()=>{
    const tick=()=>setDay(dateKey());const timer=setInterval(tick,1000);window.addEventListener('focus',tick);document.addEventListener('visibilitychange',tick);
    return()=>{clearInterval(timer);window.removeEventListener('focus',tick);document.removeEventListener('visibilitychange',tick);};
  },[]);
  useEffect(()=>{
    if(!authReady||rolling.current)return;
    const epoch=generation.current;
    rolling.current=true;
    void dailyDrafts(readBox(scope.current),day).then(drafts=>{
      if(epoch!==generation.current)return;
      let now=readBox(scope.current),changed=false;
      for(const d of drafts){
        const all=projectAll(now);const root=all.find(t=>t.id===d.patch.series_id);
        if(!root||root.deleted||root.recurrence!=='daily'||(root.repeat_until&&d.patch.date!>root.repeat_until)||all.some(t=>t.id===d.id||t.series_id===root.id&&t.date===d.patch.date))continue;
        now=user?enqueue(now,d.id,d.patch):applyLocal(now,d.id,d.patch);changed=true;
      }
      if(changed){commit(now);void sync();}
    }).catch(setMessage).finally(()=>{rolling.current=false;});
  },[box,day,user?.id,authReady,commit,sync,setMessage]);
  useEffect(()=>{
    void sync();
    const onOnline=()=>{setOnline(navigator.onLine);void sync();};
    const onFocus=()=>{void sync();};
    const onStorage=(e:StorageEvent)=>{if(e.key===scope.current){try{const b=readBox(scope.current);ref.current=b;setBox(b);void sync();}catch(err){setMessage(err);}}};
    window.addEventListener('online',onOnline);window.addEventListener('offline',onOnline);window.addEventListener('focus',onFocus);window.addEventListener('storage',onStorage);
    const timer=setInterval(()=>void sync(),15000);
    const channel=user&&supabase?supabase.channel(`flow:${user.id}`).on('postgres_changes',{event:'*',schema:'public',table:'flow_tasks',filter:`user_id=eq.${user.id}`},()=>void sync()).subscribe():null;
    return()=>{clearInterval(timer);window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOnline);window.removeEventListener('focus',onFocus);window.removeEventListener('storage',onStorage);if(channel&&supabase)void supabase.removeChannel(channel);};
  },[sync,user?.id,setMessage]);
  const resolve=async(keepLocal:boolean)=>{
    if(!conflict)return;
    try{
      const now=readBox(scope.current);let version=conflict.version;
      const queue=keepLocal&&!conflict.deleted?now.queue.map(op=>op.taskId===conflict.id?{...op,version:version++}:op):now.queue.filter(op=>op.taskId!==conflict.id);
      commit({tasks:[...now.tasks.filter(t=>t.id!==conflict.id),conflict],queue});paused.current=false;setConflict(null);setError('');await sync();
    }catch(e){setMessage(e);}
  };
  const importGuest=()=>{if(!user)return;const guest=project(readBox(GUEST)).sort((a,b)=>a.date.localeCompare(b.date)||a.sort_order-b.sort_order);let now=readBox(scope.current);for(const t of guest)if(!projectAll(now).some(n=>n.id===t.id))now=enqueue(now,t.id,{title:t.title,date:t.date,category:t.category,priority:t.priority,notes:t.notes,done:t.done,recurrence:t.recurrence,series_id:t.series_id,repeat_until:t.repeat_until,sort_order:t.sort_order});commit(now);void sync();};
  const stopDaily=(t:Task)=>{
    const cutoff=addDays(dateKey(),-1);let now=readBox(scope.current);
    const root=projectAll(now).find(n=>n.id===(t.series_id??t.id));if(!root)throw new Error('Rutina no disponible.');
    const update=(id:string,p:Patch)=>{now=user?enqueue(now,id,p):applyLocal(now,id,p);};
    update(root.id,{repeat_until:cutoff});
    for(const instance of project(now).filter(n=>n.series_id===root.id&&n.date>cutoff))update(instance.id,{deleted:true});
    commit(now);void sync();
  };
  return {tasks:project(box),user,authReady,error,conflict,online,syncing,lastSync,lastDay:day,pending:box.queue.length,mutate,reorder,sync,resolve,importGuest,stopDaily,setError};
}
