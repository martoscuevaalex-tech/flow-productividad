import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyLocal,dailyDrafts,dailyId,emptyBox,metrics,project,readBox,streaks,type Box} from '../src/model.ts';
const routine=(date='2026-09-16'):Box=>applyLocal(emptyBox(),'12345678-1234-4234-8234-123456789abc',{title:'Entrenar',date,recurrence:'daily'});
async function roll(box:Box,date:string){let b=box;for(const d of await dailyDrafts(box,date))b=applyLocal(b,d.id,d.patch);return b;}
test('tomorrow repeats unchecked and yesterday remains completed',async()=>{
  let b=routine();b=applyLocal(b,b.tasks[0].id,{done:true});b=await roll(b,'2026-09-17');
  assert.equal(metrics(project(b),['2026-09-16']).done,1);assert.equal(metrics(project(b),['2026-09-17']).done,0);
  assert.equal(metrics(project(b),['2026-09-17']).total,1);assert.equal(streaks(project(b),'2026-09-17').current,1);
  b=applyLocal(b,b.tasks.find(t=>t.date==='2026-09-17')!.id,{done:true});assert.equal(streaks(project(b),'2026-09-17').current,2);
});
test('two devices produce the same daily identity; repeated rollover is idempotent',async()=>{
  const a=await dailyDrafts(routine(),'2026-09-17'),b=await dailyDrafts(routine(),'2026-09-17');assert.equal(a[0].id,b[0].id);
  const done=await roll(routine(),'2026-09-17');assert.equal((await dailyDrafts(done,'2026-09-17')).length,0);
  assert.notEqual(await dailyId(done.tasks[0].id,'2026-09-17'),await dailyId(done.tasks[0].id,'2026-09-18'));
});
test('reopening after missed days preserves gaps as uncompleted and creates no future rows',async()=>{
  const b=await roll(routine('2026-09-14'),'2026-09-18');assert.equal(b.tasks.length,5);
  assert.deepEqual(b.tasks.map(t=>t.date).sort(),['2026-09-14','2026-09-15','2026-09-16','2026-09-17','2026-09-18']);
  assert.ok(b.tasks.every(t=>!t.done));
});
test('stopping a routine retains previous history and does not generate after its cutoff',async()=>{
  let b=await roll(routine('2026-09-14'),'2026-09-16');const root=b.tasks[0];b=applyLocal(b,root.id,{done:true,repeat_until:'2026-09-15'});
  assert.equal((await dailyDrafts(b,'2026-09-20')).length,0);assert.equal(metrics(project(b),['2026-09-14']).done,1);
});
test('a deleted daily occurrence is never regenerated',async()=>{
  let b=await roll(routine(),'2026-09-17');b=applyLocal(b,b.tasks[1].id,{deleted:true});assert.equal((await dailyDrafts(b,'2026-09-17')).length,0);
});
test('editing a daily record carries its latest title forward without rewriting old records',async()=>{
  let b=await roll(routine(),'2026-09-17');b=applyLocal(b,b.tasks[1].id,{title:'Entrenar y estirar',done:true});b=await roll(b,'2026-09-18');
  assert.equal(b.tasks.find(t=>t.date==='2026-09-16')!.title,'Entrenar');assert.equal(b.tasks.find(t=>t.date==='2026-09-18')!.title,'Entrenar y estirar');assert.equal(b.tasks.find(t=>t.date==='2026-09-18')!.done,false);
});
test('version 1 local checklists migrate to daily without resetting original completions',()=>{
  const old={tasks:[{id:'12345678-1234-4234-8234-123456789abc',title:'Rutina anterior',date:'2026-09-16',category:'Personal',priority:'media',done:true,deleted:false,version:1,notes:'',completed_at:'2026-09-16T18:00:00Z'}],queue:[]};
  Object.defineProperty(globalThis,'localStorage',{value:{getItem:()=>JSON.stringify(old)},configurable:true});
  const b=readBox('test');assert.equal(b.tasks[0].recurrence,'daily');assert.equal(b.tasks[0].series_id,b.tasks[0].id);assert.equal(b.tasks[0].done,true);
  Reflect.deleteProperty(globalThis,'localStorage');
});
