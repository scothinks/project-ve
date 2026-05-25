"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AdminCourseRow, AdminLessonRow, AdminRewardCandidateRow } from "@/lib/admin";

export type MissionActionState = {
  ok: boolean;
  message: string;
};

type MissionEditorValue = {
  id: string;
  title: string;
  description: string;
  category: "course" | "referral" | "feedback" | "campaign" | "custom";
  rewardType: "xp" | "reward";
  rewardXp: number | null;
  rewardId: string;
  repeatability: "once" | "daily" | "weekly" | "campaign" | "per_referral";
  validationType:
    | "course_completed"
    | "lesson_completed"
    | "lesson_count_completed"
    | "referral_friend_completed_lessons"
    | "proof_upload"
    | "manual_review";
  validationConfig: Record<string, unknown>;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  status: string;
};

type MissionEditorFormProps = {
  action: (previousState: MissionActionState, formData: FormData) => Promise<MissionActionState>;
  mode: "create" | "edit";
  mission: MissionEditorValue;
  courses: AdminCourseRow[];
  lessons: AdminLessonRow[];
  rewardCandidates: AdminRewardCandidateRow[];
};

function fieldClasses() {
  return "mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--ve-mission)]";
}

function labelClasses() {
  return "text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]";
}

function sectionSummaryClasses() {
  return "cursor-pointer list-none text-sm font-black text-[var(--foreground)]";
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="rounded-[14px] bg-[var(--ve-mission)] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function MissionEditorForm({
  action,
  mode,
  mission,
  courses,
  lessons,
  rewardCandidates,
}: MissionEditorFormProps) {
  const [state, formAction] = useActionState(action, { ok: false, message: "" });
  const [category, setCategory] = useState(mission.category);
  const [rewardType, setRewardType] = useState(mission.rewardType);
  const [repeatability, setRepeatability] = useState(mission.repeatability);
  const [validationType, setValidationType] = useState(mission.validationType);
  const [requiredFields, setRequiredFields] = useState<string[]>(
    asStringArray(mission.validationConfig.requiredFields).length > 0
      ? asStringArray(mission.validationConfig.requiredFields)
      : ["text"],
  );

  const selectedCourseId = asString(mission.validationConfig.courseId);
  const selectedLessonId = asString(mission.validationConfig.lessonId);
  const lessonCount = Math.max(1, asNumber(mission.validationConfig.count, 2));
  const withinDays = asNumber(mission.validationConfig.withinDays, 7) || "";
  const requiredFriendLessonCount = Math.max(
    1,
    asNumber(mission.validationConfig.requiredFriendLessonCount, 2),
  );
  const minimumAccountAgeHours = Math.max(
    0,
    asNumber(mission.validationConfig.minimumAccountAgeHours, 24),
  );
  const requiresManualReview = Boolean(mission.validationConfig.requiresManualReview);
  const proofRequirementMode = asString(mission.validationConfig.requirementMode, "all");
  const instructions = asString(mission.validationConfig.instructions);

  const lessonOptions = useMemo(() => {
    const courseTitles = new Map(courses.map((course) => [course.id, course.title]));
    return lessons.map((lesson) => ({
      id: lesson.id,
      label: `${lesson.title} · ${courseTitles.get(lesson.course_id) ?? "Unknown course"}`,
      status: lesson.status,
    }));
  }, [courses, lessons]);

  const rewardOptions = useMemo(
    () =>
      rewardCandidates.map((reward) => ({
        id: reward.id,
        label: `${reward.title} · ${reward.fulfillment_type.replaceAll("_", " ")}`,
        status:
          reward.is_enabled
            ? reward.status
            : "disabled",
      })),
    [rewardCandidates],
  );

  function toggleRequiredField(field: string) {
    setRequiredFields((current) =>
      current.includes(field) ? current.filter((item) => item !== field) : [...current, field],
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {mode === "edit" ? <input name="missionId" type="hidden" value={mission.id} /> : null}
      <input name="status" type="hidden" value={mode === "create" ? "draft" : mission.status} />

      <details
        className="rounded-[16px] border border-[color:color-mix(in_srgb,var(--ve-mission)_24%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-mission-soft)_84%,var(--ve-card))] p-4"
        open
      >
        <summary className={sectionSummaryClasses()}>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-mission)]">Mission setup</p>
          <h2 className="mt-2 text-lg font-black">What learners do</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
            Define the task, choose whether the mission awards XP or a reward, and set the validation rule.
          </p>
        </summary>
        <div className="mt-4 space-y-5 border-t border-[color:color-mix(in_srgb,var(--ve-mission)_18%,var(--ve-line-soft))] pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className={labelClasses()}>Mission title</span>
              <input className={fieldClasses()} defaultValue={mission.title} maxLength={140} name="title" required />
            </label>
            <label>
              <span className={labelClasses()}>Reward type</span>
              <select
                className={fieldClasses()}
                name="rewardType"
                onChange={(event) => setRewardType(event.target.value as typeof mission.rewardType)}
                value={rewardType}
              >
                <option value="xp">XP</option>
                <option value="reward">Reward</option>
              </select>
            </label>
          </div>
          {rewardType === "xp" ? (
            <label className="block max-w-sm">
              <span className={labelClasses()}>Reward XP</span>
              <input
                className={fieldClasses()}
                defaultValue={mission.rewardXp ?? 25}
                min={1}
                name="rewardXp"
                required
                type="number"
              />
            </label>
          ) : (
            <label className="block">
              <span className={labelClasses()}>Reward</span>
              <select className={fieldClasses()} defaultValue={mission.rewardId} name="rewardId" required>
                <option value="">Select reward</option>
                {rewardOptions.map((reward) => (
                  <option key={reward.id} value={reward.id}>
                    {reward.label} {reward.status !== "published" ? `(${reward.status})` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs font-semibold text-[var(--ve-muted)]">
                Native rewards such as XP boosts are configured in Rewards and can be granted here.
              </p>
            </label>
          )}
          <label className="block">
            <span className={labelClasses()}>Description</span>
            <textarea
              className={`${fieldClasses()} min-h-24 resize-none`}
              defaultValue={mission.description}
              maxLength={500}
              name="description"
              required
            />
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <label>
              <span className={labelClasses()}>Category</span>
              <select className={fieldClasses()} name="category" onChange={(event) => setCategory(event.target.value as typeof mission.category)} value={category}>
                <option value="course">Course</option>
                <option value="referral">Referral</option>
                <option value="feedback">Feedback</option>
                <option value="campaign">Campaign</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label>
              <span className={labelClasses()}>Repeatability</span>
              <select className={fieldClasses()} name="repeatability" onChange={(event) => setRepeatability(event.target.value as typeof mission.repeatability)} value={repeatability}>
                <option value="once">Once</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="campaign">Campaign</option>
                <option value="per_referral">Per referral</option>
              </select>
            </label>
            <label>
              <span className={labelClasses()}>Sort order</span>
              <input className={fieldClasses()} defaultValue={mission.sortOrder} name="sortOrder" type="number" />
            </label>
          </div>
        </div>
      </details>

      <details className="rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4" open>
        <summary className={sectionSummaryClasses()}>
          <h2 className="text-sm font-black">Availability</h2>
        </summary>
        <div className="mt-4 grid gap-4 border-t border-[var(--ve-line-soft)] pt-4 md:grid-cols-2">
          <label>
            <span className={labelClasses()}>Starts</span>
            <input className={fieldClasses()} defaultValue={mission.startsAt} name="startsAt" type="datetime-local" />
          </label>
          <label>
            <span className={labelClasses()}>Ends</span>
            <input className={fieldClasses()} defaultValue={mission.endsAt} name="endsAt" type="datetime-local" />
          </label>
        </div>
      </details>

      <details className="rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4" open>
        <summary className={sectionSummaryClasses()}>
          <h2 className="text-sm font-black">Validation rule</h2>
        </summary>
        <div className="mt-4 space-y-4 border-t border-[var(--ve-line-soft)] pt-4">
          <label className="block">
            <span className={labelClasses()}>Validation type</span>
            <select
              className={fieldClasses()}
              name="validationType"
              onChange={(event) => setValidationType(event.target.value as typeof mission.validationType)}
              value={validationType}
            >
              <option value="lesson_completed">Lesson completed</option>
              <option value="course_completed">Course completed</option>
              <option value="lesson_count_completed">Lesson count completed</option>
              <option value="referral_friend_completed_lessons">Referral friend completed lessons</option>
              <option value="proof_upload">Proof upload</option>
              <option value="manual_review">Manual review</option>
            </select>
          </label>

          {validationType === "lesson_completed" ? (
            <label className="block">
              <span className={labelClasses()}>Lesson</span>
              <select className={fieldClasses()} defaultValue={selectedLessonId} name="lessonId" required>
                <option value="">Select lesson</option>
                {lessonOptions.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.label} {lesson.status !== "published" ? `(${lesson.status})` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {validationType === "course_completed" ? (
            <label className="block">
              <span className={labelClasses()}>Course</span>
              <select className={fieldClasses()} defaultValue={selectedCourseId} name="courseId" required>
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title} {course.status !== "published" ? `(${course.status})` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {validationType === "lesson_count_completed" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className={labelClasses()}>Lesson count</span>
                <input className={fieldClasses()} defaultValue={lessonCount} min={1} name="count" required type="number" />
              </label>
              <label>
                <span className={labelClasses()}>Within days</span>
                <input className={fieldClasses()} defaultValue={withinDays} min={1} name="withinDays" type="number" />
              </label>
            </div>
          ) : null}

          {validationType === "referral_friend_completed_lessons" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className={labelClasses()}>Required friend lesson count</span>
                <input
                  className={fieldClasses()}
                  defaultValue={requiredFriendLessonCount}
                  min={1}
                  name="requiredFriendLessonCount"
                  required
                  type="number"
                />
              </label>
              <label>
                <span className={labelClasses()}>Minimum account age hours</span>
                <input
                  className={fieldClasses()}
                  defaultValue={minimumAccountAgeHours}
                  min={0}
                  name="minimumAccountAgeHours"
                  required
                  type="number"
                />
              </label>
            </div>
          ) : null}

          {validationType === "proof_upload" ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className={labelClasses()}>Proof rule</span>
                  <select
                    className={fieldClasses()}
                    defaultValue={proofRequirementMode}
                    name="proofRequirementMode"
                  >
                    <option value="all">All selected proof fields are required</option>
                    <option value="any">Any one selected proof field is enough</option>
                  </select>
                </label>
              </div>
              <div>
                <span className={labelClasses()}>Required proof fields</span>
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                  {["image", "video", "text", "link", "location"].map((field) => (
                    <label
                      className="flex items-center gap-3 rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] px-3 py-3 text-sm font-black"
                      key={field}
                    >
                      <input
                        checked={requiredFields.includes(field)}
                        name="requiredFields"
                        onChange={() => toggleRequiredField(field)}
                        type="checkbox"
                        value={field}
                      />
                      <span className="capitalize">{field}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-3 rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] px-3 py-3 text-sm font-black">
                <input defaultChecked={requiresManualReview} name="requiresManualReview" type="checkbox" />
                <span>Requires manual review before awarding the mission reward</span>
              </label>
            </div>
          ) : null}

          {validationType === "manual_review" ? (
            <div className="space-y-3">
              <div className="rounded-[12px] border border-[color:color-mix(in_srgb,var(--ve-store)_24%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-store-soft)_82%,var(--ve-card))] px-4 py-3 text-sm font-bold text-[color:color-mix(in_srgb,var(--ve-store)_62%,var(--foreground))]">
                Manual review missions use the existing enum and table values, but there is no learner-facing submission path yet. Keep this in draft unless you are running an operational workflow around it.
              </div>
              <label className="block">
                <span className={labelClasses()}>Reviewer instructions</span>
                <textarea
                  className={`${fieldClasses()} min-h-24 resize-none`}
                  defaultValue={instructions}
                  maxLength={800}
                  name="instructions"
                  required
                />
              </label>
            </div>
          ) : null}
        </div>
      </details>

      <div className="rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Publishing</p>
        <p className="mt-2 text-sm font-black text-[var(--foreground)]">Managed from Missions overview</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
          Save mission details here, then publish, pause, or move back to draft from the missions table.
        </p>
      </div>

      {state.message ? (
        <div
          className={`rounded-[14px] border px-4 py-3 text-sm font-black ${
            state.ok
              ? "border-[color:color-mix(in_srgb,var(--ve-green)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_78%,var(--ve-card))] text-[var(--ve-green)]"
              : "border-[color:color-mix(in_srgb,var(--ve-danger)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] text-[var(--ve-danger)]"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <SubmitButton label={mode === "create" ? "Create mission" : "Save mission"} />
      </div>
    </form>
  );
}
