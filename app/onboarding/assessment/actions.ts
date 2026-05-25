"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  VALUES_STARTER_CHECK_SLUG,
  getValuesAssessmentErrorMessage,
} from "@/lib/values-assessment";

function createAssessmentRedirect(path: string, message?: string | null) {
  if (!message) {
    return path;
  }

  const url = new URL(path, "http://localhost");
  url.searchParams.set("error", message);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export async function submitValuesAssessment(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect("/dashboard");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const assessmentId = String(formData.get("assessmentVersionId") ?? "").trim();

  if (!assessmentId) {
    redirect(
      createAssessmentRedirect(
        `/onboarding/assessment?slug=${encodeURIComponent(VALUES_STARTER_CHECK_SLUG)}`,
        "We could not load the Values Starter Check. Please refresh and try again.",
      ),
    );
  }

  const answers = Array.from(formData.entries())
    .filter(([key, value]) => key.startsWith("question:") && typeof value === "string")
    .map(([key, value]) => ({
      question_id: key.replace("question:", ""),
      option_id: String(value),
    }));

  const { error } = await supabase.rpc("complete_values_assessment", {
    p_assessment_version_id: assessmentId,
    p_answers: answers,
  });

  if (error) {
    redirect(createAssessmentRedirect("/onboarding/assessment", getValuesAssessmentErrorMessage(error.message)));
  }

  revalidatePath("/dashboard");
  revalidatePath("/onboarding/assessment");
  redirect("/dashboard");
}
