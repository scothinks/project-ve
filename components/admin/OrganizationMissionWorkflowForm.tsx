"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type {
  AdminCourseRow,
  AdminLessonRow,
  AdminMissionRow,
  AdminMissionTypeRow,
} from "@/lib/admin";
import { AdminCard, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import {
  adaptPlatformMission,
  createOrganizationMission,
} from "@/app/admin/missions/actions";
import type { MissionActionState } from "@/components/admin/MissionEditorForm";

type ValidationType =
  | "course_completed"
  | "lesson_completed"
  | "lesson_count_completed"
  | "referral_friend_completed_lessons"
  | "proof_upload"
  | "manual_review";

const missionTypeToValidation: Record<string, ValidationType> = {
  course_completed: "course_completed",
  lesson_completed: "lesson_completed",
  lesson_count_completed: "lesson_count_completed",
  manual_approval: "manual_review",
  proof_submission: "proof_upload",
  referral: "referral_friend_completed_lessons",
};

const missionTypeToCategory: Record<string, string> = {
  course_completed: "course",
  lesson_completed: "course",
  lesson_count_completed: "campaign",
  manual_approval: "custom",
  proof_submission: "feedback",
  referral: "referral",
};

const defaultState: MissionActionState = { ok: false, message: "" };

function fieldClasses() {
  return "mt-2 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 py-3 text-sm font-bold text-[var(--foreground)] outline-none transition focus:border-[var(--ve-mission)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-mission)_10%,transparent)]";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

function helperClasses() {
  return "mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]";
}

function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="rounded-[14px] bg-[var(--ve-mission)] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving..." : children}
    </button>
  );
}

function ActionNotice({ state }: { state: MissionActionState }) {
  if (!state.message) return null;

  return (
    <div
      className={
        state.ok
          ? "rounded-[14px] border border-[color:color-mix(in_srgb,var(--ve-green)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_78%,var(--ve-card))] px-4 py-3 text-sm font-black text-[var(--ve-green)]"
          : "rounded-[14px] border border-[color:color-mix(in_srgb,var(--ve-danger)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] px-4 py-3 text-sm font-black text-[var(--ve-danger)]"
      }
    >
      {state.message}
    </div>
  );
}

function PresentationFields({ prefix }: { prefix: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label>
        <span className={labelClasses()}>Display title</span>
        <input className={fieldClasses()} maxLength={140} name="presentationTitle" placeholder={`${prefix} display title`} />
      </label>
      <label>
        <span className={labelClasses()}>CTA label</span>
        <input className={fieldClasses()} maxLength={80} name="ctaLabel" placeholder="Start mission" />
      </label>
      <label className="md:col-span-2">
        <span className={labelClasses()}>Short description</span>
        <textarea className={`${fieldClasses()} min-h-20 resize-none`} maxLength={240} name="shortDescription" />
      </label>
      <label className="md:col-span-2">
        <span className={labelClasses()}>Full instructions</span>
        <textarea className={`${fieldClasses()} min-h-28 resize-none`} maxLength={1500} name="fullInstructions" />
      </label>
      <label>
        <span className={labelClasses()}>Eligibility explanation</span>
        <textarea className={`${fieldClasses()} min-h-20 resize-none`} maxLength={500} name="eligibilityExplanation" />
      </label>
      <label>
        <span className={labelClasses()}>Reward explanation</span>
        <textarea className={`${fieldClasses()} min-h-20 resize-none`} maxLength={500} name="rewardExplanation" />
      </label>
      <label>
        <span className={labelClasses()}>Pending message</span>
        <textarea className={`${fieldClasses()} min-h-20 resize-none`} maxLength={400} name="pendingMessage" />
      </label>
      <label>
        <span className={labelClasses()}>Success message</span>
        <textarea className={`${fieldClasses()} min-h-20 resize-none`} maxLength={400} name="successMessage" />
      </label>
      <label>
        <span className={labelClasses()}>Rejection message</span>
        <textarea className={`${fieldClasses()} min-h-20 resize-none`} maxLength={400} name="rejectionMessage" />
      </label>
      <label>
        <span className={labelClasses()}>Icon or image</span>
        <input className={fieldClasses()} maxLength={400} name="iconOrImage" placeholder="Icon name or image URL" />
      </label>
      <label className="md:col-span-2">
        <span className={labelClasses()}>Terms</span>
        <textarea className={`${fieldClasses()} min-h-20 resize-none`} maxLength={1500} name="terms" />
      </label>
    </div>
  );
}

function ValidationFields({
  courses,
  lessons,
  validationType,
}: {
  courses: AdminCourseRow[];
  lessons: AdminLessonRow[];
  validationType: ValidationType;
}) {
  const lessonOptions = useMemo(() => {
    const courseTitles = new Map(courses.map((course) => [course.id, course.title]));
    return lessons.map((lesson) => ({
      id: lesson.id,
      label: `${lesson.title} · ${courseTitles.get(lesson.course_id) ?? "Unknown course"}`,
      status: lesson.status,
    }));
  }, [courses, lessons]);

  if (validationType === "course_completed") {
    return (
      <label className="block">
        <span className={labelClasses()}>Course</span>
        <select className={fieldClasses()} name="courseId" required>
          <option value="">Select course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title} {course.status !== "published" ? `(${course.status})` : ""}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (validationType === "lesson_completed") {
    return (
      <label className="block">
        <span className={labelClasses()}>Lesson</span>
        <select className={fieldClasses()} name="lessonId" required>
          <option value="">Select lesson</option>
          {lessonOptions.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.label} {lesson.status !== "published" ? `(${lesson.status})` : ""}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (validationType === "lesson_count_completed") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <label>
          <span className={labelClasses()}>Lesson count</span>
          <input className={fieldClasses()} defaultValue={2} min={1} name="count" required type="number" />
        </label>
        <label>
          <span className={labelClasses()}>Within days</span>
          <input className={fieldClasses()} min={1} name="withinDays" type="number" />
        </label>
      </div>
    );
  }

  if (validationType === "referral_friend_completed_lessons") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <label>
          <span className={labelClasses()}>Required friend lesson count</span>
          <input className={fieldClasses()} defaultValue={1} min={1} name="requiredFriendLessonCount" required type="number" />
        </label>
        <label>
          <span className={labelClasses()}>Minimum account age hours</span>
          <input className={fieldClasses()} defaultValue={24} min={0} name="minimumAccountAgeHours" required type="number" />
        </label>
      </div>
    );
  }

  if (validationType === "proof_upload") {
    return (
      <div className="space-y-4">
        <label className="block max-w-md">
          <span className={labelClasses()}>Proof rule</span>
          <select className={fieldClasses()} name="proofRequirementMode" defaultValue="all">
            <option value="all">All selected proof fields are required</option>
            <option value="any">Any one selected proof field is enough</option>
          </select>
        </label>
        <div>
          <span className={labelClasses()}>Required proof fields</span>
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            {["image", "video", "text", "link", "location"].map((field) => (
              <label
                className="flex items-center gap-3 rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] px-3 py-3 text-sm font-black"
                key={field}
              >
                <input defaultChecked={field === "text"} name="requiredFields" type="checkbox" value={field} />
                <span className="capitalize">{field}</span>
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-3 rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] px-3 py-3 text-sm font-black">
          <input name="requiresManualReview" type="checkbox" />
          <span>Requires manual review before awarding points</span>
        </label>
      </div>
    );
  }

  return (
    <label className="block">
      <span className={labelClasses()}>Reviewer instructions</span>
      <textarea className={`${fieldClasses()} min-h-24 resize-none`} maxLength={800} name="instructions" required />
    </label>
  );
}

export function OrganizationMissionWorkflowForm({
  allowedMissionTypes,
  courses,
  initialSourceMissionId = "",
  lessons,
  missionTypes,
  platformMissions,
}: {
  allowedMissionTypes: string[];
  courses: AdminCourseRow[];
  initialSourceMissionId?: string;
  lessons: AdminLessonRow[];
  missionTypes: AdminMissionTypeRow[];
  platformMissions: AdminMissionRow[];
}) {
  const availableMissionTypes = missionTypes.filter((missionType) =>
    allowedMissionTypes.includes(missionType.key),
  );
  const [selectedMissionType, setSelectedMissionType] = useState(
    availableMissionTypes[0]?.key ?? "course_completed",
  );
  const selectedType = availableMissionTypes.find((missionType) => missionType.key === selectedMissionType);
  const validationType = missionTypeToValidation[selectedMissionType] ?? "course_completed";
  const [createState, createAction] = useActionState(createOrganizationMission, defaultState);
  const [adaptState, adaptAction] = useActionState(adaptPlatformMission, defaultState);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
      <AdminCard>
        <form action={createAction} className="space-y-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-mission)]">
              Organisation-private mission
            </p>
            <h2 className="mt-2 text-xl font-black">Create from an entitled mission type</h2>
            <p className={helperClasses()}>
              This creates a reusable organisation mission. Execution still uses the registered Project Ve mission handler.
            </p>
          </div>

          {availableMissionTypes.length === 0 ? (
            <div className="rounded-[14px] border border-[color:color-mix(in_srgb,var(--ve-danger)_22%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] px-4 py-3 text-sm font-black text-[var(--ve-danger)]">
              This organisation does not have any mission type entitlements.
            </div>
          ) : (
            <>
              <input name="validationType" type="hidden" value={validationType} />
              <input name="category" type="hidden" value={missionTypeToCategory[selectedMissionType] ?? "custom"} />
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className={labelClasses()}>Mission type</span>
                  <select
                    className={fieldClasses()}
                    name="missionTypeKey"
                    onChange={(event) => setSelectedMissionType(event.target.value)}
                    value={selectedMissionType}
                  >
                    {availableMissionTypes.map((missionType) => (
                      <option key={missionType.key} value={missionType.key}>
                        {missionType.name}
                      </option>
                    ))}
                  </select>
                  <span className={helperClasses()}>
                    Handler v{selectedType?.handler_version ?? 1} · {(selectedType?.supported_reward_modes ?? []).join(", ")}
                  </span>
                </label>
                <label>
                  <span className={labelClasses()}>Repeatability</span>
                  <select
                    className={fieldClasses()}
                    defaultValue={selectedType?.supported_repeatability[0] ?? "once"}
                    key={selectedMissionType}
                    name="repeatability"
                  >
                    {(selectedType?.supported_repeatability ?? ["once"]).map((repeatability) => (
                      <option key={repeatability} value={repeatability}>
                        {repeatability.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_10rem]">
                <label>
                  <span className={labelClasses()}>Mission title</span>
                  <input className={fieldClasses()} maxLength={140} name="title" required />
                </label>
                <label>
                  <span className={labelClasses()}>Points</span>
                  <input className={fieldClasses()} defaultValue={25} min={1} name="rewardXp" required type="number" />
                </label>
              </div>
              <label className="block">
                <span className={labelClasses()}>Mission description</span>
                <textarea className={`${fieldClasses()} min-h-24 resize-none`} maxLength={500} name="description" required />
              </label>
              <div className="grid gap-4 md:grid-cols-3">
                <label>
                  <span className={labelClasses()}>Starts</span>
                  <input className={fieldClasses()} name="startsAt" type="datetime-local" />
                </label>
                <label>
                  <span className={labelClasses()}>Ends</span>
                  <input className={fieldClasses()} name="endsAt" type="datetime-local" />
                </label>
                <label>
                  <span className={labelClasses()}>Sort order</span>
                  <input className={fieldClasses()} defaultValue={0} name="sortOrder" type="number" />
                </label>
              </div>
              <ValidationFields courses={courses} lessons={lessons} validationType={validationType} />
              <PresentationFields prefix="Organisation mission" />
              <ActionNotice state={createState} />
              <SubmitButton>Create organisation mission</SubmitButton>
            </>
          )}
        </form>
      </AdminCard>

      <AdminCard>
        <form action={adaptAction} className="space-y-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-mission)]">
              Adapt Project Ve mission
            </p>
            <h2 className="mt-2 text-xl font-black">Keep the handler, localise the wording</h2>
            <p className={helperClasses()}>
              Adaptations keep source provenance and never modify the canonical platform mission.
            </p>
          </div>
          <label className="block">
            <span className={labelClasses()}>Source mission</span>
            <select className={fieldClasses()} name="sourceMissionId" required defaultValue={initialSourceMissionId}>
              <option value="">Select platform mission</option>
              {platformMissions.map((mission) => (
                <option key={mission.id} value={mission.id}>
                  {mission.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClasses()}>Local title</span>
            <input className={fieldClasses()} maxLength={140} name="title" />
          </label>
          <label className="block">
            <span className={labelClasses()}>Local description</span>
            <textarea className={`${fieldClasses()} min-h-24 resize-none`} maxLength={500} name="description" />
          </label>
          <PresentationFields prefix="Adapted mission" />
          <div className="rounded-[14px] bg-[var(--ve-panel)] p-4 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
            Adapted missions are saved as drafts. Publish from the mission list after reviewing entitlement and programme use.
          </div>
          <ActionNotice state={adaptState} />
          <SubmitButton>Adapt platform mission</SubmitButton>
        </form>

        <div className="mt-5 space-y-2 border-t border-[var(--ve-line-soft)] pt-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Available platform missions</p>
          {platformMissions.slice(0, 6).map((mission) => (
            <div className="flex items-start justify-between gap-3 rounded-[12px] bg-[var(--ve-shell)] px-3 py-2 text-xs" key={mission.id}>
              <div>
                <p className="font-black">{mission.title}</p>
                <p className="mt-1 font-semibold text-[var(--ve-muted)]">{mission.mission_type_key}</p>
              </div>
              <AdminStatusBadge tone={mission.status === "published" ? "good" : "warning"}>
                {mission.status}
              </AdminStatusBadge>
            </div>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}
