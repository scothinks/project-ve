import { requireAdmin } from "@/lib/admin";
import { getAdminWorkspaceAiAuthoringNotice } from "@/features/organizations/admin/entitlement-guards";
import { pageAuthoringEnabled } from "@/features/ai-generation/authoring/availability";
import { AiCourseAuthoring } from "@/components/admin/ai/AiCourseAuthoring";
export default async function AiBriefPage({searchParams}:{searchParams:Promise<{aiResult?:string}>}) {
  const admin=await requireAdmin();
  const unavailable=await getAdminWorkspaceAiAuthoringNotice(admin);
  const {aiResult}=await searchParams;
  return <AiCourseAuthoring key={aiResult??'new'} enabled={pageAuthoringEnabled()&&!unavailable} initialId={aiResult}/>;
}
