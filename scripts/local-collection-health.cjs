/** The Mac snapshot uses local catalogue rows, with the same source scope as the normal reader. */
function collectionHealthQuery(countries) {
  const codes = countries.split(',');
  if (codes.some(code => !/^[A-Z]{2}$/.test(code))) throw Error('Invalid catalogue countries');
  return `with scope as (
    select id, status, kind, last_fetched_at, next_poll_at, operational_state, last_extract_status, last_error, url
    from public.watched_urls
  ), nearby as (
    select e.id, e.regulations_url
    from public.events e join public.locations l on l.id=e.location_id
    where e.visibility='public' and e.merged_into_id is null
      and e.status not in ('cancelled','hidden') and coalesce(e.event_type,'') <> 'ride'
      and l.country_code in (${codes.map(code => "'" + code + "'").join(',')})
      and e.start_date between current_date and current_date+30
  ), upcoming_10m as (
    select e.id, e.regulations_url, e.practical_details
    from public.events e join public.locations l on l.id=e.location_id
    where e.visibility='public' and e.merged_into_id is null
      and e.status not in ('cancelled','hidden') and coalesce(e.event_type,'') <> 'ride'
      and l.country_code in (${codes.map(code => "'" + code + "'").join(',')})
      and e.start_date between current_date and current_date+300
  ), unmonitored as (
    select n.id
    from nearby n join public.event_sources s on s.event_id=n.id join public.watched_urls w on w.id=s.watched_url_id
    group by n.id
    having bool_or(w.status='paused') and not bool_or(w.status='active')
  ), broken_readers as (
    select w.url, w.kind, w.operational_state as state,
      count(distinct e.id) as races,
      left(coalesce(w.last_error, w.last_extract_status, ''), 140) as error,
      w.last_fetched_at
    from scope w
    left join public.event_sources s on s.watched_url_id=w.id
    left join public.events e on e.id=s.event_id and e.merged_into_id is null
    where w.status='active'
      and w.url not ilike '%portal.czechcyclingfederation.com/Races%'
      and (w.operational_state in ('broken','unreadable','review') or w.last_extract_status in ('needs_review','error'))
    group by w.id, w.url, w.kind, w.operational_state, w.last_error, w.last_extract_status, w.last_fetched_at
    order by count(distinct e.id) desc, w.last_fetched_at desc nulls last
    limit 5
  )
  select json_build_object(
    'at',now(),
    'sources',(select json_build_object('active',count(*),'due',count(*) filter(where next_poll_at<=now()),
      'late24h',count(*) filter(where next_poll_at<=now()-interval '1 day'),
      'neverRead',count(*) filter(where last_fetched_at is null),'unreadable',count(*) filter(where operational_state='unreadable'),
      'broken',count(*) filter(where operational_state='broken'))
      from scope where status='active' and url not ilike '%portal.czechcyclingfederation.com/Races%'),
    'nearby',(select json_build_object('total',count(*),'missingRegulations',count(*) filter(where nullif(btrim(regulations_url),'') is null),
      'pausedSourcesOnly',(select count(*) from unmonitored)) from nearby),
    'brokenReaders',coalesce((select json_agg(json_build_object('url',r.url,'kind',r.kind,'state',r.state,'races',r.races,'error',r.error,'lastFetchedAt',r.last_fetched_at)
      order by r.races desc, r.last_fetched_at desc nulls last) from broken_readers r),'[]'::json),
    'upcoming10m',(select json_build_object('total',count(*),'missingRegulations',count(*) filter(where nullif(btrim(regulations_url),'') is null),
      'missingDetails',count(*) filter(where not (practical_details ?| array['venue','routes','fees','schedule','categories']))) from upcoming_10m)
  )`;
}
module.exports = { collectionHealthQuery };
