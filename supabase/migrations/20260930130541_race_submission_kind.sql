-- What a visitor is pointing us at: one race, or a whole series (a cup's
-- calendar page) whose rounds should all be imported.
ALTER TABLE public.race_submissions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'race';

ALTER TABLE public.race_submissions
  DROP CONSTRAINT IF EXISTS race_submissions_kind_check;
ALTER TABLE public.race_submissions
  ADD CONSTRAINT race_submissions_kind_check CHECK (kind IN ('race', 'series'));
