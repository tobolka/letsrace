-- Search the cheap way first, guess only when that finds nothing.
--
-- The single-query version scored word_similarity for every upcoming row on
-- every search (~440 ms), and its 0.5 threshold let "cyklokros tabor" land on
-- "Jičínská cykloliga". Now an all-words substring pass runs first; only when
-- it is empty does the trigram pass run, pre-filtered through a GIN index on
-- the query's longest word and held to pg_trgm's default 0.6 word similarity.

create index if not exists events_search_text_trgm_idx
  on public.events using gin (search_text extensions.gin_trgm_ops);

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
  probe text;
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

  -- Words under four letters carry too few trigrams to guess from.
  select t into probe
    from unnest(toks) as t
    where length(t) >= 4
    order by length(t) desc, t
    limit 1;
  if probe is null then
    return;
  end if;

  return query
    with cand as (
      select e.id, e.start_date, ' ' || e.search_text || ' ' as hay
      from public.events e
      where probe <% e.search_text
        and e.merged_into_id is null
        and e.visibility = 'public'
        and e.start_date >= date_from
        and (date_to is null or e.start_date <= date_to)
    ),
    scored as (
      select
        c.id,
        c.start_date,
        bool_and(
          position(t in c.hay) > 0
          or (length(t) >= 4 and word_similarity(t, c.hay) >= 0.6)
        ) as ok,
        avg(case when position(t in c.hay) > 0 then 1.0 else word_similarity(t, c.hay) end)::real as sc
      from cand c
      cross join unnest(toks) as t
      group by c.id, c.start_date
    ),
    hits as (
      select * from scored where ok
    )
    select h.id, h.sc, true
    from hits h
    -- A guess is only as good as the best guess: keep the ones close to it.
    where h.sc >= (select max(sc) from hits) - 0.1
    order by h.sc desc, h.start_date
    limit lim;
end;
$$;

grant execute on function public.search_event_ids(text, date, date, integer) to anon, authenticated, service_role;
