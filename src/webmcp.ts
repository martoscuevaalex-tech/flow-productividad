import {useEffect} from 'react';
import {validatePatch,type Patch,type Task} from './model';
type Context={registerTool:(tool:{name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean;untrustedContentHint:boolean};execute:(input:unknown)=>unknown},options:{signal:AbortSignal})=>void|Promise<void>};
export function useWebMCP(tasks:Task[],mutate:(id:string,p:Patch)=>void,cloud:boolean){
  useEffect(()=>{
    const context=(document as Document&{modelContext?:Context}).modelContext;if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const register=(tool:Parameters<Context['registerTool']>[0])=>{try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Unsupported experimental API must not affect FLOW. */}};
    register({name:'flow_list_tasks',description:'Read the tasks currently visible in FLOW, including their assigned dates and completion status.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>tasks});
    register({name:'flow_create_task',description:'Create and persist a task using the same action as Nueva tarea. Cloud writes are queued for synchronization.',inputSchema:{type:'object',properties:{title:{type:'string',maxLength:160},date:{type:'string',format:'date'},category:{type:'string',maxLength:40}},required:['title','date'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input)=>{
      if(!input||typeof input!=='object')throw new Error('Invalid task');const p=input as Record<string,unknown>;
      if(typeof p.title!=='string'||typeof p.date!=='string'||(p.category!==undefined&&typeof p.category!=='string')||Object.keys(p).some(k=>!['title','date','category'].includes(k)))throw new Error('Invalid task fields');
      const patch:Patch={recurrence:'daily',title:p.title.trim(),date:p.date,category:typeof p.category==='string'?p.category.trim():'Personal'};validatePatch(patch,true);
      const id=crypto.randomUUID();mutate(id,patch);await new Promise(requestAnimationFrame);return {id,persistence:cloud?'queued_for_sync':'device_local'};
    }});
    register({name:'flow_set_task_completion',description:'Mark or unmark an existing task; updates the dashboard and calendar. Cloud writes are queued for synchronization.',inputSchema:{type:'object',properties:{id:{type:'string'},done:{type:'boolean'}},required:['id','done'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input)=>{
      if(!input||typeof input!=='object')throw new Error('Invalid task');const p=input as Record<string,unknown>;
      if(typeof p.id!=='string'||typeof p.done!=='boolean'||Object.keys(p).some(k=>!['id','done'].includes(k))||!tasks.some(t=>t.id===p.id))throw new Error('Task not found or invalid completion');
      mutate(p.id,{done:p.done});await new Promise(requestAnimationFrame);return {id:p.id,done:p.done,persistence:cloud?'queued_for_sync':'device_local'};
    }});
    return()=>lifecycle.abort();
  },[tasks,mutate,cloud]);
}
