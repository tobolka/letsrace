-- One coalesced publication of shared views, independent of the 60 detail checks/day.
-- Attempts, including failures/crashes, are bounded to one per six hours and four/24h.
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


create function public.pipeline_enqueue_catalogue()
returns void language sql security invoker set search_path=public,pg_temp as $$
  insert into public.pipeline_tasks(key,kind,capability,priority,payload,available_at)
  values('catalogue:upcoming','catalogue_refresh','web',80,jsonb_build_object('revision',gen_random_uuid()),now())
  on conflict(key) do update set payload=excluded.payload,
    status=case when pipeline_tasks.status='running' then 'running' else 'pending' end,
    available_at=least(pipeline_tasks.available_at,excluded.available_at),finished_at=null,last_error=null,updated_at=now();
$$;

-- Only fields that affect the shared feed; a heartbeat, evidence update or manual lock is not a new public list.
create function public.pipeline_catalogue_event_content(value jsonb)
returns jsonb language sql immutable security invoker set search_path=public,pg_temp as $$
  select jsonb_object_agg(key,val) from jsonb_each(value) as pair(key,val) where key=any(array[
    'id','slug','name','start_date','end_date','disciplines','formats','audience','age_categories','age_confidence',
    'status','visibility','merged_into_id','event_type','competition_type','season','website_url','registration_url',
    'regulations_url','results_url','registration_closes_at','source_kind','level','class_label','uci_class','location_id','series_id']);
$$;

create function public.pipeline_queue_catalogue_change()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare relevant boolean:=false;
begin
  if tg_table_name='events' then
    if tg_op<>'DELETE' then relevant:=new.visibility='public' and new.start_date>=current_date; end if;
    if tg_op<>'INSERT' then relevant:=relevant or (old.visibility='public' and old.start_date>=current_date); end if;
    if tg_op='UPDATE' and public.pipeline_catalogue_event_content(to_jsonb(new))=public.pipeline_catalogue_event_content(to_jsonb(old)) then return null; end if;
  elsif tg_table_name='locations' then
    if (new.name,new.municipality,new.country_code,new.lat,new.lng) is not distinct from (old.name,old.municipality,old.country_code,old.lat,old.lng) then return null; end if;
    relevant:=exists(select 1 from public.events where location_id=new.id and visibility='public' and start_date>=current_date);
  elsif tg_table_name='series' then
    if (new.name,new.slug,new.visibility,new.website_url,new.age_categories) is not distinct from (old.name,old.slug,old.visibility,old.website_url,old.age_categories) then return null; end if;
    relevant:=exists(select 1 from public.events where series_id=new.id and visibility='public' and start_date>=current_date);
  end if;
  if relevant then perform public.pipeline_enqueue_catalogue(); end if;
  return null;
end;
$$;
create trigger pipeline_queue_catalogue_event after insert or update or delete on public.events for each row execute function public.pipeline_queue_catalogue_change();
create trigger pipeline_queue_catalogue_location after update on public.locations for each row execute function public.pipeline_queue_catalogue_change();
create trigger pipeline_queue_catalogue_series after update on public.series for each row execute function public.pipeline_queue_catalogue_change();
revoke all on function public.pipeline_enqueue_catalogue(),public.pipeline_catalogue_event_content(jsonb),public.pipeline_queue_catalogue_change() from public,anon,authenticated;
grant execute on function public.pipeline_enqueue_catalogue(),public.pipeline_catalogue_event_content(jsonb),public.pipeline_queue_catalogue_change() to service_role;
-- Existing saved changes also need the shared view; no event records are changed.
select public.pipeline_enqueue_catalogue();
