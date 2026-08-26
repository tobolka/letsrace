-- PostGIS installs spatial_ref_sys in public without RLS, which exposes it
-- through the Data API. Enable RLS (no policies) and revoke client roles.
-- Postgres/PostGIS internals and the service_role keep working.

ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon, authenticated;
GRANT SELECT ON TABLE public.spatial_ref_sys TO postgres, service_role;

-- App SECURITY DEFINER RPCs must not be callable with the anon key.
REVOKE ALL ON FUNCTION public.app_insert_watched_url(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_set_discovered_status(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_update_watched_status(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_location_geog(uuid, double precision, double precision) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.app_insert_watched_url(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.app_set_discovered_status(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.app_update_watched_status(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_location_geog(uuid, double precision, double precision) TO service_role;
