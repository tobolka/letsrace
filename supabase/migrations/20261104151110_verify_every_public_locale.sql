-- A successful check in the old two-locale policy is incomplete under the five-locale policy.
-- Preserve prior attempt records and reuse matching refresh receipts.
with reopened as (
  update public.pipeline_tasks
  set status='pending',finished_at=null,available_at=now(),last_error=null,updated_at=now()
  where kind in ('public_refresh','series_refresh') and status='done' and result ? 'verifiedAt'
    and not coalesce(result->'locales' @> '["cs","en","de","pl","sk"]'::jsonb,false)
  returning key,payload
)
select public.pipeline_enqueue_expiration()
where exists (
  select 1 from reopened t left join public.pipeline_refresh_receipts r on r.task_key=t.key
  where t.payload->>'revision' is distinct from r.revision
);
