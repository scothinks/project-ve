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

export type OrganizationCourseDeliveryOption = {
  courseId: string;
  label: string;
  organizationId: string;
  programmeId: string | null;
  scope: "organization" | "programme";
};

export type OrganizationLearningDeliveryContext = OrganizationCourseDeliveryOption;

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
  courseDeliveryOptions: Record<string, OrganizationCourseDeliveryOption[]>;
  membershipRoles: Database["public"]["Enums"]["organization_role_key"][];
  missionIds: string[];
  organizationId: string;
  organizationSlug: string;
  programmeIds: string[];
  type: "organization";
  xpAccount: {
    balance: number;
    id: string;
    label: string;
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

async function getProgrammeCourseLinks(
  supabase: SupabaseClient<Database>,
  programmeIds: string[],
) {
  if (programmeIds.length === 0) return [];

  const { data, error } = await supabase
    .from("programme_courses")
    .select("course_id, programme_id")
    .in("programme_id", programmeIds);

  if (error) throw error;
  return (data ?? []).map((row) => ({
    courseId: row.course_id,
    programmeId: row.programme_id,
  }));
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

  const [membershipsResult, enrolmentsResult, xpAccountResult] = await Promise.all([
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
    supabase
      .from("xp_accounts")
      .select("id, display_name_plural, short_label, display_format")
      .eq("organization_id", organization.id)
      .eq("scope", "organization")
      .eq("is_default", true)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  if (membershipsResult.error) throw membershipsResult.error;
  if (enrolmentsResult.error) throw enrolmentsResult.error;
  if (xpAccountResult.error) throw xpAccountResult.error;
  if (!xpAccountResult.data) return null;

  const { data: xpBalance, error: xpBalanceError } = await supabase
    .from("user_xp_balances")
    .select("balance_cached")
    .eq("user_id", userId)
    .eq("xp_account_id", xpAccountResult.data.id)
    .maybeSingle();

  if (xpBalanceError) throw xpBalanceError;

  const roles = unique(
    ((membershipsResult.data ?? []) as MembershipRow[]).map((membership) => membership.role),
  ) as Database["public"]["Enums"]["organization_role_key"][];
  const enrolments = (enrolmentsResult.data ?? []) as EnrolmentRow[];
  const programmeIds = unique(enrolments.map((enrolment) => enrolment.programme_id));
  const directCourseIds = unique(enrolments.map((enrolment) => enrolment.course_id));
  const [programmeCourseLinks, programmeTitlesResult, organizationCourseIds, programmeMissionDeliveries, organizationMissionDeliveries] = await Promise.all([
    getProgrammeCourseLinks(supabase, programmeIds),
    programmeIds.length > 0
      ? supabase.from("programmes").select("id, title").in("id", programmeIds)
      : Promise.resolve({ data: [], error: null }),
    roles.length > 0 ? getOrganizationCourseIds(supabase, organization.id) : Promise.resolve([]),
    getProgrammeMissionDeliveryRequests(supabase, organization.id, organization.slug, programmeIds),
    getOrganizationMissionDeliveryRequests(supabase, organization.id, organization.slug, roles),
  ]);
  if (programmeTitlesResult.error) throw programmeTitlesResult.error;
  const missionDeliveries = [...organizationMissionDeliveries, ...programmeMissionDeliveries];
  const programmeTitles = new Map(
    (programmeTitlesResult.data ?? []).map((programme) => [programme.id, programme.title]),
  );
  const programmeCourseIds = programmeCourseLinks.map((link) => link.courseId);
  const directOrganizationCourseIds = enrolments
    .filter((enrolment) => enrolment.programme_id === null)
    .map((enrolment) => enrolment.course_id);
  const courseIds = unique([...directCourseIds, ...programmeCourseIds, ...organizationCourseIds]);
  const organizationCourseSet = new Set([...organizationCourseIds, ...directOrganizationCourseIds]);
  const courseDeliveryOptions = Object.fromEntries(
    courseIds.map((courseId) => {
      const programmeOptions = programmeCourseLinks
        .filter((link) => link.courseId === courseId)
        .map((link) => ({
          courseId,
          label: programmeTitles.get(link.programmeId) ?? "Programme learning",
          organizationId: organization.id,
          programmeId: link.programmeId,
          scope: "programme" as const,
        }));
      const options = programmeOptions.length > 0
        ? programmeOptions
        : organizationCourseSet.has(courseId)
          ? [{
              courseId,
              label: "Organisation learning",
              organizationId: organization.id,
              programmeId: null,
              scope: "organization" as const,
            }]
          : [];

      return [courseId, options];
    }),
  ) as Record<string, OrganizationCourseDeliveryOption[]>;

  return {
    accessSource: getAccessSource({ programmeIds, roles }),
    branding: {
      accentToken: organization.accent_token,
      logoUrl: organization.logo_url,
      name: organization.name,
      shortName: organization.short_name,
    },
    courseIds,
    courseDeliveryOptions,
    membershipRoles: roles,
    missionIds: unique(missionDeliveries.map((delivery) => delivery.missionId)),
    organizationId: organization.id,
    organizationSlug: organization.slug,
    programmeIds,
    type: "organization",
    xpAccount: {
      balance: xpBalance?.balance_cached ?? 0,
      id: xpAccountResult.data.id,
      label: xpAccountResult.data.display_format === "amount_short_label"
        ? xpAccountResult.data.short_label
        : xpAccountResult.data.display_name_plural,
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
  const organizationMissionDeliveries = await getOrganizationMissionDeliveryRequests(
    supabase,
    workspace.organizationId,
    workspace.organizationSlug,
    workspace.membershipRoles,
  );

  return getSupabaseMissionSummaries({
    missionDeliveries: [...organizationMissionDeliveries, ...missionDeliveries],
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
