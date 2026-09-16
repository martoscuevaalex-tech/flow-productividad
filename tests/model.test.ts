import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyLocal,dateKey,emptyBox,enqueue,metrics,perfectDay,periodDates,project,streaks,taskFrom,validDate} from '../src/model.ts';
const task=(date:string,done=false,id=crypto.randomUUID())=>({...taskFrom(id,{title:'Tarea',date,done}),version:1});
test('a completion updates daily, weekly and monthly metrics together; undo restores them',()=>{
  let b=applyLocal(emptyBox(),'one',{title:'Crear campaña',date:'2026-09-16'});
  b=applyLocal(b,'one',{done:true});
  for(const p of ['dia','semana','mes'] as const){assert.equal(metrics(project(b),periodDates('2026-09-16',p)).done,1);assert.equal(metrics(project(b),periodDates('2026-09-16',p)).percent,100);}
  b=applyLocal(b,'one',{done:false});assert.equal(perfectDay(project(b),'2026-09-16'),false);
});
test('editing the date moves a task between periods; deleting removes its metrics',()=>{
  let b=applyLocal(emptyBox(),'one',{title:'Tarea',date:'2026-09-16',done:true});
  b=applyLocal(b,'one',{date:'2026-10-01'});assert.equal(metrics(project(b),periodDates('2026-09-16','mes')).done,0);
  assert.equal(metrics(project(b),periodDates('2026-10-01','mes')).done,1);
  b=applyLocal(b,'one',{deleted:true});assert.equal(project(b).length,0);
});
test('streaks cross month/year boundaries, ignore future dates and require actual tasks',()=>{
  const tasks=[task('2025-12-30',true),task('2025-12-31',true),task('2026-01-01',true),task('2026-01-02',false),task('2026-01-04',true),task('2026-01-05',true)];
  assert.equal(streaks(tasks,'2026-01-02').current,3);assert.equal(streaks(tasks,'2026-01-03').current,0);assert.equal(streaks(tasks,'2026-01-02').best,3);
  assert.equal(perfectDay([],dateKey()),false);
});
test('one incomplete task prevents a perfect day and changes the current streak',()=>{
  const tasks=[task('2026-09-15',true),task('2026-09-16',true),task('2026-09-16',false)];
  assert.equal(perfectDay(tasks,'2026-09-16'),false);assert.equal(streaks(tasks,'2026-09-16').current,1);
});
test('weeks start Monday; February leap years and date validation are correct',()=>{
  assert.equal(periodDates('2026-09-20','semana')[0],'2026-09-14');assert.equal(periodDates('2024-02-10','mes').length,29);
  assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2024-02-29'),true);assert.equal(validDate('1999-01-01'),false);
});
test('offline outbox projects edits and deletion with incrementing expected versions',()=>{
  const id=crypto.randomUUID();let b=enqueue(emptyBox(),id,{title:'Tarea offline',date:'2026-09-16'});
  b=enqueue(b,id,{done:true});b=enqueue(b,id,{title:'Editada'});
  assert.deepEqual(b.queue.map(o=>o.version),[0,1,2]);assert.equal(project(b)[0].title,'Editada');assert.equal(project(b)[0].done,true);
  b=enqueue(b,id,{deleted:true});assert.equal(project(b).length,0);
});
test('refreshing a cloud snapshot preserves optimistic pending edits',()=>{
  const t=task('2026-09-16');const b=enqueue({tasks:[t],queue:[]},t.id,{done:true});
  assert.equal(project({...b,tasks:[{...t,title:'Título de la nube'}]})[0].done,true);
});
test('invalid edits cannot enter the outbox or corrupt local tasks',()=>{
  assert.throws(()=>enqueue(emptyBox(),crypto.randomUUID(),{title:' ',date:'2026-09-16'}));
  assert.throws(()=>applyLocal(emptyBox(),'gone',{done:true}));
});
