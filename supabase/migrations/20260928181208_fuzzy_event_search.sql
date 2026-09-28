-- Search that forgives how people type.
--
-- The explore box matched `name ilike '%query%'`, so "prazsky pohar" missed
-- "Pražský MTB pohár" three ways: no diacritics, a word in between, and the
-- words in a different order than typed. A typo ("prazky") had no chance.
--
-- search_event_ids folds text (unaccent + lower), splits the query into words
-- and requires every word to appear in the race name or any of its series
-- names. Only when nothing matches that way does it fall back to trigram
-- word_similarity, so a typo still lands on the race while an exact hit never
-- gets diluted by near misses — and a place name with no race match still
-- comes back empty, which lets the client fly the map there instead.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function public.search_fold(t text)
returns text
language sql
immutable
parallel safe
set search_path to ''
as $$
  select trim(regexp_replace(
    lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))),
    '[^a-z0-9]+', ' ', 'g'
  ))
$$;

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
    select
      e.id,
      e.start_date,
      ' ' || public.search_fold(
        e.name || ' ' || coalesce((
          select string_agg(s.name || ' ' || coalesce(s.short_name, ''), ' ')
          from public.event_series es
          join public.series s on s.id = es.series_id
          where es.event_id = e.id and s.visibility = 'public'
        ), '') || ' ' || coalesce((
          select s.name from public.series s
          where s.id = e.series_id and s.visibility = 'public'
        ), '')
      ) || ' ' as hay
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

grant execute on function public.search_fold(text) to anon, authenticated, service_role;
grant execute on function public.search_event_ids(text, date, date, integer) to anon, authenticated, service_role;
