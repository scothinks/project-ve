import { MissionEditorForm } from "@/components/admin/MissionEditorForm";
import { AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { createMission } from "@/app/admin/missions/actions";
import {
  getAdminCourses,
  getAdminLessons,
  getAdminMissionRewardCandidates,
  requireAdminWorkspaceRole,
} from "@/lib/admin";
import { PLATFORM_CATALOG_WORKSPACE_ID } from "@/features/admin/shared/workspace";
import { redirect } from "next/navigation";

const PLATFORM_MISSION_MANAGER_ROLES = [
  "platform_admin",
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
  "content_editor",
];

export default async function AdminNewMissionPage() {
  const { supabase, workspace } = await requireAdminWorkspaceRole(PLATFORM_MISSION_MANAGER_ROLES);

  if (workspace.type !== "platform" && workspace.id !== PLATFORM_CATALOG_WORKSPACE_ID) {
    redirect("/admin/missions");
  }
  const [courses, lessons, rewardCandidates] = await Promise.all([
    getAdminCourses(supabase),
    getAdminLessons(supabase),
    getAdminMissionRewardCandidates(supabase),
  ]);

  return (
    <>
      <AdminPageHeader
        backHref="/admin/missions"
        backLabel="Missions"
        eyebrow="Missions"
        title="Add Mission"
        subtitle="Define the mission, choose the reward payout, and keep it in draft until it is ready to publish."
      />
      <MissionEditorForm
        action={createMission}
        courses={courses}
        lessons={lessons}
        rewardCandidates={rewardCandidates}
        mission={{
          id: "",
          title: "",
          description: "",
          category: "course",
          rewardType: "xp",
          rewardXp: 25,
          rewardId: "",
          repeatability: "once",
          validationType: "lesson_completed",
          validationConfig: {
            lessonId: lessons[0]?.id ?? "",
          },
          startsAt: "",
          endsAt: "",
          sortOrder: 0,
          status: "draft",
        }}
        mode="create"
      />
    </>
  );
}
