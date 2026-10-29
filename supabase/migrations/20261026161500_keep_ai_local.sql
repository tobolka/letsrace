-- AI remains on the Mac. Remove the unused server-only ledger and RPCs.
-- No catalogue records or original local budget history are touched.
drop function public.pipeline_ai_reserve(numeric);
drop function public.pipeline_ai_settle(uuid,numeric);
drop table public.pipeline_ai_charges;
