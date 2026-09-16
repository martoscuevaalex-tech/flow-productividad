-- Integration assertions for an isolated test project. Everything rolls back.
-- Run after schema.sql. Raises an exception if any assertion fails.
begin;
insert into auth.users(id) values('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select public.flow_mutate('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',0,'{"title":"Privada A","date":"2026-09-16"}');
-- Retrying the same operation must not duplicate or increment version.
select public.flow_mutate('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',0,'{"title":"Privada A","date":"2026-09-16"}');
do $$ begin
  if (select count(*) from public.flow_tasks)<>1 then raise exception 'ASSERT: owner cannot read own task'; end if;
  if (select version from public.flow_tasks limit 1)<>1 then raise exception 'ASSERT: retry was not idempotent'; end if;
end $$;
select public.flow_mutate('20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001',1,'{"done":true}');
do $$ begin
  if not (select done from public.flow_tasks limit 1) then raise exception 'ASSERT: completion not applied'; end if;
  begin
    perform public.flow_mutate('20000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000001',1,'{"title":"Stale edit"}');
    raise exception 'ASSERT: stale version accepted';
  exception when others then
    if sqlerrm not like '%FLOW_CONFLICT%' then raise; end if;
  end;
  begin
    update public.flow_tasks set title='Bypass';
    raise exception 'ASSERT: direct writes allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$ begin
  if (select count(*) from public.flow_tasks)<>0 then raise exception 'ASSERT: another user can read private tasks'; end if;
  begin
    perform public.flow_mutate('20000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000001',2,'{"done":false}');
    raise exception 'ASSERT: cross-account update accepted';
  exception when others then if sqlerrm not like '%FLOW_FORBIDDEN%' then raise; end if;
  end;
  begin
    perform public.flow_mutate('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',0,'{"done":false}');
    raise exception 'ASSERT: another user can replay private operation';
  exception when others then if sqlerrm not like '%FLOW_FORBIDDEN%' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select public.flow_mutate('20000000-0000-0000-0000-000000000005','30000000-0000-0000-0000-000000000001',2,'{"deleted":true}');
do $$ begin
  begin
    perform public.flow_mutate('20000000-0000-0000-0000-000000000006','30000000-0000-0000-0000-000000000001',3,'{"deleted":false}');
    raise exception 'ASSERT: deleted task resurrected';
  exception when others then if sqlerrm not like '%FLOW_CONFLICT%' then raise; end if;
  end;
end $$;
set local role anon;
do $$ begin
  begin
    perform count(*) from public.flow_tasks;
    raise exception 'ASSERT: anonymous read allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.flow_mutate('20000000-0000-0000-0000-000000000007','30000000-0000-0000-0000-000000000001',3,'{"done":false}');
    raise exception 'ASSERT: anonymous RPC allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
-- Daily copies are independent; two devices cannot reset an existing copy.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select public.flow_mutate('20000000-0000-0000-0000-000000000010','30000000-0000-0000-0000-000000000010',0,'{"title":"Daily","date":"2026-09-16","recurrence":"daily","done":true}');
select public.flow_mutate('20000000-0000-0000-0000-000000000011','30000000-0000-0000-0000-000000000011',0,'{"title":"Draft","date":"2026-09-17","recurrence":"daily","series_id":"30000000-0000-0000-0000-000000000010","done":false}');
do $$ begin
  if (select done from public.flow_tasks where id='30000000-0000-0000-0000-000000000011') then raise exception 'ASSERT: next day inherited completion'; end if;
  if (select title from public.flow_tasks where id='30000000-0000-0000-0000-000000000011')<>'Daily' then raise exception 'ASSERT: authoritative template not inherited'; end if;
end $$;
select public.flow_mutate('20000000-0000-0000-0000-000000000012','30000000-0000-0000-0000-000000000011',1,'{"done":true}');
select public.flow_mutate('20000000-0000-0000-0000-000000000013','30000000-0000-0000-0000-000000000011',0,'{"title":"Other device draft","date":"2026-09-17","recurrence":"daily","series_id":"30000000-0000-0000-0000-000000000010","done":false}');
do $$ begin
  if (select version from public.flow_tasks where id='30000000-0000-0000-0000-000000000011')<>2 then raise exception 'ASSERT: daily duplicate changed version'; end if;
  if not (select done from public.flow_tasks where id='30000000-0000-0000-0000-000000000011') then raise exception 'ASSERT: another device reset today'; end if;
end $$;
select public.flow_mutate('20000000-0000-0000-0000-000000000014','30000000-0000-0000-0000-000000000010',1,'{"repeat_until":"2026-09-17"}');
select public.flow_mutate('20000000-0000-0000-0000-000000000015','30000000-0000-0000-0000-000000000015',0,'{"title":"Old offline draft","date":"2026-09-18","recurrence":"daily","series_id":"30000000-0000-0000-0000-000000000010","done":false}');
do $$ begin
  if not (select deleted from public.flow_tasks where id='30000000-0000-0000-0000-000000000015') then raise exception 'ASSERT: stopped routine revived'; end if;
  if not (select done from public.flow_tasks where id='30000000-0000-0000-0000-000000000010') then raise exception 'ASSERT: routine archive erased history'; end if;
end $$;
rollback;
