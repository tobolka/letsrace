create function public.pipeline_collector_overview()
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'jobs', coalesce((select jsonb_agg(to_jsonb(job) order by job.key) from public.pipeline_jobs job), '[]'::jsonb),
    'sources', public.pipeline_source_counts(),
    'health', public.pipeline_health(),
    'reviewCandidates', (select count(*) from public.pipeline_candidates where status in ('pending','waiting','conflict','publishing'))
  );
$$;

revoke all on function public.pipeline_collector_overview() from public,anon,authenticated;
grant execute on function public.pipeline_collector_overview() to service_role;
