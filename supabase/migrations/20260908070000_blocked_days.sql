-- A day taken by something that is not a race.
--
-- This was keyed by the Saturday of a weekend, because the planner thought in
-- weekends. It does not: a school play is on a Thursday, a holiday is one
-- Monday, and a bike-park week is six days in a row. One row per day says all
-- of those; a weekend is just two of them.
--
-- Recurring "we never race on Sundays" still lives in profiles.busy_weekdays;
-- this is the one-off kind.

create table if not exists public.blocked_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

create index if not exists blocked_days_user_idx
  on public.blocked_days (user_id, day);

alter table public.blocked_days enable row level security;

drop policy if exists blocked_days_own on public.blocked_days;
create policy blocked_days_own on public.blocked_days
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A blocked weekend meant both of its days.
insert into public.blocked_days (user_id, day, note, created_at)
select w.user_id, w.saturday, w.note, w.created_at from public.blocked_weekends w
union all
select w.user_id, w.saturday + 1, w.note, w.created_at from public.blocked_weekends w
on conflict (user_id, day) do nothing;
