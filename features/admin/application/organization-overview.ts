import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminCourses } from "@/features/learning/admin/data";
import { getCourseEditorialLifecycle } from "@/features/learning/admin/course-readiness";
import { getAdminMissions } from "@/features/missions/admin/data";
import { getAdminProgrammes } from "@/features/programmes/admin/data";
import { getAdminCohorts } from "@/features/cohorts/admin/data";
import { getAdminOrganizationLearners } from "@/features/users/admin/data";
import {
  getAdminOrganizationActivity,
  type AdminOrganizationActivityEvent,
} from "@/features/organizations/admin/activity";
import { getAdminLmsInterventions } from "@/features/interventions/admin/data";
import {
  getAdminOrganizationInvitations,
  getAdminOrganizationMemberships,
  getAdminOrganizationPlanAssignments,
  getAdminOrganizationXpAccountOverview,
  type AdminOrganizationXpAccountOverview,
} from "@/features/organizations/admin/data";
import { getAdminRewards } from "@/features/rewards/admin/data";

export type AdminOrganizationOverviewOnboarding = {
  brandingConfigured: boolean;
  adminsInvited: boolean;
  learnersImported: boolean;
  firstMissionPublished: boolean;
};

export type AdminOrganizationOverview = {
  planName: string | null;
  totalLearners: number;
  learnerGrowthLastThirtyDays: number;
  activeProgrammes: number;
  activeCohorts: number;
  coursesPublished: number;
  coursesPublishedLastSevenDays: number;
  coursesInReview: number;
  missionsPublished: number;
  points: {
    label: string;
    awarded: number;
    spent: number;
  } | null;
  pendingRewardClaims: number;
  openInterventions: {
    critical: number;
    warning: number;
    info: number;
    total: number;
  };
  onboarding: AdminOrganizationOverviewOnboarding;
  recentActivity: AdminOrganizationActivityEvent[];
};

const ADMIN_MEMBERSHIP_ROLES = new Set(["organisation_owner", "organisation_admin"]);
const PENDING_CLAIM_STATES = new Set(["details_submitted", "purchased"]);

async function getPendingRewardClaimCount(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<number> {
  // getAdminRewards merges in platform-shared/programme-sponsored rewards so
  // org admins can browse them alongside their own — but fulfillment
  // responsibility (and this attention count) belongs only to rewards this
  // org actually owns.
  const rewards = await getAdminRewards(supabase, {}, organizationId);
  const rewardIds = rewards
    .filter((reward) => reward.organization_id === organizationId)
    .map((reward) => reward.id);

  if (rewardIds.length === 0) {
    return 0;
  }

  const { data, error } = await supabase
    .from("reward_redemptions")
    .select("claim_state")
    .in("reward_id", rewardIds);

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{ claim_state: string }>).filter((row) =>
    PENDING_CLAIM_STATES.has(row.claim_state),
  ).length;
}

async function getXpOverview(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<AdminOrganizationXpAccountOverview | null> {
  try {
    return await getAdminOrganizationXpAccountOverview(supabase, organizationId);
  } catch {
    return null;
  }
}

export async function getAdminOrganizationOverview(
  supabase: SupabaseClient,
  organizationId: string,
  organizationLogoUrl: string | null,
  includeRecentActivity: boolean,
): Promise<AdminOrganizationOverview> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const [
    courses,
    missions,
    programmes,
    cohorts,
    learners,
    activity,
    interventions,
    xpOverview,
    memberships,
    pendingRewardClaims,
    planAssignments,
    invitations,
  ] = await Promise.all([
    getAdminCourses(supabase, organizationId),
    getAdminMissions(supabase, organizationId),
    getAdminProgrammes(supabase),
    getAdminCohorts(supabase),
    getAdminOrganizationLearners(supabase, organizationId),
    includeRecentActivity
      ? getAdminOrganizationActivity(supabase, { organizationId, limit: 5 })
      : Promise.resolve({
          events: [],
          filters: { actors: [], entityTypes: [], eventTypes: [] },
        }),
    getAdminLmsInterventions(supabase, { organizationId }),
    getXpOverview(supabase, organizationId),
    getAdminOrganizationMemberships(supabase),
    getPendingRewardClaimCount(supabase, organizationId),
    getAdminOrganizationPlanAssignments(supabase),
    getAdminOrganizationInvitations(supabase),
  ]);

  // getAdminCourses/getAdminMissions merge in the shared platform catalog
  // (organization_id.eq.X OR catalog_scope.eq.platform) so org admins can
  // browse it — but this org's own operational health (published counts,
  // review queue, onboarding) must only reflect content this org actually
  // owns, not the platform catalog visible alongside it.
  const ownCourses = courses.filter((course) => course.organization_id === organizationId);
  const ownMissions = missions.filter((mission) => mission.organization_id === organizationId);

  const publishedCourses = ownCourses.filter((course) => course.status === "published");
  const coursesPublishedLastSevenDays = publishedCourses.filter(
    (course) => new Date(course.updated_at).getTime() >= sevenDaysAgo,
  ).length;
  const coursesInReview = ownCourses.filter(
    (course) => getCourseEditorialLifecycle(course) === "in_review",
  ).length;

  const publishedMissions = ownMissions.filter((mission) => mission.status === "published");

  const activeProgrammes = programmes.filter((programme) => programme.status !== "archived").length;
  const activeCohorts = cohorts.filter((cohort) => cohort.status !== "archived").length;

  const learnerGrowthLastThirtyDays = learners.filter(
    (learner) => new Date(learner.created_at).getTime() >= thirtyDaysAgo,
  ).length;

  const activeAdminMemberships = memberships.filter(
    (membership) =>
      membership.organization_id === organizationId &&
      membership.status === "active" &&
      ADMIN_MEMBERSHIP_ROLES.has(membership.role),
  );
  const pendingAdminInvitations = invitations.filter(
    (invitation) =>
      invitation.organization_id === organizationId &&
      invitation.status === "pending" &&
      ADMIN_MEMBERSHIP_ROLES.has(invitation.role),
  );

  const openInterventions = interventions.reduce(
    (acc, intervention) => {
      acc.total += 1;
      acc[intervention.severity] += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0, total: 0 },
  );

  return {
    planName: planAssignments[0]?.plan?.name ?? null,
    totalLearners: learners.length,
    learnerGrowthLastThirtyDays,
    activeProgrammes,
    activeCohorts,
    coursesPublished: publishedCourses.length,
    coursesPublishedLastSevenDays,
    coursesInReview,
    missionsPublished: publishedMissions.length,
    points: xpOverview
      ? {
          label: xpOverview.account.pluralName || xpOverview.account.name || "Points",
          awarded: xpOverview.issuance,
          spent: xpOverview.redemptions,
        }
      : null,
    pendingRewardClaims,
    openInterventions,
    onboarding: {
      brandingConfigured: Boolean(organizationLogoUrl),
      adminsInvited: activeAdminMemberships.length > 1 || pendingAdminInvitations.length > 0,
      learnersImported: learners.length > 0,
      firstMissionPublished: publishedMissions.length > 0,
    },
    recentActivity: activity.events,
  };
}
