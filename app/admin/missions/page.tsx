import { EconomyPageHeader as AdminPageHeader } from "@/components/admin/economy/EconomyPrimitives";
import { EconomyCard } from "@/components/admin/economy/EconomyPrimitives";
import { availabilityLabel, missionRule, repeatabilityLabel } from "@/features/reward-economy/vocabulary";
import Link from "next/link";
import {
  AdminNoticeBanner,
  AdminPagination,
  AdminStatusBadge,
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
        backHref="/admin/economy"
        backLabel="Reward economy"
        eyebrow="Missions"
        title="Missions"
        subtitle="Turn learning into action. Set a task, choose what learners earn, and publish when ready."
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
        <div className="grid gap-4 xl:grid-cols-2">
          {paginatedMissions.items.map((mission) => <EconomyCard key={mission.id} title={mission.title} href={`/admin/missions/${mission.id}`} eyebrow={<><AdminStatusBadge tone={statusTone(mission.status)}>{mission.status}</AdminStatusBadge><span>{mission.catalog_scope === "platform" ? "Platform catalogue" : "Organisation"} · {mission.category}</span></>} actions={<div className="flex flex-wrap gap-2">
                  <Link
                    className="rounded-[12px] bg-[var(--ui-surface-inset)] px-3 py-2 text-xs font-black text-[var(--ui-text-muted)]"
                    href={`/admin/missions/${mission.id}`}
                  >
                    {mission.catalog_scope === "platform" && canManagePlatformMissions ? "Edit" : "View"}
                  </Link>
                  {isOrganizationWorkspace && mission.catalog_scope === "platform" ? (
                    <Link
                      className="rounded-[12px] bg-[var(--ui-surface-inset)] px-3 py-2 text-xs font-black text-[var(--ui-text-muted)]"
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
                            ? "rounded-[12px] bg-[color:color-mix(in_srgb,var(--ui-danger-bg)_74%,var(--ui-surface))] px-3 py-2 text-xs font-black text-[var(--ui-danger)]"
                            : "rounded-[12px] bg-[color:color-mix(in_srgb,var(--ui-action-soft)_78%,var(--ui-surface))] px-3 py-2 text-xs font-black text-[var(--ui-action)]"
                        }
                        type="submit"
                      >
                        {mission.status === "published" ? "Pause" : "Publish"}
                      </button>
                    </form>
                  ) : null}
                </div>}>
            <p className="font-semibold text-[var(--ui-text)]">{missionRule(mission.validation_type, mission.validation_config)}</p>
            <p>{mission.description}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1"><span>{getMissionRewardLabel({ rewardType: mission.reward_type, rewardXp: mission.reward_xp, rewardTitle: mission.reward?.title ?? null })}</span><span>{repeatabilityLabel(mission.repeatability)}</span></div>
            <p>{availabilityLabel(mission.starts_at, mission.ends_at)}</p>
            {mission.source_mission_id ? <p><Link className="underline" href={`/admin/missions/${mission.source_mission_id}`}>Adapted from a platform mission</Link>{Object.keys(mission.local_changes ?? {}).length > 0 ? " · Local changes" : ""}</p> : null}
            {mission.upstream_update_available ? <p className="font-semibold text-[var(--ui-reward)]">Source update available</p> : null}
          </EconomyCard>)}
        </div>
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
