-- A completed source read and completion of its individual writes are separate.
alter table public.watched_urls add column if not exists calendar_write_progress jsonb;
comment on column public.watched_urls.calendar_write_progress is 'Versioned per-source fingerprints and retry times for deterministic calendar rows.';

-- Page the joined result directly, rather than making PostgREST build an
-- embedded location for each candidate row before sorting and pagination.
create or replace function public.public_edition_candidates(
  p_country text, p_from date, p_until date, p_after uuid default null
) returns table(id uuid, name text, slug text, start_date date, series_id uuid, disciplines text[], status text, visibility text, location jsonb)
language sql stable security invoker set search_path = ''
as $$
  select e.id, e.name, e.slug, e.start_date, e.series_id, e.disciplines, e.status, e.visibility,
    jsonb_build_object('lat', l.lat, 'lng', l.lng, 'country_code', l.country_code, 'municipality', l.municipality)
  from public.events e join public.locations l on l.id = e.location_id
  where l.country_code = p_country and e.visibility = 'public' and e.merged_into_id is null
    and e.start_date >= p_from and e.start_date < p_until
    and (p_after is null or e.id > p_after)
  order by e.id limit 1000;
$$;

-- Limit the already filtered, deduplicated round set before loading related
-- presentation fields. Include legacy primary memberships as a fallback.
create or replace function public.public_series_round_rows(
  p_series uuid, p_statuses text[], p_countries text[]
) returns setof public.events
language sql stable security invoker set search_path = ''
as $$
  with members as (
    select es.event_id from public.event_series es where es.series_id = p_series
    union
    select e.id from public.events e where e.series_id = p_series
  )
  select e.*
  from members m join public.events e on e.id = m.event_id
  join public.locations l on l.id = e.location_id
  where e.visibility = 'public' and e.merged_into_id is null
    and e.status = any(p_statuses) and l.country_code = any(p_countries)
  order by e.start_date, e.id limit 200;
$$;

revoke execute on function public.public_edition_candidates(text,date,date,uuid) from public, anon, authenticated;
revoke execute on function public.public_series_round_rows(uuid,text[],text[]) from public, anon, authenticated;
grant execute on function public.public_edition_candidates(text,date,date,uuid) to service_role;
grant execute on function public.public_series_round_rows(uuid,text[],text[]) to service_role;

create or replace function public.pipeline_source_state(p_state text,p_error text)
returns text language sql immutable security invoker set search_path=public,pg_temp as $$
  select case
    when coalesce(p_state,'') not in ('error','needs_review') then 'ok'
    when coalesce(p_error,'') ~ '(provider_deferred:|LLM budget of|Shared LLM budget|calendar_budget_exhausted|calendar_time_budget_exhausted|write_time_budget_exhausted|time budget exceeded|chunk_limit|source_reader_unavailable_or_running|source_changed_before_read|concurrent_event_update|calendar_write_retry_pending)' then 'deferred'
    when p_error in ('unsupported_or_empty_source','low confidence or empty extract','dynamic_render_unavailable')
      or coalesce(p_error,'') ~ '^(source_document_too_large|pdf_has_no_text)' then 'unreadable'
    when coalesce(p_error,'') ~ '(identity_review_required|pipeline_data_review_required)'
      or (p_state='needs_review' and p_error is null) then 'review'
    else 'broken' end;
$$;
