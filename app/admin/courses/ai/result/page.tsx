import Link from "next/link";
import { notFound } from "next/navigation";
import { useAiBriefOutline } from "@/app/admin/courses/ai/brief-actions";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import { requireAdmin } from "@/lib/admin";
import { requireAdminWorkspaceAiAuthoring } from "@/features/organizations/admin/entitlement-guards";
import { getPlannerPlan } from "@/features/learning/admin/planner-data";
import { parseStoredNewCoursePlan } from "@/features/learning/admin/planner-model";

type AiResultPageProps = {
  searchParams: Promise<{ plan?: string }>;
};

export default async function AiResultPage({ searchParams }: AiResultPageProps) {
  const admin = await requireAdmin();
  await requireAdminWorkspaceAiAuthoring(admin, "/admin/courses/choose");
  const { plan: planId } = await searchParams;

  if (!planId) {
    notFound();
  }

  const plan = await getPlannerPlan(admin.supabase, planId);
  const stored = plan.mode === "new_course" ? parseStoredNewCoursePlan(plan.generated_plan) : null;
  const option = stored?.result.options[0];

  if (!stored || !option) {
    notFound();
  }

  return (
    <div className="-mx-5 md:-mx-8">
      <div className="border-b border-[var(--ui-border-subtle)] px-5 py-6 md:px-10">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--ui-text-muted)]"
          href="/admin/courses/ai/brief"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
      </div>

      <div className="flex justify-center px-6 py-12 md:py-24">
        <div className="flex w-full max-w-[640px] flex-col gap-6">
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full px-3.5 py-[5px] text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ui-on-info)]"
            style={{ background: "linear-gradient(135deg, var(--ui-info), var(--ui-info))" }}
          >
            <svg aria-hidden="true" className="h-3 w-3" fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24">
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
              <circle cx="12" cy="12" r="3.2" />
            </svg>
            AI suggested
          </span>

          <div>
            <h1 className="text-[32px] font-black leading-[1.15] tracking-[-0.01em] text-[var(--ui-text)]">
              {option.title}
            </h1>
            <p className="mt-2.5 text-[15px] font-medium leading-[1.6] text-[var(--ui-text-muted)]">
              {option.description}
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--ui-text-muted)]">
              Suggested lessons
            </span>
            {option.lessonOutline.map((lesson, index) => (
              <div
                className="flex items-center gap-3.5 rounded-[16px] border border-dashed border-[var(--ui-border-subtle)] px-4 py-3.5"
                key={lesson.title}
              >
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[var(--ui-surface-soft)] text-xs font-extrabold text-[var(--ui-text-muted)]">
                  {index + 1}
                </span>
                <span className="text-sm font-bold text-[var(--ui-text)]">{lesson.title}</span>
              </div>
            ))}
          </div>

          <div className="mt-2 flex gap-2.5">
            <form action={useAiBriefOutline} className="flex-1">
              <input name="planId" type="hidden" value={plan.id} />
              <input name="optionIndex" type="hidden" value={0} />
              <input name="learningObjectivesJson" type="hidden" value={JSON.stringify(option.learningObjectives)} />
              <input name="lessonOutlineJson" type="hidden" value={JSON.stringify(option.lessonOutline)} />
              <PendingSubmitButton
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--ui-action)] px-5 py-[15px] text-sm font-extrabold text-[var(--ui-on-action)] disabled:opacity-60"
                label="Use this outline"
                pendingLabel="Creating..."
                type="submit"
              />
            </form>
            <Link
              className="inline-flex items-center justify-center rounded-full border border-[var(--ui-border-subtle)] px-[22px] py-[15px] text-sm font-bold text-[var(--ui-text)]"
              href="/admin/courses/ai/brief"
            >
              Try again
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
