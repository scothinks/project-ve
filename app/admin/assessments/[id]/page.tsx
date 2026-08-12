import { notFound } from "next/navigation";
import { AdminNoticeBanner, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { AssessmentWorkspace } from "@/components/admin/AssessmentWorkspace";
import { getAdminAssessmentWorkspace, requireAdminWorkspaceRole } from "@/lib/admin";

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePreviewAnswers(searchParams: Record<string, string | string[] | undefined> | undefined) {
  const answers: Record<string, string> = {};

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (!key.startsWith("preview:")) {
      continue;
    }

    const questionId = key.replace("preview:", "");
    const optionId = firstSearchValue(value);

    if (questionId && optionId) {
      answers[questionId] = optionId;
    }
  }

  return answers;
}

export default async function AdminAssessmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdminWorkspaceRole([
    "organisation_owner",
    "organisation_admin",
    "programme_manager",
    "content_editor",
  ]);
  const [workspace, resolvedSearchParams] = await Promise.all([
    getAdminAssessmentWorkspace(supabase, id),
    searchParams,
  ]);

  if (!workspace) {
    notFound();
  }

  const notice = firstSearchValue(resolvedSearchParams?.notice);

  return (
    <>
      <AdminPageHeader
        backHref="/admin/assessments"
        backLabel="Assessments"
        eyebrow="Assessment workspace"
        title={workspace.assessment.title}
        subtitle="Manage overview, questions, scoring, preview, version history, and publishing for this assessment version."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <AssessmentWorkspace
        previewAnswers={parsePreviewAnswers(resolvedSearchParams)}
        workspace={workspace}
      />
    </>
  );
}
