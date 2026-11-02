import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/api/guards";
import { createServerSupabase } from "@/lib/supabase/server";
import { z } from "zod";
const answer=z.object({key:z.string().min(1).max(200),updatedAt:z.iso.datetime({offset:true}),answer:z.string().min(1).max(100)});
export const POST=withAdmin(async req=>{
  if(req.headers.get('origin')!==new URL(req.url).origin)return NextResponse.json({error:'Invalid request origin'},{status:403});
  const form=await req.formData();
  const input=answer.safeParse({key:form.get('key'),updatedAt:form.get('updatedAt'),answer:form.get('answer')});
  if(!input.success)return NextResponse.redirect(new URL('/admin?decision=invalid',req.url),303);
  const value=input.data;
  const {data,error}=await createServerSupabase().rpc('pipeline_answer_owner',{p_key:value.key,p_expected:value.updatedAt,p_answer:value.answer});
  if(error)throw error;
  return NextResponse.redirect(new URL(data?'/admin?decision=saved':'/admin?decision=changed',req.url),303);
});
