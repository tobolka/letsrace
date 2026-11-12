import { NextResponse } from 'next/server';
import { withCron } from '@/lib/api/guards';
import { createServerSupabase } from '@/lib/supabase/server';
import { z } from 'zod';
import { pipelineSourceCountsSchema } from '@/lib/pipeline/source-counts';
const overview=z.object({jobs:z.array(z.unknown()),sources:pipelineSourceCountsSchema,health:z.unknown(),reviewCandidates:z.number().int().min(0)});
export const GET=withCron(async()=>{
  const {data,error}=await createServerSupabase().rpc('pipeline_collector_overview',{});
  if(error)throw new Error(error.message);
  const {jobs,sources,health,reviewCandidates}=overview.parse(data);
  return NextResponse.json({at:new Date().toISOString(),jobs,due:sources.due,health,attentionSources:sources.broken+sources.unreadable+sources.review+sources.deferred,
    unreadableSources:sources.unreadable,brokenSources:sources.broken,reviewSources:sources.review,deferredSources:sources.deferred,overdueSources:sources.overdue,
    reviewCandidates,schedules:{free:'denně',ai:'na Macu'},countries:['CZ','SK','DE','AT','CH','IT','PL']},{headers:{'Cache-Control':'private, no-store'}});
}, "monitor");

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
}, "monitor");
