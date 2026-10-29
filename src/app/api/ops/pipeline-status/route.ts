import { NextResponse } from 'next/server';
import { withCron } from '@/lib/api/guards';
import { createServerSupabase } from '@/lib/supabase/server';
export const GET=withCron(async()=>{
  const db=createServerSupabase();
  const [{data:jobs,error},{count:due,error:dueError},{data:health,error:healthError},{count:attentionSources,error:attentionError},{count:reviewCandidates,error:reviewError}]=await Promise.all([
    db.from('pipeline_jobs').select('*'),
    // Counts describe all collector paths, not an invented server-only attribution.
    db.from('watched_urls').select('id',{count:'exact',head:true}).eq('status','active').lte('next_poll_at',new Date().toISOString()),
    db.rpc('pipeline_health',{}),
    db.from('watched_urls').select('id',{count:'exact',head:true}).eq('status','active').in('last_extract_status',['error','needs_review']),
    db.from('pipeline_candidates').select('id',{count:'exact',head:true}).in('status',['pending','waiting','conflict','publishing']),
  ]);
  if(error||dueError||healthError||attentionError||reviewError)throw new Error(error?.message??dueError?.message??healthError?.message??attentionError?.message??reviewError?.message);
  return NextResponse.json({at:new Date().toISOString(),jobs,due,health,attentionSources,reviewCandidates,schedules:{free:'denně',ai:'na Macu'},countries:['CZ','SK','DE','AT','CH','IT','PL']},{headers:{'Cache-Control':'private, no-store'}});
});
