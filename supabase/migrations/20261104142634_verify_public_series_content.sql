-- Refresh receipts enable public checks. A receipt alone cannot complete series work.
create or replace function public.pipeline_claim_tasks(p_kind text,p_capabilities text[],p_limit integer default 10)
returns setof public.pipeline_tasks language plpgsql security invoker set search_path=public,pg_temp as $$
declare take integer:=greatest(0,least(p_limit,100));
begin
  if p_kind in ('public_refresh','series_refresh') then
    perform pg_advisory_xact_lock(hashtextextended('pipeline-publication-budget',0));
    select greatest(0,least(take,60-count(*)::integer)) into take from public.pipeline_task_attempts
      where kind in ('public_refresh','series_refresh') and started_at>=date_trunc('day',now());
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
      and (p_kind not in ('public_refresh','series_refresh') or exists (
        select 1 from public.pipeline_refresh_receipts receipt
        where receipt.task_key=pipeline_tasks.key and receipt.revision=pipeline_tasks.payload->>'revision'
      ))
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
  return saved;
end;
$$;

create or replace function public.pipeline_series_revision()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare prior text; previous_series uuid; current_series uuid; race_id uuid; snapshot jsonb;
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
    if tg_op='UPDATE' and public.pipeline_catalogue_event_content(to_jsonb(old)) is not distinct from
      public.pipeline_catalogue_event_content(to_jsonb(new)) then return null; end if;
    if tg_op<>'INSERT' then previous_series:=old.series_id; end if;
    if tg_op<>'DELETE' then current_series:=new.series_id; end if;
    race_id:=case when tg_op='DELETE' then old.id else new.id end;
    for snapshot in select to_jsonb(s) from public.series s where s.id in (
      select previous_series union select current_series
      union select m.series_id from public.event_series m where m.event_id=race_id
    ) order by s.id loop
      perform public.pipeline_enqueue_series(snapshot);
    end loop;
  elsif tg_table_name='locations' then
    if (new.name,new.municipality,new.country_code,new.lat,new.lng) is not distinct from
      (old.name,old.municipality,old.country_code,old.lat,old.lng) then return null; end if;
    for snapshot in select to_jsonb(s) from public.series s where s.id in (
      select e.series_id from public.events e where e.location_id=new.id
      union select m.series_id from public.events e join public.event_series m on m.event_id=e.id where e.location_id=new.id
    ) order by s.id loop
      perform public.pipeline_enqueue_series(snapshot);
    end loop;
  end if;
  return null;
end;
$$;

create trigger pipeline_series_round_location after update on public.locations
for each row execute function public.pipeline_series_revision();

create or replace function public.pipeline_publication_counts()
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
  select jsonb_build_object('awaitingRequest',count(*) filter(where t.payload->>'revision' is distinct from r.revision),
    'requestedAwaitingCheck',count(*) filter(where t.payload->>'revision' is not distinct from r.revision),'awaitingCheck',count(*),
    'seriesAwaitingCheck',(select count(*) from public.pipeline_tasks s where s.kind='series_refresh' and s.status<>'done'),
    'seriesAwaitingRequest',(select count(*) from public.pipeline_tasks s left join public.pipeline_refresh_receipts sr on sr.task_key=s.key where s.kind='series_refresh' and s.status<>'done' and s.payload->>'revision' is distinct from sr.revision))
  from public.pipeline_tasks t left join public.pipeline_refresh_receipts r on r.task_key=t.key
  where t.kind='public_refresh' and t.status<>'done';
$$;

-- Retain matching receipts so previously requested pages are checked without a second refresh.
update public.pipeline_tasks t set status='pending',finished_at=null,available_at=now(),updated_at=now()
where t.kind='series_refresh' and t.status='done' and t.result->>'verified'='false';
