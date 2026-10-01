-- A person's answer to "who may start in this series", applied to every round.
alter table public.series
  add column if not exists age_categories_confirmed_at timestamptz,
  add column if not exists age_categories_note text;
