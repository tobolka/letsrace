create function public.pipeline_health() returns jsonb language sql security invoker set search_path = public as $$
 select jsonb_build_object(
  'sources',(select count(*) from watched_urls where status='active'),
  'due',(select count(*) from watched_urls where status='active' and next_poll_at<=now()),
  'reads24h',count(*),'ok24h',count(*) filter(where ok is true),
  'failed24h',count(*) filter(where ok is false),
  'lastSuccessAt',max(finished_at) filter(where ok is true)
 ) from ingest_runs where started_at>now()-interval '24 hours'
$$;
revoke all on function public.pipeline_health() from public,anon,authenticated;
grant execute on function public.pipeline_health() to service_role;
