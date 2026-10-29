-- Candidates are edition assertions, not another URL discovery queue.
create table public.pipeline_candidates (
  id uuid primary key default gen_random_uuid(),
  candidate_key text not null,
  evidence_hash text not null,
  source_url text not null,
  watched_url_id uuid references public.watched_urls(id) on delete set null,
  country text,
  season integer not null check (season between 2000 and 2100),
  payload jsonb not null,
  evidence jsonb not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','waiting','rejected','publishing','published','conflict')),
  decision jsonb,
  event_id uuid references public.events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(candidate_key,evidence_hash)
);
create index pipeline_candidates_queue on public.pipeline_candidates(status,season,created_at);
alter table public.pipeline_candidates enable row level security;
revoke all on public.pipeline_candidates from public, anon, authenticated;
grant select,insert,update,delete on public.pipeline_candidates to service_role;

-- Copy only reviewed non-identity fields, with a current-state check and audit
-- in the same transaction. Last year's values remain labelled as previous.
create function public.app_carry_previous_edition(target_id uuid, previous_id uuid, expected jsonb, patch jsonb)
returns boolean language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  held public.events;
  prior public.events;
  proposed public.events;
  locks text[];
  field_name text;
begin
  if target_id=previous_id then raise exception 'same edition'; end if;
  select * into held from public.events where id=target_id for update;
  select * into prior from public.events where id=previous_id for share;
  if held.id is null or prior.id is null then raise exception 'edition missing'; end if;
  if held.merged_into_id is not null or prior.merged_into_id is not null or held.visibility<>'public'
     or held.status not in ('scheduled','registration_open','postponed','tbc') then return false; end if;
  if held.start_date-prior.start_date not between 300 and 430 then return false; end if;
  select coalesce(locked_fields,'{}') into locks from public.event_overrides where event_id=target_id for share;
  locks:=coalesce(locks,'{}');
  for field_name in select jsonb_object_keys(expected) loop
    if (to_jsonb(held)->field_name) is distinct from (expected->field_name) then return false; end if;
  end loop;
  if not (expected ? 'updated_at') or not (expected ? 'start_date') then raise exception 'missing state guard'; end if;
  for field_name in select jsonb_object_keys(patch) loop
    if field_name not in ('age_categories','age_confidence','audience','disciplines','class_label','uci_class','website_url') then raise exception 'unsupported inherited field'; end if;
    if field_name=any(locks) or (field_name in ('age_categories','age_confidence','audience') and ('categories'=any(locks) or 'age_categories'=any(locks) or 'age_confidence'=any(locks) or 'audience'=any(locks))) then return false; end if;
    if field_name='age_confidence' then
      if patch->>field_name<>'previous' or prior.age_confidence<>'explicit' then return false; end if;
    elsif field_name='audience' then
      if not (patch ? 'age_categories') then return false; end if;
    elsif (patch->field_name) is distinct from (to_jsonb(prior)->field_name) then return false;
    end if;
  end loop;
  proposed:=jsonb_populate_record(held,patch);
  update public.events set age_categories=proposed.age_categories,age_confidence=proposed.age_confidence,
    audience=proposed.audience,disciplines=proposed.disciplines,class_label=proposed.class_label,
    uci_class=proposed.uci_class,website_url=proposed.website_url,updated_at=now() where id=target_id;
  for field_name in select jsonb_object_keys(patch) loop
    if (to_jsonb(held)->field_name) is distinct from (patch->field_name) then
      insert into public.event_facts(event_id,field,value,previous,source_url,method,version)
        values(target_id,field_name,patch->field_name,to_jsonb(held)->field_name,prior.website_url,'previous_edition','guarded-v1');
    end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.app_carry_previous_edition(uuid,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.app_carry_previous_edition(uuid,uuid,jsonb,jsonb) to service_role;
