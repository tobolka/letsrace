-- A rider's gender, optional: it picks the girls' or the boys' category of a
-- race for them. Null means not given, and every category that fits is shown.

alter table public.family_members
  add column if not exists gender text;

alter table public.family_members
  drop constraint if exists family_members_gender_check;

alter table public.family_members
  add constraint family_members_gender_check
  check (gender is null or gender in ('female', 'male'));
