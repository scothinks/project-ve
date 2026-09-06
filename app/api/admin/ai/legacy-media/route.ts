import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { revalidateLearningPaths } from '@/app/admin/courses/learning-cache';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request) {
 const {supabase}=await requireAdmin();const course=new URL(request.url).searchParams.get('course')??'';
 const {data,error}=await supabase.rpc('admin_legacy_ai_media_workspace',{p_course:course});
 return NextResponse.json(error?{error:'Earlier media is unavailable. Check your access.'}:data,{status:error?403:200,headers});
}
export async function POST(request:Request) {
 const {supabase}=await requireAdmin();const body=await request.json().catch(()=>null);
 if(!body||typeof body.courseId!=='string')return NextResponse.json({error:'Choose a course.'},{status:400,headers});
 const {error}=body.action==='map'
  ? await supabase.rpc('admin_map_legacy_ai_media',{p_course:body.courseId,p_asset:body.assetId,p_kind:body.kind,p_target:body.targetId})
  : body.action==='decide'
   ? await supabase.rpc('admin_decide_legacy_ai_job',{p_job:body.jobId,p_decision:body.decision})
   : body.action==='cover'
    ? await supabase.rpc('admin_set_editorial_cover',{p_target:body.target,p_id:body.targetId,p_version:body.versionId})
    : {error:{message:'Choose a supported action.'}};
 if(error)return NextResponse.json({error:error.message},{status:409,headers});
 revalidateLearningPaths(body.courseId,[]);
 return NextResponse.json({saved:true},{headers});
}
