import Link from "next/link";
import {
  AdminNoticeBanner,
  AdminPagination,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTable,
  EmptyAdminState,
  adminButtonClasses,
} from "@/components/admin/AdminPrimitives";
import { setMissionStatus } from "@/app/admin/missions/actions";
import { PLATFORM_CATALOG_WORKSPACE_ID } from "@/features/admin/shared/workspace";
import { getAdminMissions, requireAdminWorkspaceRole } from "@/lib/admin";
import { getMissionRewardLabel } from "@/lib/missions";
import { paginateItems, parsePageParam } from "@/lib/pagination";

const MISSION_MANAGER_ROLES = [
  "platform_admin",
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
  "content_editor",
];

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
  const { supabase, workspace } = await requireAdminWorkspaceRole(MISSION_MANAGER_ROLES);
  const missions = await getAdminMissions(supabase);
  const { page, notice } = (await searchParams) ?? {};
  const paginatedMissions = paginateItems(missions, parsePageParam(page), 20);
  const isCatalogWorkspace = workspace.id === PLATFORM_CATALOG_WORKSPACE_ID;
  const isOrganizationWorkspace = workspace.type === "organization" && !isCatalogWorkspace;
  const canManagePlatformMissions =
    workspace.type === "platform"
    || workspace.roles.includes("platform_admin")
    || isCatalogWorkspace;

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
      <div className="mb-4 flex flex-wrap justify-end gap-3">
        {isOrganizationWorkspace ? (
          <Link className={adminButtonClasses("primary")} href="/admin/missions/organization/new">
            Create or adapt mission
          </Link>
        ) : (
          <Link className={adminButtonClasses("primary")} href="/admin/missions/new">
            Add platform mission
          </Link>
        )}
      </div>
      {missions.length === 0 ? (
        <EmptyAdminState>No missions found.</EmptyAdminState>
      ) : (
        <>
        <AdminTable columns={["Mission", "Scope", "Reward", "Category", "Repeatability", "Validation", "Status", "Action"]}>
          {paginatedMissions.items.map((mission) => (
            <tr key={mission.id}>
              <td className="min-w-[240px] px-4 py-4">
                <Link className="font-black hover:text-[var(--ve-mission)]" href={`/admin/missions/${mission.id}`}>
                  {mission.title}
                </Link>
                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                  {mission.description}
                </p>
                {mission.source_mission_id ? (
                  <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                    Adapted from {mission.source_mission_id}
                  </p>
                ) : null}
                {mission.upstream_update_available ? (
                  <p className="mt-1 text-xs font-black text-[color:color-mix(in_srgb,var(--ve-store)_62%,var(--foreground))]">
                    Source update available
                  </p>
                ) : null}
              </td>
              <td className="whitespace-nowrap px-4 py-4">
                <div className="flex flex-col gap-2">
                  <AdminStatusBadge tone={mission.catalog_scope === "platform" ? "neutral" : "store"}>
                    {mission.catalog_scope.replaceAll("_", " ")}
                  </AdminStatusBadge>
                  <span className="text-xs font-semibold text-[var(--ve-muted)]">
                    {mission.mission_type_key}
                  </span>
                </div>
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
                    {mission.catalog_scope === "platform" && canManagePlatformMissions ? "Edit" : "View"}
                  </Link>
                  {isOrganizationWorkspace && mission.catalog_scope === "platform" ? (
                    <Link
                      className="rounded-[12px] bg-[var(--ve-panel)] px-3 py-2 text-xs font-black text-[var(--ve-muted-strong)]"
                      href={`/admin/missions/organization/new?sourceMissionId=${encodeURIComponent(mission.id)}`}
                    >
                      Adapt
                    </Link>
                  ) : null}
                  {mission.catalog_scope !== "platform" || canManagePlatformMissions ? (
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
                  ) : null}
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
