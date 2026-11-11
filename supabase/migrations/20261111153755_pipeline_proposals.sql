-- Readers stop writing races. They hand in a proposal: a race, a field, a value, the page
-- and the words on it. One function decides and writes, in one transaction with the history
-- row, and the existing trigger on events queues the public refresh in that same transaction.
--
-- event_facts stays the history of what was written; a proposal that was never applied
-- never appears there. See docs/pipeline-v2.md, part 3, and docs/pipeline-write-paths.md.
--
-- First field: regulations_url, into an empty field only.

create table public.pipeline_proposals (
  key text primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  field text not null,
  value jsonb not null,
  source_url text not null check (source_url ~ '^https?://'),
  quote text not null check (length(quote) >= 8),
  reader text not null,
  version text not null,
  -- The task this came from, when it came from the queue.
  task_key text,
  status text not null default 'proposed' check (status in ('proposed','applied','held','rejected','superseded')),
  reason text,
  fact_id uuid,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check ((status = 'proposed') = (decided_at is null))
);
create index pipeline_proposals_event on public.pipeline_proposals(event_id, field);
create index pipeline_proposals_open on public.pipeline_proposals(status, created_at) where status in ('proposed','held');
alter table public.pipeline_proposals enable row level security;
revoke all on public.pipeline_proposals from public, anon, authenticated;
grant select, insert, update, delete on public.pipeline_proposals to service_role;

-- The same proposal handed in twice is one row: the key is what it says, not when it arrived.
create function public.pipeline_submit_proposal(p_event uuid, p_field text, p_value jsonb, p_source text, p_quote text,
  p_reader text, p_version text, p_task text default null)
returns text language plpgsql security invoker set search_path = public, pg_temp as $$
declare made text := md5(concat_ws('|', p_event::text, p_field, p_value::text, p_source, p_reader, p_version));
begin
  insert into public.pipeline_proposals(key, event_id, field, value, source_url, quote, reader, version, task_key)
    values (made, p_event, p_field, p_value, p_source, p_quote, p_reader, p_version, p_task)
    on conflict (key) do nothing;
  return made;
end;
$$;

-- Decide one proposal and, if it stands, write it. Safe to call again: a decided proposal
-- answers with its decision and writes nothing. A held one is looked at afresh, because
-- what held it (a lock, a hidden race) can change.
create function public.pipeline_apply_proposal(p_key text)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare p public.pipeline_proposals; e public.events; locked text[]; link text; fact uuid;
  decide text; why text;
begin
  select * into p from public.pipeline_proposals where key = p_key for update;
  if not found then return jsonb_build_object('status', 'missing'); end if;
  if p.status not in ('proposed', 'held') then
    return jsonb_build_object('status', p.status, 'reason', p.reason, 'repeated', true);
  end if;

  -- Everything is checked against the race as it is now, under a lock, not as the reader saw it.
  select * into e from public.events where id = p.event_id for update;
  select locked_fields into locked from public.event_overrides where event_id = p.event_id for share;
  link := p.value #>> '{}';
  if p.field <> 'regulations_url' then decide := 'held'; why := 'unsupported_field';
  elsif jsonb_typeof(p.value) <> 'string' or link !~ '^https?://' then decide := 'rejected'; why := 'invalid_value';
  elsif e.merged_into_id is not null then decide := 'rejected'; why := 'merged';
  elsif e.start_date < (now() at time zone 'UTC')::date then decide := 'rejected'; why := 'past_race';
  elsif e.regulations_url = link then decide := 'superseded'; why := 'already_set';
  elsif e.regulations_url is not null then decide := 'superseded'; why := 'field_filled';
  elsif e.visibility is distinct from 'public' then decide := 'held'; why := 'hidden';
  elsif 'regulations_url' = any(coalesce(locked, '{}')) then decide := 'held'; why := 'manual_lock';
  else
    update public.events set regulations_url = link, updated_at = now() where id = e.id;
    insert into public.event_facts(event_id, field, value, previous, source_url, quote, method, version)
      values (e.id, 'regulations_url', p.value, null, p.source_url, p.quote, p.reader, p.version)
      returning id into fact;
    decide := 'applied';
  end if;

  update public.pipeline_proposals set status = decide, reason = why, fact_id = fact, decided_at = now() where key = p_key;
  return jsonb_build_object('status', decide, 'reason', why, 'fact', fact);
end;
$$;

revoke execute on function public.pipeline_submit_proposal(uuid, text, jsonb, text, text, text, text, text),
  public.pipeline_apply_proposal(text) from public, anon, authenticated;
grant execute on function public.pipeline_submit_proposal(uuid, text, jsonb, text, text, text, text, text),
  public.pipeline_apply_proposal(text) to service_role;
