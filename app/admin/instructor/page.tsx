import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AdminCard,
  AdminNoticeBanner,
  AdminPageHeader,
  AdminStatCard,
  AdminStatusBadge,
  AdminTable,
  EmptyAdminState,
  adminButtonClasses,
} from "@/components/admin/AdminPrimitives";
import {
  getAdminInstructorWorkspace,
  getAdminOrganizations,
  requireAdminWorkspaceRole,
} from "@/lib/admin";
import { PLATFORM_CATALOG_WORKSPACE_ID } from "@/features/admin/shared/workspace";
import { formatRewardDate } from "@/lib/rewards";
import {
  createInstructorIntervention,
  reviewInstructorProofSubmission,
  sendInstructorReminder,
  updateInstructorInterventionStatus,
} from "./actions";

type InstructorSearchParams = {
  notice?: string | string[];
  organizationId?: string | string[];
  unitId?: string | string[];
};

const INSTRUCTOR_WORKSPACE_ROLES = [
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
  "reviewer",
  "instructor",
  "report_viewer",
];

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function selectedOrEmpty(value: string | undefined) {
  return value && value !== "all" ? value : "";
}

function percent(value: number) {
  return `${Math.round(value)}%`;
}

function statusTone(status: string) {
  if (status === "published" || status === "active" || status === "resolved") return "good" as const;
  if (status === "archived" || status === "dismissed" || status === "critical") return "danger" as const;
  return "warning" as const;
}

function severityTone(severity: string) {
  if (severity === "critical") return "danger" as const;
  if (severity === "info") return "neutral" as const;
  return "warning" as const;
}

function redirectHref(organizationId: string, unitId: string | null) {
  const params = new URLSearchParams({ organizationId });
  if (unitId) params.set("unitId", unitId);
  return `/admin/instructor?${params.toString()}`;
}

export default async function AdminInstructorWorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<InstructorSearchParams>;
}) {
  const { supabase, workspace } = await requireAdminWorkspaceRole(INSTRUCTOR_WORKSPACE_ROLES);

  // The instructor workspace is built from a real organisation's cohorts and
  // enrolments — there is nothing to show for the platform-catalog
  // pseudo-workspace, which has neither.
  if (workspace.id === PLATFORM_CATALOG_WORKSPACE_ID) {
    redirect("/admin/courses");
  }

  const params = (await searchParams) ?? {};
  const organizations = await getAdminOrganizations(supabase);
  const requestedOrganizationId = selectedOrEmpty(firstSearchValue(params.organizationId));
  const selectedOrganizationId = workspace.type === "organization"
    ? workspace.id
    : requestedOrganizationId || organizations[0]?.id || "";
  const requestedUnitId = selectedOrEmpty(firstSearchValue(params.unitId));
  const notice = firstSearchValue(params.notice);
  const instructorWorkspace = selectedOrganizationId
    ? await getAdminInstructorWorkspace(supabase, {
        limit: 100,
        organizationId: selectedOrganizationId,
        unitId: requestedUnitId || null,
      })
    : null;
  const selectedUnitId = instructorWorkspace?.unitId ?? requestedUnitId;
  const currentHref = selectedOrganizationId ? redirectHref(selectedOrganizationId, selectedUnitId || null) : "/admin/instructor";

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="Instructor workspace"
        title="Instructor and supervisor workspace"
        subtitle="Review assigned cohorts, learner progress, overdue and inactive learners, mission evidence, interventions, announcements and reminders."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}

      {organizations.length === 0 || !selectedOrganizationId || !instructorWorkspace ? (
        <EmptyAdminState>No organisation workspace is available.</EmptyAdminState>
      ) : (
        <>
          <AdminCard className="mb-5">
            <form className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
              <label>
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
                  Organisation
                </span>
                <select
                  className="mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--ve-green)]"
                  defaultValue={selectedOrganizationId}
                  disabled={workspace.type === "organization"}
                  name="organizationId"
                >
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
                {workspace.type === "organization" ? (
                  <input name="organizationId" type="hidden" value={selectedOrganizationId} />
                ) : null}
              </label>
              <label>
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
                  Unit
                </span>
                <select
                  className="mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--ve-green)]"
                  defaultValue={selectedUnitId || "all"}
                  name="unitId"
                >
                  <option value="all">All permitted units</option>
                  {instructorWorkspace.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button className={adminButtonClasses("primary", "w-full")} type="submit">
                  Apply
                </button>
              </div>
            </form>
          </AdminCard>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard label="My cohorts" value={instructorWorkspace.cohorts.length} />
            <AdminStatCard label="Learners" value={instructorWorkspace.learners.length} />
            <AdminStatCard label="Inactive" tone="warning" value={instructorWorkspace.inactiveLearners.length} />
            <AdminStatCard label="Overdue" tone="risk" value={instructorWorkspace.overdueLearners.length} />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.8fr]">
            <div>
              <h2 className="mb-3 text-lg font-black">My cohorts</h2>
              {instructorWorkspace.cohorts.length === 0 ? (
                <EmptyAdminState>No cohorts are assigned to this workspace.</EmptyAdminState>
              ) : (
                <AdminTable columns={["Cohort", "Units", "Members", "Assigned", "Status"]}>
                  {instructorWorkspace.cohorts.map((cohort) => (
                    <tr key={cohort.id}>
                      <td className="min-w-[240px] px-4 py-4">
                        <p className="font-black">{cohort.title}</p>
                        <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{cohort.id}</p>
                      </td>
                      <td className="min-w-[200px] px-4 py-4 text-xs font-bold text-[var(--ve-muted-strong)]">
                        {cohort.units.length > 0 ? cohort.units.map((unit) => unit.name).join(", ") : "No unit"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-black tabular-nums">{cohort.activeMembers}</td>
                      <td className="whitespace-nowrap px-4 py-4 font-black tabular-nums">{cohort.assignedLearners}</td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <AdminStatusBadge tone={statusTone(cohort.status)}>{cohort.status}</AdminStatusBadge>
                      </td>
                    </tr>
                  ))}
                </AdminTable>
              )}
            </div>

            <div>
              <h2 className="mb-3 text-lg font-black">Announcements and reminders</h2>
              {!instructorWorkspace.canAct ? (
                <EmptyAdminState>This workspace is read-only.</EmptyAdminState>
              ) : instructorWorkspace.reminderTargets.length === 0 ? (
                <EmptyAdminState>No inactive or overdue reminder targets.</EmptyAdminState>
              ) : (
                <AdminCard>
                  <form action={sendInstructorReminder} className="space-y-4">
                    <input name="organizationId" type="hidden" value={selectedOrganizationId} />
                    <input name="unitId" type="hidden" value={selectedUnitId || ""} />
                    <input name="redirectTo" type="hidden" value={currentHref} />
                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
                        Title
                      </span>
                      <input
                        className="mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--ve-green)]"
                        defaultValue="Reminder from your instructor"
                        name="title"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
                        Message
                      </span>
                      <textarea
                        className="mt-1 min-h-24 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--ve-green)]"
                        defaultValue="Please check your assigned learning."
                        name="body"
                        required
                      />
                    </label>
                    <div className="grid max-h-64 gap-2 overflow-auto pr-1">
                      {instructorWorkspace.reminderTargets.map((target) => (
                        <label className="flex items-start gap-3 rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-3 text-xs" key={`${target.userId}:${target.reason}`}>
                          <input className="mt-1 size-4" defaultChecked name="userIds" type="checkbox" value={target.userId} />
                          <span>
                            <span className="block font-black">{target.displayName ?? target.userId}</span>
                            <span className="mt-1 block font-semibold text-[var(--ve-muted)]">{target.reason}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <button className={adminButtonClasses("primary", "w-full")} type="submit">
                      Send reminder
                    </button>
                  </form>
                </AdminCard>
              )}
            </div>
          </section>

          <section className="mt-6">
            <h2 className="mb-3 text-lg font-black">Learner progress</h2>
            {instructorWorkspace.learners.length === 0 ? (
              <EmptyAdminState>No learner progress rows match this workspace.</EmptyAdminState>
            ) : (
              <AdminTable columns={["Learner", "Cohorts", "Assigned", "Completed", "Overdue", "Progress", "Last activity"]}>
                {instructorWorkspace.learners.map((learner) => (
                  <tr key={learner.userId}>
                    <td className="min-w-[220px] px-4 py-4">
                      <p className="font-black">{learner.displayName ?? "Unnamed learner"}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{learner.userId}</p>
                    </td>
                    <td className="min-w-[200px] px-4 py-4 text-xs font-bold text-[var(--ve-muted-strong)]">
                      {learner.cohorts.length > 0 ? learner.cohorts.map((cohort) => cohort.title).join(", ") : "No cohort"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-black tabular-nums">{learner.assignedCount}</td>
                    <td className="whitespace-nowrap px-4 py-4 font-black tabular-nums">{learner.completedCount}</td>
                    <td className="whitespace-nowrap px-4 py-4 font-black tabular-nums">{learner.overdueCount}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-bold">{percent(learner.averageProgress)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-bold">
                      {learner.lastActivityAt ? formatRewardDate(learner.lastActivityAt) : "No activity"}
                    </td>
                  </tr>
                ))}
              </AdminTable>
            )}
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <div>
              <h2 className="mb-3 text-lg font-black">Inactive learners</h2>
              {instructorWorkspace.inactiveLearners.length === 0 ? (
                <EmptyAdminState>No inactive learners in this scope.</EmptyAdminState>
              ) : (
                <AdminTable columns={["Learner", "Progress", "Last activity"]}>
                  {instructorWorkspace.inactiveLearners.map((learner) => (
                    <tr key={`inactive:${learner.userId}`}>
                      <td className="min-w-[220px] px-4 py-4">
                        <p className="font-black">{learner.displayName ?? "Unnamed learner"}</p>
                        <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{learner.userId}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-bold">{percent(learner.averageProgress)}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-bold">
                        {learner.lastActivityAt ? formatRewardDate(learner.lastActivityAt) : "No activity"}
                      </td>
                    </tr>
                  ))}
                </AdminTable>
              )}
            </div>

            <div>
              <h2 className="mb-3 text-lg font-black">Overdue learners</h2>
              {instructorWorkspace.overdueLearners.length === 0 ? (
                <EmptyAdminState>No overdue learners in this scope.</EmptyAdminState>
              ) : (
                <AdminTable columns={["Learner", "Content", "Due", "Action"]}>
                  {instructorWorkspace.overdueLearners.map((learner) => (
                    <tr key={`overdue:${learner.userId}:${learner.programmeId ?? learner.courseId}`}>
                      <td className="min-w-[220px] px-4 py-4">
                        <p className="font-black">{learner.displayName ?? "Unnamed learner"}</p>
                        <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{learner.userId}</p>
                      </td>
                      <td className="min-w-[180px] px-4 py-4 text-xs font-bold text-[var(--ve-muted-strong)]">
                        {learner.programmeId ?? learner.courseId ?? "Assignment"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-bold">
                        {learner.dueAt ? formatRewardDate(learner.dueAt) : "No due date"}
                      </td>
                      <td className="min-w-[190px] px-4 py-4">
                        {instructorWorkspace.canAct ? (
                          <form action={createInstructorIntervention} className="flex gap-2">
                            <input name="organizationId" type="hidden" value={selectedOrganizationId} />
                            <input name="userId" type="hidden" value={learner.userId} />
                            <input name="programmeId" type="hidden" value={learner.programmeId ?? ""} />
                            <input name="cohortId" type="hidden" value={learner.cohortId ?? ""} />
                            <input name="type" type="hidden" value="overdue" />
                            <input name="severity" type="hidden" value="critical" />
                            <input name="reason" type="hidden" value="Learner is overdue on an assigned item." />
                            <input name="redirectTo" type="hidden" value={currentHref} />
                            <button className={adminButtonClasses("secondary", "min-h-9 px-3 text-xs")} type="submit">
                              Open intervention
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs font-bold text-[var(--ve-muted)]">Read only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </AdminTable>
              )}
            </div>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <div>
              <h2 className="mb-3 text-lg font-black">Mission evidence</h2>
              {instructorWorkspace.missionEvidence.length === 0 ? (
                <EmptyAdminState>No submitted mission evidence in this scope.</EmptyAdminState>
              ) : (
                <div className="space-y-4">
                  {instructorWorkspace.missionEvidence.map((proof) => (
                    <AdminCard key={`${proof.userId}:${proof.missionId}:${proof.awardScope}:${proof.proofType}`}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-black">{proof.missionTitle ?? proof.missionId}</h3>
                            <AdminStatusBadge tone="warning">{proof.status}</AdminStatusBadge>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-[var(--ve-muted-strong)]">
                            {proof.displayName ?? proof.userId}
                          </p>
                          <p className="mt-1 text-xs font-bold text-[var(--ve-muted)]">
                            Submitted {formatRewardDate(proof.createdAt)}
                          </p>
                          <div className="mt-3 rounded-[12px] bg-[var(--ve-panel)] p-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
                              {proof.proofType}
                            </p>
                            <p className="mt-1 break-words text-sm font-bold leading-6">{proof.value}</p>
                          </div>
                        </div>
                        {instructorWorkspace.canAct ? (
                          <div className="grid w-full max-w-sm gap-2 sm:grid-cols-2">
                            <form action={reviewInstructorProofSubmission}>
                              <input name="userId" type="hidden" value={proof.userId} />
                              <input name="missionId" type="hidden" value={proof.missionId} />
                              <input name="awardScope" type="hidden" value={proof.awardScope} />
                              <input name="status" type="hidden" value="approved" />
                              <input name="redirectTo" type="hidden" value={currentHref} />
                              <button className={adminButtonClasses("success", "w-full")} type="submit">
                                Approve
                              </button>
                            </form>
                            <form action={reviewInstructorProofSubmission} className="flex gap-2">
                              <input name="userId" type="hidden" value={proof.userId} />
                              <input name="missionId" type="hidden" value={proof.missionId} />
                              <input name="awardScope" type="hidden" value={proof.awardScope} />
                              <input name="status" type="hidden" value="rejected" />
                              <input name="redirectTo" type="hidden" value={currentHref} />
                              <input
                                className="min-w-0 flex-1 rounded-[12px] border border-[var(--ve-line-soft)] px-3 text-xs font-semibold outline-none"
                                maxLength={500}
                                name="rejectionReason"
                                placeholder="Reason"
                              />
                              <button className={adminButtonClasses("danger", "px-3 text-xs")} type="submit">
                                Reject
                              </button>
                            </form>
                          </div>
                        ) : null}
                      </div>
                    </AdminCard>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black">Open interventions</h2>
                <Link className={adminButtonClasses("secondary", "min-h-9 px-3 text-xs")} href="/admin/interventions">
                  Full queue
                </Link>
              </div>
              {instructorWorkspace.openInterventions.length === 0 ? (
                <EmptyAdminState>No open interventions in this scope.</EmptyAdminState>
              ) : (
                <div className="space-y-4">
                  {instructorWorkspace.openInterventions.map((intervention) => (
                    <AdminCard key={intervention.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-black">{intervention.displayName ?? intervention.userId}</p>
                          <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                            {intervention.programmeTitle ?? intervention.programmeId}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <AdminStatusBadge tone={severityTone(intervention.severity)}>{intervention.severity}</AdminStatusBadge>
                          <AdminStatusBadge tone={statusTone(intervention.status)}>{intervention.status}</AdminStatusBadge>
                        </div>
                      </div>
                      <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">{intervention.reason}</p>
                      <p className="mt-2 text-xs font-bold text-[var(--ve-muted)]">
                        Triggered {formatRewardDate(intervention.triggeredAt)}
                      </p>
                      {instructorWorkspace.canAct ? (
                        <form action={updateInstructorInterventionStatus} className="mt-4 flex flex-wrap gap-2">
                          <input name="interventionId" type="hidden" value={intervention.id} />
                          <input name="redirectTo" type="hidden" value={currentHref} />
                          <input
                            className="h-10 min-w-[160px] rounded-[10px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 text-xs font-semibold outline-none focus:border-[var(--ve-green)]"
                            name="note"
                            placeholder="Internal note"
                          />
                          <button className={adminButtonClasses("secondary", "px-3 text-xs")} name="status" type="submit" value="acknowledged">
                            Acknowledge
                          </button>
                          <button className={adminButtonClasses("success", "px-3 text-xs")} name="status" type="submit" value="resolved">
                            Resolve
                          </button>
                          <button className={adminButtonClasses("danger", "px-3 text-xs")} name="status" type="submit" value="dismissed">
                            Dismiss
                          </button>
                        </form>
                      ) : null}
                    </AdminCard>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
