-- Which pages we read races from is ours, not the public's. The browser never
-- reads event_sources (the server does, with the service role), yet the
-- publishable key could list all of them. Drop the open read; with RLS on and
-- no policy, only the service role sees the table.
drop policy if exists event_sources_public_read on public.event_sources;
