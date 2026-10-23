-- A capability token for the personal calendar feed.
--
-- Calendar apps subscribe by URL and send no cookies, so the URL itself has to
-- carry the authority. It exposes nothing but the races already in that
-- person's plan, and rotating the column invalidates every copy of the link.

alter table public.profiles
  add column if not exists ics_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_ics_token_key on public.profiles (ics_token);
