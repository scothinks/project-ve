import 'server-only';
import { cache } from 'react';
import { requireAdmin, PLATFORM_CATALOG_WORKSPACE_ID, type AdminContext } from '@/lib/admin';
import { getAdminWorkspaceAiAuthoringNotice } from '@/features/organizations/admin/entitlement-guards';
import { pageAuthoringEnabled } from './availability';

export type CourseAvailability = { enabled: boolean; guidanceEnabled: boolean; reason: string | null; workspaceId: string | null };
export function courseWorkspaceId(admin: AdminContext) {
  return admin.workspace.type === 'organization' && admin.workspace.id !== PLATFORM_CATALOG_WORKSPACE_ID ? admin.workspace.id : null;
}
export const getCourseAvailability = cache(async (): Promise<CourseAvailability> => {
  const admin = await requireAdmin();
  const notice = await getAdminWorkspaceAiAuthoringNotice(admin);
  const reason = notice || (!pageAuthoringEnabled() ? 'AI course creation is not enabled yet.'
    : !process.env.OPENAI_API_KEY ? 'AI course creation is temporarily unavailable.' : null);
  return { enabled: !reason, guidanceEnabled: !reason && process.env.AI_AUTHORING_GUIDANCE_ENABLED === 'true', reason, workspaceId: courseWorkspaceId(admin) };
});
