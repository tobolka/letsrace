-- Close routine sample checks and aged critical checks (without slug renames or errors)
-- once their expiration receipt ages past the 35-minute buffer over the 30-minute edge TTL,
-- include routine edits on non-public/merged/non-scheduled races and demoted pre-Nov-12 tasks,
-- and re-sync any pending tasks whose payload revision drifted behind events.public_revision.

update public.pipeline_tasks t
set
  payload = jsonb_build_object(
    'revision', e.public_revision,
    'slug', e.slug,
    'previousSlugs', coalesce(t.payload->'previousSlugs', '[]'::jsonb),
    'expected', public.pipeline_event_content(to_jsonb(e)),
    'htmlCheck', case
      when t.priority in (30, 100) or t.payload->>'htmlCheck' = 'required' then 'required'
      else 'sample'
    end
  ),
  last_error = null,
  available_at = now() + interval '1 minute',
  updated_at = now()
from public.events e
where t.kind = 'public_refresh'
  and t.status = 'pending'
  and t.entity_id = e.id
  and e.public_revision::text is distinct from t.payload->>'revision';

create or replace function public.pipeline_close_unsampled_race_checks()
returns integer language sql security invoker set search_path=public,pg_temp as $$
  with candidates as materialized (
    select
      t.key,
      receipt.requested_at,
      case
        when t.priority in (10, 20, 30, 40)
          and coalesce(t.payload->>'htmlCheck', 'sample') = 'sample' then
          case
            when e.visibility <> 'public'
              or e.merged_into_id is not null
              or e.status not in ('scheduled', 'registration_open', 'completed') then 'non_public_routine'
            when mod(hashtextextended(t.key || ':' || receipt.revision, 0), 10) <> 0 then 'outside_sample'
            else 'receipt_aged_out'
          end
        else 'edge_ttl_expired'
      end as verification_reason
    from public.pipeline_tasks t
    join public.pipeline_refresh_receipts receipt
      on receipt.task_key = t.key and receipt.revision = t.payload->>'revision'
    join public.events e
      on e.id = t.entity_id and e.public_revision::text = receipt.revision
    where t.kind = 'public_refresh'
      and t.status = 'pending'
      and t.last_error is null
      and coalesce(t.payload->'previousSlugs', '[]'::jsonb) = '[]'::jsonb
      and e.slug = t.payload->>'slug'
      and (
        (
          t.priority in (10, 20, 30, 40)
          and coalesce(t.payload->>'htmlCheck', 'sample') = 'sample'
          and (
            receipt.requested_at <= now() - interval '35 minutes'
            or e.visibility <> 'public'
            or e.merged_into_id is not null
            or e.status not in ('scheduled', 'registration_open', 'completed')
            or mod(hashtextextended(t.key || ':' || receipt.revision, 0), 10) <> 0
          )
        )
        or (
          (t.priority in (30, 100) or t.payload->>'htmlCheck' = 'required')
          and not (t.priority in (10, 20, 30, 40) and coalesce(t.payload->>'htmlCheck', 'sample') = 'sample')
          and receipt.requested_at <= now() - interval '35 minutes'
        )
      )
    order by t.updated_at, t.key
    limit 1000
    for update of t skip locked
  ), closed as (
    update public.pipeline_tasks t
    set
      status = 'done',
      token = null,
      lease_until = null,
      finished_at = now(),
      updated_at = now(),
      result = jsonb_build_object(
        'verified', false,
        'verification', candidates.verification_reason,
        'revision', t.payload->>'revision',
        'refreshRequestedAt', candidates.requested_at
      ) || case
        when t.result ? 'verifiedAt' then jsonb_build_object('previousVerification', t.result)
        else '{}'::jsonb
      end
    from candidates
    where t.key = candidates.key
    returning t.key
  )
  select count(*)::integer from closed;
$$;

revoke all on function public.pipeline_close_unsampled_race_checks() from public,anon,authenticated;
grant execute on function public.pipeline_close_unsampled_race_checks() to service_role;
