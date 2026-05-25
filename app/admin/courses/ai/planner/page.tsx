import Link from "next/link";
import { AdminCard, AdminNoticeBanner, AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import {
  dismissCoursePlan,
  generateCourseExpansionPlan,
  generateLessonFromExpansionSuggestion,
  generateNewCoursePlanOptions,
  generatePlannedLessonsFromSelectedPlan,
  handleNewCoursePlanOptionSubmission,
} from "@/app/admin/courses/planner-actions";
import {
  parseStoredCourseExpansionPlan,
  parseStoredNewCoursePlan,
  parseStoredNewCoursePlanSelection,
} from "@/lib/ai-course-planner";
import { getAiLearningConfig } from "@/lib/ai-learning-generator";
import { getAdminAiCoursePlans, getAdminCourses, requireAdmin } from "@/lib/admin";

function fieldClasses() {
  return "mt-2 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 py-3 text-sm font-bold outline-none transition focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)]";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

function formatPlanTime(value: string) {
  return new Date(value).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function planTone(status: string) {
  if (status === "used") return "good" as const;
  if (status === "dismissed") return "danger" as const;
  if (status === "selected") return "warning" as const;
  return "neutral" as const;
}

function isHistoryPlan(status: string) {
  return status === "used" || status === "dismissed";
}

function prioritizeFocusedPlan<T extends { id: string }>(plans: T[], focusedPlanId?: string) {
  return [...plans].sort((first, second) => {
    if (first.id === focusedPlanId) return -1;
    if (second.id === focusedPlanId) return 1;
    return 0;
  });
}

function shouldOpenPlan(status: string, planId: string, focusedPlanId?: string) {
  return planId === focusedPlanId || status === "selected";
}

function disclosureClasses() {
  return "rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)]";
}

function disclosureSummaryClasses() {
  return "cursor-pointer list-none px-4 py-4";
}

function buildPlannerRedirect(courseId?: string, plan?: string) {
  const params = new URLSearchParams();
  if (courseId) params.set("courseId", courseId);
  if (plan) params.set("plan", plan);
  const query = params.toString();
  return query ? `/admin/courses/ai/planner?${query}` : "/admin/courses/ai/planner";
}

type PlannerPageProps = {
  searchParams?: Promise<{ notice?: string; courseId?: string; plan?: string }>;
};

export default async function AdminAiCoursePlannerPage({ searchParams }: PlannerPageProps) {
  const config = getAiLearningConfig();
  const { supabase } = await requireAdmin();
  const { notice, courseId, plan } = (await searchParams) ?? {};
  const [courses, newCoursePlans, expansionPlans] = await Promise.all([
    getAdminCourses(supabase),
    getAdminAiCoursePlans(supabase, { mode: "new_course", limit: 12 }),
    getAdminAiCoursePlans(supabase, { mode: "expand_course", courseId, limit: 12 }),
  ]);

  const selectedCourse = courseId ? courses.find((course) => course.id === courseId) ?? null : null;
  const orderedNewCoursePlans = prioritizeFocusedPlan(newCoursePlans, plan);
  const orderedExpansionPlans = prioritizeFocusedPlan(expansionPlans, plan);
  const activeNewCoursePlans = orderedNewCoursePlans.filter((planRow) => !isHistoryPlan(planRow.status));
  const historicalNewCoursePlans = orderedNewCoursePlans.filter((planRow) => isHistoryPlan(planRow.status));
  const activeExpansionPlans = orderedExpansionPlans.filter((planRow) => !isHistoryPlan(planRow.status));
  const historicalExpansionPlans = orderedExpansionPlans.filter((planRow) => isHistoryPlan(planRow.status));

  return (
    <>
      <AdminPageHeader
        backHref="/admin/courses"
        backLabel="Courses"
        eyebrow="Learning"
        title="AI Course Planner"
        subtitle="Plan a new course from a rough idea or expand an existing course with suggested next lessons before running the current draft workflow."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <AdminCard>
            <div className="mb-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">Start a new course</p>
              <h2 className="mt-2 text-lg font-black">Generate 3 course brief options</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                Start from a rough idea, problem, or theme. The planner suggests course titles, learning goals, and lesson structure before the normal AI draft flow begins.
              </p>
            </div>

            <form action={generateNewCoursePlanOptions} className="space-y-5">
              <label className="block">
                <span className={labelClasses()}>Rough idea / problem / theme</span>
                <textarea
                  className={`${fieldClasses()} min-h-28 resize-none`}
                  name="roughIdea"
                  placeholder="Example: Many young people know they should vote, but they do not understand how civic responsibility affects daily life."
                  required
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className={labelClasses()}>Audience</span>
                  <input className={fieldClasses()} name="audience" placeholder="Young adults, community learners" required />
                </label>
                <label>
                  <span className={labelClasses()}>Region</span>
                  <input className={fieldClasses()} name="region" placeholder="Nigeria" required />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className={labelClasses()}>Level</span>
                  <select className={fieldClasses()} defaultValue="beginner" name="level">
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </label>
                <label>
                  <span className={labelClasses()}>Tone</span>
                  <input className={fieldClasses()} defaultValue="practical and encouraging" name="tone" required />
                </label>
              </div>

              <label className="block">
                <span className={labelClasses()}>Notes</span>
                <textarea
                  className={`${fieldClasses()} min-h-24 resize-none`}
                  name="notes"
                  placeholder="Add local context, examples to include, examples to avoid, or source material to stay close to."
                />
              </label>

              <PendingSubmitButton
                className="inline-flex items-center justify-center rounded-[14px] bg-[var(--ve-green)] px-5 py-3 text-sm font-black text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
                label="Generate Brief Options"
                pendingLabel="Generating Brief Options..."
                type="submit"
              />
            </form>
          </AdminCard>

          <AdminCard>
            <div className="mb-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">Expand an existing course</p>
              <h2 className="mt-2 text-lg font-black">Suggest the next useful lessons</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                The planner reviews current lessons, page structure, and quiz coverage, then suggests logical next lessons or improvement paths without publishing anything.
              </p>
            </div>

            <form action={generateCourseExpansionPlan} className="space-y-5">
              <label className="block">
                <span className={labelClasses()}>Course</span>
                <select className={fieldClasses()} defaultValue={courseId ?? ""} name="course_id" required>
                  <option value="">Select an existing course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title} ({course.status})
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 md:grid-cols-[1fr_160px]">
                <label>
                  <span className={labelClasses()}>Expansion goal</span>
                  <select className={fieldClasses()} defaultValue="Fill topic gaps" name="expansion_goal">
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
                  <span className={labelClasses()}>Suggestions</span>
                  <input className={fieldClasses()} defaultValue={3} max={6} min={1} name="number_of_suggestions" type="number" />
                </label>
              </div>

              <label className="block">
                <span className={labelClasses()}>Notes</span>
                <textarea
                  className={`${fieldClasses()} min-h-24 resize-none`}
                  name="notes"
                  placeholder="Example: Avoid repeating the current intro lessons. Add more practice and real-life scenarios."
                />
              </label>

              <PendingSubmitButton
                className="inline-flex items-center justify-center rounded-[14px] bg-[var(--ve-sky)] px-5 py-3 text-sm font-black text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
                label="Generate Expansion Ideas"
                pendingLabel="Generating Expansion Ideas..."
                type="submit"
              />
            </form>
          </AdminCard>
        </div>

        <AdminCard className="space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">Workflow</p>
            <h2 className="mt-2 text-lg font-black">Planning sits before generation</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
              The planner helps editors decide what to generate. It never publishes, never skips text review, and never bypasses media approval.
            </p>
          </div>

          <div className="rounded-[16px] bg-[var(--ve-panel)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Server model</p>
            <p className="mt-2 text-sm font-black">{config.textModel}</p>
            <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
              Planner output is validated as strict JSON before saving.
            </p>
          </div>

          <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Environment</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
              {config.hasApiKey
                ? "OPENAI_API_KEY is available for planning and draft generation."
                : "OPENAI_API_KEY is not configured. Planning and draft generation will fail until it is added to the server environment."}
            </p>
          </div>

          <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Current focus</p>
            <p className="mt-2 text-sm font-black">
              {selectedCourse ? selectedCourse.title : "No course preselected"}
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
              {selectedCourse
                ? "Expansion plans below are filtered to the selected course."
                : "Pick a course above or open the planner from a course detail page to focus expansion work."}
            </p>
          </div>
        </AdminCard>
      </div>

      <section className="mt-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">Planner results</p>
            <h2 className="mt-2 text-lg font-black">New course brief options</h2>
          </div>
        </div>

        {orderedNewCoursePlans.length === 0 ? (
          <AdminCard>
            <p className="text-sm font-semibold text-[var(--ve-muted)]">No AI course brief plans yet.</p>
          </AdminCard>
        ) : (
          <div className="space-y-4">
            <details className={disclosureClasses()} open={activeNewCoursePlans.length > 0}>
              <summary className={disclosureSummaryClasses()}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">Active brief results</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                      Draft and selected plans you can still work with.
                    </p>
                  </div>
                  <AdminStatusBadge tone="warning">{activeNewCoursePlans.length}</AdminStatusBadge>
                </div>
              </summary>

              <div className="space-y-4 border-t border-[var(--ve-line-soft)] px-4 py-4">
                {activeNewCoursePlans.length === 0 ? (
                  <p className="text-sm font-semibold text-[var(--ve-muted)]">No active new-course briefs right now.</p>
                ) : (
                  activeNewCoursePlans.map((planRow) => {
                    const planData = parseStoredNewCoursePlan(planRow.generated_plan);
                    const selectedBrief = parseStoredNewCoursePlanSelection(planRow.selected_items[0]);
                    if (!planData) {
                      return (
                        <div className="rounded-[16px] border border-[color:color-mix(in_srgb,var(--ve-danger)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] p-4" key={planRow.id}>
                          <p className="text-sm font-semibold text-[var(--ve-danger)]">This saved plan could not be read.</p>
                        </div>
                      );
                    }

                    return (
                      <details className={disclosureClasses()} key={planRow.id} open={shouldOpenPlan(planRow.status, planRow.id, plan)}>
                        <summary className={disclosureSummaryClasses()}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                                New course plan
                              </p>
                              <h3 className="mt-2 text-base font-black">{planData.input.roughIdea}</h3>
                              <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                                Generated {formatPlanTime(planRow.created_at)} · {planData.input.audience} · {planData.input.region}
                              </p>
                            </div>
                            <AdminStatusBadge tone={planTone(planRow.status)}>{planRow.status}</AdminStatusBadge>
                          </div>
                        </summary>

                        <div className="space-y-5 border-t border-[var(--ve-line-soft)] px-4 py-4">
                          {selectedBrief ? (
                            <div className="rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                                    Selected brief
                                  </p>
                                  <p className="mt-2 text-sm font-black">{selectedBrief.title}</p>
                                  <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                                    {selectedBrief.generatedCourseId
                                      ? `Course shell created ${selectedBrief.courseShellCreatedAt ? formatPlanTime(selectedBrief.courseShellCreatedAt) : "recently"}.`
                                      : "This brief is selected and ready for staged generation."}
                                  </p>
                                  {selectedBrief.lessonsGeneratedAt ? (
                                    <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                                      Planned lessons generated {formatPlanTime(selectedBrief.lessonsGeneratedAt)}.
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {selectedBrief.generatedCourseId ? (
                                    <Link
                                      className="rounded-[12px] bg-[var(--ve-card)] px-3 py-2 text-xs font-black text-[var(--ve-green)]"
                                      href={`/admin/courses/${selectedBrief.generatedCourseId}`}
                                    >
                                      Open Course Shell
                                    </Link>
                                  ) : null}
                                  {selectedBrief.generatedCourseId && !selectedBrief.lessonsGeneratedAt ? (
                                    <form action={generatePlannedLessonsFromSelectedPlan}>
                                      <input name="planId" type="hidden" value={planRow.id} />
                                      <PendingSubmitButton
                                        className="rounded-[12px] bg-[var(--ve-sky)] px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-70"
                                        label="Generate Planned Lessons"
                                        pendingLabel="Generating Planned Lessons..."
                                        type="submit"
                                      />
                                    </form>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ) : null}

                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <form action={dismissCoursePlan}>
                              <input name="planId" type="hidden" value={planRow.id} />
                              <input name="redirectTo" type="hidden" value={buildPlannerRedirect(courseId)} />
                              <PendingSubmitButton
                                className="rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] px-3 py-2 text-xs font-black text-[var(--ve-danger)] disabled:cursor-not-allowed disabled:opacity-70"
                                label="Dismiss"
                                pendingLabel="Dismissing..."
                                type="submit"
                              />
                            </form>
                          </div>

                          <div className="grid gap-4 xl:grid-cols-3">
                            {planData.result.options.map((option, optionIndex) => (
                              <form action={handleNewCoursePlanOptionSubmission} className="rounded-[16px] border border-[var(--ve-line-soft)] p-4" key={`${planRow.id}-${option.title}`}>
                                <input name="planId" type="hidden" value={planRow.id} />
                                <input name="optionIndex" type="hidden" value={optionIndex} />
                                <input name="learningObjectivesJson" type="hidden" value={JSON.stringify(option.learningObjectives)} />
                                <input name="lessonOutlineJson" type="hidden" value={JSON.stringify(option.lessonOutline)} />
                                <div className="space-y-3">
                                  <label className="block">
                                    <span className={labelClasses()}>Title</span>
                                    <input className={fieldClasses()} defaultValue={option.title} name="selectedTitle" />
                                  </label>

                                  <label className="block">
                                    <span className={labelClasses()}>Description</span>
                                    <textarea className={`${fieldClasses()} min-h-24 resize-none`} defaultValue={option.description} name="selectedDescription" />
                                  </label>

                                  <div className="grid gap-3 md:grid-cols-2">
                                    <label>
                                      <span className={labelClasses()}>Level</span>
                                      <select className={fieldClasses()} defaultValue={option.level} name="selectedLevel">
                                        <option value="beginner">Beginner</option>
                                        <option value="intermediate">Intermediate</option>
                                        <option value="advanced">Advanced</option>
                                      </select>
                                    </label>
                                    <label>
                                      <span className={labelClasses()}>Tone</span>
                                      <input className={fieldClasses()} defaultValue={option.tone} name="selectedTone" />
                                    </label>
                                  </div>

                                  <label className="block">
                                    <span className={labelClasses()}>Course goal</span>
                                    <textarea className={`${fieldClasses()} min-h-20 resize-none`} defaultValue={option.courseGoal} name="selectedCourseGoal" />
                                  </label>

                                  <label className="block">
                                    <span className={labelClasses()}>Target audience</span>
                                    <input className={fieldClasses()} defaultValue={option.targetAudience} name="selectedTargetAudience" />
                                  </label>

                                  <div>
                                    <p className={labelClasses()}>Learning objectives</p>
                                    <ul className="mt-2 space-y-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                                      {option.learningObjectives.map((objective) => (
                                        <li key={objective}>• {objective}</li>
                                      ))}
                                    </ul>
                                  </div>

                                  <div>
                                    <p className={labelClasses()}>Lesson outline</p>
                                    <div className="mt-2 space-y-3">
                                      {option.lessonOutline.map((lesson, lessonIndex) => (
                                        <div className="rounded-[14px] bg-[var(--ve-panel)] p-3" key={`${option.title}-${lesson.title}`}>
                                          <p className="text-sm font-black">{lessonIndex + 1}. {lesson.title}</p>
                                          <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{lesson.purpose}</p>
                                          <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                                            Objective: {lesson.learningObjective}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <label className="block">
                                    <span className={labelClasses()}>Quiz strategy</span>
                                    <textarea className={`${fieldClasses()} min-h-20 resize-none`} defaultValue={option.quizStrategy} name="selectedQuizStrategy" />
                                  </label>

                                  <label className="block">
                                    <span className={labelClasses()}>Media style</span>
                                    <textarea className={`${fieldClasses()} min-h-20 resize-none`} defaultValue={option.mediaStyle} name="selectedMediaStyle" />
                                  </label>

                                  <label className="block">
                                    <span className={labelClasses()}>Why this course</span>
                                    <textarea className={`${fieldClasses()} min-h-20 resize-none`} defaultValue={option.whyThisCourse} name="selectedWhyThisCourse" />
                                  </label>

                                  <div className="flex flex-wrap gap-3 pt-2">
                                    <PendingSubmitButton
                                      className="rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_78%,var(--ve-card))] px-4 py-3 text-sm font-black text-[var(--ve-green)] disabled:cursor-not-allowed disabled:opacity-70"
                                      label="Use This Brief"
                                      name="submitIntent"
                                      pendingLabel="Saving Brief..."
                                      pendingValue="use-brief"
                                      type="submit"
                                      value="use-brief"
                                    />
                                    <PendingSubmitButton
                                      className="rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-sky-soft)_78%,var(--ve-card))] px-4 py-3 text-sm font-black text-[var(--ve-sky)] disabled:cursor-not-allowed disabled:opacity-70"
                                      label="Generate Course Shell"
                                      name="submitIntent"
                                      pendingLabel="Generating Course Shell..."
                                      pendingValue="generate-course-shell"
                                      type="submit"
                                      value="generate-course-shell"
                                    />
                                    <PendingSubmitButton
                                      className="rounded-[12px] bg-[var(--ve-green)] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-70"
                                      label="Generate Course Draft"
                                      name="submitIntent"
                                      pendingLabel="Generating Course Draft..."
                                      pendingValue="generate-course"
                                      type="submit"
                                      value="generate-course"
                                    />
                                  </div>
                                  <input name="redirectTo" type="hidden" value={buildPlannerRedirect(courseId, planRow.id)} />
                                </div>
                              </form>
                            ))}
                          </div>
                        </div>
                      </details>
                    );
                  })
                )}
              </div>
            </details>

            <details className={disclosureClasses()} open={historicalNewCoursePlans.some((planRow) => planRow.id === plan)}>
              <summary className={disclosureSummaryClasses()}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">History</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                      Used and dismissed briefs from earlier planning runs.
                    </p>
                  </div>
                  <AdminStatusBadge tone="neutral">{historicalNewCoursePlans.length}</AdminStatusBadge>
                </div>
              </summary>

              <div className="space-y-4 border-t border-[var(--ve-line-soft)] px-4 py-4">
                {historicalNewCoursePlans.length === 0 ? (
                  <p className="text-sm font-semibold text-[var(--ve-muted)]">No saved brief history yet.</p>
                ) : (
                  historicalNewCoursePlans.map((planRow) => {
                    const planData = parseStoredNewCoursePlan(planRow.generated_plan);
                    if (!planData) {
                      return (
                        <div className="rounded-[16px] border border-[color:color-mix(in_srgb,var(--ve-danger)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] p-4" key={planRow.id}>
                          <p className="text-sm font-semibold text-[var(--ve-danger)]">This saved plan could not be read.</p>
                        </div>
                      );
                    }

                    return (
                      <details className={disclosureClasses()} key={planRow.id} open={planRow.id === plan}>
                        <summary className={disclosureSummaryClasses()}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                                New course plan
                              </p>
                              <h3 className="mt-2 text-base font-black">{planData.input.roughIdea}</h3>
                              <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                                Generated {formatPlanTime(planRow.created_at)} · {planData.input.audience} · {planData.input.region}
                              </p>
                            </div>
                            <AdminStatusBadge tone={planTone(planRow.status)}>{planRow.status}</AdminStatusBadge>
                          </div>
                        </summary>

                        <div className="space-y-4 border-t border-[var(--ve-line-soft)] px-4 py-4">
                          {planData.result.options.map((option, optionIndex) => (
                            <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4" key={`${planRow.id}-${option.title}`}>
                              <p className="text-sm font-black">{optionIndex + 1}. {option.title}</p>
                              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">{option.description}</p>
                              <p className="mt-2 text-xs font-semibold text-[var(--ve-muted)]">
                                {option.level} · {option.tone}
                              </p>
                            </div>
                          ))}
                        </div>
                      </details>
                    );
                  })
                )}
              </div>
            </details>
          </div>
        )}
      </section>

      <section className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">Planner results</p>
            <h2 className="mt-2 text-lg font-black">Expansion plans and next lesson ideas</h2>
          </div>
          {selectedCourse ? (
            <Link
              className="rounded-[12px] border border-[var(--ve-line-soft)] px-4 py-3 text-sm font-black text-[var(--ve-green)]"
              href={`/admin/courses/${selectedCourse.id}`}
            >
              Open {selectedCourse.title}
            </Link>
          ) : null}
        </div>

        {orderedExpansionPlans.length === 0 ? (
          <AdminCard>
            <p className="text-sm font-semibold text-[var(--ve-muted)]">
              {selectedCourse ? "No expansion plans for this course yet." : "No AI expansion plans yet."}
            </p>
          </AdminCard>
        ) : (
          <div className="space-y-4">
            <details className={disclosureClasses()} open={activeExpansionPlans.length > 0}>
              <summary className={disclosureSummaryClasses()}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">Active expansion results</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                      Suggestion sets that are still available for lesson drafting.
                    </p>
                  </div>
                  <AdminStatusBadge tone="warning">{activeExpansionPlans.length}</AdminStatusBadge>
                </div>
              </summary>

              <div className="space-y-4 border-t border-[var(--ve-line-soft)] px-4 py-4">
                {activeExpansionPlans.length === 0 ? (
                  <p className="text-sm font-semibold text-[var(--ve-muted)]">
                    {selectedCourse ? "No active expansion plans for this course right now." : "No active expansion plans right now."}
                  </p>
                ) : (
                  activeExpansionPlans.map((planRow) => {
                    const planData = parseStoredCourseExpansionPlan(planRow.generated_plan);
                    if (!planData) {
                      return (
                        <div className="rounded-[16px] border border-[color:color-mix(in_srgb,var(--ve-danger)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] p-4" key={planRow.id}>
                          <p className="text-sm font-semibold text-[var(--ve-danger)]">This saved expansion plan could not be read.</p>
                        </div>
                      );
                    }

                    return (
                      <details className={disclosureClasses()} key={planRow.id} open={shouldOpenPlan(planRow.status, planRow.id, plan)}>
                        <summary className={disclosureSummaryClasses()}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                                {planData.input.courseTitle}
                              </p>
                              <h3 className="mt-2 text-base font-black">{planData.input.expansionGoal}</h3>
                              <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                                Generated {formatPlanTime(planRow.created_at)}
                              </p>
                            </div>
                            <AdminStatusBadge tone={planTone(planRow.status)}>{planRow.status}</AdminStatusBadge>
                          </div>
                        </summary>

                        <div className="space-y-5 border-t border-[var(--ve-line-soft)] px-4 py-4">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <form action={dismissCoursePlan}>
                              <input name="planId" type="hidden" value={planRow.id} />
                              <input name="redirectTo" type="hidden" value={buildPlannerRedirect(planData.input.courseId)} />
                              <PendingSubmitButton
                                className="rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] px-3 py-2 text-xs font-black text-[var(--ve-danger)] disabled:cursor-not-allowed disabled:opacity-70"
                                label="Dismiss"
                                pendingLabel="Dismissing..."
                                type="submit"
                              />
                            </form>
                          </div>

                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4">
                              <p className={labelClasses()}>Current coverage</p>
                              <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                                {planData.result.courseAnalysis.currentCoverage.map((item) => (
                                  <li key={item}>• {item}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4">
                              <p className={labelClasses()}>Gaps</p>
                              <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                                {planData.result.courseAnalysis.gaps.map((item) => (
                                  <li key={item}>• {item}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4">
                              <p className={labelClasses()}>Recommended direction</p>
                              <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                                {planData.result.courseAnalysis.recommendedDirection}
                              </p>
                            </div>
                          </div>

                          <div className="grid gap-4 xl:grid-cols-2">
                            {planData.result.lessonSuggestions.map((suggestion, suggestionIndex) => (
                              <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4" key={`${planRow.id}-${suggestion.title}`}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-black">{suggestion.title}</p>
                                    <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                                      {suggestion.difficulty} · {suggestion.estimatedMinutes} min
                                    </p>
                                  </div>
                                  <AdminStatusBadge tone="warning">{suggestion.placement}</AdminStatusBadge>
                                </div>
                                <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                                  <span className="font-black text-[var(--foreground)]">Why:</span> {suggestion.reason}
                                </p>
                                <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                                  <span className="font-black text-[var(--foreground)]">Learning objective:</span> {suggestion.learningObjective}
                                </p>

                                <div className="mt-3">
                                  <p className={labelClasses()}>Suggested pages</p>
                                  <div className="mt-2 space-y-2">
                                    {suggestion.suggestedPages.map((page) => (
                                      <div className="rounded-[14px] bg-[var(--ve-panel)] p-3" key={`${suggestion.title}-${page.title}`}>
                                        <p className="text-sm font-black">{page.title}</p>
                                        <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                                          {page.pageType} · {page.purpose}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                                  <span className="font-black text-[var(--foreground)]">Quiz approach:</span> {suggestion.quizApproach}
                                </p>

                                <div className="mt-3">
                                  <p className={labelClasses()}>Media suggestions</p>
                                  <div className="mt-2 space-y-2">
                                    {suggestion.mediaSuggestions.length === 0 ? (
                                      <p className="text-sm font-semibold text-[var(--ve-muted)]">No media suggestions.</p>
                                    ) : (
                                      suggestion.mediaSuggestions.map((media) => (
                                        <div className="rounded-[14px] bg-[var(--ve-panel)] p-3" key={`${suggestion.title}-${media.placement}-${media.assetType}`}>
                                          <p className="text-sm font-black">{media.assetType} · {media.placement}</p>
                                          <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{media.prompt}</p>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>

                                <form action={generateLessonFromExpansionSuggestion} className="mt-4">
                                  <input name="planId" type="hidden" value={planRow.id} />
                                  <input name="suggestionIndex" type="hidden" value={suggestionIndex} />
                                  <PendingSubmitButton
                                    className="rounded-[12px] bg-[var(--ve-sky)] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-70"
                                    label="Generate Lesson Draft"
                                    pendingLabel="Generating Lesson Draft..."
                                    type="submit"
                                  />
                                </form>
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>
                    );
                  })
                )}
              </div>
            </details>

            <details className={disclosureClasses()} open={historicalExpansionPlans.some((planRow) => planRow.id === plan)}>
              <summary className={disclosureSummaryClasses()}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">History</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                      Used and dismissed expansion runs from earlier planning work.
                    </p>
                  </div>
                  <AdminStatusBadge tone="neutral">{historicalExpansionPlans.length}</AdminStatusBadge>
                </div>
              </summary>

              <div className="space-y-4 border-t border-[var(--ve-line-soft)] px-4 py-4">
                {historicalExpansionPlans.length === 0 ? (
                  <p className="text-sm font-semibold text-[var(--ve-muted)]">No expansion history yet.</p>
                ) : (
                  historicalExpansionPlans.map((planRow) => {
                    const planData = parseStoredCourseExpansionPlan(planRow.generated_plan);
                    if (!planData) {
                      return (
                        <div className="rounded-[16px] border border-[color:color-mix(in_srgb,var(--ve-danger)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] p-4" key={planRow.id}>
                          <p className="text-sm font-semibold text-[var(--ve-danger)]">This saved expansion plan could not be read.</p>
                        </div>
                      );
                    }

                    return (
                      <details className={disclosureClasses()} key={planRow.id} open={planRow.id === plan}>
                        <summary className={disclosureSummaryClasses()}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                                {planData.input.courseTitle}
                              </p>
                              <h3 className="mt-2 text-base font-black">{planData.input.expansionGoal}</h3>
                              <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                                Generated {formatPlanTime(planRow.created_at)}
                              </p>
                            </div>
                            <AdminStatusBadge tone={planTone(planRow.status)}>{planRow.status}</AdminStatusBadge>
                          </div>
                        </summary>

                        <div className="space-y-4 border-t border-[var(--ve-line-soft)] px-4 py-4">
                          <p className="text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                            <span className="font-black text-[var(--foreground)]">Recommended direction:</span> {planData.result.courseAnalysis.recommendedDirection}
                          </p>
                          {planData.result.lessonSuggestions.map((suggestion, suggestionIndex) => (
                            <div className="rounded-[16px] border border-[var(--ve-line-soft)] p-4" key={`${planRow.id}-${suggestion.title}`}>
                              <p className="text-sm font-black">{suggestionIndex + 1}. {suggestion.title}</p>
                              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">{suggestion.reason}</p>
                              <p className="mt-2 text-xs font-semibold text-[var(--ve-muted)]">
                                {suggestion.placement} · {suggestion.difficulty} · {suggestion.estimatedMinutes} min
                              </p>
                            </div>
                          ))}
                        </div>
                      </details>
                    );
                  })
                )}
              </div>
            </details>
          </div>
        )}
      </section>
    </>
  );
}
