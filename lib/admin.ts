import "server-only";

export {
  getAdminOverview,
  getSelectedAdminWorkspaceId,
  requireAdmin,
  requireAdminWorkspaceRole,
  requirePlatformAdmin,
  resolveOrganizationScopeFilter,
  workspaceHasAnyRole,
  PLATFORM_CATALOG_WORKSPACE_ID,
  type AdminContext,
  type AdminWorkspace,
  type OrganizationScopeFilter,
} from "@/features/admin/application/context";

export {
  getAdminOrganizationOverview,
  type AdminOrganizationOverview,
  type AdminOrganizationOverviewOnboarding,
} from "@/features/admin/application/organization-overview";

export {
  getAdminCatalogOverview,
  type AdminCatalogOverview,
} from "@/features/admin/application/catalog-overview";

export {
  getAdminPeopleWorkspace,
  ORGANIZATION_ROLE_DESCRIPTIONS,
  ORGANIZATION_ROLE_LABELS,
  type AdminPeopleMember,
  type AdminPeopleTargetOption,
  type AdminPeopleWorkspace,
} from "@/features/admin/application/people-workspace";

export {
  getAdminCatalogPeopleWorkspace,
  type AdminCatalogPeopleWorkspace,
  type AdminCatalogStaffInvitation,
  type AdminCatalogStaffMember,
} from "@/features/admin/application/catalog-people-workspace";

export {
  getAdminOrganizationOversight,
  type AdminOrganizationOversight,
  type AdminOversightEntitlementRow,
} from "@/features/admin/application/organization-oversight";

export {
  getAdminPlatformOverview,
  type AdminPlatformOverview,
} from "@/features/admin/application/platform-overview";

export {
  getAdminAssessmentVersions,
  getAdminAssessmentWorkspace,
  type AdminAssessmentOptionRow,
  type AdminAssessmentQuestionRow,
  type AdminAssessmentUsageRow,
  type AdminAssessmentValueDimensionRow,
  type AdminAssessmentVersionRow,
  type AdminAssessmentVersionSummary,
  type AdminAssessmentWorkspace,
} from "@/features/assessments/admin/data";

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
  searchAdminUsers,
  type AdminProfileRow,
} from "@/features/users/admin/data";

export {
  getAdminOrganizationActivity,
  type AdminOrganizationActivity,
  type AdminOrganizationActivityActor,
  type AdminOrganizationActivityChanges,
  type AdminOrganizationActivityDetail,
  type AdminOrganizationActivityEvent,
  type AdminOrganizationActivityFilters,
  type AdminOrganizationActivityFilterOptions,
} from "@/features/organizations/admin/activity";

export {
  getAdminOrganizationEntitlementOverrides,
  getAdminOrganizationAdjustmentLearners,
  getAdminOrganizationInvitations,
  getAdminOrganizationMemberships,
  getAdminOrganizationUnitMembers,
  getAdminOrganizationUnits,
  getAdminOrganizations,
  getAdminOrganizationContexts,
  getAdminOrganizationPlanAssignments,
  getAdminOrganizationPlans,
  getAdminOrganizationTemporaryEntitlementGrants,
  getAdminOrganizationXpAccountOverview,
  type AdminOrganizationEntitlementOverrideRow,
  type AdminOrganizationAdjustmentLearnerOption,
  type AdminOrganizationInvitationRow,
  type AdminOrganizationMembershipRow,
  type AdminOrganizationUnitMemberRow,
  type AdminOrganizationUnitRow,
  type AdminOrganizationRow,
  type AdminOrganizationContext,
  type AdminOrganizationPlanAssignmentRow,
  type AdminOrganizationPlanRow,
  type AdminOrganizationTemporaryEntitlementGrantRow,
  type AdminOrganizationXpAccountOverview,
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
  getAdminInstructorWorkspace,
  parseAdminInstructorWorkspace,
  type AdminInstructorWorkspace,
  type AdminInstructorWorkspaceCohort,
  type AdminInstructorWorkspaceInactiveLearner,
  type AdminInstructorWorkspaceIntervention,
  type AdminInstructorWorkspaceLearner,
  type AdminInstructorWorkspaceMissionEvidence,
  type AdminInstructorWorkspaceOverdueLearner,
  type AdminInstructorWorkspaceReminderTarget,
  type AdminInstructorWorkspaceUnit,
} from "@/features/instructors/admin/data";

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
