import {requireAdmin} from '@/lib/admin';
import {LegacyMediaReview} from '@/components/admin/ai/LegacyMediaReview';
import type {LegacyMediaWorkspace} from '@/features/ai-generation/authoring/legacy-contracts';
export default async function EarlierMediaPage({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;const {supabase}=await requireAdmin();
 const {data,error}=await supabase.rpc('admin_legacy_ai_media_workspace',{p_course:id});
 if(error)throw error;
 return <LegacyMediaReview courseId={id} initial={data as unknown as LegacyMediaWorkspace}/>;
}
