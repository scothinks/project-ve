import Link from "next/link";
import {
  AdminNoticeBanner,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTable,
  EmptyAdminState,
  adminButtonClasses,
} from "@/components/admin/AdminPrimitives";
import { getAdminCohorts, requireAdmin } from "@/lib/admin";
import { formatRewardDate } from "@/lib/rewards";

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statusTone(status: string) {
  if (status === "published") return "good" as const;
  if (status === "archived") return "danger" as const;
  return "warning" as const;
}

export default async function AdminCohortsPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string | string[] }>;
}) {
  const { supabase } = await requireAdmin();
  const cohorts = await getAdminCohorts(supabase);
  const notice = firstSearchValue((await searchParams)?.notice);

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="Cohorts"
        title="Cohorts"
        subtitle="Manage organisation learner groups, bulk rosters, course assignments, programme assignments and enrolment state."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <div className="mb-4 flex justify-end">
        <Link className={adminButtonClasses("primary")} href="/admin/cohorts/new">
          Add cohort
        </Link>
      </div>
      {cohorts.length === 0 ? (
        <EmptyAdminState>No cohorts found.</EmptyAdminState>
      ) : (
        <AdminTable columns={["Cohort", "Organisation", "Members", "Assignments", "Status", "Updated", "Action"]}>
          {cohorts.map((cohort) => (
            <tr key={cohort.id}>
              <td className="min-w-[260px] px-4 py-4">
                <Link className="font-black hover:text-[var(--ve-green)]" href={`/admin/cohorts/${cohort.id}`}>
                  {cohort.title}
                </Link>
                <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{cohort.slug}</p>
                <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-[var(--ve-muted-strong)]">
                  {cohort.description || "No description set."}
                </p>
              </td>
              <td className="whitespace-nowrap px-4 py-4 font-bold">
                {cohort.organization?.name ?? cohort.organization_id}
              </td>
              <td className="whitespace-nowrap px-4 py-4 font-bold tabular-nums">
                {cohort.active_member_count ?? 0}
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-sm font-bold">
                {cohort.course_assignment_count ?? 0} courses · {cohort.programme_assignment_count ?? 0} programmes
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                <AdminStatusBadge tone={statusTone(cohort.status)}>{cohort.status}</AdminStatusBadge>
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-sm font-bold">
                {formatRewardDate(cohort.updated_at)}
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                <Link className={adminButtonClasses("secondary", "px-3 text-xs")} href={`/admin/cohorts/${cohort.id}`}>
                  Manage
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </>
  );
}
