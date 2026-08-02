import Link from "next/link";
import {
  AdminCard,
  AdminStatusBadge,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import { parseStoredCourseExpansionPlan } from "@/features/learning/admin/planner-model";
import type { AdminCourseDetailPageData } from "./course-detail-data";

type ExpansionAction = (formData: FormData) => void | Promise<void>;

type CourseDetailExpansionSectionProps = {
  course: AdminCourseDetailPageData["course"];
  expansionPlans: AdminCourseDetailPageData["expansionPlans"];
  actions: {
    generateCourseExpansionPlan: ExpansionAction;
    generateLessonFromExpansionSuggestion: ExpansionAction;
  };
};

function workflowTone(status: string) {
  if (status === "approved" || status === "ready" || status === "published") return "good" as const;
  if (status === "changes_requested") return "danger" as const;
  if (status === "draft" || status === "generation_ready" || status === "in_review") return "warning" as const;
  return "neutral" as const;
}

function formatPlanTime(value: string) {
  return new Date(value).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function CourseDetailExpansionSection({
  actions,
  course,
  expansionPlans,
}: CourseDetailExpansionSectionProps) {
  return (
    <section className="mb-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <AdminCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">AI lesson assistant</p>
            <h2 className="mt-2 text-lg font-black">Plan the next lesson before drafting it</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
              Analyze the current course, suggest useful next lessons, and draft only the selected lesson idea into the existing text review, media review, and publish workflow.
            </p>
          </div>
          <Link
            className="rounded-[12px] border border-[var(--ve-line-soft)] px-4 py-3 text-sm font-black text-[var(--ve-green)]"
            href={`/admin/courses/ai/planner?courseId=${course.id}`}
          >
            Open AI Planner
          </Link>
        </div>

        <form action={actions.generateCourseExpansionPlan} className="mt-5 space-y-4">
          <input name="course_id" type="hidden" value={course.id} />
          <div className="grid gap-4 md:grid-cols-[1fr_150px]">
            <label>
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Expansion goal</span>
              <select className="mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold" defaultValue="Fill topic gaps" name="expansion_goal">
                <option value="Add beginner lessons">Add beginner lessons</option>
                <option value="Add advanced lessons">Add advanced lessons</option>
                <option value="Add scenario/practice lessons">Add scenario/practice lessons</option>
                <option value="Add recap/assessment lesson">Add recap/assessment lesson</option>
                <option value="Fill topic gaps">Fill topic gaps</option>
                <option value="Improve weak course progression">Improve weak course progression</option>
                <option value="Create follow-up course">Create follow-up course</option>
              </select>
            </label>
            <label>
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Suggestions</span>
              <input className="mt-2 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold" defaultValue={3} max={6} min={1} name="number_of_suggestions" type="number" />
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Notes</span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold"
              name="notes"
              placeholder="Example: Focus on practice, recap, and gentle progression without repeating the current lessons."
            />
          </label>

          <PendingSubmitButton
            className="inline-flex items-center justify-center rounded-[14px] bg-[var(--ve-sky)] px-5 py-3 text-sm font-black text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
                label="Propose Curriculum"
                pendingLabel="Proposing Curriculum..."
            type="submit"
          />
        </form>
      </AdminCard>

      <AdminCard>
        <h2 className="text-lg font-black">Latest expansion plans</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
          Generate a lesson draft directly from any suggestion below. It will stay in draft and re-enter the existing approval gates.
        </p>

        {expansionPlans.length === 0 ? (
          <div className="mt-4">
            <EmptyAdminState>No expansion plans yet for this course.</EmptyAdminState>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {expansionPlans.map((planRow) => {
              const planData = parseStoredCourseExpansionPlan(planRow.generated_plan);
              if (!planData) {
                return (
                  <div className="rounded-[16px] border border-[color:color-mix(in_srgb,var(--ve-danger)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] p-4 text-sm font-semibold text-[var(--ve-danger)]" key={planRow.id}>
                    This saved expansion plan could not be read.
                  </div>
                );
              }

              return (
                <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4" key={planRow.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                        {planData.input.expansionGoal}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                        Generated {formatPlanTime(planRow.created_at)}
                      </p>
                    </div>
                    <AdminStatusBadge tone={workflowTone(planRow.status)}>{planRow.status.replaceAll("_", " ")}</AdminStatusBadge>
                  </div>

                  <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                    <span className="font-black text-[var(--foreground)]">Recommended direction:</span> {planData.result.courseAnalysis.recommendedDirection}
                  </p>

                  <div className="mt-4 space-y-3">
                    {planData.result.lessonSuggestions.map((suggestion, suggestionIndex) => (
                      <div className="rounded-[14px] bg-[var(--ve-panel)] p-4" key={`${planRow.id}-${suggestion.title}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black">{suggestion.title}</p>
                            <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                              {suggestion.placement} · {suggestion.difficulty} · {suggestion.estimatedMinutes} min
                            </p>
                          </div>
                          <form action={actions.generateLessonFromExpansionSuggestion}>
                            <input name="planId" type="hidden" value={planRow.id} />
                            <input name="suggestionIndex" type="hidden" value={suggestionIndex} />
                            <PendingSubmitButton
                              className="rounded-[12px] bg-[var(--ve-sky)] px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-70"
                              label="Draft Lesson"
                              pendingLabel="Drafting Lesson..."
                              type="submit"
                            />
                          </form>
                        </div>
                        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                          {suggestion.reason}
                        </p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                          <span className="font-black text-[var(--foreground)]">Objective:</span> {suggestion.learningObjective}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AdminCard>
    </section>
  );
}
