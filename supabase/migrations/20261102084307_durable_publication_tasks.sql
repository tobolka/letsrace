-- Private durable work. A publication request commits with the catalogue change.
create table public.pipeline_tasks (
  key text primary key,
  kind text not null,
  capability text not null,
  entity_id uuid,
  priority integer not null default 0,
  payload jsonb not null default '{}',
  status text not null default 'pending' check(status in ('pending','running','done','blocked')),
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  token uuid,
  attempts integer not null default 0,
  result jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index pipeline_tasks_due on public.pipeline_tasks(kind,capability,status,available_at,priority desc);
create index pipeline_tasks_entity on public.pipeline_tasks(entity_id);
alter table public.pipeline_tasks enable row level security;
revoke all on public.pipeline_tasks from public,anon,authenticated;
grant select,insert,update,delete on public.pipeline_tasks to service_role;

create table public.pipeline_task_attempts (
  token uuid primary key,
  task_key text not null references public.pipeline_tasks(key) on delete cascade,
  kind text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text,
  result jsonb,
  error text
);
create index pipeline_task_attempts_key on public.pipeline_task_attempts(task_key);
create index pipeline_task_attempts_budget on public.pipeline_task_attempts(kind,started_at);
alter table public.pipeline_task_attempts enable row level security;
revoke all on public.pipeline_task_attempts from public,anon,authenticated;
grant select,insert,update,delete on public.pipeline_task_attempts to service_role;

create function public.pipeline_claim_tasks(p_kind text,p_capabilities text[],p_limit integer default 10)
returns setof public.pipeline_tasks language plpgsql security invoker set search_path=public,pg_temp as $$
declare take integer:=greatest(0,least(p_limit,100));
begin
  if p_kind='public_refresh' then
    perform pg_advisory_xact_lock(hashtextextended('pipeline-publication-budget',0));
    select greatest(0,least(take,60-count(*)::integer)) into take from public.pipeline_task_attempts
      where kind=p_kind and started_at>=date_trunc('day',now());
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

create function public.pipeline_finish_task(p_key text,p_token uuid,p_payload jsonb,p_result jsonb)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare held public.pipeline_tasks;
begin
  select * into held from public.pipeline_tasks where key=p_key for update;
  if not found or p_token is null or held.token is distinct from p_token or held.status<>'running' or held.lease_until is null or held.lease_until<=now() then return false; end if;
  if held.payload is distinct from p_payload then
    update public.pipeline_task_attempts set outcome='superseded',finished_at=now(),result=p_result where token=p_token;
    update public.pipeline_tasks set status='pending',token=null,lease_until=null,updated_at=now() where key=p_key;
    return false;
  end if;
  update public.pipeline_tasks set status='done',token=null,lease_until=null,result=p_result,last_error=null,finished_at=now(),updated_at=now() where key=p_key;
  update public.pipeline_task_attempts set outcome='done',finished_at=now(),result=p_result where token=p_token;
  return true;
end;
$$;

create function public.pipeline_retry_task(p_key text,p_token uuid,p_error text,p_delay_seconds integer default 3600)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  update public.pipeline_tasks set status='pending',token=null,lease_until=null,last_error=left(p_error,1000),
    available_at=now()+make_interval(secs=>greatest(60,least(p_delay_seconds,604800))),updated_at=now()
    where key=p_key and token=p_token and status='running' and lease_until>now();
  if not found then return false; end if;
  update public.pipeline_task_attempts set outcome='retry',error=left(p_error,1000),finished_at=now() where token=p_token;
  return true;
end;
$$;

alter table public.events add column public_revision uuid not null default gen_random_uuid();

create function public.pipeline_event_content(value jsonb)
returns jsonb language sql immutable security invoker set search_path=public,pg_temp as $$
  select value - array['updated_at','last_seen_at','created_at','search_text','name_normalized','fingerprint','public_revision'];
$$;

create function public.pipeline_stamp_public_revision()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' then new.public_revision:=gen_random_uuid();
  elsif public.pipeline_event_content(to_jsonb(new)) is distinct from public.pipeline_event_content(to_jsonb(old))
     or new.public_revision is distinct from old.public_revision then new.public_revision:=gen_random_uuid();
  else new.public_revision:=old.public_revision;
  end if;
  return new;
end;
$$;

create function public.pipeline_queue_public_revision()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare previous_slugs jsonb:='[]'; critical boolean:=true;
begin
  if tg_op='UPDATE' then
    if new.public_revision=old.public_revision then return new; end if;
    if new.slug is distinct from old.slug then previous_slugs:=jsonb_build_array(old.slug); end if;
    critical:=(to_jsonb(new)->'start_date',to_jsonb(new)->'end_date',to_jsonb(new)->'status',to_jsonb(new)->'visibility',to_jsonb(new)->'merged_into_id')
      is distinct from (to_jsonb(old)->'start_date',to_jsonb(old)->'end_date',to_jsonb(old)->'status',to_jsonb(old)->'visibility',to_jsonb(old)->'merged_into_id');
  end if;
  insert into public.pipeline_tasks(key,kind,capability,entity_id,priority,payload,available_at)
  values('public:'||new.id,'public_refresh','web',new.id,case when critical then 100 else 40 end,
    jsonb_build_object('revision',new.public_revision,'slug',new.slug,'previousSlugs',previous_slugs,'expected',public.pipeline_event_content(to_jsonb(new))),now()+interval '1 minute')
  on conflict(key) do update set
    payload=excluded.payload||jsonb_build_object('previousSlugs',coalesce(pipeline_tasks.payload->'previousSlugs','[]')||previous_slugs),
    priority=case when pipeline_tasks.status='done' then excluded.priority else greatest(pipeline_tasks.priority,excluded.priority) end,
    status=case when pipeline_tasks.status='running' then 'running' else 'pending' end,
    available_at=least(pipeline_tasks.available_at,excluded.available_at),finished_at=null,last_error=null,updated_at=now();
  return new;
end;
$$;
create trigger pipeline_stamp_public_revision before insert or update on public.events
for each row execute function public.pipeline_stamp_public_revision();
create trigger pipeline_queue_public_revision after insert or update on public.events
for each row execute function public.pipeline_queue_public_revision();

-- Place corrections also change the race page, even if its event row was untouched.
create function public.pipeline_location_revision()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if (to_jsonb(new)-array['updated_at','geog','geocode_query','geocode_status','created_at'])
    is distinct from (to_jsonb(old)-array['updated_at','geog','geocode_query','geocode_status','created_at']) then
    update public.events set public_revision=gen_random_uuid() where location_id=new.id;
  end if;
  return new;
end;
$$;
create trigger pipeline_location_revision after update on public.locations
for each row execute function public.pipeline_location_revision();

revoke all on function public.pipeline_claim_tasks(text,text[],integer),public.pipeline_finish_task(text,uuid,jsonb,jsonb),
  public.pipeline_retry_task(text,uuid,text,integer),public.pipeline_event_content(jsonb),public.pipeline_stamp_public_revision(),
  public.pipeline_queue_public_revision(),public.pipeline_location_revision() from public,anon,authenticated;
grant execute on function public.pipeline_claim_tasks(text,text[],integer),public.pipeline_finish_task(text,uuid,jsonb,jsonb),
  public.pipeline_retry_task(text,uuid,text,integer),public.pipeline_event_content(jsonb),public.pipeline_stamp_public_revision(),
  public.pipeline_queue_public_revision(),public.pipeline_location_revision() to service_role;
