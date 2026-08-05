import "server-only";

import { redirect } from "next/navigation";
import { appendAdminNotice } from "@/lib/admin-feedback";
import type { AdminContext } from "@/features/admin/application/context";
import { resolveOrganizationEntitlements } from "@/features/organizations/application/entitlements";

export const ORGANIZATION_AI_AUTHORING_NOTICE =
  "AI authoring is not available on this organisation plan.";

async function organizationHasAiAuthoring(
  context: AdminContext,
  organizationId: string,
) {
  const { entitlements } = await resolveOrganizationEntitlements(
    context.supabase,
    organizationId,
  );

  return entitlements.aiAuthoringEnabled;
}

export async function getAdminWorkspaceAiAuthoringNotice(
  context: AdminContext,
) {
  if (context.workspace.type === "platform") {
    return null;
  }

  return await organizationHasAiAuthoring(context, context.workspace.id)
    ? null
    : ORGANIZATION_AI_AUTHORING_NOTICE;
}

export async function requireAdminWorkspaceAiAuthoring(
  context: AdminContext,
  redirectTo: string,
) {
  const notice = await getAdminWorkspaceAiAuthoringNotice(context);

  if (notice) {
    redirect(appendAdminNotice(redirectTo, notice));
  }
}

export async function requireAdminCourseAiAuthoring(
  context: AdminContext,
  courseId: string,
  redirectTo: string,
) {
  if (!courseId) {
    await requireAdminWorkspaceAiAuthoring(context, redirectTo);
    return;
  }

  const { data, error } = await context.supabase
    .from("courses")
    .select("organization_id")
    .eq("id", courseId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data?.organization_id) {
    if (!await organizationHasAiAuthoring(context, data.organization_id)) {
      redirect(appendAdminNotice(redirectTo, ORGANIZATION_AI_AUTHORING_NOTICE));
    }
    return;
  }

  await requireAdminWorkspaceAiAuthoring(context, redirectTo);
}

export async function requireAdminLessonAiAuthoring(
  context: AdminContext,
  lessonId: string,
  redirectTo: string,
) {
  if (!lessonId) {
    await requireAdminWorkspaceAiAuthoring(context, redirectTo);
    return;
  }

  const { data, error } = await context.supabase
    .from("lessons")
    .select("course_id")
    .eq("id", lessonId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  await requireAdminCourseAiAuthoring(context, data?.course_id ?? "", redirectTo);
}
