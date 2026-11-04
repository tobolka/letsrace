create function public.pipeline_calendar_freshness(
  p_source uuid, p_key text, p_token uuid, p_url text,
  p_ids text[] default null, p_count integer default null,
  p_from date default null, p_until date default null
) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  eligible_ids uuid[];
  upcoming_count integer;
  overlap_count integer;
  changed_count integer;
  today date := (now() at time zone 'UTC')::date;
begin
  perform 1 from public.watched_urls
    where id=p_source and status='active' and url=p_url for update;
  if not found then
    raise exception 'source_reader_unavailable_or_running: source changed before calendar freshness update';
  end if;
  perform 1 from public.pipeline_tasks
    where key=p_key and entity_id=p_source and kind='source_read' and status='running'
      and token=p_token and lease_until>clock_timestamp() for update;
  if not found then
    raise exception 'source_reader_unavailable_or_running: source lease lost before calendar freshness update';
  end if;

  if p_ids is null then
    update public.events e set last_seen_at=now()
      where e.start_date>=today and e.visibility='public' and e.merged_into_id is null
        and (e.last_seen_at is null or e.last_seen_at < now()-interval '1 hour')
        and exists (select 1 from public.event_sources s where s.event_id=e.id and s.watched_url_id=p_source);
    get diagnostics changed_count=row_count;
    return changed_count;
  end if;

  if p_count is null or p_count<3 or p_from is null or p_until is null or p_until<greatest(today,p_from) then return 0; end if;
  with upcoming as materialized (
    select e.id, s.external_id, s.external_id=any(p_ids) as listed
    from public.event_sources s join public.events e on e.id=s.event_id
    where s.watched_url_id=p_source and s.external_id is not null
      and e.visibility='public' and e.merged_into_id is null
      and e.status in ('scheduled','postponed','registration_open','tbc')
      and e.start_date between greatest(today,p_from) and p_until
  ), missing as (
    select id from upcoming group by id having not bool_or(listed)
  )
  select (select count(distinct external_id) from upcoming),
    (select count(distinct external_id) from upcoming where listed),
    array(select id from missing)
  into upcoming_count, overlap_count, eligible_ids;
  if cardinality(eligible_ids)=0 or upcoming_count<3
    or overlap_count<greatest(2,ceil(upcoming_count*0.5))
    or cardinality(eligible_ids)>greatest(6,floor(upcoming_count*0.35)) then return 0; end if;

  -- Serialize with event writers and FK inserts before checking other sources.
  perform 1 from public.events where id=any(eligible_ids) order by id for update;
  with eligible as materialized (
    select e.id,e.status,e.visibility from public.events e
    where e.id=any(eligible_ids) and e.visibility='public' and e.merged_into_id is null
      and e.status in ('scheduled','postponed','registration_open','tbc')
      and e.start_date between greatest(today,p_from) and p_until
      and exists (select 1 from public.event_sources s where s.event_id=e.id and s.watched_url_id=p_source and s.external_id is not null)
      and not exists (
        select 1 from public.event_sources s where s.event_id=e.id
          and (s.watched_url_id is distinct from p_source or s.external_id=any(p_ids))
      )
      and not exists (
        select 1 from public.event_overrides o where o.event_id=e.id
          and o.locked_fields && array['status','visibility']
      )
  ), hidden as (
    update public.events e set visibility='hidden',status='hidden',updated_at=now()
    from eligible old where e.id=old.id returning e.id,old.status,old.visibility
  )
  insert into public.event_facts(event_id,field,value,previous,source_url,method,version)
    select h.id, f.field, to_jsonb('hidden'::text), to_jsonb(f.previous), p_url, 'calendar_removal', '1'
    from hidden h cross join lateral (values ('status',h.status),('visibility',h.visibility)) f(field,previous);
  get diagnostics changed_count=row_count;
  return changed_count/2;
end;
$$;
revoke execute on function public.pipeline_calendar_freshness(uuid,text,uuid,text,text[],integer,date,date) from public,anon,authenticated;
grant execute on function public.pipeline_calendar_freshness(uuid,text,uuid,text,text[],integer,date,date) to service_role;
