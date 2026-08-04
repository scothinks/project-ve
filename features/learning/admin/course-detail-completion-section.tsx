import {
  AdminCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import type { AdminCourseDetailPageData } from "./course-detail-data";

type CourseCompletionAction = (formData: FormData) => void | Promise<void>;

type CourseDetailCompletionSectionProps = {
  action: CourseCompletionAction;
  assessments: AdminCourseDetailPageData["completionAssessmentOptions"];
  course: AdminCourseDetailPageData["course"];
  lessons: AdminCourseDetailPageData["lessons"];
  missions: AdminCourseDetailPageData["completionMissionOptions"];
  quizzes: AdminCourseDetailPageData["quizRows"];
  rules: AdminCourseDetailPageData["courseCompletionRules"];
};

function fieldClasses() {
  return "mt-2 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 py-3 text-sm font-bold text-[var(--foreground)] outline-none transition focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)]";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

function helperTextClasses() {
  return "mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]";
}

function asStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : fallback;
}

function numericRuleValue(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

export function CourseDetailCompletionSection({
  action,
  assessments,
  course,
  lessons,
  missions,
  quizzes,
  rules,
}: CourseDetailCompletionSectionProps) {
  const publishedLessons = lessons.filter((lesson) => lesson.status === "published");
  const publishedQuizzes = quizzes.filter((quiz) => quiz.status === "published");
  const requiredLessonIds = new Set(asStringArray(
    rules?.required_lesson_ids,
    publishedLessons.map((lesson) => lesson.id),
  ));
  const requiredQuizIds = new Set(asStringArray(
    rules?.required_quiz_ids,
    publishedQuizzes.map((quiz) => quiz.id),
  ));
  const requiredMissionIds = new Set(asStringArray(rules?.required_mission_ids, []));
  const minimumQuizScore = numericRuleValue(rules?.minimum_quiz_score, 0);
  const minimumCompletionThreshold = numericRuleValue(rules?.minimum_completion_threshold, 100);
  const requiredFinalAssessmentVersionId = typeof rules?.required_final_assessment_version_id === "string"
    ? rules.required_final_assessment_version_id
    : "";

  return (
    <AdminCard className="p-0">
      <details>
        <summary className="cursor-pointer list-none px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                Completion
              </p>
              <h2 className="mt-2 text-lg font-black">Course transcript rules</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                Selected lessons, quizzes and missions contribute to completion progress. A selected final assessment remains mandatory.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminStatusBadge tone={rules ? "good" : "warning"}>
                {rules ? "configured" : "default rules"}
              </AdminStatusBadge>
              <AdminStatusBadge tone="neutral">
                {requiredLessonIds.size + requiredQuizIds.size + requiredMissionIds.size} requirements
              </AdminStatusBadge>
            </div>
          </div>
        </summary>

        <form action={action} className="border-t border-[var(--ve-line-soft)] px-5 pb-5">
          <input name="courseId" type="hidden" value={course.id} />
          <input name="redirectTo" type="hidden" value={`/admin/courses/${course.id}?tab=overview`} />

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label>
              <span className={labelClasses()}>Minimum quiz score</span>
              <input
                className={fieldClasses()}
                defaultValue={minimumQuizScore}
                max={100}
                min={0}
                name="minimumQuizScore"
                type="number"
              />
            </label>
            <label>
              <span className={labelClasses()}>Completion threshold</span>
              <input
                className={fieldClasses()}
                defaultValue={minimumCompletionThreshold}
                max={100}
                min={0}
                name="minimumCompletionThreshold"
                type="number"
              />
              <span className={helperTextClasses()}>
                Use 100 for all selected work. Lower values allow completion once the learner reaches that percentage and completes any final assessment.
              </span>
            </label>
          </div>

          <label className="mt-4 block">
            <span className={labelClasses()}>Final assessment</span>
            <select
              className={fieldClasses()}
              defaultValue={requiredFinalAssessmentVersionId}
              name="requiredFinalAssessmentVersionId"
            >
              <option value="">No final assessment required</option>
              {assessments.map((assessment) => (
                <option key={assessment.id} value={assessment.id}>
                  {assessment.title}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            <div>
              <p className={labelClasses()}>Completion lessons</p>
              <div className="mt-3 space-y-2">
                {lessons.map((lesson) => (
                  <label
                    className="flex items-start gap-3 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3 text-sm font-bold"
                    key={lesson.id}
                  >
                    <input
                      className="mt-1 size-4"
                      defaultChecked={requiredLessonIds.has(lesson.id)}
                      name="requiredLessonIds"
                      type="checkbox"
                      value={lesson.id}
                    />
                    <span>
                      {lesson.title}
                      <span className={helperTextClasses()}>{lesson.status}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className={labelClasses()}>Completion quizzes</p>
              <div className="mt-3 space-y-2">
                {quizzes.length > 0 ? quizzes.map((quiz) => {
                  const lesson = lessons.find((item) => item.id === quiz.lesson_id);

                  return (
                    <label
                      className="flex items-start gap-3 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3 text-sm font-bold"
                      key={quiz.id}
                    >
                      <input
                        className="mt-1 size-4"
                        defaultChecked={requiredQuizIds.has(quiz.id)}
                        name="requiredQuizIds"
                        type="checkbox"
                        value={quiz.id}
                      />
                      <span>
                        {quiz.title}
                        <span className={helperTextClasses()}>
                          {lesson?.title ?? quiz.lesson_id} · {quiz.status}
                        </span>
                      </span>
                    </label>
                  );
                }) : (
                  <p className="rounded-[14px] bg-[var(--ve-panel)] p-3 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
                    No quizzes are attached to this course yet.
                  </p>
                )}
              </div>
            </div>

            <div>
              <p className={labelClasses()}>Completion missions</p>
              <div className="mt-3 space-y-2">
                {missions.map((mission) => (
                  <label
                    className="flex items-start gap-3 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3 text-sm font-bold"
                    key={mission.id}
                  >
                    <input
                      className="mt-1 size-4"
                      defaultChecked={requiredMissionIds.has(mission.id)}
                      name="requiredMissionIds"
                      type="checkbox"
                      value={mission.id}
                    />
                    <span>
                      {mission.title}
                      <span className={helperTextClasses()}>
                        {mission.category} · {mission.validation_type.replaceAll("_", " ")}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <PendingSubmitButton
            className="mt-5 rounded-[12px] bg-[var(--ve-green)] px-4 py-2 text-sm font-black text-white"
            label="Save Completion Rules"
            name="actionIntent"
            pendingLabel="Saving..."
            pendingValue="save"
            type="submit"
            value="save"
          />
        </form>
      </details>
    </AdminCard>
  );
}
