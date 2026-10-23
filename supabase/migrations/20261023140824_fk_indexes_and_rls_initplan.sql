-- Applied to production on 2026-10-23 (version 20261023140824, the one the
-- database recorded). Written from the Supabase advisors of the same day.
--
-- 1. Cover the thirteen foreign keys the performance advisor lists. Without an
--    index a delete or a join on the parent scans the child table. Plain
--    CREATE INDEX: these tables are small and a migration runs in a transaction,
--    where CONCURRENTLY is not allowed.
-- 2. Evaluate auth.uid() once per statement, not once per row: wrap it in a
--    sub-select. Same rule, same result, cheaper at scale.
-- 3. Pin the search_path of the one function the security advisor flags.

-- 1. Foreign-key indexes ----------------------------------------------------

create index if not exists discovered_links_from_watched_url_id_idx on public.discovered_links (from_watched_url_id);
create index if not exists duplicate_reviews_right_id_idx on public.duplicate_reviews (right_id);
create index if not exists event_attendance_event_id_idx on public.event_attendance (event_id);
create index if not exists event_attendance_member_id_idx on public.event_attendance (member_id);
create index if not exists event_categories_event_id_idx on public.event_categories (event_id);
create index if not exists event_favorites_event_id_idx on public.event_favorites (event_id);
create index if not exists event_sources_event_id_idx on public.event_sources (event_id);
create index if not exists ingest_runs_watched_url_id_idx on public.ingest_runs (watched_url_id);
create index if not exists plan_change_deliveries_change_id_idx on public.plan_change_deliveries (change_id);
create index if not exists race_alert_deliveries_event_id_idx on public.race_alert_deliveries (event_id);
create index if not exists race_submissions_user_id_idx on public.race_submissions (user_id);
create index if not exists watched_urls_extraction_profile_id_idx on public.watched_urls (extraction_profile_id);
create index if not exists watched_urls_parent_id_idx on public.watched_urls (parent_id);

-- 2. RLS: auth.uid() -> (select auth.uid()) -----------------------------------

alter policy blocked_days_own on public.blocked_days
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy blocked_weekends_own on public.blocked_weekends
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy event_attendance_own on public.event_attendance
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy event_favorites_own on public.event_favorites
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy family_members_own on public.family_members
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy race_alerts_own on public.race_alerts
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter policy plan_change_deliveries_own_select on public.plan_change_deliveries
  using ((select auth.uid()) = user_id);
alter policy plan_digest_deliveries_own_select on public.plan_digest_deliveries
  using ((select auth.uid()) = user_id);

alter policy profiles_select_own on public.profiles using ((select auth.uid()) = id);
alter policy profiles_update_own on public.profiles
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
alter policy profiles_insert_own on public.profiles with check ((select auth.uid()) = id);

alter policy race_submissions_insert_own on public.race_submissions
  with check ((select auth.uid()) = user_id);

alter policy race_alert_deliveries_own_select on public.race_alert_deliveries
  using (exists (
    select 1 from public.race_alerts a
    where a.id = race_alert_deliveries.alert_id and a.user_id = (select auth.uid())
  ));

-- 3. Function search_path ---------------------------------------------------

alter function public.app_age_rank(text[], text) set search_path = public, pg_temp;
