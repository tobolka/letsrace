-- A weekend taken by something that is not a race: a wedding, a work trip, a
-- holiday. Recurring "we never race on Sundays" already lives in
-- profiles.busy_weekdays; this is the one-off kind, keyed by the Saturday of
-- the weekend so it lines up with the planner's weekend buckets.

create table if not exists public.blocked_weekends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saturday date not null,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, saturday)
);

create index if not exists blocked_weekends_user_idx
  on public.blocked_weekends (user_id, saturday);

alter table public.blocked_weekends enable row level security;

drop policy if exists blocked_weekends_own on public.blocked_weekends;
create policy blocked_weekends_own on public.blocked_weekends
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
