-- Per-rider busy days and preferred disciplines (household or team).

alter table public.family_members
  add column if not exists busy_weekdays smallint[] not null default '{}'::smallint[],
  add column if not exists preferred_disciplines text[] not null default '{}'::text[];

alter table public.family_members
  drop constraint if exists family_members_busy_weekdays_check;

alter table public.family_members
  add constraint family_members_busy_weekdays_check
  check (busy_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]);

update public.family_members m
set
  busy_weekdays = p.busy_weekdays,
  preferred_disciplines = p.preferred_disciplines
from public.profiles p
where m.user_id = p.id
  and m.is_self
  and m.busy_weekdays = '{}'::smallint[]
  and m.preferred_disciplines = '{}'::text[];
