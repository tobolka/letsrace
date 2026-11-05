-- Only consecutive successful, complete reads with no discoveries can prove a leaf page fruitless.
-- Pausing is reversible, keeps history, and the marker in notes identifies every automatic decision.
create or replace function public.pipeline_pause_fruitless_sources(p_min_reads integer default 3, p_limit integer default 200)
returns integer
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
declare paused integer;
begin
  with due as (
    select w.id
    from public.watched_urls w
    where w.status = 'active'
      and w.added_by = 'auto-same-domain'
      and coalesce(w.last_extract_status, '') not in ('off_season', 'error', 'dead')
      and regexp_replace(w.url, '^https?://[^/]+/?', '') <> ''
      and position((extract(year from now())::integer + 1)::text in w.url) = 0
      and not exists (select 1 from public.event_sources s where s.watched_url_id = w.id or s.source_url = w.url)
      and not exists (select 1 from public.watched_urls c join public.event_sources s on s.watched_url_id = c.id where c.parent_id = w.id)
      and not exists (select 1 from public.events e where e.website_url = w.url or e.registration_url = w.url or e.regulations_url = w.url)
      and not exists (select 1 from public.pipeline_candidates c where c.watched_url_id = w.id and c.status in ('pending', 'waiting', 'conflict', 'publishing'))
      and not exists (select 1 from public.watched_urls c where c.parent_id = w.id and c.status = 'active')
      and not exists (select 1 from public.pipeline_tasks t where t.key = 'source:' || w.id and t.status = 'running')
      and not exists (select 1 from public.ingest_runs r where r.watched_url_id = w.id and coalesce(r.events_upserted, 0) > 0)
      and (
        select count(*) >= least(greatest(p_min_reads, 3), 20)
          and bool_and(
            r.ok is true and r.finished_at is not null
            and coalesce(r.http_status between 200 and 299, false)
            and r.metrics->>'complete' is not distinct from 'true'
            and r.metrics->>'extracted' is not distinct from '0'
            and coalesce(r.metrics->>'deferred', 'false') = 'false'
            and coalesce(r.metrics->>'pendingWrites', '0') = '0'
            and coalesce(r.metrics->>'failed', '0') = '0'
            and coalesce(r.metrics->>'deferredWrites', '0') = '0'
            and coalesce(r.metrics->'issues', '[]'::jsonb) = '[]'::jsonb
            and coalesce(r.links_discovered, 0) = 0
          )
        from (
          select r.ok,r.finished_at,r.http_status,r.metrics,r.links_discovered
          from public.ingest_runs r where r.watched_url_id = w.id
          order by r.started_at desc, r.id desc
          limit least(greatest(p_min_reads, 3), 20)
        ) r
      )
    order by w.created_at
    limit least(greatest(p_limit, 1), 500)
    for update of w skip locked
  ), updated as (
    update public.watched_urls w
    set status = 'paused', notes = trim(coalesce(w.notes, '') || ' [auto-bez-zavodu]'), updated_at = now()
    from due
    where w.id = due.id
    returning w.id
  )
  select count(*)::integer into paused from updated;
  return paused;
end;
$$;

revoke execute on function public.pipeline_pause_fruitless_sources(integer, integer) from public, anon, authenticated;
grant execute on function public.pipeline_pause_fruitless_sources(integer, integer) to service_role;
