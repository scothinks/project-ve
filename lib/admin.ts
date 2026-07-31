import "server-only";

export {
  getAdminOverview,
  requireAdmin,
  type AdminContext,
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
  getAdminProofSubmissions,
  type AdminMissionRow,
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
  getAdminUsers,
  type AdminProfileRow,
} from "@/features/users/admin/data";

export {
  getAdminRedemptions,
  getAdminRewards,
  type AdminRedemptionFilters,
  type AdminRedemptionRow,
  type AdminRewardRow,
} from "@/features/rewards/admin/data";

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
