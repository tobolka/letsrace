-- Series changes and membership changes must survive a crash like race updates.
create function public.pipeline_enqueue_series(p_series jsonb,p_previous_slug text default null)
returns void language sql security invoker set search_path=public,pg_temp as $$
  insert into public.pipeline_tasks(key,kind,capability,entity_id,priority,payload)
  values('series:'||(p_series->>'id'),'series_refresh','web',(p_series->>'id')::uuid,70,
    jsonb_build_object('revision',gen_random_uuid(),'slug',p_series->>'slug','expected',p_series,
      'previousSlugs',case when p_previous_slug is null then '[]'::jsonb else jsonb_build_array(p_previous_slug) end))
  on conflict(key) do update set payload=excluded.payload||jsonb_build_object('previousSlugs',
      coalesce(pipeline_tasks.payload->'previousSlugs','[]')||(excluded.payload->'previousSlugs')),
    status='pending',available_at=now(),finished_at=null,last_error=null,updated_at=now();
$$;
create function public.pipeline_series_revision()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare prior text; old_row jsonb; new_row jsonb; relevant boolean:=true;
begin
  if tg_table_name='series' then
    if tg_op='DELETE' then
      perform public.pipeline_enqueue_series(to_jsonb(old)||jsonb_build_object('visibility','hidden'));
      return null;
    end if;
    if tg_op='UPDATE' then
      if (to_jsonb(new)-array['updated_at','last_seen_at','created_at']) is not distinct from (to_jsonb(old)-array['updated_at','last_seen_at','created_at']) then return null; end if;
      if old.slug is distinct from new.slug then prior:=old.slug; end if;
      -- These values are embedded in each race's detail, not only the series page.
      if (old.name,old.slug,old.visibility,old.website_url,old.age_categories) is distinct from (new.name,new.slug,new.visibility,new.website_url,new.age_categories) then
        update public.events set public_revision=gen_random_uuid() where series_id=new.id;
      end if;
    end if;
    perform public.pipeline_enqueue_series(to_jsonb(new),prior);
  elsif tg_table_name='events' then
    if tg_op='UPDATE' then
      relevant:=public.pipeline_catalogue_event_content(to_jsonb(old)) is distinct from public.pipeline_catalogue_event_content(to_jsonb(new));
      if not relevant then return null; end if;
    end if;
    if tg_op<>'INSERT' and old.series_id is not null then
      select to_jsonb(s) into old_row from public.series s where s.id=old.series_id;
      if old_row is not null then perform public.pipeline_enqueue_series(old_row); end if;
    end if;
    if tg_op<>'DELETE' and new.series_id is not null and (tg_op='INSERT' or new.series_id is distinct from old.series_id) then
      select to_jsonb(s) into new_row from public.series s where s.id=new.series_id;
      if new_row is not null then perform public.pipeline_enqueue_series(new_row); end if;
    end if;
  end if;
  return null;
end;
$$;
create trigger pipeline_series_content after insert or update or delete on public.series for each row execute function public.pipeline_series_revision();
create trigger pipeline_series_membership after insert or update or delete on public.events for each row execute function public.pipeline_series_revision();

create or replace function public.pipeline_queue_expiration()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if new.kind not in ('public_refresh','series_refresh') then return null; end if;
  if tg_op='UPDATE' and new.payload->>'revision' is not distinct from old.payload->>'revision' then return null; end if;
  perform public.pipeline_enqueue_expiration();
  return null;
end;
$$;
create or replace function public.pipeline_expiration_candidates(p_token uuid)
returns table(key text,payload jsonb) language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.pipeline_tasks t where t.key='publication:expire' and t.kind='public_expire' and t.status='running' and t.token=p_token and t.lease_until>now()) then raise exception 'Expiration claim expired'; end if;
  return query select t.key,t.payload from public.pipeline_tasks t left join public.pipeline_refresh_receipts r on r.task_key=t.key
    where t.kind in ('public_refresh','series_refresh') and t.status<>'done' and t.payload->>'revision' is distinct from r.revision
    order by t.priority desc,t.created_at,t.key limit 200;
end;
$$;
create or replace function public.pipeline_record_expirations(p_token uuid,p_items jsonb)
returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare saved integer;
begin
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>200 then raise exception 'Invalid expiration receipt batch'; end if;
  perform 1 from public.pipeline_tasks where key='publication:expire' and kind='public_expire' and status='running' and token=p_token and lease_until>now();
  if not found then raise exception 'Expiration claim expired'; end if;
  with candidates as materialized (
    select t.key,t.payload->>'revision' as revision from public.pipeline_tasks t join jsonb_array_elements(p_items) item on item->>'key'=t.key
      where t.kind in ('public_refresh','series_refresh') and t.payload->>'revision'=item->>'revision'
  ), recorded as (
    insert into public.pipeline_refresh_receipts(task_key,revision,requested_at) select key,revision,now() from candidates
    on conflict(task_key) do update set revision=excluded.revision,requested_at=excluded.requested_at returning task_key
  ) select count(*)::integer into saved from recorded;
  -- A series task means "request refresh" only. It never claims HTML verification.
  update public.pipeline_tasks t set status='done',finished_at=now(),updated_at=now(),result=jsonb_build_object('requestedAt',r.requested_at,'verified',false)
    from public.pipeline_refresh_receipts r where t.key=r.task_key and t.kind='series_refresh' and t.payload->>'revision'=r.revision and t.status='pending';
  return saved;
end;
$$;
revoke all on function public.pipeline_enqueue_series(jsonb,text),public.pipeline_series_revision() from public,anon,authenticated;
grant execute on function public.pipeline_enqueue_series(jsonb,text),public.pipeline_series_revision() to service_role;
-- Include series already affected by the existing backlog, without touching races.
select public.pipeline_enqueue_series(to_jsonb(s)) from public.series s where exists(select 1 from public.events e join public.pipeline_tasks t on t.entity_id=e.id where e.series_id=s.id and t.kind='public_refresh' and t.status<>'done');

create or replace function public.pipeline_publication_counts()
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
  select jsonb_build_object('awaitingRequest',count(*) filter(where t.payload->>'revision' is distinct from r.revision),
    'requestedAwaitingCheck',count(*) filter(where t.payload->>'revision' is not distinct from r.revision),'awaitingCheck',count(*),
    'seriesAwaitingRequest',(select count(*) from public.pipeline_tasks s left join public.pipeline_refresh_receipts sr on sr.task_key=s.key where s.kind='series_refresh' and s.status<>'done' and s.payload->>'revision' is distinct from sr.revision))
  from public.pipeline_tasks t left join public.pipeline_refresh_receipts r on r.task_key=t.key
  where t.kind='public_refresh' and t.status<>'done';
$$;
