import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ValuesAssessmentFlow } from "@/components/onboarding/ValuesAssessmentFlow";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";
import {
  getPublishedValuesAssessment,
  getUserAssessmentCompletionStatus,
  learnerNeedsValuesAssessment,
} from "@/lib/values-assessment";
import { submitValuesAssessment } from "./actions";

type ValuesAssessmentPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

function getPreferredFirstName(displayName?: string | null) {
  const firstName = displayName?.trim().split(/\s+/)[0];
  return firstName && firstName.length > 0 ? firstName : null;
}

export default async function ValuesAssessmentPage({ searchParams }: ValuesAssessmentPageProps) {
  const params = (await searchParams) ?? {};
  const { user, profile } = await getCurrentUserProfile();

  if (!user) {
    redirect("/login");
  }

  if (profile?.role === "admin") {
    redirect("/dashboard");
  }

  const supabase = await createSupabaseServerClient();
  const completionStatus = await getUserAssessmentCompletionStatus(supabase, user.id);

  if (
    !learnerNeedsValuesAssessment({
      role: profile?.role,
      assessmentCompletedAt: completionStatus?.assessment_completed_at ?? null,
    })
  ) {
    redirect("/dashboard");
  }

  const assessment = await getPublishedValuesAssessment(supabase);

  if (!assessment) {
    return (
      <main className="mobile-shell min-h-screen px-6 py-10">
        <Card className="mx-auto max-w-2xl p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ve-green)]">
            Values Starter Check
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.03em]">
            This check is not available yet
          </h1>
          <p className="mt-3 text-sm font-medium leading-6 text-[var(--ve-muted)]">
            We could not load the starter questions right now. Please try again shortly.
          </p>
          <div className="mt-5">
            <Button href="/dashboard" variant="soft">
              Back to Home
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="mobile-shell min-h-screen px-5 py-8 pb-10">
      <ValuesAssessmentFlow
        action={submitValuesAssessment}
        assessment={{
          id: assessment.id,
          title: assessment.title,
          xpAward: assessment.xpAward,
          questions: assessment.questions.map((question) => ({
            id: question.id,
            prompt: question.prompt,
            helperText: question.helperText,
            options: question.options.map((option) => ({
              id: option.id,
              label: option.label,
              description: option.description,
            })),
          })),
        }}
        errorMessage={params.error ?? null}
        preferredName={getPreferredFirstName(profile?.display_name)}
      />
    </main>
  );
}
