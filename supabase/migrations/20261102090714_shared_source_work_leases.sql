create function public.pipeline_sync_source_task()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and (new.status,new.url,new.kind,new.next_poll_at) is not distinct from (old.status,old.url,old.kind,old.next_poll_at) then return new; end if;
  insert into public.pipeline_tasks(key,kind,capability,entity_id,priority,payload,status,available_at)
  values('source:'||new.id,'source_read',case when new.url ilike '%portal.czechcyclingfederation.com/Races%' then 'browser' else 'http' end,new.id,
    case when new.kind in ('series','federation','aggregator','calendar') then 80 else 30 end,
    jsonb_build_object('sourceId',new.id,'url',new.url,'sourceKind',new.kind,'enabled',new.status='active','nextPollAt',new.next_poll_at),
    case when new.status='active' then 'pending' else 'blocked' end,coalesce(new.next_poll_at,now()))
  on conflict(key) do update set capability=excluded.capability,priority=excluded.priority,payload=excluded.payload,
    status=case when pipeline_tasks.status='running' then 'running' else excluded.status end,
    available_at=excluded.available_at,updated_at=now();
  return new;
end;
$$;
create trigger pipeline_sync_source_task after insert or update of status,url,kind,next_poll_at on public.watched_urls
for each row execute function public.pipeline_sync_source_task();

-- Existing poll dates remain the schedule; this is one durable representation,
-- not a second independent schedule. The old selector remains an adapter.
insert into public.pipeline_tasks(key,kind,capability,entity_id,priority,payload,status,available_at)
select 'source:'||id,'source_read',case when url ilike '%portal.czechcyclingfederation.com/Races%' then 'browser' else 'http' end,id,
 case when kind in ('series','federation','aggregator','calendar') then 80 else 30 end,
 jsonb_build_object('sourceId',id,'url',url,'sourceKind',kind,'enabled',status='active','nextPollAt',next_poll_at),
 case when status='active' then 'pending' else 'blocked' end,coalesce(next_poll_at,now()) from public.watched_urls
on conflict(key) do nothing;

create function public.pipeline_claim_source(p_source uuid,p_capabilities text[])
returns setof public.pipeline_tasks language plpgsql security invoker set search_path=public,pg_temp as $$
declare held public.pipeline_tasks;
begin
  select * into held from public.pipeline_tasks where key='source:'||p_source for update;
  if not found or held.status='blocked' or not held.capability=any(p_capabilities)
    or (held.status='running' and held.lease_until>now()) then return; end if;
  -- A direct service read may be explicitly requested before the next date.
  -- It still cannot reactivate a paused source or steal another reader's lease.
  if not exists(select 1 from public.watched_urls where id=p_source and status='active') then return; end if;
  update public.pipeline_task_attempts set outcome='lease_expired',finished_at=now() where token=held.token and finished_at is null;
  update public.pipeline_tasks set status='running',token=gen_random_uuid(),lease_until=now()+interval '20 minutes',attempts=attempts+1,updated_at=now()
    where key=held.key returning * into held;
  insert into public.pipeline_task_attempts(token,task_key,kind) values(held.token,held.key,held.kind);
  return next held;
end;
$$;

create function public.pipeline_finish_source(p_key text,p_token uuid,p_url text,p_result jsonb)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare held public.pipeline_tasks; source public.watched_urls; obsolete boolean;
begin
  select * into held from public.pipeline_tasks where key=p_key for update;
  if not found or p_token is null or held.kind<>'source_read' or held.token is distinct from p_token
    or held.status<>'running' or held.lease_until is null or held.lease_until<=now() then return false; end if;
  select * into source from public.watched_urls where id=held.entity_id;
  obsolete:=source.url is distinct from p_url;
  update public.pipeline_tasks set status=case when source.status='active' then 'pending' else 'blocked' end,
    token=null,lease_until=null,result=p_result,last_error=p_result->>'error',
    available_at=case when obsolete then now() else coalesce(source.next_poll_at,now()+interval '1 hour') end,
    finished_at=now(),updated_at=now() where key=p_key;
  update public.pipeline_task_attempts set outcome=case when obsolete then 'superseded' else 'done' end,result=p_result,finished_at=now() where token=p_token;
  return not obsolete;
end;
$$;
revoke all on function public.pipeline_sync_source_task(),public.pipeline_claim_source(uuid,text[]),public.pipeline_finish_source(text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.pipeline_sync_source_task(),public.pipeline_claim_source(uuid,text[]),public.pipeline_finish_source(text,uuid,text,jsonb) to service_role;

-- The web overview must know when the Mac is actually reporting, without
-- collecting its process list, local paths or machine identity.
create table public.pipeline_workers (
  key text primary key,
  heartbeat_at timestamptz not null default now(),
  status text not null,
  paused boolean not null default false,
  next_run_at timestamptz,
  summary jsonb
);
alter table public.pipeline_workers enable row level security;
revoke all on public.pipeline_workers from public,anon,authenticated;
grant select,insert,update,delete on public.pipeline_workers to service_role;

create function public.pipeline_reopened_public_task()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if old.kind='public_refresh' and old.status='done' and new.status='pending' then
    new.available_at:=now()+interval '1 minute';
  end if;
  return new;
end;
$$;
create trigger pipeline_reopened_public_task before update on public.pipeline_tasks
for each row execute function public.pipeline_reopened_public_task();
revoke all on function public.pipeline_reopened_public_task() from public,anon,authenticated;
grant execute on function public.pipeline_reopened_public_task() to service_role;
