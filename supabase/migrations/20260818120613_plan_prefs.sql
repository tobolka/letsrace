-- Household prefs: weekdays already taken (ISO 1=Mon … 7=Sun) and preferred disciplines.

alter table public.profiles
  add column if not exists busy_weekdays smallint[] not null default '{}'::smallint[],
  add column if not exists preferred_disciplines text[] not null default '{}'::text[];

alter table public.profiles
  drop constraint if exists profiles_busy_weekdays_check;

alter table public.profiles
  add constraint profiles_busy_weekdays_check
  check (busy_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]);
