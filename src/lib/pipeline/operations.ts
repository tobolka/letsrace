import { randomUUID } from 'node:crypto';
import { createServerSupabase } from '@/lib/supabase/server';
export async function pipelineJob<T extends Record<string,unknown>>(key: string, work:()=>Promise<T>) {
  const db=createServerSupabase(), id=randomUUID();
  const {data:claimed,error}=await db.rpc('pipeline_begin',{p_key:key,p_run:id});
  if(error) throw new Error(error.message);
  if(!claimed)return {ok:true,status:'already_running'};
  try {
    const result=await work();
    const {error}=await db.from('pipeline_jobs').update({finished_at:new Date().toISOString(),status:typeof result.status==='string'?result.status:result.ok===false?'attention':'ok',summary:JSON.parse(JSON.stringify(result))}).eq('key',key).eq('run_id',id);
    if(error)throw new Error(error.message);
    return result;
  } catch(error){
    await db.from('pipeline_jobs').update({finished_at:new Date().toISOString(),status:'error',summary:{error:error instanceof Error?error.message:'Job failed'}}).eq('key',key).eq('run_id',id);
    throw error;
  }
}
