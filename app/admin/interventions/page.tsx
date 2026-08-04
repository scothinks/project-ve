import {
  AdminCard,
  AdminNoticeBanner,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTable,
  EmptyAdminState,
  adminButtonClasses,
} from "@/components/admin/AdminPrimitives";
import { updateLmsInterventionStatus } from "@/app/admin/interventions/actions";
import {
  getAdminLmsInterventions,
  getAdminOrganizations,
  getAdminProgrammes,
  requireAdmin,
  type AdminLmsInterventionStatus,
} from "@/lib/admin";
import { formatRewardDate } from "@/lib/rewards";

type InterventionSearchParams = {
  notice?: string | string[];
  organizationId?: string | string[];
  programmeId?: string | string[];
  status?: string | string[];
};

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function selectedOrEmpty(value: string | undefined) {
  return value && value !== "all" ? value : "";
}

function selectedStatus(value: string | undefined): AdminLmsInterventionStatus {
  if (value === "acknowledged" || value === "resolved" || value === "dismissed") {
    return value;
  }

  return "open";
}

function severityTone(severity: string) {
  if (severity === "critical") return "danger" as const;
  if (severity === "warning") return "warning" as const;
  return "neutral" as const;
}

function statusTone(status: string) {
  if (status === "resolved") return "good" as const;
  if (status === "dismissed") return "danger" as const;
  if (status === "acknowledged") return "warning" as const;
  return "neutral" as const;
}

function interventionLabel(type: string) {
  if (type === "upcoming_due") return "Upcoming due";
  if (type === "overdue") return "Overdue";
  return "Inactive";
}

function appendNoticeHref(params: URLSearchParams) {
  const query = params.toString();
  return `/admin/interventions${query ? `?${query}` : ""}`;
}

export default async function AdminLmsInterventionsPage({
  searchParams,
}: {
  searchParams?: Promise<InterventionSearchParams>;
}) {
  const { supabase } = await requireAdmin();
  const params = (await searchParams) ?? {};
  const selectedOrganizationId = selectedOrEmpty(firstSearchValue(params.organizationId));
  const selectedProgrammeId = selectedOrEmpty(firstSearchValue(params.programmeId));
  const status = selectedStatus(firstSearchValue(params.status));
  const notice = firstSearchValue(params.notice);
  const [organizations, programmes] = await Promise.all([
    getAdminOrganizations(supabase),
    getAdminProgrammes(supabase),
  ]);
  const filteredProgrammes = selectedOrganizationId
    ? programmes.filter((programme) => programme.organization_id === selectedOrganizationId)
    : programmes;
  const interventions = await getAdminLmsInterventions(supabase, {
    limit: 100,
    organizationId: selectedOrganizationId || null,
    programmeId: selectedProgrammeId || null,
    status,
  });
  const redirectParams = new URLSearchParams();

  if (selectedOrganizationId) redirectParams.set("organizationId", selectedOrganizationId);
  if (selectedProgrammeId) redirectParams.set("programmeId", selectedProgrammeId);
  redirectParams.set("status", status);

  const redirectTo = appendNoticeHref(redirectParams);

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="Interventions"
        title="Programme intervention queue"
        subtitle="Review LMS due-date and inactivity signals generated from programme enrolments, completion state and learner activity."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}

      <AdminCard className="mb-5">
        <form className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <label>
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
              Organisation
            </span>
            <select
              className="mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--ve-green)]"
              defaultValue={selectedOrganizationId || "all"}
              name="organizationId"
            >
              <option value="all">All organisations</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
              Programme
            </span>
            <select
              className="mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--ve-green)]"
              defaultValue={selectedProgrammeId || "all"}
              name="programmeId"
            >
              <option value="all">All programmes</option>
              {filteredProgrammes.map((programme) => (
                <option key={programme.id} value={programme.id}>
                  {programme.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
              Status
            </span>
            <select
              className="mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--ve-green)]"
              defaultValue={status}
              name="status"
            >
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </label>
          <div className="flex items-end">
            <button className={adminButtonClasses("primary", "w-full")} type="submit">
              Apply
            </button>
          </div>
        </form>
      </AdminCard>

      {interventions.length === 0 ? (
        <EmptyAdminState>No intervention rows match these filters.</EmptyAdminState>
      ) : (
        <AdminTable columns={["Learner", "Programme", "Signal", "Timing", "Status", "Action"]}>
          {interventions.map((intervention) => (
            <tr key={intervention.id}>
              <td className="min-w-[230px] px-4 py-4">
                <p className="font-black">{intervention.displayName ?? "Unnamed learner"}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{intervention.userId}</p>
                {intervention.cohortTitle ? (
                  <p className="mt-2 text-xs font-bold text-[var(--ve-muted-strong)]">{intervention.cohortTitle}</p>
                ) : null}
              </td>
              <td className="min-w-[220px] px-4 py-4">
                <p className="font-black">{intervention.programmeTitle ?? intervention.programmeId}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                  {intervention.organizationName ?? intervention.organizationId}
                </p>
              </td>
              <td className="min-w-[220px] px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  <AdminStatusBadge tone={severityTone(intervention.severity)}>
                    {intervention.severity}
                  </AdminStatusBadge>
                  <AdminStatusBadge tone="neutral">
                    {interventionLabel(intervention.type)}
                  </AdminStatusBadge>
                </div>
                <p className="mt-2 text-sm font-semibold text-[var(--ve-muted-strong)]">{intervention.reason}</p>
              </td>
              <td className="min-w-[190px] px-4 py-4 text-sm font-bold">
                <p>Triggered {formatRewardDate(intervention.triggeredAt)}</p>
                <p className="mt-1 text-xs text-[var(--ve-muted)]">
                  Due {intervention.dueAt ? formatRewardDate(intervention.dueAt) : "not set"}
                </p>
                <p className="mt-1 text-xs text-[var(--ve-muted)]">
                  Activity {intervention.lastActivityAt ? formatRewardDate(intervention.lastActivityAt) : "none"}
                </p>
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                <AdminStatusBadge tone={statusTone(intervention.status)}>
                  {intervention.status}
                </AdminStatusBadge>
              </td>
              <td className="min-w-[270px] px-4 py-4">
                <form action={updateLmsInterventionStatus} className="flex flex-wrap items-center gap-2">
                  <input name="interventionId" type="hidden" value={intervention.id} />
                  <input name="redirectTo" type="hidden" value={redirectTo} />
                  <input
                    className="h-9 min-w-[150px] rounded-[10px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 text-xs font-semibold outline-none focus:border-[var(--ve-green)]"
                    name="note"
                    placeholder="Internal note"
                    type="text"
                  />
                  {intervention.status !== "acknowledged" ? (
                    <button
                      className={adminButtonClasses("secondary", "px-3 text-xs")}
                      name="status"
                      type="submit"
                      value="acknowledged"
                    >
                      Acknowledge
                    </button>
                  ) : null}
                  {intervention.status !== "resolved" ? (
                    <button
                      className={adminButtonClasses("success", "px-3 text-xs")}
                      name="status"
                      type="submit"
                      value="resolved"
                    >
                      Resolve
                    </button>
                  ) : null}
                  {intervention.status !== "dismissed" ? (
                    <button
                      className={adminButtonClasses("danger", "px-3 text-xs")}
                      name="status"
                      type="submit"
                      value="dismissed"
                    >
                      Dismiss
                    </button>
                  ) : null}
                </form>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </>
  );
}
