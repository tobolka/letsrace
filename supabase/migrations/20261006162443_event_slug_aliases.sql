-- Addresses a race used to have. Race pages look a slug up here when no race
-- carries it any more, and redirect permanently to the race's current one —
-- so renaming slugs never breaks a link someone saved or Google found.
create table if not exists public.event_slug_aliases (
  slug text primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists event_slug_aliases_event_id_idx on public.event_slug_aliases (event_id);

alter table public.event_slug_aliases enable row level security;

drop policy if exists event_slug_aliases_read on public.event_slug_aliases;
create policy event_slug_aliases_read on public.event_slug_aliases
  for select using (true);
