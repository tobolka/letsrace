-- Lock down public schema RLS: catalog is read-only for clients;
-- user tables are owner-scoped; service_role bypasses RLS for server jobs.

-- ---------------------------------------------------------------------------
-- Catalog / ingest: drop open write policies (keep public SELECT where useful)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS events_write_all ON public.events;
DROP POLICY IF EXISTS locations_write_all ON public.locations;
DROP POLICY IF EXISTS series_write_all ON public.series;
DROP POLICY IF EXISTS event_categories_write_all ON public.event_categories;
DROP POLICY IF EXISTS event_sources_write_all ON public.event_sources;
DROP POLICY IF EXISTS event_overrides_write_all ON public.event_overrides;
DROP POLICY IF EXISTS watched_urls_write_all ON public.watched_urls;
DROP POLICY IF EXISTS discovered_links_write_all ON public.discovered_links;
DROP POLICY IF EXISTS extraction_profiles_write_all ON public.extraction_profiles;
DROP POLICY IF EXISTS ingest_runs_write_all ON public.ingest_runs;
DROP POLICY IF EXISTS admin_notifications_all ON public.admin_notifications;
DROP POLICY IF EXISTS race_submissions_all ON public.race_submissions;

-- Tighten public event/series reads to visible catalog only.
DROP POLICY IF EXISTS events_public_read ON public.events;
CREATE POLICY events_public_read ON public.events
  FOR SELECT TO anon, authenticated
  USING (visibility = 'public');

DROP POLICY IF EXISTS series_public_read ON public.series;
CREATE POLICY series_public_read ON public.series
  FOR SELECT TO anon, authenticated
  USING (visibility = 'public');

-- ---------------------------------------------------------------------------
-- User data: replace open ALL with owner policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS profiles_all ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS family_members_all ON public.family_members;
CREATE POLICY family_members_own ON public.family_members
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS event_favorites_all ON public.event_favorites;
CREATE POLICY event_favorites_own ON public.event_favorites
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS event_attendance_all ON public.event_attendance;
CREATE POLICY event_attendance_own ON public.event_attendance
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Submissions: users may insert their own row; reads/updates are server-only.
CREATE POLICY race_submissions_insert_own ON public.race_submissions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Plan delivery tables: owner can read their own delivery rows (server writes).
CREATE POLICY plan_change_deliveries_own_select ON public.plan_change_deliveries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY plan_digest_deliveries_own_select ON public.plan_digest_deliveries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Auto-bootstrap profile + self family member on signup
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  display text;
BEGIN
  display := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, 'rider'), '@', 1),
    'Rider'
  );

  INSERT INTO public.profiles (id, email, display_name, updated_at)
  VALUES (new.id, new.email, display, now())
  ON CONFLICT (id) DO UPDATE
    SET email = excluded.email,
        display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
        updated_at = now();

  INSERT INTO public.family_members (user_id, name, relationship, is_self)
  SELECT new.id, display, 'self', true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.user_id = new.id AND fm.is_self = true
  );

  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role, supabase_auth_admin;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER app RPCs: service_role only
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.app_insert_watched_url(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_set_discovered_status(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_update_watched_status(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_location_geog(uuid, double precision, double precision) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.app_insert_watched_url(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.app_set_discovered_status(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.app_update_watched_status(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_location_geog(uuid, double precision, double precision) TO service_role;
