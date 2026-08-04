import Link from "next/link";
import {
  AdminNoticeBanner,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTable,
  EmptyAdminState,
  adminButtonClasses,
} from "@/components/admin/AdminPrimitives";
import { setProgrammeStatus } from "@/app/admin/programmes/actions";
import { getAdminProgrammes, requireAdmin } from "@/lib/admin";
import { formatRewardDate } from "@/lib/rewards";

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statusTone(status: string) {
  if (status === "published") return "good" as const;
  if (status === "archived") return "danger" as const;
  return "warning" as const;
}

export default async function AdminProgrammesPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string | string[] }>;
}) {
  const { supabase } = await requireAdmin();
  const programmes = await getAdminProgrammes(supabase);
  const params = (await searchParams) ?? {};
  const notice = firstSearchValue(params.notice);

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="Programmes"
        title="Programmes"
        subtitle="Build organisation operating containers that sequence courses and attach missions, rewards, assessments, schedules and completion rules."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <div className="mb-4 flex justify-end">
        <Link className={adminButtonClasses("primary")} href="/admin/programmes/new">
          Add programme
        </Link>
      </div>
      {programmes.length === 0 ? (
        <EmptyAdminState>No programmes found.</EmptyAdminState>
      ) : (
        <AdminTable columns={["Programme", "Organisation", "Content", "Status", "Updated", "Action"]}>
          {programmes.map((programme) => {
            const nextStatus = programme.status === "published" ? "draft" : "published";

            return (
              <tr key={programme.id}>
                <td className="min-w-[260px] px-4 py-4">
                  <Link className="font-black hover:text-[var(--ve-green)]" href={`/admin/programmes/${programme.id}`}>
                    {programme.title}
                  </Link>
                  <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">{programme.slug}</p>
                  <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-[var(--ve-muted-strong)]">
                    {programme.objective || "No objective set."}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-4 font-bold">
                  {programme.organization?.name ?? programme.organization_id}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm font-bold">
                  {programme.course_count ?? 0} courses · {programme.mission_count ?? 0} missions · {programme.reward_count ?? 0} rewards
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <AdminStatusBadge tone={statusTone(programme.status)}>
                    {programme.status}
                  </AdminStatusBadge>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm font-bold">
                  {formatRewardDate(programme.updated_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Link className={adminButtonClasses("secondary", "px-3 text-xs")} href={`/admin/programmes/${programme.id}`}>
                      Edit
                    </Link>
                    <form action={setProgrammeStatus}>
                      <input name="programmeId" type="hidden" value={programme.id} />
                      <input name="redirectTo" type="hidden" value="/admin/programmes" />
                      <input name="status" type="hidden" value={nextStatus} />
                      <button
                        className={adminButtonClasses(nextStatus === "published" ? "success" : "danger", "px-3 text-xs")}
                        type="submit"
                      >
                        {nextStatus === "published" ? "Publish" : "Move to draft"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            );
          })}
        </AdminTable>
      )}
    </>
  );
}
