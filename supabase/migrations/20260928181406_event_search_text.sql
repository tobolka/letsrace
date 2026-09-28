-- Fold each race's searchable text once, on write, instead of on every search.
--
-- search_event_ids folded the name and joined every series for each of ~1,200
-- upcoming rows per query — around 600 ms, most of it in unaccent. The folded
-- haystack now lives in events.search_text, kept current by triggers on
-- events (name, series_id), event_series (membership) and series (renames,
-- visibility). A search is then just string comparison over that column.

alter table public.events add column if not exists search_text text;

create or replace function public.event_search_text(eid uuid, ename text, esid uuid)
returns text
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select public.search_fold(
    coalesce(ename, '') || ' ' || coalesce((
      select string_agg(s.name || ' ' || coalesce(s.short_name, ''), ' ')
      from public.series s
      where s.visibility = 'public'
        and (
          s.id = esid
          or s.id in (select es.series_id from public.event_series es where es.event_id = eid)
        )
    ), '')
  )
$$;

create or replace function public.events_set_search_text()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  new.search_text := public.event_search_text(new.id, new.name, new.series_id);
  return new;
end;
$$;

drop trigger if exists events_set_search_text on public.events;
create trigger events_set_search_text
  before insert or update of name, series_id on public.events
  for each row execute function public.events_set_search_text();

create or replace function public.event_series_refresh_search_text()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  eid uuid := coalesce(new.event_id, old.event_id);
begin
  update public.events e
    set search_text = public.event_search_text(e.id, e.name, e.series_id)
    where e.id = eid;
  if tg_op = 'UPDATE' and old.event_id is distinct from new.event_id then
    update public.events e
      set search_text = public.event_search_text(e.id, e.name, e.series_id)
      where e.id = old.event_id;
  end if;
  return null;
end;
$$;

drop trigger if exists event_series_refresh_search_text on public.event_series;
create trigger event_series_refresh_search_text
  after insert or update or delete on public.event_series
  for each row execute function public.event_series_refresh_search_text();

create or replace function public.series_refresh_search_text()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  update public.events e
    set search_text = public.event_search_text(e.id, e.name, e.series_id)
    where e.series_id = new.id
       or e.id in (select es.event_id from public.event_series es where es.series_id = new.id);
  return null;
end;
$$;

drop trigger if exists series_refresh_search_text on public.series;
create trigger series_refresh_search_text
  after update of name, short_name, visibility on public.series
  for each row
  when (
    old.name is distinct from new.name
    or old.short_name is distinct from new.short_name
    or old.visibility is distinct from new.visibility
  )
  execute function public.series_refresh_search_text();

update public.events e
  set search_text = public.event_search_text(e.id, e.name, e.series_id)
  where e.merged_into_id is null;

create or replace function public.search_event_ids(
  q text,
  date_from date,
  date_to date default null,
  max_results integer default 300
)
returns table (event_id uuid, score real, fuzzy boolean)
language sql
stable
set search_path to 'public', 'extensions', 'pg_temp'
as $$
  with toks as (
    select distinct t
    from unnest(string_to_array(public.search_fold(q), ' ')) as t
    where t <> ''
  ),
  cand as (
    select e.id, e.start_date, ' ' || coalesce(e.search_text, '') || ' ' as hay
    from public.events e
    where e.merged_into_id is null
      and e.visibility = 'public'
      and e.start_date >= date_from
      and (date_to is null or e.start_date <= date_to)
  ),
  scored as (
    select
      c.id,
      c.start_date,
      bool_and(position(t in c.hay) > 0) as exact,
      -- Words under four letters carry too few trigrams to guess from.
      bool_and(
        position(t in c.hay) > 0
        or (length(t) >= 4 and word_similarity(t, c.hay) >= 0.5)
      ) as near,
      avg(
        case
          when position(' ' || t || ' ' in c.hay) > 0 then 1.0
          when position(t in c.hay) > 0 then 0.9
          else word_similarity(t, c.hay)
        end
      )::real as score
    from cand c
    cross join toks
    group by c.id, c.start_date
  ),
  tier as (
    select exists (select 1 from scored where exact) as has_exact
  ),
  hits as (
    select s.*
    from scored s, tier
    where case when tier.has_exact then s.exact else s.near end
  )
  select h.id, h.score, not h.exact
  from hits h
  -- A guess is only as good as the best guess: keep the ones close to it.
  where h.exact or h.score >= (select max(score) from hits) - 0.1
  order by h.score desc, h.start_date asc
  limit greatest(1, least(max_results, 500))
$$;
