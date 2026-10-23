-- One row per race identity.
--
-- `fingerprint` is date + geohash-5 + normalized name — the key the watcher
-- already uses to decide whether it has seen a race before. Without a
-- constraint behind it, two concurrent source fetches could each miss the
-- other's insert and both create the row; 52 such pairs had accumulated.
--
-- Run scripts/merge-fingerprint-collisions.ts before applying this, or the
-- index build will fail on the existing duplicates.
create unique index if not exists events_fingerprint_key
  on public.events (fingerprint);
