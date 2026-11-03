-- Refresh requests are independent of the expensive, capped HTML checks.
create table public.pipeline_refresh_receipts (
  task_key text primary key references public.pipeline_tasks(key) on delete cascade,
  revision text not null,
  requested_at timestamptz not null default now()
);
alter table public.pipeline_refresh_receipts enable row level security;
revoke all on public.pipeline_refresh_receipts from public,anon,authenticated;
grant select,insert,update,delete on public.pipeline_refresh_receipts to service_role;
create or replace function public.pipeline_claim_tasks(p_kind text,p_capabilities text[],p_limit integer default 10)
returns setof public.pipeline_tasks language plpgsql security invoker set search_path=public,pg_temp as $$
declare take integer:=greatest(0,least(p_limit,100));
begin
  if p_kind='public_refresh' then
    perform pg_advisory_xact_lock(hashtextextended('pipeline-publication-budget',0));
    select greatest(0,least(take,60-count(*)::integer)) into take from public.pipeline_task_attempts
      where kind=p_kind and started_at>=date_trunc('day',now());
  end if;
  if p_kind='catalogue_refresh' then
    perform pg_advisory_xact_lock(hashtextextended('pipeline-catalogue-budget',0));
    take:=least(take,1);
    if exists(select 1 from public.pipeline_task_attempts where kind=p_kind and started_at>now()-interval '6 hours')
      or (select count(*) from public.pipeline_task_attempts where kind=p_kind and started_at>now()-interval '24 hours')>=4 then take:=0; end if;
  end if;
  if p_kind='public_expire' then
    perform pg_advisory_xact_lock(hashtextextended('pipeline-expiration-budget',0));
    take:=least(take,1);
    if exists(select 1 from public.pipeline_task_attempts where kind=p_kind and started_at>now()-interval '1 hour')
      or (select count(*) from public.pipeline_task_attempts where kind=p_kind and started_at>now()-interval '24 hours')>=4 then take:=0; end if;
  end if;
  return query with chosen as materialized (
    select key,token from public.pipeline_tasks
    where kind=p_kind and capability=any(p_capabilities)
      and ((status='pending' and available_at<=now()) or (status='running' and lease_until<=now()))
    order by priority desc,available_at,created_at,key
    for update skip locked limit take
  ), expired as (
    update public.pipeline_task_attempts set outcome='lease_expired',finished_at=now()
    where token in(select token from chosen) and finished_at is null returning token
  ), claimed as (
    update public.pipeline_tasks t set status='running',token=gen_random_uuid(),lease_until=now()+interval '5 minutes',
    attempts=attempts+1,updated_at=now()
    from chosen c where t.key=c.key returning t.*
  ), logged as (
    insert into public.pipeline_task_attempts(token,task_key,kind) select token,key,kind from claimed returning token
  ) select c.* from claimed c join logged l using(token);
end;
$$;

create function public.pipeline_enqueue_expiration()
returns void language sql security invoker set search_path=public,pg_temp as $$
  insert into public.pipeline_tasks(key,kind,capability,priority,payload)
  values('publication:expire','public_expire','web',90,jsonb_build_object('revision',gen_random_uuid()))
  on conflict(key) do update set payload=excluded.payload,
    status=case when pipeline_tasks.status='running' then 'running' else 'pending' end,
    available_at=least(pipeline_tasks.available_at,now()),finished_at=null,last_error=null,updated_at=now();
$$;
create function public.pipeline_queue_expiration()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if new.kind<>'public_refresh' then return null; end if;
  if tg_op='UPDATE' and new.payload->>'revision' is not distinct from old.payload->>'revision' then return null; end if;
  perform public.pipeline_enqueue_expiration();
  return null;
end;
$$;
create trigger pipeline_queue_expiration after insert or update on public.pipeline_tasks
for each row execute function public.pipeline_queue_expiration();

create function public.pipeline_expiration_candidates(p_token uuid)
returns table(key text,payload jsonb) language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.pipeline_tasks t where t.key='publication:expire' and t.kind='public_expire' and t.status='running' and t.token=p_token and t.lease_until>now()) then raise exception 'Expiration claim expired'; end if;
  return query select t.key,t.payload from public.pipeline_tasks t
    left join public.pipeline_refresh_receipts r on r.task_key=t.key
    where t.kind='public_refresh' and t.status<>'done' and t.payload->>'revision' is distinct from r.revision
    order by t.priority desc,t.created_at,t.key limit 200;
end;
$$;
create function public.pipeline_record_expirations(p_token uuid,p_items jsonb)
returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare saved integer;
begin
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>200 then raise exception 'Invalid expiration receipt batch'; end if;
  perform 1 from public.pipeline_tasks where key='publication:expire' and kind='public_expire' and status='running' and token=p_token and lease_until>now() for update;
  if not found then raise exception 'Expiration claim expired'; end if;
  with candidates as materialized (
    select t.key,t.payload->>'revision' as revision from public.pipeline_tasks t join jsonb_array_elements(p_items) item on item->>'key'=t.key
      where t.kind='public_refresh' and t.payload->>'revision'=item->>'revision'
  ), recorded as (
    insert into public.pipeline_refresh_receipts(task_key,revision,requested_at) select key,revision,now() from candidates
    on conflict(task_key) do update set revision=excluded.revision,requested_at=excluded.requested_at returning task_key
  ) select count(*)::integer into saved from recorded;
  return saved;
end;
$$;
revoke all on function public.pipeline_enqueue_expiration(),public.pipeline_queue_expiration(),public.pipeline_expiration_candidates(uuid),public.pipeline_record_expirations(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.pipeline_enqueue_expiration(),public.pipeline_queue_expiration(),public.pipeline_expiration_candidates(uuid),public.pipeline_record_expirations(uuid,jsonb) to service_role;
select public.pipeline_enqueue_expiration();

create function public.pipeline_publication_counts()
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
  select jsonb_build_object('awaitingRequest',count(*) filter(where t.payload->>'revision' is distinct from r.revision),
    'requestedAwaitingCheck',count(*) filter(where t.payload->>'revision' is not distinct from r.revision),
    'awaitingCheck',count(*))
  from public.pipeline_tasks t left join public.pipeline_refresh_receipts r on r.task_key=t.key
  where t.kind='public_refresh' and t.status<>'done';
$$;
revoke all on function public.pipeline_publication_counts() from public,anon,authenticated;
grant execute on function public.pipeline_publication_counts() to service_role;
