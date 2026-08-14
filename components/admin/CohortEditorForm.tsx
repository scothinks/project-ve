import type { ReactNode } from "react";
import type {
  AdminCohortDetail,
  AdminCourseRow,
  AdminOrganizationRow,
  AdminOrganizationUnitRow,
  AdminProfileRow,
  AdminProgrammeRow,
} from "@/lib/admin";
import {
  assignCourseToAudience,
  assignProgrammeToAudience,
  saveCohort,
  updateEnrolmentStatus,
} from "@/app/admin/cohorts/actions";
import { AdminCard, AdminStatusBadge, adminButtonClasses } from "@/components/admin/AdminPrimitives";
import { formatRewardDate } from "@/lib/rewards";

function fieldClasses() {
  return "mt-2 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 py-3 text-sm font-bold text-[var(--foreground)] outline-none transition focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)]";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

function helperTextClasses() {
  return "mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]";
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 16);
}

function statusTone(status: string) {
  if (status === "published" || status === "active" || status === "completed") return "good" as const;
  if (status === "archived" || status === "withdrawn") return "danger" as const;
  return "warning" as const;
}

function displayUser(profile?: Pick<AdminProfileRow, "display_name" | "id" | "role"> | null) {
  if (!profile) return "Unknown user";
  return profile.display_name || profile.id;
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

function UserCheckbox({
  checked,
  fieldName,
  user,
}: {
  checked?: boolean;
  fieldName: string;
  user: AdminProfileRow;
}) {
  return (
    <label className="flex items-start gap-3 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3 text-sm">
      <input
        className="mt-1 size-4"
        defaultChecked={checked}
        name={fieldName}
        type="checkbox"
        value={user.id}
      />
      <span>
        <span className="block font-black">{displayUser(user)}</span>
        <span className="mt-1 block text-xs font-semibold text-[var(--ve-muted)]">
          {user.role} · {user.id}
        </span>
      </span>
    </label>
  );
}

function EmptyPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-[var(--ve-line)] bg-[var(--ve-shell)] p-4 text-sm font-bold text-[var(--ve-muted)]">
      {children}
    </div>
  );
}

export function CohortEditorForm({
  cohort,
  courses,
  organizations,
  programmes,
  units,
  users,
}: {
  cohort?: AdminCohortDetail | null;
  courses: AdminCourseRow[];
  organizations: AdminOrganizationRow[];
  programmes: AdminProgrammeRow[];
  units: AdminOrganizationUnitRow[];
  users: AdminProfileRow[];
}) {
  const selectedOrganizationId = cohort?.organization_id ?? organizations[0]?.id ?? "";
  const activeMemberIds = new Set(
    (cohort?.members ?? [])
      .filter((member) => member.status === "active")
      .map((member) => member.user_id),
  );
  const availableCourses = courses.filter(
    (course) =>
      course.catalog_scope === "platform" ||
      (course.organization_id && course.organization_id === selectedOrganizationId),
  );
  const availableProgrammes = programmes.filter(
    (programme) => programme.organization_id === selectedOrganizationId,
  );
  const availableUnits = units.filter(
    (unit) => unit.organization_id === selectedOrganizationId && unit.status !== "archived",
  );
  const selectedUnitIds = new Set((cohort?.units ?? []).map((unit) => unit.id));

  return (
    <div className="space-y-5">
      <form action={saveCohort} className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <input name="cohortId" type="hidden" value={cohort?.id ?? ""} />
        <div className="space-y-5">
          <FormSection
            title="Cohort identity"
            subtitle="Cohorts are organisation audience groups used for learner assignment and intake scheduling."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className={labelClasses()}>Organisation</span>
                {cohort ? (
                  <>
                    <input name="organizationId" type="hidden" value={selectedOrganizationId} />
                    <div className="mt-2 rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-panel)] px-4 py-3 text-sm font-black">
                      {cohort.organization?.name ?? selectedOrganizationId}
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
                <select className={fieldClasses()} name="status" defaultValue={cohort?.status ?? "draft"}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_18rem]">
              <label>
                <span className={labelClasses()}>Title</span>
                <input className={fieldClasses()} name="title" required defaultValue={cohort?.title ?? ""} />
              </label>
              <label>
                <span className={labelClasses()}>Slug</span>
                <input className={fieldClasses()} name="slug" placeholder="generated from title" defaultValue={cohort?.slug ?? ""} />
              </label>
            </div>
            <label className="mt-4 block">
              <span className={labelClasses()}>Description</span>
              <textarea className={`${fieldClasses()} min-h-28 resize-none`} name="description" defaultValue={cohort?.description ?? ""} />
            </label>
          </FormSection>

          <FormSection
            title="Learners"
            subtitle="Saving replaces the active cohort roster. Omitted existing members are withdrawn, preserving history."
          >
            <div className="grid gap-3 md:grid-cols-2">
              {users.map((user) => (
                <UserCheckbox
                  checked={activeMemberIds.has(user.id)}
                  fieldName="memberUserIds"
                  key={user.id}
                  user={user}
                />
              ))}
            </div>
            <label className="mt-4 block">
              <span className={labelClasses()}>Bulk learner UUIDs</span>
              <textarea
                className={`${fieldClasses()} min-h-24 resize-none font-mono text-xs`}
                name="bulkMemberUserIds"
                placeholder="Paste learner UUIDs separated by spaces, commas, or new lines"
              />
            </label>
          </FormSection>
        </div>

        <div className="space-y-5">
          <FormSection title="Schedule">
            <label className="block">
              <span className={labelClasses()}>Starts</span>
              <input className={fieldClasses()} name="startsAt" type="datetime-local" defaultValue={toDateTimeLocal(cohort?.starts_at)} />
            </label>
            <label className="mt-4 block">
              <span className={labelClasses()}>Ends</span>
              <input className={fieldClasses()} name="endsAt" type="datetime-local" defaultValue={toDateTimeLocal(cohort?.ends_at)} />
            </label>
          </FormSection>

          <FormSection title="Units">
            {availableUnits.length === 0 ? (
              <EmptyPanel>No active organisation units are available.</EmptyPanel>
            ) : (
              <div className="grid max-h-72 gap-3 overflow-auto pr-1">
                {availableUnits.map((unit) => (
                  <label
                    className="flex items-start gap-3 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3 text-sm"
                    key={unit.id}
                  >
                    <input
                      className="mt-1 size-4"
                      defaultChecked={selectedUnitIds.has(unit.id)}
                      name="unitIds"
                      type="checkbox"
                      value={unit.id}
                    />
                    <span>
                      <span className="block font-black">{unit.name}</span>
                      <span className="mt-1 block text-xs font-semibold text-[var(--ve-muted)]">
                        {unit.unit_type}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </FormSection>

          {cohort ? (
            <FormSection title="Roster state">
              <div className="grid grid-cols-3 gap-3 text-center">
                {(["active", "completed", "withdrawn"] as const).map((status) => (
                  <div className="rounded-[14px] bg-[var(--ve-panel)] p-3" key={status}>
                    <p className="text-2xl font-black tabular-nums">
                      {cohort.members.filter((member) => member.status === status).length}
                    </p>
                    <p className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
                      {status}
                    </p>
                  </div>
                ))}
              </div>
            </FormSection>
          ) : null}

          <button className={adminButtonClasses("primary", "w-full")} type="submit">
            Save cohort
          </button>
        </div>
      </form>

      {cohort ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <FormSection
            title="Assign course"
            subtitle="Create direct learner assignments, cohort assignments, or both. Enrolments are created by the database workflow."
          >
            <form action={assignCourseToAudience} className="space-y-4">
              <input name="cohortId" type="hidden" value={cohort.id} />
              <input name="organizationId" type="hidden" value={cohort.organization_id} />
              <label className="block">
                <span className={labelClasses()}>Course</span>
                <select className={fieldClasses()} name="courseId" required>
                  {availableCourses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClasses()}>Due date</span>
                <input className={fieldClasses()} name="courseDueAt" type="datetime-local" />
              </label>
              <label className="flex items-start gap-3 rounded-[14px] bg-[var(--ve-panel)] p-4 text-sm font-black">
                <input className="mt-1" defaultChecked name="assignCourseToCohort" type="checkbox" />
                <span>
                  Assign to this cohort
                  <span className="block text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                    Active cohort members receive enrolments immediately.
                  </span>
                </span>
              </label>
              <div className="grid max-h-72 gap-3 overflow-auto pr-1">
                {users.map((user) => (
                  <UserCheckbox fieldName="courseUserIds" key={user.id} user={user} />
                ))}
              </div>
              <label className="block">
                <span className={labelClasses()}>Bulk direct learner UUIDs</span>
                <textarea className={`${fieldClasses()} min-h-20 resize-none font-mono text-xs`} name="bulkCourseUserIds" />
              </label>
              <button className={adminButtonClasses("success", "w-full")} type="submit">
                Assign course
              </button>
            </form>
          </FormSection>

          <FormSection
            title="Assign programme"
            subtitle="Programme assignment creates programme enrolments and derived course enrolments for the programme sequence."
          >
            <form action={assignProgrammeToAudience} className="space-y-4">
              <input name="cohortId" type="hidden" value={cohort.id} />
              <label className="block">
                <span className={labelClasses()}>Programme</span>
                <select className={fieldClasses()} name="programmeId" required>
                  {availableProgrammes.map((programme) => (
                    <option key={programme.id} value={programme.id}>
                      {programme.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className={labelClasses()}>Intake starts</span>
                  <input className={fieldClasses()} name="programmeIntakeStartsAt" type="datetime-local" />
                </label>
                <label>
                  <span className={labelClasses()}>Due date</span>
                  <input className={fieldClasses()} name="programmeDueAt" type="datetime-local" />
                </label>
              </div>
              <label className="flex items-start gap-3 rounded-[14px] bg-[var(--ve-panel)] p-4 text-sm font-black">
                <input className="mt-1" defaultChecked name="assignProgrammeToCohort" type="checkbox" />
                <span>
                  Assign to this cohort
                  <span className="block text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                    Active cohort members receive programme and course enrolments.
                  </span>
                </span>
              </label>
              <div className="grid max-h-72 gap-3 overflow-auto pr-1">
                {users.map((user) => (
                  <UserCheckbox fieldName="programmeUserIds" key={user.id} user={user} />
                ))}
              </div>
              <label className="block">
                <span className={labelClasses()}>Bulk direct learner UUIDs</span>
                <textarea className={`${fieldClasses()} min-h-20 resize-none font-mono text-xs`} name="bulkProgrammeUserIds" />
              </label>
              <button className={adminButtonClasses("success", "w-full")} type="submit">
                Assign programme
              </button>
            </form>
          </FormSection>
        </div>
      ) : null}

      {cohort ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <FormSection title="Current members">
            {cohort.members.length === 0 ? (
              <EmptyPanel>No members have been added.</EmptyPanel>
            ) : (
              <div className="space-y-3">
                {cohort.members.map((member) => (
                  <div className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3" key={member.user_id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-black">{displayUser(member.profile)}</p>
                        <p className={helperTextClasses()}>{member.user_id}</p>
                      </div>
                      <AdminStatusBadge tone={statusTone(member.status)}>{member.status}</AdminStatusBadge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FormSection>

          <FormSection title="Assignments">
            <div className="space-y-4">
              {cohort.courseAssignments.length === 0 && cohort.programmeAssignments.length === 0 ? (
                <EmptyPanel>No cohort assignments have been created.</EmptyPanel>
              ) : null}
              {cohort.units.length > 0 ? (
                <div className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3">
                  <p className="font-black">Units</p>
                  <p className={helperTextClasses()}>
                    {cohort.units.map((unit) => `${unit.unit_type}: ${unit.name}`).join(", ")}
                  </p>
                </div>
              ) : null}
              {cohort.courseAssignments.map((assignment) => (
                <div className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3" key={assignment.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-black">{assignment.course?.title ?? assignment.course_id}</p>
                      <p className={helperTextClasses()}>
                        Course · {assignment.assignment_source} · due {assignment.due_at ? formatRewardDate(assignment.due_at) : "not set"}
                      </p>
                    </div>
                    <AdminStatusBadge tone={statusTone(assignment.status)}>{assignment.status}</AdminStatusBadge>
                  </div>
                </div>
              ))}
              {cohort.programmeAssignments.map((assignment) => (
                <div className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3" key={assignment.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-black">{assignment.programme?.title ?? assignment.programme_id}</p>
                      <p className={helperTextClasses()}>
                        Programme · intake {assignment.intake_starts_at ? formatRewardDate(assignment.intake_starts_at) : "not set"}
                      </p>
                    </div>
                    <AdminStatusBadge tone={statusTone(assignment.status)}>{assignment.status}</AdminStatusBadge>
                  </div>
                </div>
              ))}
            </div>
          </FormSection>
        </div>
      ) : null}

      {cohort ? (
        <FormSection title="Enrolments">
          {cohort.enrolments.length === 0 ? (
            <EmptyPanel>No cohort-created enrolments have been generated.</EmptyPanel>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
                  <tr>
                    <th className="px-3 py-2">Learner</th>
                    <th className="px-3 py-2">Content</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Due</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ve-line-soft)]">
                  {cohort.enrolments.map((enrolment) => (
                    <tr key={enrolment.id}>
                      <td className="min-w-56 px-3 py-3">
                        <p className="font-black">{displayUser(enrolment.profile)}</p>
                        <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{enrolment.user_id}</p>
                      </td>
                      <td className="min-w-56 px-3 py-3 font-bold">
                        {enrolment.course?.title ?? enrolment.programme?.title ?? enrolment.course_id ?? enrolment.programme_id}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-bold capitalize">
                        {enrolment.assignment_source}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-bold">
                        {enrolment.due_at ? formatRewardDate(enrolment.due_at) : "Not set"}
                      </td>
                      <td className="min-w-44 px-3 py-3">
                        <form action={updateEnrolmentStatus} className="flex gap-2">
                          <input name="cohortId" type="hidden" value={cohort.id} />
                          <input name="enrolmentId" type="hidden" value={enrolment.id} />
                          <select className="rounded-[10px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-2 py-2 text-xs font-black" name="status" defaultValue={enrolment.status}>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="withdrawn">Withdrawn</option>
                          </select>
                          <button className={adminButtonClasses("secondary", "min-h-9 px-3 text-xs")} type="submit">
                            Save
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </FormSection>
      ) : null}
    </div>
  );
}
