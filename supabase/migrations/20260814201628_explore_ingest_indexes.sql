-- Explore / ingest performance indexes (idempotent).
-- Captures composite indexes that listEvents + ingest health rely on.

CREATE INDEX IF NOT EXISTS events_public_upcoming_idx
  ON public.events (start_date)
  WHERE visibility = 'public'
    AND status IN ('scheduled', 'tbc', 'postponed', 'registration_open');

CREATE INDEX IF NOT EXISTS events_visibility_status_start_idx
  ON public.events (visibility, status, start_date);

CREATE INDEX IF NOT EXISTS ingest_runs_started_at_idx
  ON public.ingest_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS ingest_runs_ok_started_idx
  ON public.ingest_runs (ok, started_at DESC);

CREATE INDEX IF NOT EXISTS watched_urls_extract_status_idx
  ON public.watched_urls (last_extract_status)
  WHERE last_extract_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS locations_lat_lng_idx
  ON public.locations (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;
