-- Upgrade an existing FLOW version 1 database without erasing history.
begin;
alter table public.flow_tasks add column if not exists recurrence text not null default 'daily' check (recurrence in ('daily','none'));
alter table public.flow_tasks add column if not exists series_id uuid;
alter table public.flow_tasks add column if not exists repeat_until date;
update public.flow_tasks set series_id=id where recurrence='daily' and series_id is null;
alter table public.flow_tasks alter column recurrence set default 'none';
create unique index if not exists flow_series_day on public.flow_tasks(user_id,series_id,date);
create or replace function public.flow_mutate(p_operation_id uuid,p_task_id uuid,p_expected_version integer,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid := auth.uid();
  current_row public.flow_tasks;
  previous public.flow_operations;
  result_row jsonb;
  routine public.flow_tasks;
  source_row public.flow_tasks;
  series uuid;
  recurring text;
  stop_day date;
  archived boolean := false;
begin
  if owner_id is null then raise exception 'FLOW_AUTH_REQUIRED'; end if;
  if p_operation_id is null or p_task_id is null or p_expected_version is null or p_expected_version<0 then raise exception 'FLOW_INVALID_OPERATION'; end if;
  if p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb then raise exception 'FLOW_INVALID_PATCH'; end if;
  if exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('title','date','category','priority','notes','done','deleted','recurrence','series_id','repeat_until')) then raise exception 'FLOW_INVALID_FIELD'; end if;
  if exists(select 1 from jsonb_each(p_patch) e where (e.key in ('done','deleted') and jsonb_typeof(e.value)<>'boolean') or (e.key not in ('done','deleted') and jsonb_typeof(e.value)<>'string' and not (e.key in ('series_id','repeat_until') and jsonb_typeof(e.value)='null'))) then raise exception 'FLOW_INVALID_TYPE'; end if;
  -- Lock both identities: repeated retries and concurrent changes serialize.
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0));
  select * into previous from public.flow_operations where id=p_operation_id;
  if found then
    if previous.user_id<>owner_id or previous.task_id<>p_task_id then raise exception 'FLOW_FORBIDDEN'; end if;
    return previous.result;
  end if;
  series := (p_patch->>'series_id')::uuid;
  recurring := coalesce(p_patch->>'recurrence','none');
  stop_day := (p_patch->>'repeat_until')::date;
  -- Auto-generated daily instances use the same identity on every device.
  if series is not null and series<>p_task_id and p_expected_version=0 then
    perform pg_advisory_xact_lock(hashtextextended(series::text,1));
    select * into routine from public.flow_tasks where id=series for update;
    if not found or routine.user_id<>owner_id or routine.series_id<>routine.id or routine.recurrence<>'daily' then raise exception 'FLOW_FORBIDDEN'; end if;
    if (p_patch->>'date')::date<=routine.date then raise exception 'FLOW_INVALID_DATE'; end if;
    select * into source_row from public.flow_tasks where user_id=owner_id and series_id=series and date<(p_patch->>'date')::date and not deleted order by date desc limit 1;
    if not found then source_row := routine; end if;
    archived := routine.deleted or (routine.repeat_until is not null and (p_patch->>'date')::date>routine.repeat_until);
    -- Keep explicit import fields; automatic drafts inherit the latest template.
    if not p_patch ? 'repeat_until' then
      p_patch := p_patch || jsonb_build_object('title',source_row.title,'category',source_row.category,'notes',source_row.notes,'priority',source_row.priority);
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_task_id::text,1));
  select * into current_row from public.flow_tasks where id=p_task_id for update;
  if not found then
    if p_expected_version<>0 then raise exception 'FLOW_CONFLICT'; end if;
    insert into public.flow_tasks(id,user_id,title,date,category,priority,notes,done,deleted,completed_at,recurrence,series_id,repeat_until)
    values(p_task_id,owner_id,p_patch->>'title',(p_patch->>'date')::date,coalesce(p_patch->>'category','Personal'),coalesce(p_patch->>'priority','media'),coalesce(p_patch->>'notes',''),coalesce((p_patch->>'done')::boolean,false),archived,case when (p_patch->>'done')::boolean then now() else null end,recurring,case when recurring='daily' then coalesce(series,p_task_id) else null end,stop_day)
    returning * into current_row;
  else
    if current_row.user_id<>owner_id then raise exception 'FLOW_FORBIDDEN'; end if;
    -- A second device generating an already-existing daily copy adopts it.
    if p_expected_version=0 and series is not null and series<>p_task_id and current_row.series_id=series and current_row.date=(p_patch->>'date')::date then
      result_row := to_jsonb(current_row);
      insert into public.flow_operations(id,user_id,task_id,result) values(p_operation_id,owner_id,p_task_id,result_row);
      return result_row;
    end if;
    if current_row.version<>p_expected_version or current_row.deleted then raise exception 'FLOW_CONFLICT'; end if;
    if p_patch ? 'recurrence' or p_patch ? 'series_id' then raise exception 'FLOW_IMMUTABLE_SERIES'; end if;
    if current_row.recurrence='daily' and p_patch ? 'date' and (p_patch->>'date')::date<>current_row.date then raise exception 'FLOW_IMMUTABLE_DATE'; end if;
    update public.flow_tasks set
      title=coalesce(p_patch->>'title',title), date=coalesce((p_patch->>'date')::date,date),
      category=coalesce(p_patch->>'category',category), priority=coalesce(p_patch->>'priority',priority),
      notes=coalesce(p_patch->>'notes',notes), done=coalesce((p_patch->>'done')::boolean,done),
      deleted=coalesce((p_patch->>'deleted')::boolean,deleted),
      completed_at=case when p_patch ? 'done' then case when (p_patch->>'done')::boolean then coalesce(completed_at,now()) else null end else completed_at end,
      repeat_until=case when p_patch ? 'repeat_until' then stop_day else repeat_until end,
      version=version+1,updated_at=now()
    where id=p_task_id returning * into current_row;
  end if;
  result_row=to_jsonb(current_row);
  insert into public.flow_operations(id,user_id,task_id,result) values(p_operation_id,owner_id,p_task_id,result_row);
  return result_row;
end;
$$;
revoke all on function public.flow_mutate(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.flow_mutate(uuid,uuid,integer,jsonb) to authenticated;
commit;
