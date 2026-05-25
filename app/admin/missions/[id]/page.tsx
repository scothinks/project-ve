import { notFound } from "next/navigation";
import { ContentValueTagEditor } from "@/components/admin/ContentValueTagEditor";
import { MissionEditorForm } from "@/components/admin/MissionEditorForm";
import { AdminNoticeBanner, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { updateMission } from "@/app/admin/missions/actions";
import {
  getAdminContentValueTags,
  getAdminCourses,
  getAdminLessons,
  getAdminMission,
  getAdminMissionRewardCandidates,
  getAdminValueDimensions,
  requireAdmin,
} from "@/lib/admin";

function toDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
  const { supabase } = await requireAdmin();
  const [mission, courses, lessons, rewardCandidates, valueDimensions, valueTags] = await Promise.all([
    getAdminMission(supabase, id),
    getAdminCourses(supabase),
    getAdminLessons(supabase),
    getAdminMissionRewardCandidates(supabase),
    getAdminValueDimensions(supabase),
    getAdminContentValueTags(supabase, "mission", id),
  ]);

  if (!mission) {
    notFound();
  }

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
