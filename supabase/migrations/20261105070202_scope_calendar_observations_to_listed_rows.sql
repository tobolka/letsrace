-- A partially processed calendar proves freshness only for rows actually seen.
-- This operation never hides anything or changes a source's schedule.
create function public.pipeline_touch_listed_events(
  p_source uuid, p_key text, p_token uuid, p_url text, p_ids text[]
) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare changed_count integer;
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
  update public.events e set last_seen_at=now()
    where e.start_date >= (now() at time zone 'UTC')::date
      and e.visibility='public' and e.merged_into_id is null
      and (e.last_seen_at is null or e.last_seen_at < now()-interval '1 hour')
      and exists (select 1 from public.event_sources s
        where s.event_id=e.id and s.watched_url_id=p_source and s.external_id=any(p_ids));
  get diagnostics changed_count=row_count;
  return changed_count;
end;
$$;
revoke execute on function public.pipeline_touch_listed_events(uuid,text,uuid,text,text[]) from public,anon,authenticated;
grant execute on function public.pipeline_touch_listed_events(uuid,text,uuid,text,text[]) to service_role;
