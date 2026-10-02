-- Every value a machine writes to a race, with where it came from.
--
-- A language model reads race pages now. It is held to evidence — a quote and
-- the page it is on — and the value is derived from that evidence by code.
-- This table keeps that evidence, so a value can be traced to its page, a bad
-- method or prompt version can be rolled back in one statement, and accuracy
-- can be measured per method.
--
-- `previous` is what the field held before, so a rollback restores it.

create table if not exists public.event_facts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  field text not null,
  value jsonb,
  previous jsonb,
  source_url text,
  quote text,
  -- 'llm', 'human', 'parser:<name>', 'carry_forward'…
  method text not null,
  model text,
  version text,
  status text not null default 'active' check (status in ('active', 'rolled_back', 'superseded', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists event_facts_event_idx on public.event_facts (event_id, field);
create index if not exists event_facts_method_idx on public.event_facts (method, version, created_at);

alter table public.event_facts enable row level security;
-- No policy: written and read by the catalogue tooling with the service role.

-- What a page said the last time a model read it, so it is read again only
-- when its text changes.
create table if not exists public.page_reads (
  url text not null,
  -- What read it and with which prompt version.
  reader text not null,
  text_hash text not null,
  read_at timestamptz not null default now(),
  primary key (url, reader)
);

alter table public.page_reads enable row level security;
