-- Baseline: indexes that already exist on production (documented for version control).
-- Safe to re-run: IF NOT EXISTS throughout.

CREATE INDEX IF NOT EXISTS events_age_categories_gin ON public.events USING gin (age_categories);
CREATE INDEX IF NOT EXISTS events_audience_idx ON public.events USING btree (audience);
CREATE INDEX IF NOT EXISTS events_disciplines_gin ON public.events USING gin (disciplines);
CREATE INDEX IF NOT EXISTS events_event_type_idx ON public.events USING btree (event_type);
CREATE INDEX IF NOT EXISTS events_fingerprint_idx ON public.events USING btree (fingerprint);
CREATE INDEX IF NOT EXISTS events_formats_gin ON public.events USING gin (formats);
CREATE INDEX IF NOT EXISTS events_level_idx ON public.events USING btree (level);
CREATE INDEX IF NOT EXISTS events_location_id_idx ON public.events USING btree (location_id);
CREATE INDEX IF NOT EXISTS events_season_idx ON public.events USING btree (season);
CREATE INDEX IF NOT EXISTS events_series_id_idx ON public.events USING btree (series_id);
CREATE INDEX IF NOT EXISTS events_start_date_idx ON public.events USING btree (start_date);
CREATE INDEX IF NOT EXISTS events_visibility_idx ON public.events USING btree (visibility);

CREATE INDEX IF NOT EXISTS locations_country_idx ON public.locations USING btree (country_code);

CREATE INDEX IF NOT EXISTS series_age_categories_gin ON public.series USING gin (age_categories);
CREATE INDEX IF NOT EXISTS series_country_code_idx ON public.series USING btree (country_code);
CREATE INDEX IF NOT EXISTS series_disciplines_gin ON public.series USING gin (disciplines);
CREATE INDEX IF NOT EXISTS series_season_idx ON public.series USING btree (season);
CREATE INDEX IF NOT EXISTS series_visibility_idx ON public.series USING btree (visibility);

CREATE INDEX IF NOT EXISTS watched_urls_next_poll_idx ON public.watched_urls USING btree (next_poll_at);
CREATE INDEX IF NOT EXISTS watched_urls_status_idx ON public.watched_urls USING btree (status);
