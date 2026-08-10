import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserProfile } from "@/lib/supabase-server";
import { getLearningCourseSummariesByIds, getLearningCoursesByIds } from "@/lib/supabase-learning";
import {
  getSupabaseMissionSummaries,
  type MissionDeliveryRequest,
  type MissionPresentationOverride,
} from "@/lib/supabase-missions";
import { getOrganizationRewardStoreSnapshot } from "@/lib/supabase-rewards";
export { filterTranscriptForOrganizationWorkspace } from "@/features/organizations/application/learner-workspace-domain";
import type { Course } from "@/lib/lessons";
import type { UserMissionSummary } from "@/lib/missions";
import type { RewardStoreSnapshot } from "@/lib/rewards";
import type { Database } from "@/types/database";

type MembershipRow = {
  role: Database["public"]["Enums"]["organization_role_key"];
};

type EnrolmentRow = {
  course_id: string | null;
  programme_id: string | null;
};

export type LearnerWorkspaceAccessSource =
  | "course_enrolment"
  | "membership"
  | "owner"
  | "programme_enrolment";

export type PublicLearnerWorkspaceContext = {
  accessSource: "public";
  branding: {
    accentToken: "green";
    logoUrl: null;
    name: "Project Ve";
    shortName: "Project Ve";
  };
  membershipRoles: [];
  organizationId: null;
  organizationSlug: null;
  programmeIds: [];
  type: "public";
  xpAccount: {
    balance: number;
    label: "Project Ve XP";
    type: "project_ve";
  };
};

export type OrganizationLearnerWorkspaceContext = {
  accessSource: LearnerWorkspaceAccessSource;
  branding: {
    accentToken: Database["public"]["Enums"]["organization_accent_token"];
    logoUrl: string | null;
    name: string;
    shortName: string | null;
  };
  courseIds: string[];
  membershipRoles: Database["public"]["Enums"]["organization_role_key"][];
  missionIds: string[];
  organizationId: string;
  organizationSlug: string;
  programmeIds: string[];
  type: "organization";
  xpAccount: {
    balance: number;
    label: "Organisation points";
    type: "organization";
  };
};

export type LearnerWorkspaceContext =
  | OrganizationLearnerWorkspaceContext
  | PublicLearnerWorkspaceContext;

const OWNER_ROLE = "organisation_owner";

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function getAccessSource({
  programmeIds,
  roles,
}: {
  programmeIds: string[];
  roles: Database["public"]["Enums"]["organization_role_key"][];
}): LearnerWorkspaceAccessSource {
  if (roles.includes(OWNER_ROLE)) return "owner";
  if (roles.length > 0) return "membership";
  if (programmeIds.length > 0) return "programme_enrolment";
  return "course_enrolment";
}

async function getProgrammeCourseIds(
  supabase: SupabaseClient<Database>,
  programmeIds: string[],
) {
  if (programmeIds.length === 0) return [];

  const { data, error } = await supabase
    .from("programme_courses")
    .select("course_id")
    .in("programme_id", programmeIds);

  if (error) throw error;
  return unique((data ?? []).map((row) => row.course_id));
}

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

async function getOrganizationCourseIds(
  supabase: SupabaseClient<Database>,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("courses")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "published");

  if (error) throw error;
  return unique((data ?? []).map((row) => row.id));
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
  userId: string,
  profile: UserProfile | null,
  organizationSlug: string,
): Promise<OrganizationLearnerWorkspaceContext | null> {
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, short_name, slug, logo_url, accent_token, lifecycle_status, verification_status")
    .eq("slug", organizationSlug)
    .maybeSingle();

  if (organizationError) throw organizationError;
  if (!organization) return null;

  const { data: canEnter, error: canEnterError } = await supabase.rpc(
    "current_user_can_enter_organization",
    { p_organization_id: organization.id },
  );

  if (canEnterError) throw canEnterError;
  if (!canEnter) return null;

  const [membershipsResult, enrolmentsResult] = await Promise.all([
    supabase
      .from("organization_memberships")
      .select("role")
      .eq("organization_id", organization.id)
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase
      .from("enrolments")
      .select("course_id, programme_id")
      .eq("organization_id", organization.id)
      .eq("user_id", userId)
      .in("status", ["active", "completed"]),
  ]);

  if (membershipsResult.error) throw membershipsResult.error;
  if (enrolmentsResult.error) throw enrolmentsResult.error;

  const roles = unique(
    ((membershipsResult.data ?? []) as MembershipRow[]).map((membership) => membership.role),
  ) as Database["public"]["Enums"]["organization_role_key"][];
  const enrolments = (enrolmentsResult.data ?? []) as EnrolmentRow[];
  const programmeIds = unique(enrolments.map((enrolment) => enrolment.programme_id));
  const directCourseIds = unique(enrolments.map((enrolment) => enrolment.course_id));
  const [programmeCourseIds, organizationCourseIds, missionDeliveries] = await Promise.all([
    getProgrammeCourseIds(supabase, programmeIds),
    roles.length > 0 ? getOrganizationCourseIds(supabase, organization.id) : Promise.resolve([]),
    getProgrammeMissionDeliveryRequests(supabase, organization.id, organization.slug, programmeIds),
  ]);
  const courseIds = unique([...directCourseIds, ...programmeCourseIds, ...organizationCourseIds]);

  return {
    accessSource: getAccessSource({ programmeIds, roles }),
    branding: {
      accentToken: organization.accent_token,
      logoUrl: organization.logo_url,
      name: organization.name,
      shortName: organization.short_name,
    },
    courseIds,
    membershipRoles: roles,
    missionIds: unique(missionDeliveries.map((delivery) => delivery.missionId)),
    organizationId: organization.id,
    organizationSlug: organization.slug,
    programmeIds,
    type: "organization",
    xpAccount: {
      balance: profile?.xp_balance_cached ?? 0,
      label: "Organisation points",
      type: "organization",
    },
  };
}

export async function getOrganizationWorkspaceCourses(
  supabase: SupabaseClient<Database>,
  workspace: OrganizationLearnerWorkspaceContext,
): Promise<Course[]> {
  return getLearningCourseSummariesByIds(supabase, workspace.courseIds);
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

  const missionDeliveries = await getProgrammeMissionDeliveryRequests(
    supabase,
    workspace.organizationId,
    workspace.organizationSlug,
    workspace.programmeIds,
  );

  return getSupabaseMissionSummaries({
    missionDeliveries,
    origin,
    referralCode: profile.referral_code ?? null,
    supabase,
    userId: profile.id,
  });
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
