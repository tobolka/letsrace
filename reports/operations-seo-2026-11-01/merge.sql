begin;
-- Reviewed against https://www.dsergebnis.de/nrw-cross-cup-2026/.
-- Same named round, day, town and cycling format; keep established IDs.
-- app_merge_events records complete private recovery snapshots and keeps redirects.
select app_merge_events('a55944aa-c6ac-4428-bfcd-eba0a897582d','3a64d3b6-b9c8-4d82-a29e-1ec3b1df6ce9');
select app_merge_events('93a4f5d5-7043-41e4-b834-069df9fd1105','9f255e7a-a446-4f95-a11b-3226fc4b39a1');
select app_merge_events('38b83324-c9e0-4603-8fa5-a42b50de7a87','1a94a41a-b49e-4941-98aa-8b653ca59ecc');
commit;
