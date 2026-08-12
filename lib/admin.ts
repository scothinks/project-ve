import "server-only";

export {
  getAdminOverview,
  getSelectedAdminWorkspaceId,
  requireAdmin,
  requireAdminWorkspaceRole,
  requirePlatformAdmin,
  type AdminContext,
  type AdminWorkspace,
} from "@/features/admin/application/context";

export {
  getAdminCampaign,
  getAdminCampaignAnalytics,
  getAdminCampaigns,
  type AdminCampaignAnalytics,
  type AdminCampaignRewardMetric,
  type AdminCampaignRow,
} from "@/features/campaigns/admin/data";

export {
  getAdminAiCoursePlans,
  getAdminCourse,
  getAdminCourseCategories,
  getAdminCourses,
  getAdminLearningMediaAssets,
  getAdminLesson,
  getAdminLessons,
  type AdminAiCoursePlanRow,
  type AdminCourseRow,
  type AdminLearningMediaAssetRow,
  type AdminLessonBlockRow,
  type AdminLessonPageRow,
  type AdminLessonRow,
  type AdminQuizOptionRow,
  type AdminQuizQuestionRow,
  type AdminQuizRow,
} from "@/features/learning/admin/data";

export {
  getAdminContentValueTags,
  getAdminValueDimensions,
} from "@/features/content-values/admin/data";

export {
  getAdminMission,
  getAdminMissionRewardCandidates,
  getAdminMissions,
  getAdminMissionTypes,
  getAdminProofSubmissions,
  type AdminMissionRow,
  type AdminMissionTypeRow,
  type AdminProofRow,
  type AdminProofSubmission,
} from "@/features/missions/admin/data";

export {
  getAdminRecommendationSections,
  type AdminRecommendationSection,
  type AdminRecommendationItemRow,
  type AdminRecommendationSectionRow,
} from "@/features/recommendations/admin/data";

export {
  getAdminOrganizationLearners,
  getAdminUsers,
  type AdminProfileRow,
} from "@/features/users/admin/data";

export {
  getAdminOrganizationEntitlementOverrides,
  getAdminOrganizationInvitations,
  getAdminOrganizationMemberships,
  getAdminOrganizations,
  getAdminOrganizationContexts,
  getAdminOrganizationPlanAssignments,
  getAdminOrganizationPlans,
  type AdminOrganizationEntitlementOverrideRow,
  type AdminOrganizationInvitationRow,
  type AdminOrganizationMembershipRow,
  type AdminOrganizationRow,
  type AdminOrganizationContext,
  type AdminOrganizationPlanAssignmentRow,
  type AdminOrganizationPlanRow,
} from "@/features/organizations/admin/data";

export {
  getAdminCohort,
  getAdminCohorts,
  type AdminCohortDetail,
  type AdminCohortMemberRow,
  type AdminCohortOrganizationRow,
  type AdminCohortRow,
  type AdminCourseAssignmentRow,
  type AdminEnrolmentRow,
  type AdminProgrammeAssignmentRow,
} from "@/features/cohorts/admin/data";

export {
  getAdminAssessmentVersionOptions,
  getAdminProgramme,
  getAdminProgrammePendingAccessRequests,
  getAdminProgrammes,
  type AdminAssessmentVersionOptionRow,
  type AdminProgrammeAssessmentRow,
  type AdminProgrammeCourseRow,
  type AdminProgrammeDetail,
  type AdminProgrammeMissionRow,
  type AdminProgrammePendingAccessRequest,
  type AdminProgrammeRewardRow,
  type AdminProgrammeRow,
} from "@/features/programmes/admin/data";

export {
  getAdminRedemptions,
  getAdminRewards,
  type AdminRedemptionFilters,
  type AdminRedemptionRow,
  type AdminRewardRow,
} from "@/features/rewards/admin/data";

export {
  getAdminLmsReporting,
  parseAdminLmsReporting,
  type AdminLmsCohortComparison,
  type AdminLmsLearnerReport,
  type AdminLmsMissionCompletionReport,
  type AdminLmsQuizScoreReport,
  type AdminLmsReporting,
  type AdminLmsReportingFilters,
  type AdminLmsReportingSummary,
  type AdminLmsRewardUsageReport,
} from "@/features/reporting/admin/data";

export {
  getAdminLmsInterventions,
  parseAdminLmsInterventions,
  type AdminLmsIntervention,
  type AdminLmsInterventionFilters,
  type AdminLmsInterventionSeverity,
  type AdminLmsInterventionStatus,
  type AdminLmsInterventionType,
} from "@/features/interventions/admin/data";

export {
  getAdminPerkDraws,
  getAdminPerkPrograms,
  getAdminRewardDetail,
  type AdminInventoryAdjustment,
  type AdminInventoryItem,
  type AdminPerkAnalytics,
  type AdminPerkDistributionRow,
  type AdminPerkDrawRow,
  type AdminPerkPrizePerformance,
  type AdminPerkPrizeReleaseBucketRow,
  type AdminPerkPrizeRow,
  type AdminPerkProgramRow,
  type AdminPerkTrendPoint,
  type AdminRewardCandidateRow,
  type AdminRewardDetail,
} from "@/features/rewards/admin/perks";

export {
  getAdminManualXpGrantStatus,
  getAdminXpLedger,
  getAdminXpSettings,
  type AdminManualXpGrantStatusRow,
  type AdminXpLedgerFilters,
  type AdminXpSettingsRow,
  type AdminXpTransactionRow,
} from "@/features/xp/admin/data";
