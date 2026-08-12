import type { ReactNode } from "react";
import Link from "next/link";
import type {
  AdminAssessmentVersionOptionRow,
  AdminCourseRow,
  AdminMissionRow,
  AdminOrganizationRow,
  AdminProgrammeDetail,
  AdminProgrammePendingAccessRequest,
  AdminRewardRow,
} from "@/lib/admin";
import type { OrganizationAssessmentCapability } from "@/features/organizations/entitlements";
import { AdminCard, AdminStatusBadge, adminButtonClasses } from "@/components/admin/AdminPrimitives";
import { reviewContextualProgrammeAccess, saveProgramme } from "@/app/admin/programmes/actions";

function fieldClasses() {
  return "mt-2 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 py-3 text-sm font-bold text-[var(--foreground)] outline-none transition focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)]";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

function helperTextClasses() {
  return "mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]";
}

function rewardOwnerLabel(reward: AdminRewardRow) {
  if (reward.owner_scope === "platform_owned") {
    return reward.shared_with_programmes ? "shared platform" : "platform only";
  }

  if (reward.owner_scope === "organization_owned") {
    return "organisation owned";
  }

  if (reward.owner_scope === "programme_sponsored") {
    return "programme sponsored";
  }

  return "platform";
}

function assessmentOwnerLabel(assessment: AdminAssessmentVersionOptionRow) {
  if (assessment.owner_scope === "platform") {
    return "Project Ve template";
  }

  return `Organisation v${assessment.version_number}`;
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 16);
}

function toDisplayDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function selectedOrder<T extends { sort_order: number }>(
  selected: T[],
  id: string,
  fallback: number,
  getId: (item: T) => string,
) {
  return selected.find((item) => getId(item) === id)?.sort_order ?? fallback;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function missionPresentationValue(
  mission: AdminMissionRow,
  selectedMission: AdminProgrammeDetail["missions"][number] | undefined,
  key: string,
) {
  return asString(selectedMission?.presentation_overrides?.[key] ?? mission.presentation_config?.[key]);
}

function FormSection({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <AdminCard>
      <div className="mb-4">
        <h2 className="text-base font-black">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </AdminCard>
  );
}

export function ProgrammePendingAccessRequestsCard({
  programme,
  requests,
}: {
  programme: AdminProgrammeDetail;
  requests: AdminProgrammePendingAccessRequest[];
}) {
  return (
    <AdminCard>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black">Pending access requests</h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
            Review contextual referral requests for this programme.
          </p>
        </div>
        <AdminStatusBadge tone={requests.length > 0 ? "warning" : "good"}>
          {requests.length} pending
        </AdminStatusBadge>
      </div>
      {requests.length === 0 ? (
        <div className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] px-4 py-3 text-sm font-bold text-[var(--ve-muted-strong)]">
          No contextual referral access requests are waiting for review.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const referralSource = asString(request.metadata.contextualReferralTokenId)
              || asString(request.metadata.contextualReferralAttributionId)
              || "Contextual referral";
            const learnerName = request.learner?.display_name || request.learner?.referral_code || request.user_id;

            return (
              <div
                className="grid gap-4 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4 text-sm lg:grid-cols-[1fr_18rem]"
                key={request.id}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">{learnerName}</p>
                    <AdminStatusBadge tone="warning">{request.status}</AdminStatusBadge>
                  </div>
                  <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                    <div>
                      <dt className={labelClasses()}>Programme</dt>
                      <dd className="mt-1 font-bold">{programme.title}</dd>
                    </div>
                    <div>
                      <dt className={labelClasses()}>Referral source</dt>
                      <dd className="mt-1 break-all font-bold">{referralSource}</dd>
                    </div>
                    <div>
                      <dt className={labelClasses()}>Requested at</dt>
                      <dd className="mt-1 font-bold">{toDisplayDateTime(request.assigned_at)}</dd>
                    </div>
                  </dl>
                </div>
                <div className="space-y-3">
                  <form action={reviewContextualProgrammeAccess}>
                    <input name="enrolmentId" type="hidden" value={request.id} />
                    <input name="programmeId" type="hidden" value={programme.id} />
                    <input name="decision" type="hidden" value="approve" />
                    <button className={adminButtonClasses("primary", "w-full")} type="submit">
                      Approve
                    </button>
                  </form>
                  <form action={reviewContextualProgrammeAccess} className="space-y-2">
                    <input name="enrolmentId" type="hidden" value={request.id} />
                    <input name="programmeId" type="hidden" value={programme.id} />
                    <input name="decision" type="hidden" value="reject" />
                    <label>
                      <span className={labelClasses()}>Rejection reason</span>
                      <input
                        className={fieldClasses()}
                        maxLength={500}
                        name="rejectionReason"
                        placeholder="Optional"
                      />
                    </label>
                    <button className={adminButtonClasses("secondary", "w-full")} type="submit">
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminCard>
  );
}

function SelectionRow({
  checked,
  children,
  fieldName,
  id,
  label,
  order,
}: {
  checked: boolean;
  children: ReactNode;
  fieldName: string;
  id: string;
  label: string;
  order: number;
}) {
  const inputId = `${fieldName}-${id}`;

  return (
    <div className="grid gap-3 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3 text-sm md:grid-cols-[1.5rem_5rem_1fr] md:items-start">
      <input
        aria-label={`Select ${label}`}
        className="mt-1 size-4"
        defaultChecked={checked}
        id={inputId}
        name={fieldName}
        type="checkbox"
        value={id}
      />
      <input
        aria-label="Sequence"
        className="w-full rounded-[10px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-2 py-1 text-xs font-black tabular-nums"
        defaultValue={order}
        min={1}
        name={`${fieldName}Order:${id}`}
        type="number"
      />
      <div>{children}</div>
    </div>
  );
}

export function ProgrammeEditorForm({
  assessmentCapability,
  assessmentVersions,
  courses,
  missions,
  organizations,
  programme,
  rewards,
}: {
  assessmentCapability: OrganizationAssessmentCapability;
  assessmentVersions: AdminAssessmentVersionOptionRow[];
  courses: AdminCourseRow[];
  missions: AdminMissionRow[];
  organizations: AdminOrganizationRow[];
  programme?: AdminProgrammeDetail | null;
  rewards: AdminRewardRow[];
}) {
  const selectedCourses = programme?.courses ?? [];
  const selectedCourseIds = new Set(selectedCourses.map((course) => course.course_id));
  const selectedMissions = programme?.missions ?? [];
  const selectedMissionIds = new Set(selectedMissions.map((mission) => mission.mission_id));
  const selectedRewards = programme?.rewards ?? [];
  const selectedRewardIds = new Set(selectedRewards.map((reward) => reward.reward_id));
  const selectedAssessments = programme?.assessments ?? [];
  const selectedAssessmentIds = new Set(selectedAssessments.map((assessment) => assessment.assessment_version_id));
  const completionRules = programme?.completion_rules ?? {};
  const minimumCompletionThreshold = Number(completionRules.minimumCompletionThreshold ?? 100);
  const requiredFinalAssessmentVersionId = String(completionRules.requiredFinalAssessmentVersionId ?? "");
  const selectedOrganizationId = programme?.organization_id ?? organizations[0]?.id ?? "";

  return (
    <form action={saveProgramme} className="space-y-5">
      <input name="programmeId" type="hidden" value={programme?.id ?? ""} />

      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <FormSection
            title="Programme identity"
            subtitle="Programmes are operating containers for delivery and outcomes. They are not courses."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className={labelClasses()}>Organisation</span>
                {programme ? (
                  <>
                    <input name="organizationId" type="hidden" value={selectedOrganizationId} />
                    <div className="mt-2 rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-panel)] px-4 py-3 text-sm font-black">
                      {programme.organization?.name ?? selectedOrganizationId}
                    </div>
                  </>
                ) : (
                  <select className={fieldClasses()} name="organizationId" required defaultValue={selectedOrganizationId}>
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <label>
                <span className={labelClasses()}>Status</span>
                <select className={fieldClasses()} name="status" defaultValue={programme?.status ?? "draft"}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_18rem]">
              <label>
                <span className={labelClasses()}>Title</span>
                <input className={fieldClasses()} name="title" required defaultValue={programme?.title ?? ""} />
              </label>
              <label>
                <span className={labelClasses()}>Slug</span>
                <input className={fieldClasses()} name="slug" placeholder="generated from title" defaultValue={programme?.slug ?? ""} />
              </label>
            </div>
            <label className="mt-4 block">
              <span className={labelClasses()}>Objective</span>
              <textarea className={`${fieldClasses()} min-h-28 resize-none`} name="objective" defaultValue={programme?.objective ?? ""} />
            </label>
            <label className="mt-4 block">
              <span className={labelClasses()}>Intended audience</span>
              <textarea className={`${fieldClasses()} min-h-24 resize-none`} name="intendedAudience" defaultValue={programme?.intended_audience ?? ""} />
            </label>
          </FormSection>

          <FormSection
            title="Course sequence"
            subtitle="Courses stay reusable. Use the sequence field to set the programme order."
          >
            <div className="space-y-3">
              {courses.map((course, index) => (
                <SelectionRow
                  checked={selectedCourseIds.has(course.id)}
                  fieldName="courseIds"
                  id={course.id}
                  key={course.id}
                  label={course.title}
                  order={selectedOrder(selectedCourses, course.id, index + 1, (item) => item.course_id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black">{course.title}</span>
                    <AdminStatusBadge tone={course.status === "published" ? "good" : "warning"}>{course.status}</AdminStatusBadge>
                    <AdminStatusBadge tone={course.catalog_scope === "platform" ? "neutral" : "store"}>
                      {course.catalog_scope.replaceAll("_", " ")}
                    </AdminStatusBadge>
                  </div>
                  <p className={helperTextClasses()}>{course.category} · {course.estimated_minutes} minutes</p>
                </SelectionRow>
              ))}
            </div>
          </FormSection>

          <FormSection title="Missions" subtitle="Attach current mission rules and configure programme-specific delivery without changing the reusable mission.">
            <div className="mb-4 flex flex-wrap gap-2">
              <Link className={adminButtonClasses("secondary")} href="/admin/missions">
                Use existing mission
              </Link>
              <Link className={adminButtonClasses("secondary")} href="/admin/missions/organization/new">
                Create organisation mission
              </Link>
            </div>
            <div className="space-y-3">
              {missions.map((mission, index) => {
                const selectedMission = selectedMissions.find((item) => item.mission_id === mission.id);
                const displayTitle = missionPresentationValue(mission, selectedMission, "title");
                const ctaLabel = missionPresentationValue(mission, selectedMission, "ctaLabel");
                const shortDescription = missionPresentationValue(mission, selectedMission, "shortDescription");

                return (
                  <SelectionRow
                    checked={selectedMissionIds.has(mission.id)}
                    fieldName="missionIds"
                    id={mission.id}
                    key={mission.id}
                    label={mission.title}
                    order={selectedOrder(selectedMissions, mission.id, index + 1, (item) => item.mission_id)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black">{mission.title}</span>
                      <AdminStatusBadge tone={mission.status === "published" ? "good" : "warning"}>{mission.status}</AdminStatusBadge>
                      <AdminStatusBadge tone={mission.catalog_scope === "platform" ? "neutral" : "store"}>
                        {mission.catalog_scope.replaceAll("_", " ")}
                      </AdminStatusBadge>
                    </div>
                    <p className={helperTextClasses()}>
                      {mission.category} · {mission.validation_type.replaceAll("_", " ")} · {mission.mission_type_key}
                    </p>
                    <div className="mt-4 grid gap-3 border-t border-[var(--ve-line-soft)] pt-4 lg:grid-cols-3">
                      <label>
                        <span className={labelClasses()}>Starts</span>
                        <input
                          className={fieldClasses()}
                          defaultValue={toDateTimeLocal(selectedMission?.starts_at)}
                          name={`missionStartsAt:${mission.id}`}
                          type="datetime-local"
                        />
                      </label>
                      <label>
                        <span className={labelClasses()}>Due</span>
                        <input
                          className={fieldClasses()}
                          defaultValue={toDateTimeLocal(selectedMission?.due_at)}
                          name={`missionDueAt:${mission.id}`}
                          type="datetime-local"
                        />
                      </label>
                      <label>
                        <span className={labelClasses()}>Points override</span>
                        <input
                          className={fieldClasses()}
                          defaultValue={selectedMission?.reward_xp_override ?? ""}
                          min={1}
                          name={`missionRewardXpOverride:${mission.id}`}
                          placeholder={String(mission.reward_xp ?? "")}
                          type="number"
                        />
                      </label>
                      <label className="flex items-center gap-3 rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-3 py-3 text-sm font-black">
                        <input
                          defaultChecked={selectedMission?.is_required ?? false}
                          name={`missionRequired:${mission.id}`}
                          type="checkbox"
                        />
                        <span>Required for programme completion</span>
                      </label>
                      <label>
                        <span className={labelClasses()}>XP account</span>
                        <select className={fieldClasses()} disabled defaultValue="">
                          <option value="">Default organisation account</option>
                        </select>
                        <span className={helperTextClasses()}>Account selection is enabled with P1.5C XP accounts.</span>
                      </label>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <label>
                        <span className={labelClasses()}>Programme title</span>
                        <input
                          className={fieldClasses()}
                          defaultValue={displayTitle}
                          maxLength={140}
                          name={`missionDisplayTitle:${mission.id}`}
                          placeholder={mission.title}
                        />
                      </label>
                      <label>
                        <span className={labelClasses()}>CTA label</span>
                        <input
                          className={fieldClasses()}
                          defaultValue={ctaLabel}
                          maxLength={80}
                          name={`missionCtaLabel:${mission.id}`}
                          placeholder="Start mission"
                        />
                      </label>
                      <label className="lg:col-span-2">
                        <span className={labelClasses()}>Short learner description</span>
                        <textarea
                          className={`${fieldClasses()} min-h-20 resize-none`}
                          defaultValue={shortDescription}
                          maxLength={240}
                          name={`missionShortDescription:${mission.id}`}
                          placeholder={mission.description}
                        />
                      </label>
                    </div>
                    <div className="mt-4 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">Learner preview</p>
                      <h3 className="mt-2 text-base font-black">{displayTitle || mission.title}</h3>
                      <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted-strong)]">
                        {shortDescription || mission.description}
                      </p>
                      <div className="mt-3 inline-flex rounded-[12px] bg-[var(--ve-mission)] px-3 py-2 text-xs font-black text-white">
                        {ctaLabel || "Start mission"}
                      </div>
                    </div>
                    {mission.catalog_scope === "platform" ? (
                      <div className="mt-3">
                        <Link
                          className="text-xs font-black text-[var(--ve-mission)] hover:underline"
                          href={`/admin/missions/organization/new?sourceMissionId=${encodeURIComponent(mission.id)}`}
                        >
                          Adapt Project Ve mission for this organisation
                        </Link>
                      </div>
                    ) : null}
                  </SelectionRow>
                );
              })}
            </div>
          </FormSection>

          <FormSection title="Rewards" subtitle="Attach existing rewards. Tenant reward isolation is handled in a later P1 ticket.">
            <div className="space-y-3">
              {rewards.map((reward, index) => (
                <SelectionRow
                  checked={selectedRewardIds.has(reward.id)}
                  fieldName="rewardIds"
                  id={reward.id}
                  key={reward.id}
                  label={reward.title}
                  order={selectedOrder(selectedRewards, reward.id, index + 1, (item) => item.reward_id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black">{reward.title}</span>
                    <AdminStatusBadge tone={reward.status === "published" ? "good" : "warning"}>{reward.status}</AdminStatusBadge>
                    <AdminStatusBadge tone={reward.shared_with_programmes ? "good" : "neutral"}>
                      {rewardOwnerLabel(reward)}
                    </AdminStatusBadge>
                  </div>
                  <p className={helperTextClasses()}>{reward.cost_xp} XP · {reward.fulfillment_type.replaceAll("_", " ")}</p>
                </SelectionRow>
              ))}
            </div>
          </FormSection>

          <FormSection
            title="Assessment"
            subtitle={
              assessmentCapability === "assigned_only"
                ? "Assessment authoring and programme assessment checkpoints are not available on this organisation plan."
                : "Attach published assessment versions as programme-level checkpoints."
            }
          >
            {assessmentCapability === "assigned_only" ? (
              <div className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] px-4 py-3 text-sm font-bold text-[var(--ve-muted-strong)]">
                Starter organisations use direct assignment, course quizzes and programme completion rules.
              </div>
            ) : (
              <div className="space-y-3">
                {assessmentVersions.map((assessment, index) => {
                  const selectedAssessment = selectedAssessments.find((item) => item.assessment_version_id === assessment.id);

                  return (
                    <SelectionRow
                      checked={selectedAssessmentIds.has(assessment.id)}
                      fieldName="assessmentVersionIds"
                      id={assessment.id}
                      key={assessment.id}
                      label={assessment.title}
                      order={selectedOrder(selectedAssessments, assessment.id, index + 1, (item) => item.assessment_version_id)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black">{assessment.title}</span>
                        <AdminStatusBadge tone={assessment.status === "published" ? "good" : "warning"}>{assessment.status}</AdminStatusBadge>
                        <AdminStatusBadge tone={assessment.owner_scope === "platform" ? "neutral" : "store"}>
                          {assessmentOwnerLabel(assessment)}
                        </AdminStatusBadge>
                      </div>
                      <p className={helperTextClasses()}>{assessment.slug}</p>
                      <div className="mt-4 grid gap-3 border-t border-[var(--ve-line-soft)] pt-4 lg:grid-cols-2">
                        <label className="flex items-center gap-3 rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-3 py-3 text-sm font-black lg:col-span-2">
                          <input
                            defaultChecked={selectedAssessment?.is_required ?? true}
                            name={`assessmentRequired:${assessment.id}`}
                            type="checkbox"
                          />
                          <span>Required for programme completion</span>
                        </label>
                        <label>
                          <span className={labelClasses()}>Introduction copy</span>
                          <textarea
                            className={`${fieldClasses()} min-h-20 resize-none`}
                            defaultValue={selectedAssessment?.introduction_copy || assessment.introduction_copy}
                            maxLength={1000}
                            name={`assessmentIntroductionCopy:${assessment.id}`}
                          />
                        </label>
                        <label>
                          <span className={labelClasses()}>Completion copy</span>
                          <textarea
                            className={`${fieldClasses()} min-h-20 resize-none`}
                            defaultValue={selectedAssessment?.completion_copy || assessment.completion_copy}
                            maxLength={1000}
                            name={`assessmentCompletionCopy:${assessment.id}`}
                          />
                        </label>
                      </div>
                    </SelectionRow>
                  );
                })}
                {assessmentVersions.length === 0 ? (
                  <div className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] px-4 py-3 text-sm font-bold text-[var(--ve-muted-strong)]">
                    No published assessment templates are available for this workspace.
                  </div>
                ) : null}
              </div>
            )}
          </FormSection>
        </div>

        <div className="space-y-5">
          <FormSection title="Schedule">
            <label className="block">
              <span className={labelClasses()}>Starts</span>
              <input className={fieldClasses()} name="scheduleStartsAt" type="datetime-local" defaultValue={toDateTimeLocal(programme?.schedule_starts_at)} />
            </label>
            <label className="mt-4 block">
              <span className={labelClasses()}>Ends</span>
              <input className={fieldClasses()} name="scheduleEndsAt" type="datetime-local" defaultValue={toDateTimeLocal(programme?.schedule_ends_at)} />
            </label>
          </FormSection>

          <FormSection
            title="Completion rules"
            subtitle="Selected courses and missions contribute to the transcript completion percentage. A selected final assessment remains mandatory."
          >
            <label className="block">
              <span className={labelClasses()}>Completion threshold</span>
              <input
                className={fieldClasses()}
                max={100}
                min={0}
                name="minimumCompletionThreshold"
                type="number"
                defaultValue={Number.isFinite(minimumCompletionThreshold) ? minimumCompletionThreshold : 100}
              />
              <span className={helperTextClasses()}>
                Use 100 for all selected work. Lower values allow completion once the learner reaches that percentage and completes any final assessment.
              </span>
            </label>
            <label className="mt-4 block">
              <span className={labelClasses()}>Final assessment</span>
              <select
                className={fieldClasses()}
                name="requiredFinalAssessmentVersionId"
                defaultValue={requiredFinalAssessmentVersionId}
              >
                <option value="">No final assessment required</option>
                {assessmentVersions.map((assessment) => (
                  <option key={assessment.id} value={assessment.id}>
                    {assessment.title}
                  </option>
                ))}
              </select>
              <span className={helperTextClasses()}>If selected, keep the same assessment checked in the assessment list.</span>
            </label>
            <div className="mt-4 rounded-[14px] bg-[var(--ve-panel)] p-4 text-sm font-black">
              {selectedCourseIds.size} selected courses and {selectedMissionIds.size} selected missions contribute to completion progress.
              <span className="block text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                Final assessments remain mandatory when selected. Certificates are deferred to P2.
              </span>
            </div>
          </FormSection>

          <button className={adminButtonClasses("primary", "w-full")} type="submit">
            Save programme
          </button>
        </div>
      </div>
    </form>
  );
}
