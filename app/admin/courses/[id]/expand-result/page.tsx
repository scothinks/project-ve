import Link from "next/link";
import { notFound } from "next/navigation";
import { generateLessonFromExpansionSuggestion } from "@/app/admin/courses/planner-actions";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import { requireAdmin } from "@/lib/admin";
import { requireAdminCourseAiAuthoring } from "@/features/organizations/admin/entitlement-guards";
import { getPlannerPlan } from "@/features/learning/admin/planner-data";
import { parseStoredCourseExpansionPlan } from "@/features/learning/admin/planner-model";

type ExpandResultPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ plan?: string }>;
};

export default async function ExpandResultPage({ params, searchParams }: ExpandResultPageProps) {
  const { id } = await params;
  const admin = await requireAdmin();
  await requireAdminCourseAiAuthoring(admin, id, `/admin/courses/${id}`);
  const { plan: planId } = await searchParams;

  if (!planId) {
    notFound();
  }

  const plan = await getPlannerPlan(admin.supabase, planId);
  const stored = plan.mode === "expand_course" ? parseStoredCourseExpansionPlan(plan.generated_plan) : null;

  if (!stored) {
    notFound();
  }

  return (
    <div className="-mx-5 md:-mx-8">
      <div className="border-b border-[var(--ui-border-subtle)] px-5 py-6 md:px-10">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--ui-text-muted)]"
          href={`/admin/courses/${id}/expand`}
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
      </div>

      <div className="flex justify-center px-6 py-12 md:py-24">
        <div className="flex w-full max-w-[600px] flex-col gap-6">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--ui-info)]">
              Suggested lessons
            </p>
            <h1 className="mt-2.5 text-[28px] font-black leading-[1.15] tracking-[-0.01em] text-[var(--ui-text)]">
              Add what&apos;s useful
            </h1>
            <p className="mt-2 text-sm font-medium leading-[1.6] text-[var(--ui-text-muted)]">
              Each one you add lands in the curriculum marked &quot;Needs review&quot; until someone signs off on it.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {stored.result.lessonSuggestions.map((suggestion, index) => (
              <div
                className="rounded-[18px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-[18px]"
                key={suggestion.title}
              >
                <div className="flex items-start justify-between gap-3.5">
                  <div className="min-w-0">
                    <p className="text-[15px] font-extrabold text-[var(--ui-text)]">{suggestion.title}</p>
                    <p className="mt-1.5 text-[13px] font-medium leading-[1.5] text-[var(--ui-text-muted)]">
                      {suggestion.reason}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-[var(--ui-text-muted)]">
                      {suggestion.estimatedMinutes} min &middot; estimated
                    </p>
                  </div>
                  <form action={generateLessonFromExpansionSuggestion}>
                    <input name="planId" type="hidden" value={plan.id} />
                    <input name="suggestionIndex" type="hidden" value={index} />
                    <PendingSubmitButton
                      className="shrink-0 rounded-full border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-soft)] px-4 py-2 text-xs font-extrabold text-[var(--ui-text)] disabled:opacity-60"
                      label="Add"
                      pendingLabel="Adding..."
                      type="submit"
                    />
                  </form>
                </div>
              </div>
            ))}
          </div>

          <Link
            className="self-center text-[13px] font-extrabold text-[var(--ui-action)]"
            href={`/admin/courses/${id}`}
          >
            Done &middot; back to curriculum
          </Link>
        </div>
      </div>
    </div>
  );
}
