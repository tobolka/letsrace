begin;
do $test$
declare k text:=md5(gen_random_uuid()::text); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); f uuid:=gen_random_uuid();
begin
insert into pipeline_candidates(id,candidate_key,evidence_hash,source_url,season,payload,evidence,reason,status,created_at) values
(a,k,'test-a','https://example.invalid/test',2027,'{"name":"test assertion","startDate":"2027-01-01"}','{}','transactional test','pending',now()-interval '5 seconds'),
(b,k,'test-b','https://example.invalid/test',2027,'{"name":"test assertion","startDate":"2027-01-01"}','{}','transactional test','pending',now()-interval '4 seconds');
if (select status from pipeline_candidates where id=a)<>'rejected' or (select status from pipeline_candidates where id=b)<>'pending' then raise exception 'Snapshot supersession failed'; end if;
insert into pipeline_candidates(id,candidate_key,evidence_hash,source_url,season,payload,evidence,reason,status,created_at) values
(c,k,'test-c','https://example.invalid/test',2027,'{"name":"test assertion","startDate":"2027-01-02"}','{}','transactional test','pending',now()-interval '3 seconds'),
(d,k,'test-d','https://example.invalid/test',2027,'{"name":"test assertion","startDate":"2027-01-01"}','{}','transactional test','publishing',now()-interval '2 seconds'),
(f,k,'test-f','https://example.invalid/test',2027,'{"name":"test assertion","startDate":"2027-01-01"}','{}','transactional test','pending',now()-interval '1 second');
if (select status from pipeline_candidates where id=b)<>'rejected' or (select status from pipeline_candidates where id=c)<>'pending' or (select status from pipeline_candidates where id=d)<>'publishing' or (select status from pipeline_candidates where id=f)<>'pending' then raise exception 'Distinct assertions or publishing state modified'; end if;
end $test$;
select 'PASS: identical snapshots supersede; changed assertions stay pending; publishing is preserved; all fixtures rolled back' verification;
rollback;
