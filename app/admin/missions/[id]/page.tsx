import { notFound } from "next/navigation";
import { ContentValueTagEditor } from "@/components/admin/ContentValueTagEditor";
import { MissionEditorForm } from "@/components/admin/MissionEditorForm";
import { AdminCard, AdminNoticeBanner, AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { updateMission, updateOrganizationMission } from "@/app/admin/missions/actions";
import {
  getAdminContentValueTags,
  getAdminCourses,
  getAdminLessons,
  getAdminMission,
  getAdminMissionRewardCandidates,
  getAdminValueDimensions,
  requireAdminWorkspaceRole,
} from "@/lib/admin";

const MISSION_MANAGER_ROLES = [
  "platform_admin",
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
  "content_editor",
];

function toDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function JsonPreview({ value }: { value: Record<string, unknown> }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-[14px] bg-[var(--ve-panel)] p-4 text-xs font-semibold leading-5 text-[var(--ve-muted-strong)]">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default async function AdminMissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const { notice } = (await searchParams) ?? {};
  const { supabase, workspace } = await requireAdminWorkspaceRole(MISSION_MANAGER_ROLES);
  const mission = await getAdminMission(supabase, id);

  if (!mission) {
    notFound();
  }

  if (
    workspace.type === "organization"
    && mission.catalog_scope !== "platform"
    && mission.organization_id !== workspace.id
  ) {
    notFound();
  }

  const canEditPlatformMission =
    workspace.type === "platform" || workspace.roles.includes("platform_admin");

  if (mission.catalog_scope === "platform" && !canEditPlatformMission) {
    return (
      <>
        <AdminPageHeader
          backHref="/admin/missions"
          backLabel="Missions"
          eyebrow="Missions"
          title={mission.title}
          subtitle={
            mission.catalog_scope === "platform"
              ? "Review the canonical platform mission. Adapt it from an organisation workspace to localise delivery."
              : "Review organisation mission configuration. Publishing stays in the missions overview."
          }
        />
        {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
        <div className="space-y-5">
          <AdminCard>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                  {mission.catalog_scope === "platform" ? "Platform mission" : "Organisation mission"}
                </p>
                <h2 className="mt-2 text-xl font-black">{mission.title}</h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                  {mission.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <AdminStatusBadge tone={mission.status === "published" ? "good" : "warning"}>
                  {mission.status}
                </AdminStatusBadge>
                <AdminStatusBadge tone={mission.catalog_scope === "platform" ? "neutral" : "store"}>
                  {mission.catalog_scope.replaceAll("_", " ")}
                </AdminStatusBadge>
              </div>
            </div>
            <dl className="mt-5 grid gap-4 text-sm md:grid-cols-3">
              <div>
                <dt className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Mission type</dt>
                <dd className="mt-1 font-black">{mission.mission_type_key}</dd>
              </div>
              <div>
                <dt className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Reward mode</dt>
                <dd className="mt-1 font-black">{mission.reward_mode.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">Source</dt>
                <dd className="mt-1 font-black">{mission.source_mission_id ?? "Organisation private"}</dd>
              </div>
            </dl>
          </AdminCard>

          <AdminCard>
            <h2 className="text-base font-black">Presentation configuration</h2>
            <JsonPreview value={mission.presentation_config ?? {}} />
          </AdminCard>

          <AdminCard>
            <h2 className="text-base font-black">Execution configuration</h2>
            <JsonPreview value={mission.validation_config ?? {}} />
          </AdminCard>
        </div>
      </>
    );
  }

  if (mission.catalog_scope !== "platform") {
    const [courses, lessons] = await Promise.all([
      getAdminCourses(supabase),
      getAdminLessons(supabase),
    ]);
    const executionLocked = mission.catalog_scope === "adapted_platform";

    return (
      <>
        <AdminPageHeader
          backHref="/admin/missions"
          backLabel="Missions"
          eyebrow="Organisation missions"
          title={mission.title}
          subtitle={
            executionLocked
              ? "Edit local wording and learner presentation while preserving the adapted platform mission handler."
              : "Edit the organisation-private mission rule, point amount and learner presentation."
          }
        />
        {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
        <div className="space-y-5">
          <AdminCard>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                  {executionLocked ? "Adapted platform mission" : "Organisation-private mission"}
                </p>
                <h2 className="mt-2 text-xl font-black">{mission.title}</h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                  {executionLocked
                    ? "Source handler configuration is locked to preserve platform provenance. Programme delivery can still override dates, required state and points."
                    : "Changes are scoped to this organisation and validated by the organisation mission RPC."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <AdminStatusBadge tone={mission.status === "published" ? "good" : "warning"}>
                  {mission.status}
                </AdminStatusBadge>
                <AdminStatusBadge tone="store">
                  {mission.catalog_scope.replaceAll("_", " ")}
                </AdminStatusBadge>
              </div>
            </div>
          </AdminCard>
          <MissionEditorForm
            action={updateOrganizationMission}
            allowRewardSelection={false}
            courses={courses}
            lessons={lessons}
            lockExecutionConfig={executionLocked}
            rewardCandidates={[]}
            mission={{
              id: mission.id,
              title: mission.title,
              description: mission.description,
              category: mission.category as "course" | "referral" | "feedback" | "campaign" | "custom",
              rewardType: "xp",
              rewardXp: mission.reward_xp,
              rewardId: "",
              repeatability: mission.repeatability as "once" | "daily" | "weekly" | "campaign" | "per_referral",
              validationType: mission.validation_type as
                | "course_completed"
                | "lesson_completed"
                | "lesson_count_completed"
                | "referral_friend_completed_lessons"
                | "proof_upload"
                | "manual_review",
              validationConfig: mission.validation_config ?? {},
              startsAt: toDateTimeInput(mission.starts_at),
              endsAt: toDateTimeInput(mission.ends_at),
              sortOrder: mission.sort_order,
              status: mission.status,
              deliveryScope: mission.delivery_scope,
            }}
            mode="edit"
            presentationConfig={mission.presentation_config ?? {}}
            showDeliveryScope
            showPresentationConfig
          />
        </div>
      </>
    );
  }

  const [courses, lessons, rewardCandidates, valueDimensions, valueTags] = await Promise.all([
    getAdminCourses(supabase),
    getAdminLessons(supabase),
    getAdminMissionRewardCandidates(supabase),
    getAdminValueDimensions(supabase),
    getAdminContentValueTags(supabase, "mission", id),
  ]);

  return (
    <>
      <AdminPageHeader
        backHref="/admin/missions"
        backLabel="Missions"
        eyebrow="Missions"
        title={mission.title}
        subtitle="Edit the mission rule and payout settings. Publishing stays in the missions overview."
      />
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <ContentValueTagEditor
        contentId={mission.id}
        contentType="mission"
        dimensions={valueDimensions}
        redirectTo={`/admin/missions/${mission.id}`}
        tags={valueTags}
      />
      <MissionEditorForm
        action={updateMission}
        courses={courses}
        lessons={lessons}
        rewardCandidates={rewardCandidates}
        mission={{
          id: mission.id,
          title: mission.title,
          description: mission.description,
          category: mission.category as "course" | "referral" | "feedback" | "campaign" | "custom",
          rewardType: mission.reward_type,
          rewardXp: mission.reward_xp,
          rewardId: mission.reward_id ?? "",
          repeatability: mission.repeatability as "once" | "daily" | "weekly" | "campaign" | "per_referral",
          validationType: mission.validation_type as
            | "course_completed"
            | "lesson_completed"
            | "lesson_count_completed"
            | "referral_friend_completed_lessons"
            | "proof_upload"
            | "manual_review",
          validationConfig: mission.validation_config ?? {},
          startsAt: toDateTimeInput(mission.starts_at),
          endsAt: toDateTimeInput(mission.ends_at),
          sortOrder: mission.sort_order,
          status: mission.status,
        }}
        mode="edit"
      />
    </>
  );
}
