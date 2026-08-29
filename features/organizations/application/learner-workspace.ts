import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserProfile } from "@/lib/supabase-server";
import { measureAsync } from "@/lib/performance";
import {
  parseOrganizationLearnerWorkspaceContext,
  type OrganizationLearningDeliveryContext,
  type OrganizationLearnerWorkspaceContext,
  type PublicLearnerWorkspaceContext,
} from "@/features/organizations/application/learner-workspace-context";
import { getLearningCoursesByIds } from "@/lib/supabase-learning";
import {
  getLearningCourseCardsByIds,
} from "@/features/learning/data/course-card-data";
import type { LearningCourseCard } from "@/features/learning/application/course-card-model";
import {
  getSupabaseMissionSummaries,
  type MissionDeliveryRequest,
  type MissionPresentationOverride,
} from "@/lib/supabase-missions";
import { getOrganizationRewardStoreSnapshot } from "@/lib/supabase-rewards";
export { filterTranscriptForOrganizationWorkspace } from "@/features/organizations/application/learner-workspace-domain";
import type { Course } from "@/lib/lessons";
import type { UserMissionSummary } from "@/lib/missions";
import type { LessonProgressRecord } from "@/lib/progress";
import type { RewardStoreSnapshot } from "@/lib/rewards";
import type { Database } from "@/types/database";

export type {
  LearnerWorkspaceAccessSource,
  LearnerWorkspaceContext,
  OrganizationCourseDeliveryOption,
  OrganizationLearningDeliveryContext,
  OrganizationLearnerWorkspaceContext,
  PublicLearnerWorkspaceContext,
} from "@/features/organizations/application/learner-workspace-context";

type ProgrammeLessonPageCompletionRow = {
  completed_at: string;
  lesson_id: string;
  page_id: string;
};

type OrganizationProgressCourse = {
  id: string;
  lessons: ReadonlyArray<{
    id: string;
    pages: ReadonlyArray<{ id: string }>;
  }>;
};

async function getProgrammeMissionDeliveryRequests(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  organizationSlug: string,
  programmeIds: string[],
) {
  if (programmeIds.length === 0) return [];

  const { data, error } = await supabase
    .from("programme_missions")
    .select(
      "mission_id, programme_id, starts_at, due_at, is_required, xp_account_id, reward_xp_override, presentation_overrides",
    )
    .in("programme_id", programmeIds)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row): MissionDeliveryRequest => {
    const config =
      row.presentation_overrides
      && typeof row.presentation_overrides === "object"
      && !Array.isArray(row.presentation_overrides)
        ? row.presentation_overrides as Record<string, unknown>
        : {};
    const presentationOverride = Object.fromEntries(
      [
        "ctaLabel",
        "description",
        "eligibilityExplanation",
        "fullInstructions",
        "icon",
        "imageUrl",
        "pendingMessage",
        "rejectionMessage",
        "rewardExplanation",
        "shortDescription",
        "successMessage",
        "terms",
        "title",
      ].flatMap((key) => {
        const value = config[key];
        return typeof value === "string" && value.trim() ? [[key, value.trim()]] : [];
      }),
    ) as MissionPresentationOverride;

    return {
      deliveryId: `${row.programme_id}:${row.mission_id}`,
      missionId: row.mission_id,
      presentationOverride,
      executionContext: {
        deliveryId: `${row.programme_id}:${row.mission_id}`,
        organizationId,
        organizationSlug,
        programmeId: row.programme_id,
        programmeMissionId: row.mission_id,
        startsAt: row.starts_at,
        dueAt: row.due_at,
        isRequired: row.is_required,
        xpAccountId: row.xp_account_id,
        rewardXpOverride: row.reward_xp_override,
      },
    };
  });
}

async function getOrganizationMissionDeliveryRequests(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  organizationSlug: string,
  roles: Database["public"]["Enums"]["organization_role_key"][],
) {
  if (roles.length === 0) return [];

  const { data, error } = await supabase
    .from("missions")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("delivery_scope", "organization")
    .eq("status", "published")
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row): MissionDeliveryRequest => ({
    deliveryId: `${organizationId}:${row.id}`,
    missionId: row.id,
    executionContext: {
      deliveryId: `${organizationId}:${row.id}`,
      organizationId,
      organizationSlug,
      programmeId: null,
      programmeMissionId: null,
      startsAt: null,
      dueAt: null,
      isRequired: false,
      xpAccountId: null,
      rewardXpOverride: null,
    },
  }));
}

export function getPublicLearnerWorkspace(profile: UserProfile | null): PublicLearnerWorkspaceContext {
  return {
    accessSource: "public",
    branding: {
      accentToken: "green",
      logoUrl: null,
      name: "Project Ve",
      shortName: "Project Ve",
    },
    membershipRoles: [],
    organizationId: null,
    organizationSlug: null,
    programmeIds: [],
    type: "public",
    xpAccount: {
      balance: profile?.xp_balance_cached ?? 0,
      label: "Project Ve XP",
      type: "project_ve",
    },
  };
}

export async function resolveOrganizationLearnerWorkspace(
  supabase: SupabaseClient<Database>,
  organizationSlug: string,
): Promise<OrganizationLearnerWorkspaceContext | null> {
  const { data, error } = await measureAsync("org.workspace.context_rpc", () =>
    supabase.rpc("get_organization_learner_workspace_context", {
      p_organization_slug: organizationSlug,
    }),
  );

  if (error) throw error;
  return parseOrganizationLearnerWorkspaceContext(data);
}

export async function getOrganizationWorkspaceCourseCards(
  supabase: SupabaseClient<Database>,
  workspace: OrganizationLearnerWorkspaceContext,
): Promise<LearningCourseCard[]> {
  return getLearningCourseCardsByIds(supabase, workspace.courseIds);
}

export async function getOrganizationWorkspaceCourse(
  supabase: SupabaseClient<Database>,
  workspace: OrganizationLearnerWorkspaceContext,
  courseId: string,
): Promise<Course | null> {
  if (!workspace.courseIds.includes(courseId)) {
    return null;
  }

  const courses = await getLearningCoursesByIds(supabase, [courseId]);
  return courses[0] ?? null;
}

export function getOrganizationCourseDeliveryContext(
  workspace: OrganizationLearnerWorkspaceContext,
  courseId: string,
  requestedProgrammeId?: string | null,
): OrganizationLearningDeliveryContext | null {
  const options = workspace.courseDeliveryOptions[courseId] ?? [];
  if (requestedProgrammeId) {
    return options.find((option) => option.programmeId === requestedProgrammeId) ?? null;
  }
  return options.length === 1 ? options[0] : null;
}

export function appendOrganizationDeliverySearchParam(
  href: string,
  deliveryContext: OrganizationLearningDeliveryContext,
) {
  if (!deliveryContext.programmeId) return href;
  const [path, query = ""] = href.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("programmeId", deliveryContext.programmeId);
  return `${path}?${params.toString()}`;
}

export function getOrganizationDeliveryKey(
  courseId: string,
  deliveryContext: Pick<OrganizationLearningDeliveryContext, "programmeId"> | null,
) {
  return `${courseId}:${deliveryContext?.programmeId ?? "organization"}`;
}

async function deliveryRequiresContextualCompletion(
  supabase: SupabaseClient<Database>,
  courseId: string,
  deliveryContext: OrganizationLearningDeliveryContext,
) {
  if (!deliveryContext.programmeId) {
    return false;
  }

  const { data, error } = await supabase
    .from("programme_courses")
    .select("prior_completion_policy")
    .eq("programme_id", deliveryContext.programmeId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (error) throw error;
  return data?.prior_completion_policy === "require_completion_in_context";
}

async function getContextualProgrammeLessonProgress({
  course,
  deliveryContext,
  supabase,
  userId,
}: {
  course: OrganizationProgressCourse;
  deliveryContext: OrganizationLearningDeliveryContext;
  supabase: SupabaseClient<Database>;
  userId: string;
}): Promise<LessonProgressRecord[]> {
  if (!deliveryContext.programmeId) {
    return [];
  }

  const lessonIds = course.lessons.map((lesson) => lesson.id);
  if (lessonIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("programme_lesson_page_completions")
    .select("lesson_id, page_id, completed_at")
    .eq("user_id", userId)
    .eq("programme_id", deliveryContext.programmeId)
    .in("lesson_id", lessonIds);

  if (error) throw error;

  const completionsByLessonId = new Map<string, ProgrammeLessonPageCompletionRow[]>();
  for (const row of (data ?? []) as ProgrammeLessonPageCompletionRow[]) {
    const rows = completionsByLessonId.get(row.lesson_id) ?? [];
    rows.push(row);
    completionsByLessonId.set(row.lesson_id, rows);
  }

  return course.lessons.flatMap((lesson) => {
    const rows = completionsByLessonId.get(lesson.id) ?? [];
    if (rows.length === 0) {
      return [];
    }

    const completedPages = Array.from(new Set(rows.map((row) => row.page_id)));
    const completedPageSet = new Set(completedPages);
    const requiredPageIds = lesson.pages.map((page) => page.id);
    const latestCompletion = rows
      .map((row) => row.completed_at)
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
    const lessonCompleted =
      requiredPageIds.length > 0 && requiredPageIds.every((pageId) => completedPageSet.has(pageId));

    return [{
      lesson_id: lesson.id,
      completed_pages: completedPages,
      completed_modules: completedPages,
      quiz_score: null,
      completed_at: lessonCompleted ? latestCompletion : null,
      updated_at: latestCompletion,
    }];
  });
}

export async function getOrganizationDeliveryLessonProgress({
  course,
  deliveryContext,
  fallbackProgress,
  supabase,
  userId,
}: {
  course: OrganizationProgressCourse;
  deliveryContext: OrganizationLearningDeliveryContext;
  fallbackProgress: LessonProgressRecord[];
  supabase: SupabaseClient<Database>;
  userId: string;
}): Promise<LessonProgressRecord[]> {
  const requiresContextualCompletion = await deliveryRequiresContextualCompletion(
    supabase,
    course.id,
    deliveryContext,
  );

  if (!requiresContextualCompletion) {
    return fallbackProgress;
  }

  return getContextualProgrammeLessonProgress({
    course,
    deliveryContext,
    supabase,
    userId,
  });
}

export async function getOrganizationWorkspaceMissions({
  origin,
  profile,
  supabase,
  workspace,
}: {
  origin: string;
  profile: UserProfile | null;
  supabase: SupabaseClient<Database>;
  workspace: OrganizationLearnerWorkspaceContext;
}): Promise<UserMissionSummary[]> {
  if (!profile) return [];

  const [missionDeliveries, organizationMissionDeliveries] = await measureAsync(
    "org.missions.delivery_context_batch",
    () => Promise.all([
      getProgrammeMissionDeliveryRequests(
        supabase,
        workspace.organizationId,
        workspace.organizationSlug,
        workspace.programmeIds,
      ),
      getOrganizationMissionDeliveryRequests(
        supabase,
        workspace.organizationId,
        workspace.organizationSlug,
        workspace.membershipRoles,
      ),
    ]),
  );

  return measureAsync("org.missions.summaries", () =>
    getSupabaseMissionSummaries({
      missionDeliveries: [...organizationMissionDeliveries, ...missionDeliveries],
      origin,
      referralCode: profile.referral_code ?? null,
      supabase,
      userId: profile.id,
    }),
  );
}

export async function getOrganizationWorkspaceRewardSnapshot({
  supabase,
  userId,
  workspace,
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  workspace: OrganizationLearnerWorkspaceContext;
}): Promise<RewardStoreSnapshot> {
  return getOrganizationRewardStoreSnapshot(supabase, userId, workspace.xpAccount.balance, {
    organizationId: workspace.organizationId,
    programmeIds: workspace.programmeIds,
  });
}
