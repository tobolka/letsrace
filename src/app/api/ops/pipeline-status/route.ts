import { NextResponse } from 'next/server';
import { withCron } from '@/lib/api/guards';
import { createServerSupabase } from '@/lib/supabase/server';
import { z } from 'zod';
export const GET=withCron(async()=>{
  const db=createServerSupabase();
  const [{data:jobs,error},{count:due,error:dueError},{data:health,error:healthError},{count:attentionSources,error:attentionError},{count:reviewCandidates,error:reviewError},{count:unreadableSources,error:unreadableError}]=await Promise.all([
    db.from('pipeline_jobs').select('*'),
    // Counts describe all collector paths, not an invented server-only attribution.
    db.from('watched_urls').select('id',{count:'exact',head:true}).eq('status','active').lte('next_poll_at',new Date().toISOString()),
    db.rpc('pipeline_health',{}),
    db.from('watched_urls').select('id',{count:'exact',head:true}).eq('status','active').in('last_extract_status',['error','needs_review']),
    db.from('pipeline_candidates').select('id',{count:'exact',head:true}).in('status',['pending','waiting','conflict','publishing']),
    // A page the free reader cannot parse is waiting for the AI reader, not broken.
    db.from('watched_urls').select('id',{count:'exact',head:true}).eq('status','active').eq('last_extract_status','needs_review').or('last_error.eq.unsupported_or_empty_source,last_error.eq.low confidence or empty extract,last_error.eq.dynamic_render_unavailable'),
  ]);
  if(error||dueError||healthError||attentionError||reviewError||unreadableError)throw new Error(error?.message??dueError?.message??healthError?.message??attentionError?.message??reviewError?.message??unreadableError?.message);
  return NextResponse.json({at:new Date().toISOString(),jobs,due,health,attentionSources,unreadableSources,brokenSources:(attentionSources??0)-(unreadableSources??0),reviewCandidates,schedules:{free:'denně',ai:'na Macu'},countries:['CZ','SK','DE','AT','CH','IT','PL']},{headers:{'Cache-Control':'private, no-store'}});
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
