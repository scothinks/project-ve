import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
    <main className="mobile-shell min-h-screen px-5 py-8 pb-12">
      <div className="mx-auto max-w-3xl">
        <Card className="overflow-hidden p-6 md:p-7">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--ve-green)]">
            Values Starter Check
          </p>
          <h1 className="mt-3 text-[2rem] font-black tracking-[-0.04em] text-[var(--foreground)]">
            Values Starter Check
          </h1>
          <p className="mt-3 text-[0.98rem] font-medium leading-7 text-[var(--ve-muted-strong)]">
            Answer a few quick questions so Project VE can suggest lessons that fit where you are
            starting from. There are no right or wrong answers.
          </p>
          <div className="mt-5 rounded-[20px] bg-[var(--ve-green-soft)] px-4 py-3 text-sm font-semibold text-[var(--ve-green)]">
            Complete this check to unlock your personalized starting path and earn {assessment.xpAward} XP.
          </div>
          {params.error ? (
            <div className="mt-4 rounded-[18px] border border-[color:color-mix(in_srgb,var(--ve-mission)_28%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-mission)_10%,var(--ve-card))] px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
              {params.error}
            </div>
          ) : null}
        </Card>

        <form action={submitValuesAssessment} className="mt-5 space-y-4">
          <input name="assessmentVersionId" type="hidden" value={assessment.id} />

          {assessment.questions.map((question, index) => (
            <Card className="p-5 md:p-6" key={question.id} variant="quiet">
              <fieldset className="space-y-4">
                <legend className="text-base font-black leading-7 text-[var(--foreground)]">
                  <span className="mr-2 text-[var(--ve-green)]">{index + 1}.</span>
                  {question.prompt}
                </legend>
                {question.helperText ? (
                  <p className="text-sm font-medium leading-6 text-[var(--ve-muted)]">
                    {question.helperText}
                  </p>
                ) : null}
                <div className="space-y-3">
                  {question.options.map((option) => (
                    <label
                      className="flex cursor-pointer gap-3 rounded-[22px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] px-4 py-4 transition hover:border-[var(--ve-green)]"
                      key={option.id}
                    >
                      <input
                        className="mt-1 size-4 accent-[var(--ve-green)]"
                        name={`question:${question.id}`}
                        required
                        type="radio"
                        value={option.id}
                      />
                      <span className="min-w-0 text-[0.96rem] font-semibold leading-6 text-[var(--foreground)]">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </Card>
          ))}

          <div className="sticky bottom-4">
            <Card className="p-4 shadow-[0_12px_30px_rgba(var(--ve-shadow-rgb),0.18)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                  We will use this to personalize your starting lessons in a supportive way.
                </p>
                <Button className="w-full sm:w-auto" type="submit">
                  Finish and continue
                </Button>
              </div>
            </Card>
          </div>
        </form>
      </div>
    </main>
  );
}
