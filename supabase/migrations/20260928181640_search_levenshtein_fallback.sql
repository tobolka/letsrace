-- Guess typos by edit distance per word, not by trigram overlap.
--
-- Trigram word_similarity could not be tuned: "prazky" scores 0.57 against
-- "pražský", so 0.6 lost the very typo that started this, while 0.5 let
-- "cyklokros tabor" land on "Jičínská cykloliga". Levenshtein per word says
-- what a typo is: one edit for a 4–7 letter word, two for a longer one. Each
-- word is also compared with the same-length prefix of the race's words, so
-- Czech endings don't count as typos ("sumava" → "šumavský",
-- "krkonose" → "krkonošská").

create extension if not exists fuzzystrmatch with schema extensions;

drop index if exists public.events_search_text_trgm_idx;

create or replace function public.search_event_ids(
  q text,
  date_from date,
  date_to date default null,
  max_results integer default 300
)
returns table (event_id uuid, score real, fuzzy boolean)
language plpgsql
stable
set search_path to 'public', 'extensions', 'pg_temp'
as $$
#variable_conflict use_column
declare
  toks text[];
  lim integer := greatest(1, least(coalesce(max_results, 300), 500));
begin
  select coalesce(array_agg(distinct t), '{}')
    into toks
    from unnest(string_to_array(public.search_fold(q), ' ')) as t
    where t <> '';
  if cardinality(toks) = 0 then
    return;
  end if;

  -- Every typed word appears somewhere in the name or a series name.
  return query
    select e.id, 1.0::real, false
    from public.events e
    where e.merged_into_id is null
      and e.visibility = 'public'
      and e.start_date >= date_from
      and (date_to is null or e.start_date <= date_to)
      and not exists (
        select 1 from unnest(toks) as t
        where position(t in coalesce(e.search_text, '')) = 0
      )
    order by e.start_date, e.id
    limit lim;
  if found then
    return;
  end if;

  -- Words under four letters are too short to tell a typo from another word.
  if not exists (select 1 from unnest(toks) as t where length(t) >= 4) then
    return;
  end if;

  return query
    with cand as (
      select e.id, e.start_date, coalesce(e.search_text, '') as hay
      from public.events e
      where e.merged_into_id is null
        and e.visibility = 'public'
        and e.start_date >= date_from
        and (date_to is null or e.start_date <= date_to)
    ),
    dist as (
      select
        c.id,
        c.start_date,
        t,
        case
          when position(t in c.hay) > 0 then 0
          when length(t) < 4 then 99
          else (
            select min(least(levenshtein(t, w), levenshtein(t, left(w, length(t)))))
            from unnest(string_to_array(c.hay, ' ')) as w
            where w <> '' and abs(length(w) - length(t)) <= 12
          )
        end as d
      from cand c
      cross join unnest(toks) as t
    ),
    scored as (
      select
        id,
        start_date,
        bool_and(d <= case when length(t) < 4 then 0 when length(t) < 8 then 1 else 2 end) as ok,
        avg(1.0 - least(d, length(t))::numeric / length(t))::real as sc
      from dist
      group by id, start_date
    ),
    hits as (
      select * from scored where ok
    )
    select h.id, h.sc, true
    from hits h
    -- Prefer the closest guesses: one typo beats two when both exist.
    where h.sc >= (select max(sc) from hits) - 0.1
    order by h.sc desc, h.start_date
    limit lim;
end;
$$;

grant execute on function public.search_event_ids(text, date, date, integer) to anon, authenticated, service_role;
