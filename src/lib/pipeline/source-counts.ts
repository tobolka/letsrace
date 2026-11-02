import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
const count=z.number().int().min(0);
const counts=z.object({sources:count,due:count,overdue:count,broken:count,unreadable:count,deferred:count,review:count});
export async function getPipelineSourceCounts() {
  const {data,error}=await createServerSupabase().rpc('pipeline_source_counts',{});
  if(error)throw Error(`Reading source state: ${error.message}`);
  return counts.parse(data);
}
