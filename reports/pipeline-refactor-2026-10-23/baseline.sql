select jsonb_build_object(
'captured_at',now(),
'catalogue',(select jsonb_build_object('total',count(*),'public_unmerged',count(*) filter(where visibility='public' and merged_into_id is null),'upcoming_public',count(*) filter(where visibility='public' and merged_into_id is null and coalesce(end_date,start_date)>=current_date),'upcoming_with_website',count(*) filter(where visibility='public' and merged_into_id is null and start_date>=current_date and website_url is not null),'upcoming_with_registration',count(*) filter(where visibility='public' and merged_into_id is null and start_date>=current_date and registration_url is not null)) from events),
'source_health',(select jsonb_agg(x) from (select status,last_extract_status,count(*) as sources from watched_urls group by 1,2 order by 3 desc) x),
'last_7_days',(select jsonb_build_object('runs',count(*),'success',count(*) filter(where ok),'failed',count(*) filter(where ok=false),'unfinished',count(*) filter(where finished_at is null),'upserts',sum(events_upserted),'links',sum(links_discovered)) from ingest_runs where started_at>=now()-interval '7 days'),
'facts',(select count(*) from event_facts),
'recent_failed_sources',(select jsonb_agg(x) from (select url,last_error,last_extract_status from watched_urls where last_extract_status in ('needs_review','error') order by last_fetched_at desc nulls last limit 12) x)
) as baseline;
