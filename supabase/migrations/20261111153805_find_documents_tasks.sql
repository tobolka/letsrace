-- The first kind of Mac work to become queue tasks: looking for a race's regulations on its own
-- site. One task per site, because a site's documents are listed once for all its races.
-- Builds on pipeline_tasks as it is; needs 20261111153755_pipeline_proposals.sql.
--

-- The races this work is for: public, coming, with a site and no regulations, not locked.
create function public.pipeline_find_documents_races()
returns table(id uuid, name text, start_date date, website_url text, municipality text, country_code text)
language sql stable security invoker set search_path = public, pg_temp as $$
  select e.id, e.name, e.start_date, e.website_url, l.municipality, l.country_code
  from public.events e left join public.locations l on l.id = e.location_id
  where e.visibility = 'public' and e.merged_into_id is null
    and e.start_date >= (now() at time zone 'UTC')::date
    and e.regulations_url is null and e.website_url is not null
    and not exists (select 1 from public.event_overrides o where o.event_id = e.id and 'regulations_url' = any(o.locked_fields))
  order by e.start_date, e.id;
$$;

-- A task per site. A site already waiting or being read is left alone; one finished long
-- enough ago is opened again. Returns how many tasks were added or reopened.
create function public.pipeline_queue_find_documents(p_sites text[], p_again_after_seconds integer default 86400)
returns integer language plpgsql security invoker set search_path = public, pg_temp as $$
declare changed integer;
begin
  insert into public.pipeline_tasks(key, kind, capability, payload)
    select 'find_documents:' || site, 'find_documents', 'http', jsonb_build_object('site', site)
    from (select distinct unnest(p_sites) site) sites where site ~ '^https?://'
  on conflict (key) do update set status = 'pending', available_at = now(), updated_at = now()
    where pipeline_tasks.status = 'done'
      and pipeline_tasks.finished_at <= now() - make_interval(secs => greatest(0, p_again_after_seconds));
  get diagnostics changed = row_count;
  return changed;
end;
$$;

-- Finish a task and hand in what it found, or neither. Only the attempt that still holds the
-- task may do so: a worker that comes back after its lease ran out, or whose task was given
-- different input meanwhile, leaves nothing behind.
create function public.pipeline_finish_with_proposals(p_key text, p_token uuid, p_payload jsonb, p_result jsonb, p_proposals jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare held public.pipeline_tasks; item jsonb; keys text[] := '{}';
begin
  select * into held from public.pipeline_tasks where key = p_key for update;
  if not found or p_token is null or held.token is distinct from p_token or held.status <> 'running'
    or held.lease_until is null or held.lease_until <= now() then
    return jsonb_build_object('accepted', false, 'reason', 'stale_attempt');
  end if;
  if held.payload is distinct from p_payload then
    -- Records the attempt as superseded and puts the task back for its new input.
    perform public.pipeline_finish_task(p_key, p_token, p_payload, p_result);
    return jsonb_build_object('accepted', false, 'reason', 'input_changed');
  end if;
  if jsonb_typeof(coalesce(p_proposals, '[]'::jsonb)) <> 'array' then raise exception 'Proposals must be a list'; end if;
  for item in select value from jsonb_array_elements(coalesce(p_proposals, '[]'::jsonb)) loop
    keys := keys || public.pipeline_submit_proposal((item->>'event_id')::uuid, item->>'field', item->'value',
      item->>'source_url', item->>'quote', item->>'reader', item->>'version', p_key);
  end loop;
  if not public.pipeline_finish_task(p_key, p_token, p_payload, p_result) then raise exception 'Task % could not be finished', p_key; end if;
  return jsonb_build_object('accepted', true, 'proposals', to_jsonb(keys));
end;
$$;

revoke execute on function public.pipeline_find_documents_races(), public.pipeline_queue_find_documents(text[], integer),
  public.pipeline_finish_with_proposals(text, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.pipeline_find_documents_races(), public.pipeline_queue_find_documents(text[], integer),
  public.pipeline_finish_with_proposals(text, uuid, jsonb, jsonb, jsonb) to service_role;
