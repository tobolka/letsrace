-- Where a race's age categories came from. 'explicit': the source stated them
-- (a category list, an age token in the name, a federation's category field).
-- 'default': a heuristic filled them from the level or discipline — a guess.
-- NULL: none known. The category filter trusts only 'explicit' to rule a race
-- out; a guess may say a race is likely, never that it is not.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS age_confidence text;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_age_confidence_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_age_confidence_check CHECK (age_confidence IN ('explicit', 'default'));
