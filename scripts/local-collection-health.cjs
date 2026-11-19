/** The Mac snapshot uses local catalogue rows, with the same source scope as the normal reader. */
function collectionHealthQuery(countries) {
  const codes = countries.split(',');
  if (codes.some(code => !/^[A-Z]{2}$/.test(code))) throw Error('Invalid catalogue countries');
  return `with scope as (
    select status, last_fetched_at, next_poll_at, operational_state, url
    from public.watched_urls
  ), nearby as (
    select e.id, e.regulations_url
    from public.events e join public.locations l on l.id=e.location_id
    where e.visibility='public' and e.merged_into_id is null
      and e.status not in ('cancelled','hidden') and coalesce(e.event_type,'') <> 'ride'
      and l.country_code in (${codes.map(code => "'" + code + "'").join(',')})
      and e.start_date between current_date and current_date+30
  ), unmonitored as (
    select n.id
    from nearby n join public.event_sources s on s.event_id=n.id join public.watched_urls w on w.id=s.watched_url_id
    group by n.id
    having bool_or(w.status='paused') and not bool_or(w.status='active')
  )
  select json_build_object(
    'at',now(),
    'sources',(select json_build_object('active',count(*),'due',count(*) filter(where next_poll_at<=now()),
      'late24h',count(*) filter(where next_poll_at<=now()-interval '1 day'),
      'neverRead',count(*) filter(where last_fetched_at is null),'unreadable',count(*) filter(where operational_state='unreadable'))
      from scope where status='active' and url not ilike '%portal.czechcyclingfederation.com/Races%'),
    'nearby',(select json_build_object('total',count(*),'missingRegulations',count(*) filter(where nullif(btrim(regulations_url),'') is null),
      'pausedSourcesOnly',(select count(*) from unmonitored)) from nearby)
  )`;
}
module.exports = { collectionHealthQuery };
