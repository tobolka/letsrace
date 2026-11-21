-- A race's or series' Facebook page. Organisers often announce dates and posters only there;
-- the owner files those by hand (scripts/add-announced-races.ts) and the race card links to it.
-- Only facebook.com pages: anything else belongs in website_url.
alter table public.events add column if not exists facebook_url text;
alter table public.series add column if not exists facebook_url text;

alter table public.events drop constraint if exists events_facebook_url_check;
alter table public.events add constraint events_facebook_url_check
  check (facebook_url is null or facebook_url ~* '^https://([a-z0-9-]+\.)?facebook\.com/[^ ]+$');
alter table public.series drop constraint if exists series_facebook_url_check;
alter table public.series add constraint series_facebook_url_check
  check (facebook_url is null or facebook_url ~* '^https://([a-z0-9-]+\.)?facebook\.com/[^ ]+$');
