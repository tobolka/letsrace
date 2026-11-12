-- Keep a distinction between delivering an expiration request and observing public HTML.
create or replace function public.pipeline_queue_public_revision()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  previous_slugs jsonb := '[]';
  new_content jsonb := public.pipeline_event_content(to_jsonb(new));
  critical_fields text[] := array['slug','name','start_date','end_date','status','visibility','merged_into_id','location_id','series_id','registration_url'];
  critical boolean := true;
begin
  if tg_op = 'UPDATE' then
    if new.public_revision = old.public_revision then return new; end if;
    if new.slug is distinct from old.slug then previous_slugs := jsonb_build_array(old.slug); end if;
    critical := exists(
      select 1 from unnest(critical_fields) as field(name)
      where new_content->field.name is distinct from to_jsonb(old)->field.name
    );
  end if;

  insert into public.pipeline_tasks(key,kind,capability,entity_id,priority,payload,available_at)
  values('public:'||new.id,'public_refresh','web',new.id,case when critical then 100 else 40 end,
    jsonb_build_object('revision',new.public_revision,'slug',new.slug,'previousSlugs',previous_slugs,
      'expected',new_content,'htmlCheck',case when critical then 'required' else 'sample' end),
    now()+interval '1 minute')
  on conflict(key) do update set
    payload = excluded.payload || jsonb_build_object(
      'previousSlugs', case when pipeline_tasks.status='done' then previous_slugs
        else coalesce(pipeline_tasks.payload->'previousSlugs','[]')||previous_slugs end,
      'htmlCheck', case when pipeline_tasks.status<>'done'
        and (pipeline_tasks.priority in (30,100) or pipeline_tasks.payload->>'htmlCheck'='required')
        then 'required' else excluded.payload->>'htmlCheck' end),
    priority = case when pipeline_tasks.status='done' then excluded.priority else greatest(pipeline_tasks.priority,excluded.priority) end,
    status = case when pipeline_tasks.status='running' then 'running' else 'pending' end,
    available_at = least(pipeline_tasks.available_at,excluded.available_at),finished_at=null,last_error=null,updated_at=now();
  return new;
end;
$$;

create function public.pipeline_close_unsampled_race_checks()
returns integer language sql security invoker set search_path=public,pg_temp as $$
  with candidates as materialized (
    select t.key, receipt.requested_at
    from public.pipeline_tasks t
    join public.pipeline_refresh_receipts receipt on receipt.task_key=t.key and receipt.revision=t.payload->>'revision'
    join public.events e on e.id=t.entity_id and e.public_revision::text=receipt.revision
    where t.kind='public_refresh' and t.status='pending'
      and t.priority in (10,40) and t.last_error is null
      and coalesce(t.payload->>'htmlCheck','sample')='sample'
      and coalesce(t.payload->'previousSlugs','[]'::jsonb)='[]'::jsonb
      and e.slug=t.payload->>'slug' and e.visibility='public' and e.merged_into_id is null
      and e.status in ('scheduled','registration_open','completed')
      and mod(hashtextextended(t.key||':'||receipt.revision,0),10)<>0
    order by t.updated_at,t.key
    limit 1000
    for update of t skip locked
  ), closed as (
    update public.pipeline_tasks t
    set status='done',token=null,lease_until=null,finished_at=now(),updated_at=now(),
      result=jsonb_build_object('verified',false,'verification','outside_sample',
        'revision',t.payload->>'revision','refreshRequestedAt',candidates.requested_at)
      || case when t.result ? 'verifiedAt' then jsonb_build_object('previousVerification',t.result) else '{}'::jsonb end
    from candidates where t.key=candidates.key
    returning t.key
  )
  select count(*)::integer from closed;
$$;

revoke all on function public.pipeline_close_unsampled_race_checks() from public,anon,authenticated;
grant execute on function public.pipeline_close_unsampled_race_checks() to service_role;
