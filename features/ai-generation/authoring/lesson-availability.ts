import "server-only";
import type { AdminContext } from "@/lib/admin";
import { resolveOrganizationEntitlements } from "@/features/organizations/application/entitlements";
import { ORGANIZATION_AI_AUTHORING_NOTICE } from "@/features/organizations/admin/entitlement-guards";
import { pageAuthoringEnabled } from "./availability";

// Both the course entry point and the suggestion screen use the destination
// course's plan, including when a platform admin is editing an organisation course.
export async function getLessonAssistanceAvailability(
  { supabase }: Pick<AdminContext, "supabase">,
  organizationId: string | null,
) {
  const entitled = organizationId
    ? (await resolveOrganizationEntitlements(supabase, organizationId)).entitlements.aiAuthoringEnabled
    : true;
  const reason = !entitled ? ORGANIZATION_AI_AUTHORING_NOTICE
    : !pageAuthoringEnabled() ? "AI suggestions are not enabled yet."
    : !process.env.OPENAI_API_KEY ? "AI suggestions are temporarily unavailable."
    : null;
  return { enabled: reason === null, reason };
}
