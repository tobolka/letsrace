-- User-entered entry fee on a planned race.

alter table public.event_favorites
  add column if not exists fee_amount numeric;
