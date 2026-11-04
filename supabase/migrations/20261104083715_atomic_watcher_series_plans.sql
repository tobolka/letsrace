-- Keep the established race and candidate writers as the write boundary.
-- Materialize new foreign keys before them and change existing series after
-- them, since the series trigger advances the revisions of linked races.
create function public.pipeline_write_watcher_with_series(p_operation text,p_args jsonb,p_series jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  plan jsonb; held public.series; proposed public.series; candidate public.pipeline_candidates;
  v_event_id uuid := (p_args->>'p_event')::uuid;
  secondary uuid[]; receipt jsonb; series_id uuid; payload jsonb;
begin
  if p_operation is null or p_operation not in ('create','update','publish')
    or jsonb_typeof(p_series) is distinct from 'array'
    then raise exception 'Invalid watcher series plan'; end if;
  if p_operation='publish' then
    select * into candidate from public.pipeline_candidates where id=(p_args->>'p_id')::uuid for update;
    if not found or candidate.publish_token is null or candidate.publish_token is distinct from (p_args->>'p_token')::uuid
      or candidate.evidence_hash is distinct from p_args->>'p_hash' then raise exception 'Candidate publication lease lost'; end if;
    if candidate.status='published' and candidate.publication_result is not null then return candidate.publication_result; end if;
    if candidate.status<>'publishing' or candidate.publish_error is not null
      or candidate.publish_lease_until is null or candidate.publish_lease_until<=clock_timestamp() then raise exception 'Candidate publication lease lost'; end if;
  end if;

  payload:=case when p_operation='update' then p_args->'p_patch' else p_args->'p_payload' end;
  secondary:=array(select value::uuid from jsonb_array_elements_text(coalesce(
    case when p_operation='update' then p_args#>'{p_evidence,secondarySeries}' else p_args->'p_secondary' end,'[]')));
  for plan in select value from jsonb_array_elements(p_series) order by value->>'slug' loop
    series_id:=(plan->>'id')::uuid;
    if series_id is null or nullif(plan->>'slug','') is null
      or not (coalesce(payload->>'series_id'=series_id::text,false) or series_id=any(secondary))
      then raise exception 'Unattached watcher series plan'; end if;
    select * into held from public.series where slug=plan->>'slug' for no key update;
    if plan ? 'create' then
      if found then raise exception 'concurrent_event_update: series created since planning'; end if;
      proposed:=jsonb_populate_record(null::public.series,plan->'create');
      begin
        insert into public.series(id,slug,name,name_normalized,website_url,audience_hint,country_code,disciplines,
          age_categories,series_type,level,competition_type,season,source_url,source_kind,last_seen_at,updated_at)
        values(series_id,plan->>'slug',proposed.name,proposed.name_normalized,proposed.website_url,proposed.audience_hint,
          proposed.country_code,proposed.disciplines,proposed.age_categories,proposed.series_type,proposed.level,
          proposed.competition_type,proposed.season,proposed.source_url,proposed.source_kind,now(),now());
      exception when unique_violation then
        raise exception 'concurrent_event_update: series created since planning';
      end;
    elsif not found or held.id is distinct from series_id
      or jsonb_typeof(plan->'expected') is distinct from 'object'
      or jsonb_typeof(plan->'patch') is distinct from 'object'
      or (to_jsonb(held)-'last_seen_at') is distinct from
        (to_jsonb(jsonb_populate_record(null::public.series,plan->'expected'))-'last_seen_at')
      then raise exception 'concurrent_event_update: series changed since planning';
    end if;
  end loop;

  if p_operation='create' then
    receipt:=public.pipeline_create_watcher_event(v_event_id,payload,p_args->'p_source',p_args->>'p_hash',p_args->>'p_reader',
      (p_args->>'p_reviewed')::boolean,nullif(p_args->'p_location','null'),p_args->'p_categories',secondary,nullif(p_args->'p_lease','null'));
  elsif p_operation='update' then
    receipt:=public.pipeline_update_watcher_bundle(v_event_id,(p_args->>'p_revision')::uuid,payload,p_args->'p_evidence',
      p_args->'p_source',p_args->>'p_source_hash',p_args->>'p_reader',p_args->'p_categories');
  else
    receipt:=public.pipeline_publish_candidate((p_args->>'p_id')::uuid,(p_args->>'p_token')::uuid,p_args->>'p_hash',
      v_event_id,(p_args->>'p_revision')::uuid,payload,p_args->'p_source',p_args->>'p_source_hash',
      p_args->>'p_reader',nullif(p_args->'p_location','null'),p_args->'p_categories',secondary);
  end if;

  for plan in select value from jsonb_array_elements(p_series) loop
    series_id:=(plan->>'id')::uuid;
    if not exists(select 1 from public.events e where e.id=v_event_id and e.series_id=(plan->>'id')::uuid)
      and not exists(select 1 from public.event_series m where m.event_id=v_event_id and m.series_id=(plan->>'id')::uuid)
      then
        if plan ? 'create' then raise exception 'concurrent_event_update: new series membership was refused'; end if;
        continue;
    end if;
    if plan ? 'create' then continue; end if;
    select * into held from public.series where id=series_id;
    proposed:=jsonb_populate_record(held,plan->'patch');
    if (plan->'patch')-'last_seen_at'-'updated_at' <> '{}'::jsonb then
      update public.series set name_normalized=proposed.name_normalized,website_url=proposed.website_url,
        country_code=proposed.country_code,disciplines=proposed.disciplines,
        age_categories=case when held.age_categories_confirmed_at is null then proposed.age_categories else held.age_categories end,
        audience_hint=case when held.age_categories_confirmed_at is null then proposed.audience_hint else held.audience_hint end,
        level=proposed.level,competition_type=proposed.competition_type,season=proposed.season,
        series_type=proposed.series_type,source_url=proposed.source_url,source_kind=proposed.source_kind,
        last_seen_at=now(),updated_at=now() where id=series_id;
    elsif held.last_seen_at is null or held.last_seen_at<now()-interval '1 day' then
      update public.series set last_seen_at=now() where id=series_id;
    end if;
  end loop;
  return receipt;
end;
$$;

revoke execute on function public.pipeline_write_watcher_with_series(text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.pipeline_write_watcher_with_series(text,jsonb,jsonb) to service_role;
