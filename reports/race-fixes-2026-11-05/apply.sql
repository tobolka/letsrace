-- Owner-requested corrections, 5 November 2026. Every value is from the organiser's own page.
-- Stops if a race changed since it was checked. Manual locks keep sources from undoing this.
begin;

do $fix$
declare
  keep uuid := 'a29fb9a6-9646-49b3-b004-ec37c4175199'; -- Lakeland GRVL 2027, Mikołajki
  dup uuid := '0af22121-814d-493b-9049-5386b1a65145';  -- Lakeland GRVL, wrongly at Szelment
  perun uuid := 'ba4123b5-68fd-4b29-a579-b0e130af87cc';
  gr8 uuid := 'e62e75dc-5a6a-4b1c-833e-7c48a9699674';
  version text := 'owner-race-fixes-2026-11-05';
begin
  perform 1 from public.events where id = keep and public_revision = '2c80f3b4-5f5c-4246-925c-83d3278ced95' and merged_into_id is null for update;
  if not found then raise exception 'Lakeland (Mikołajki) changed since it was checked'; end if;
  perform 1 from public.events where id = dup and public_revision = 'f23b667c-de70-4805-bcab-e15002373f8e' and merged_into_id is null for update;
  if not found then raise exception 'Lakeland (Szelment) changed since it was checked'; end if;
  perform 1 from public.events where id = perun and public_revision = '3e26284d-9b3d-4108-a001-89c95591c7e2' and merged_into_id is null for update;
  if not found then raise exception 'Perun changed since it was checked'; end if;
  perform 1 from public.events where id = gr8 and public_revision = '48cad863-fcad-492d-a6f6-2e36307ce19d' and merged_into_id is null for update;
  if not found then raise exception 'GR8 Lakes changed since it was checked'; end if;

  -- LAKELAND: one race at Mikołajki, keeping the organiser's links.
  perform public.app_merge_events(keep, dup);
  update public.events set
    website_url = 'https://lakeland.gravel.love/',
    regulations_url = 'https://lakeland.gravel.love/regulamin/',
    registration_url = 'https://sklep.gravel.love/produkt/lakeland-grvl-2027-oplata-rejestracyjna/',
    start_date = '2027-05-26', end_date = '2027-05-30', status = 'registration_open',
    location_id = (select location_id from public.events where id = keep),
    updated_at = now()
  where id = keep;
  insert into public.event_categories (event_id, name)
    select keep, 'Ultra 1100–1200 km' where not exists (select 1 from public.event_categories where event_id = keep and name = 'Ultra 1100–1200 km');
  insert into public.event_overrides (event_id, locked_fields, updated_by) values (keep, '{location_id,start_date,end_date,website_url,regulations_url,registration_url}', version)
    on conflict (event_id) do update set locked_fields = (select array_agg(distinct field) from unnest(public.event_overrides.locked_fields || excluded.locked_fields) field), updated_by = excluded.updated_by, updated_at = now();
  insert into public.event_facts (event_id, field, value, source_url, quote, method, version) values
    (keep, 'location_id', '"Mikołajki"', 'https://lakeland.gravel.love/regulamin/', 'Start, finish and race office: Mikołajki', 'owner_request', version),
    (keep, 'start_date', '"2027-05-26"', 'https://lakeland.gravel.love/regulamin/', 'Lakeland GRVL 2027, 26–30 May 2027, start 26 May at 6:00', 'owner_request', version),
    (keep, 'merged_into_id', to_jsonb(dup::text), 'https://lakeland.gravel.love/regulamin/', 'Same race listed at Szelment and Mikołajki; the organiser names Mikołajki', 'owner_request', version);

  -- PERUN: the organiser says 17–19 July, Wierzchosławice. Last Man Standing, not a marathon distance.
  update public.events set start_date = '2027-07-17', end_date = '2027-07-19', status = 'registration_open', updated_at = now() where id = perun;
  insert into public.event_categories (event_id, name)
    select perun, 'Last Man Standing, okruh asi 30 km' where not exists (select 1 from public.event_categories where event_id = perun and name = 'Last Man Standing, okruh asi 30 km');
  insert into public.event_overrides (event_id, locked_fields, updated_by) values (perun, '{start_date,end_date,location_id}', version)
    on conflict (event_id) do update set locked_fields = (select array_agg(distinct field) from unnest(public.event_overrides.locked_fields || excluded.locked_fields) field), updated_by = excluded.updated_by, updated_at = now();
  insert into public.event_facts (event_id, field, value, source_url, quote, method, version) values
    (perun, 'start_date', '"2027-07-17"', 'https://hardygravel.cc/rajdy/perun-2027/', '17–19 lipca · 3 dni', 'owner_request', version),
    (perun, 'status', '"registration_open"', 'https://hardygravel.cc/rajdy/perun-2027/', 'Registration listed as open, 16.10.2026 to 11.07.2027', 'owner_request', version);

  -- GR8 LAKES: the organiser's calendar says 17–19 September, its race site and shop 18–19.
  -- The 2027 regulations are not out, so the date stays as it is and only the links change.
  update public.events set
    website_url = 'https://greatlakes.gravel.love/',
    registration_url = 'https://sklep.gravel.love/produkt/great-lakes-gravel-2027-oplata-rejestracyjna/',
    status = 'registration_open',
    updated_at = now()
  where id = gr8;
  insert into public.event_overrides (event_id, locked_fields, updated_by) values (gr8, '{website_url,registration_url}', version)
    on conflict (event_id) do update set locked_fields = (select array_agg(distinct field) from unnest(public.event_overrides.locked_fields || excluded.locked_fields) field), updated_by = excluded.updated_by, updated_at = now();
  insert into public.event_facts (event_id, field, value, source_url, quote, method, version) values
    (gr8, 'website_url', '"https://greatlakes.gravel.love/"', 'https://greatlakes.gravel.love/', 'GR8 Lakes GRVL 2027, Mikołajki', 'owner_request', version);
end
$fix$;

commit;
