-- Automatically added follow-up pages stop being read once they have repeatedly produced no race.
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
      and regexp_replace(w.url, '^https?://[^/]+/?', '') <> ''
      and position((extract(year from now())::integer + 1)::text in w.url) = 0
      and not exists (select 1 from public.event_sources s where s.watched_url_id = w.id or s.source_url = w.url)
      and not exists (select 1 from public.watched_urls c join public.event_sources s on s.watched_url_id = c.id where c.parent_id = w.id)
      and not exists (select 1 from public.events e where e.website_url = w.url or e.registration_url = w.url or e.regulations_url = w.url)
      and not exists (select 1 from public.pipeline_candidates c where c.watched_url_id = w.id and c.status in ('pending', 'waiting'))
      and not exists (select 1 from public.pipeline_tasks t where t.key = 'source:' || w.id and t.status = 'running')
      and not exists (select 1 from public.ingest_runs r where r.watched_url_id = w.id and coalesce(r.events_upserted, 0) > 0)
      and (select count(*) from public.ingest_runs r where r.watched_url_id = w.id) >= greatest(p_min_reads, 1)
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
