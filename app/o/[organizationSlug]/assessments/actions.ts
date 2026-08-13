"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createLoginHref } from "@/lib/auth-redirect";
import { isLiveMode } from "@/lib/app-mode";
import { getValuesAssessmentErrorMessage } from "@/lib/values-assessment";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function createAssessmentRedirect(path: string, message?: string | null) {
  if (!message) {
    return path;
  }

  const url = new URL(path, "http://localhost");
  url.searchParams.set("error", message);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function getOrgAssessmentPath({
  assessmentVersionId,
  organizationSlug,
  programmeId,
}: {
  assessmentVersionId: string;
  organizationSlug: string;
  programmeId: string;
}) {
  return `/o/${encodeURIComponent(organizationSlug)}/assessments/${encodeURIComponent(assessmentVersionId)}?programmeId=${encodeURIComponent(programmeId)}`;
}

export async function submitOrganizationValuesAssessment(formData: FormData) {
  const organizationSlug = String(formData.get("organizationSlug") ?? "").trim();
  const programmeId = String(formData.get("programmeId") ?? "").trim();
  const assessmentVersionId = String(formData.get("assessmentVersionId") ?? "").trim();
  const fallbackPath = organizationSlug
    ? getOrgAssessmentPath({ assessmentVersionId, organizationSlug, programmeId })
    : "/org/my";
  const supabase = await createSupabaseServerClient();

  if (isLiveMode && !supabase) {
    redirect(createLoginHref(fallbackPath));
  }

  if (!supabase) {
    redirect("/org/my");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isLiveMode && !user) {
    redirect(createLoginHref(fallbackPath));
  }

  if (!user) {
    redirect("/org/my");
  }

  if (!organizationSlug || !programmeId || !assessmentVersionId) {
    redirect(createAssessmentRedirect(fallbackPath, "We could not load this assessment. Please refresh and try again."));
  }

  const answers = Array.from(formData.entries())
    .filter(([key, value]) => key.startsWith("question:") && typeof value === "string")
    .map(([key, value]) => ({
      question_id: key.replace("question:", ""),
      option_id: String(value),
    }));

  const { error } = await supabase.rpc("complete_values_assessment", {
    p_assessment_version_id: assessmentVersionId,
    p_answers: answers,
    p_programme_id: programmeId,
  });

  if (error) {
    redirect(createAssessmentRedirect(fallbackPath, getValuesAssessmentErrorMessage(error.message)));
  }

  revalidatePath(`/o/${encodeURIComponent(organizationSlug)}/learn`);
  revalidatePath(`/o/${encodeURIComponent(organizationSlug)}/profile`);
  redirect(
    `/o/${encodeURIComponent(organizationSlug)}/learn?assessment=completed&programmeId=${encodeURIComponent(programmeId)}&assessmentVersionId=${encodeURIComponent(assessmentVersionId)}`,
  );
}
