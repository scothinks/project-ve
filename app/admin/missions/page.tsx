import Link from "next/link";
import {
  AdminNoticeBanner,
  AdminPagination,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTable,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import { setMissionStatus } from "@/app/admin/missions/actions";
import { getAdminMissions, requireAdmin } from "@/lib/admin";
import { getMissionRewardLabel } from "@/lib/missions";
import { paginateItems, parsePageParam } from "@/lib/pagination";

function statusTone(status: string) {
  if (status === "published") return "good" as const;
  if (status === "draft") return "warning" as const;
  return "neutral" as const;
}

function validationLabel(validationType: string) {
  switch (validationType) {
    case "lesson_completed":
      return "Lesson completed";
    case "course_completed":
      return "Course completed";
    case "lesson_count_completed":
      return "Lesson count";
    case "referral_friend_completed_lessons":
      return "Referral lessons";
    case "proof_upload":
      return "Proof upload";
    case "manual_review":
      return "Manual review";
    default:
      return validationType.replaceAll("_", " ");
  }
}

export default async function AdminMissionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; notice?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const missions = await getAdminMissions(supabase);
  const { page, notice } = (await searchParams) ?? {};
  const paginatedMissions = paginateItems(missions, parsePageParam(page), 20);

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="Missions"
        title="Missions"
        subtitle="Configure mission rules, reward payouts, and publishing using the current mission validation model."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <div className="mb-4 flex justify-end">
        <Link
          className="rounded-[14px] bg-[var(--ve-mission)] px-4 py-3 text-sm font-black text-white"
          href="/admin/missions/new"
        >
          Add Mission
        </Link>
      </div>
      {missions.length === 0 ? (
        <EmptyAdminState>No missions found.</EmptyAdminState>
      ) : (
        <>
        <AdminTable columns={["Mission", "Reward", "Category", "Repeatability", "Validation", "Status", "Action"]}>
          {paginatedMissions.items.map((mission) => (
            <tr key={mission.id}>
              <td className="min-w-[240px] px-4 py-4">
                <Link className="font-black hover:text-[var(--ve-mission)]" href={`/admin/missions/${mission.id}`}>
                  {mission.title}
                </Link>
                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  {mission.description}
                </p>
              </td>
              <td className="whitespace-nowrap px-4 py-4 font-black tabular-nums">
                {getMissionRewardLabel({
                  rewardType: mission.reward_type,
                  rewardXp: mission.reward_xp,
                  rewardTitle: mission.reward?.title ?? null,
                })}
              </td>
              <td className="whitespace-nowrap px-4 py-4 capitalize">{mission.category}</td>
              <td className="whitespace-nowrap px-4 py-4 capitalize">{mission.repeatability}</td>
              <td className="whitespace-nowrap px-4 py-4">
                {validationLabel(mission.validation_type)}
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                <AdminStatusBadge tone={statusTone(mission.status)}>
                  {mission.status}
                </AdminStatusBadge>
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="rounded-[12px] bg-[var(--ve-panel)] px-3 py-2 text-xs font-black text-[var(--ve-muted-strong)]"
                    href={`/admin/missions/${mission.id}`}
                  >
                    Edit
                  </Link>
                  <form action={setMissionStatus}>
                    <input name="missionId" type="hidden" value={mission.id} />
                    <input name="redirectTo" type="hidden" value="/admin/missions" />
                    <input
                      name="status"
                      type="hidden"
                      value={mission.status === "published" ? "draft" : "published"}
                    />
                    <button
                      className={
                        mission.status === "published"
                          ? "rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] px-3 py-2 text-xs font-black text-[var(--ve-danger)]"
                          : "rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_78%,var(--ve-card))] px-3 py-2 text-xs font-black text-[var(--ve-green)]"
                      }
                      type="submit"
                    >
                      {mission.status === "published" ? "Pause" : "Publish"}
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
        <AdminPagination
          basePath="/admin/missions"
          currentPage={paginatedMissions.currentPage}
          summary={`Showing ${paginatedMissions.startItem}-${paginatedMissions.endItem} of ${paginatedMissions.totalItems} missions`}
          totalPages={paginatedMissions.totalPages}
        />
        </>
      )}
    </>
  );
}
