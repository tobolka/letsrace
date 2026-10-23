-- Official race info / propozice (HTML page or PDF).
alter table public.events
  add column if not exists regulations_url text;
