import { NextResponse } from 'next/server';
import { withCron } from '@/lib/api/guards';
import { createServerSupabase } from '@/lib/supabase/server';
import { z } from 'zod';
import { getPipelineSourceCounts } from '@/lib/pipeline/source-counts';
export const GET=withCron(async()=>{
  const db=createServerSupabase();
  const [{data:jobs,error},sources,{data:health,error:healthError},{count:reviewCandidates,error:reviewError}]=await Promise.all([
    db.from('pipeline_jobs').select('*'),
    getPipelineSourceCounts(),
    db.rpc('pipeline_health',{}),
    db.from('pipeline_candidates').select('id',{count:'exact',head:true}).in('status',['pending','waiting','conflict','publishing']),
  ]);
  if(error||healthError||reviewError)throw new Error(error?.message??healthError?.message??reviewError?.message);
  return NextResponse.json({at:new Date().toISOString(),jobs,due:sources.due,health,attentionSources:sources.broken+sources.unreadable+sources.review+sources.deferred,
    unreadableSources:sources.unreadable,brokenSources:sources.broken,reviewSources:sources.review,deferredSources:sources.deferred,overdueSources:sources.overdue,
    reviewCandidates,schedules:{free:'denně',ai:'na Macu'},countries:['CZ','SK','DE','AT','CH','IT','PL']},{headers:{'Cache-Control':'private, no-store'}});
});

const count=z.number().int().min(0).max(1_000_000).optional();
const heartbeat=z.object({status:z.enum(['running','waiting','paused','quiet','attention']),paused:z.boolean(),nextRunAt:z.number().min(0).max(4_102_444_800_000).nullable(),
  lastResult:z.object({at:z.number().optional(),reads:count,created:count,updated:count,failed:count,deferred:count,unreadable:count}).nullable()});
export const POST=withCron(async(req,ctx)=>{
  const input=heartbeat.safeParse(await req.json());
  if(!input.success)return NextResponse.json({error:'Invalid collector heartbeat'},{status:400});
  const value=input.data,db=createServerSupabase();
  const {error}=await db.from('pipeline_workers').upsert({key:'mac',heartbeat_at:new Date().toISOString(),status:value.status,paused:value.paused,
    next_run_at:value.nextRunAt?new Date(value.nextRunAt).toISOString():null,summary:value.lastResult},{onConflict:'key'});
  if(error)throw error;
  return GET(req,ctx);
});
