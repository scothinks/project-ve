import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSupabaseServerClient,
  getCurrentUserProfile,
  type UserProfile,
} from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";

type CountableTable =
  | "profiles"
  | "rewards"
  | "reward_redemptions"
  | "mission_proofs"
  | "missions"
  | "campaigns"
  | "xp_transactions";

export type AdminContext = {
  supabase: SupabaseClient;
  profile: UserProfile;
};

export type AdminRewardRow = {
  id: string;
  campaign_id: string | null;
  title: string;
  description: string | null;
  cost_xp: number;
  status: string;
  is_enabled: boolean;
  distribution_mode: string;
  fulfillment_type: string;
  visibility_mode: string;
  total_uploaded: number;
  total_available: number;
  per_user_limit: number;
  limit_period: string;
  starts_at: string | null;
  ends_at: string | null;
  offer_expires_at: string | null;
  updated_at: string;
  campaign?: AdminCampaignRow | null;
};

export type AdminRewardDetail = AdminRewardRow & {
  thumbnail: Record<string, unknown>;
  terms: string | null;
  claim_steps: unknown;
  fulfillment_config: Record<string, unknown>;
  redemption_window_days: number | null;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
};

export type AdminPerkPrizeRow = {
  id: string;
  bundle_reward_id: string;
  prize_type: "reward" | "native_xp" | "xp_boost";
  source_reward_id: string | null;
  title: string | null;
  thumbnail: Record<string, unknown> | null;
  config: Record<string, unknown>;
  weight: number;
  total_win_cap: number | null;
  daily_win_cap: number | null;
  available_from: string | null;
  expires_at: string | null;
  sort_order: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
  source_reward?: Pick<AdminRewardRow, "id" | "title" | "fulfillment_type" | "status" | "is_enabled"> | null;
  performance?: AdminPerkPrizePerformance | null;
  releaseBuckets?: AdminPerkPrizeReleaseBucketRow[];
  assigned_available?: number;
  source_reward_direct_available?: number;
  source_reward_total_available?: number;
  source_reward_assigned_available?: number;
};

export type AdminPerkPrizePerformance = {
  prizeId: string;
  drawsTotal: number;
  drawsToday: number;
  remainingTotal: number | null;
  remainingToday: number | null;
};

export type AdminPerkPrizeReleaseBucketRow = {
  id: string;
  prize_id: string;
  label: string | null;
  starts_at: string;
  ends_at: string | null;
  release_cap: number;
  sort_order: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
  drawsInBucket?: number;
  remainingInBucket?: number;
};

export type AdminPerkDrawRow = {
  id: string;
  bundle_reward_id: string;
  user_id: string;
  redemption_id: string;
  prize_id: string | null;
  awarded_reward_id: string | null;
  awarded_fulfillment_type: string;
  awarded_title: string;
  awarded_thumbnail: Record<string, unknown>;
  awarded_payload: Record<string, unknown>;
  award_status: string;
  created_at: string;
  profile?: AdminProfileRow;
  awarded_reward?: AdminRewardRow | null;
};

export type AdminPerkAnalytics = {
  activePrizeCount: number;
  drawsTotal: number;
  drawsToday: number;
  fallbackDrawsTotal: number;
  fallbackDrawsToday: number;
  fallbackRateTotal: number;
  fallbackRateToday: number;
};

export type AdminPerkTrendPoint = {
  date: string;
  draws: number;
  fallbackDraws: number;
};

export type AdminPerkDistributionRow = {
  key: string;
  label: string;
  draws: number;
  share: number;
};

export type AdminPerkProgramRow = {
  reward: AdminRewardRow;
  prizeCount: number;
  enabledPrizeCount: number;
  drawsTotal: number;
  drawsToday: number;
  fallbackConfigured: boolean;
};

export type AdminRewardCandidateRow = Pick<
  AdminRewardRow,
  | "id"
  | "title"
  | "distribution_mode"
  | "fulfillment_type"
  | "status"
  | "is_enabled"
  | "visibility_mode"
> & {
  total_available?: number;
  direct_available?: number;
  assigned_available?: number;
};

type AdminRewardAssignmentCountRow = {
  reward_id: string;
  total_available: number;
  direct_available: number;
  assigned_available: number;
};

type AdminPerkPrizeAssignmentCountRow = {
  prize_id: string;
  assigned_available: number;
};

export type AdminCampaignRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  starts_at: string | null;
  ends_at: string | null;
  budget_label: string | null;
  budget_amount: number | null;
  created_at: string;
  updated_at: string;
};

export type AdminCourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  level: string;
  thumbnail: Record<string, unknown> | null;
  status: string;
  sort_order: number;
  estimated_minutes: number;
  ai_text_status: string;
  ai_media_status: string;
  ai_publish_status: string;
  ai_generated: boolean;
  ai_generation_notes: Record<string, unknown>;
  text_approved_at: string | null;
  text_approved_by: string | null;
  text_approved_by_name?: string | null;
  media_approved_at: string | null;
  media_approved_by: string | null;
  media_approved_by_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminLessonRow = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image: Record<string, unknown> | null;
  status: string;
  sort_order: number;
  estimated_minutes: number;
  retry_mode: string;
  retry_cooldown_seconds: number | null;
  retry_requires_reread: boolean;
  quiz_requires_lesson_completion: boolean;
  max_earning_attempts: number | null;
  ai_text_status: string;
  ai_media_status: string;
  ai_publish_status: string;
  ai_generated: boolean;
  ai_generation_notes: Record<string, unknown>;
  text_approved_at: string | null;
  text_approved_by: string | null;
  text_approved_by_name?: string | null;
  media_approved_at: string | null;
  media_approved_by: string | null;
  media_approved_by_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminLessonPageRow = {
  id: string;
  lesson_id: string;
  page_number: number;
  title: string;
  subtitle: string | null;
  page_type: string;
  cover_image: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type AdminLessonBlockRow = {
  id: string;
  page_id: string;
  block_type: string;
  sort_order: number;
  payload: Record<string, unknown>;
};

export type AdminQuizRow = {
  id: string;
  lesson_id: string;
  title: string;
  version: number;
  status: string;
  ai_text_status: string;
  ai_generated: boolean;
  ai_generation_notes: Record<string, unknown>;
  text_approved_at: string | null;
  text_approved_by: string | null;
  text_approved_by_name?: string | null;
};

export type AdminLearningMediaAssetRow = {
  id: string;
  course_id: string | null;
  lesson_id: string | null;
  asset_type: string;
  placement: string;
  source: string;
  prompt: string | null;
  script: string | null;
  url: string | null;
  alt_text: string | null;
  caption: string | null;
  metadata: Record<string, unknown>;
  review_status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  lesson?: Pick<AdminLessonRow, "id" | "title"> | null;
};

export type AdminQuizQuestionRow = {
  id: string;
  quiz_id: string;
  question_order: number;
  question_type: string;
  prompt: string;
  explanation: string | null;
  xp: number;
  options?: AdminQuizOptionRow[];
};

export type AdminQuizOptionRow = {
  id: string;
  question_id: string;
  option_order: number;
  label: string;
  is_correct: boolean;
};

export type AdminInventoryItem = {
  id: string;
  campaign_id: string | null;
  item_type: "voucher_code" | "qr_code";
  payload: Record<string, unknown>;
  status: string;
  available_from: string | null;
  expires_at: string | null;
  uploaded_at: string;
  assigned_at: string | null;
  redeemed_at: string | null;
  batch_label: string | null;
  partner_reference: string | null;
};

export type AdminInventoryAdjustment = {
  id: string;
  reward_id: string;
  campaign_id: string | null;
  delta: number;
  reason: string;
  created_at: string;
  batch_label: string | null;
  partner_reference: string | null;
};

export type AdminRedemptionRow = {
  id: string;
  user_id: string;
  reward_id: string;
  status: string;
  claim_state: string;
  reward_title_snapshot: string | null;
  xp_cost_at_redemption: number | null;
  fulfillment_type: string | null;
  claim_data: Record<string, unknown> | null;
  user_message: string | null;
  redemption_expires_at: string | null;
  refunded_at: string | null;
  fulfilled_at: string | null;
  admin_note: string | null;
  requested_at: string;
  profile?: AdminProfileRow;
  reward?: AdminRewardRow | null;
};

export type AdminRedemptionFilters = {
  claimState?: string;
  fulfillmentType?: string;
  rewardId?: string;
  campaignId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type AdminCampaignRewardMetric = {
  rewardId: string;
  title: string;
  fulfillmentType: string;
  costXp: number;
  totalUploaded: number;
  totalAvailable: number;
  purchases: number;
  fulfilled: number;
  refunded: number;
  xpSpent: number;
};

export type AdminCampaignAnalytics = {
  totalRewards: number;
  enabledRewards: number;
  totalInventoryUploaded: number;
  totalInventoryAvailable: number;
  redemptionsRequested: number;
  redemptionsFulfilled: number;
  redemptionsRefunded: number;
  xpSpent: number;
  pendingManualSubmissions: number;
  reallocatedIn: number;
  reallocatedOut: number;
  rewardMetrics: AdminCampaignRewardMetric[];
};

export type AdminProfileRow = {
  id: string;
  display_name: string | null;
  referral_code: string | null;
  xp_balance_cached: number;
  role: string;
  created_at: string;
  redemption_unlocked_at: string | null;
  fraud_review_status: string;
};

type LegacyAdminRewardRow = Omit<AdminRewardRow, "distribution_mode">;

function withDerivedDistributionMode<T extends { fulfillment_type: string }>(
  reward: T,
): T & { distribution_mode: string; fulfillment_type: string } {
  return {
    ...reward,
    distribution_mode: reward.fulfillment_type === "perk_bundle" ? "perk_bundle" : "direct",
    fulfillment_type: reward.fulfillment_type === "perk_bundle" ? "manual" : reward.fulfillment_type,
  };
}

function isMissingDistributionModeError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as Record<string, unknown>;
  return /distribution_mode/i.test(String(record.message ?? ""));
}

function isMissingPerkReleaseBucketError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as Record<string, unknown>;
  return /perk_prize_release_buckets/i.test(String(record.message ?? ""));
}

function isMissingPerkPrizeInventoryAssignmentError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as Record<string, unknown>;
  return /perk_prize_id|admin_reward_assignment_counts|admin_perk_prize_assignment_counts/i.test(
    `${String(record.message ?? "")} ${String(record.details ?? "")}`,
  );
}

function getStartOfTodayInLagosIso() {
  const offsetMs = 60 * 60 * 1000;
  const nowMs = Date.now();
  const startMs = Math.floor((nowMs + offsetMs) / 86_400_000) * 86_400_000 - offsetMs;
  return new Date(startMs).toISOString();
}

export type AdminMissionRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  reward_type: "xp" | "reward";
  reward_xp: number | null;
  reward_id: string | null;
  reward?: Pick<AdminRewardRow, "id" | "title" | "fulfillment_type"> | null;
  repeatability: string;
  validation_type: string;
  validation_config: Record<string, unknown>;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
};

function normalizeAdminMissionReward(
  value: unknown,
): AdminMissionRow["reward"] {
  if (Array.isArray(value)) {
    return normalizeAdminMissionReward(value[0]);
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const reward = value as Partial<NonNullable<AdminMissionRow["reward"]>>;
  if (
    typeof reward.id !== "string"
    || typeof reward.title !== "string"
    || typeof reward.fulfillment_type !== "string"
  ) {
    return null;
  }

  return {
    id: reward.id,
    title: reward.title,
    fulfillment_type: reward.fulfillment_type,
  };
}

export type AdminRecommendationSectionRow = {
  id: string;
  slug: string;
  placement: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  status: string;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminRecommendationItemRow = {
  id: string;
  section_id: string;
  item_type: "course" | "lesson";
  item_id: string;
  sort_order: number;
  created_at: string;
};

export type AdminRecommendationSection = AdminRecommendationSectionRow & {
  items: Array<
    AdminRecommendationItemRow & {
      label: string;
      status: string;
    }
  >;
};

export type AdminProofRow = {
  id: string;
  user_id: string;
  mission_id: string;
  award_scope: string;
  proof_type: string;
  value: string;
  status: "submitted" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type AdminProofSubmission = {
  key: string;
  userId: string;
  missionId: string;
  awardScope: string;
  status: "submitted" | "approved" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
  proofs: AdminProofRow[];
  profile?: AdminProfileRow;
  mission?: AdminMissionRow;
};

export type AdminXpTransactionRow = {
  id: string;
  user_id: string;
  amount: number;
  direction: "earn" | "spend";
  source_type: string;
  source_id: string;
  award_scope: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  profile?: AdminProfileRow;
};

export type AdminXpLedgerFilters = {
  userQuery?: string;
  direction?: "earn" | "spend";
  sourceType?: "quiz_question" | "mission" | "reward_redemption" | "adjustment";
  dateFrom?: string;
  dateTo?: string;
};

export type AdminXpSettingsRow = {
  id: number;
  default_daily_quiz_xp_limit: number;
  admin_manual_grant_daily_limit: number;
  updated_at: string;
};

export type AdminManualXpGrantStatusRow = {
  local_date: string;
  daily_limit: number;
  granted_today: number;
  remaining_today: number;
};

export async function requireAdmin(): Promise<AdminContext> {
  const [supabase, { user, profile }] = await Promise.all([
    createSupabaseServerClient(),
    getCurrentUserProfile(),
  ]);

  if (!isSupabaseConfigured || !supabase) {
    redirect("/login");
  }

  if (!user) {
    redirect("/login");
  }

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  return { supabase, profile };
}

async function getExactCount(supabase: SupabaseClient, table: CountableTable) {
  const { count, error } = await supabase.from(table).select("id", {
    count: "exact",
    head: true,
  });

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function getProfilesByIds(
  supabase: SupabaseClient,
  userIds: Array<string | null | undefined>,
) {
  const uniqueIds = Array.from(new Set(userIds)).filter(
    (userId): userId is string => typeof userId === "string" && userId.length > 0,
  );

  if (uniqueIds.length === 0) {
    return new Map<string, AdminProfileRow>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, referral_code, xp_balance_cached, role, created_at, redemption_unlocked_at, fraud_review_status",
    )
    .in("id", uniqueIds)
    .returns<AdminProfileRow[]>();

  if (error) {
    throw error;
  }

  return new Map((data ?? []).map((profile) => [profile.id, profile]));
}

function attachApprovalNames<
  T extends {
    text_approved_by: string | null;
    media_approved_by?: string | null;
  },
>(
  rows: T[],
  profilesById: Map<string, AdminProfileRow>,
) {
  return rows.map((row) => ({
    ...row,
    text_approved_by_name: row.text_approved_by
      ? profilesById.get(row.text_approved_by)?.display_name ?? null
      : null,
    media_approved_by_name: row.media_approved_by
      ? profilesById.get(row.media_approved_by)?.display_name ?? null
      : null,
  }));
}

export async function getAdminOverview(supabase: SupabaseClient) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    totalRewards,
    totalMissions,
    totalCampaigns,
    pendingRedemptions,
    pendingProofItems,
    earnedToday,
  ] = await Promise.all([
    getExactCount(supabase, "profiles"),
    getExactCount(supabase, "rewards"),
    getExactCount(supabase, "missions"),
    getExactCount(supabase, "campaigns"),
    supabase
      .from("reward_redemptions")
      .select("id", { count: "exact", head: true })
      .in("claim_state", ["details_submitted", "purchased"]),
    supabase
      .from("mission_proofs")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted"),
    supabase
      .from("xp_transactions")
      .select("amount")
      .eq("direction", "earn")
      .gte("created_at", todayStart.toISOString())
      .returns<Array<{ amount: number }>>(),
  ]);

  if (pendingRedemptions.error) {
    throw pendingRedemptions.error;
  }

  if (pendingProofItems.error) {
    throw pendingProofItems.error;
  }

  if (earnedToday.error) {
    throw earnedToday.error;
  }

  return {
    totalUsers,
    totalRewards,
    totalMissions,
    totalCampaigns,
    pendingRedemptions: pendingRedemptions.count ?? 0,
    pendingProofItems: pendingProofItems.count ?? 0,
    xpEarnedToday: (earnedToday.data ?? []).reduce((total, row) => total + row.amount, 0),
  };
}

async function getCampaignsByIds(supabase: SupabaseClient, campaignIds: string[]) {
  const uniqueIds = Array.from(new Set(campaignIds)).filter(Boolean);

  if (uniqueIds.length === 0) {
    return new Map<string, AdminCampaignRow>();
  }

  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id, slug, name, description, status, starts_at, ends_at, budget_label, budget_amount, created_at, updated_at",
    )
    .in("id", uniqueIds)
    .returns<AdminCampaignRow[]>();

  if (error) {
    throw error;
  }

  return new Map((data ?? []).map((campaign) => [campaign.id, campaign]));
}

export async function getAdminCampaigns(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id, slug, name, description, status, starts_at, ends_at, budget_label, budget_amount, created_at, updated_at",
    )
    .order("starts_at", { ascending: false, nullsFirst: false })
    .returns<AdminCampaignRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map((mission) => ({
    ...mission,
    reward: normalizeAdminMissionReward((mission as { reward?: unknown }).reward),
  }));
}

export async function getAdminCampaign(supabase: SupabaseClient, campaignId: string) {
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id, slug, name, description, status, starts_at, ends_at, budget_label, budget_amount, created_at, updated_at",
    )
    .eq("id", campaignId)
    .maybeSingle<AdminCampaignRow>();

  if (error) {
    throw error;
  }

  return data
    ? {
        ...data,
        reward: normalizeAdminMissionReward((data as { reward?: unknown }).reward),
      }
    : data;
}

export async function getAdminCourses(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("courses")
    .select("id, slug, title, description, category, level, thumbnail, status, sort_order, estimated_minutes, ai_text_status, ai_media_status, ai_publish_status, ai_generated, ai_generation_notes, text_approved_at, text_approved_by, media_approved_at, media_approved_by, created_at, updated_at")
    .order("sort_order", { ascending: true })
    .returns<AdminCourseRow[]>();

  if (error) {
    throw error;
  }

  const courses = data ?? [];
  const courseIds = courses.map((course) => course.id);
  const approvalUserIds = courses.flatMap((course) => [
    course.text_approved_by,
    course.media_approved_by,
  ]);

  if (courseIds.length === 0) {
    return [];
  }

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("course_id, estimated_minutes")
    .in("course_id", courseIds)
    .returns<Array<{ course_id: string; estimated_minutes: number }>>();

  if (lessonsError) {
    throw lessonsError;
  }

  const profilesById = await getProfilesByIds(supabase, approvalUserIds);

  const minutesByCourseId = new Map<string, number>();
  for (const lesson of lessons ?? []) {
    minutesByCourseId.set(
      lesson.course_id,
      (minutesByCourseId.get(lesson.course_id) ?? 0) + lesson.estimated_minutes,
    );
  }

  return attachApprovalNames(courses, profilesById).map((course) => ({
    ...course,
    estimated_minutes: minutesByCourseId.get(course.id) ?? 0,
  }));
}

export async function getAdminCourseCategories(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("courses")
    .select("category")
    .returns<Array<{ category: string | null }>>();

  if (error) {
    throw error;
  }

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => row.category?.trim())
        .filter((category): category is string => Boolean(category)),
    ),
  ).sort((first, second) => first.localeCompare(second));
}

export async function getAdminCourse(supabase: SupabaseClient, courseId: string) {
  const { data, error } = await supabase
    .from("courses")
    .select("id, slug, title, description, category, level, thumbnail, status, sort_order, estimated_minutes, ai_text_status, ai_media_status, ai_publish_status, ai_generated, ai_generation_notes, text_approved_at, text_approved_by, media_approved_at, media_approved_by, created_at, updated_at")
    .eq("id", courseId)
    .maybeSingle<AdminCourseRow>();

  if (error) {
    throw error;
  }

  if (!data) return data;

  const profilesById = await getProfilesByIds(supabase, [
    data.text_approved_by,
    data.media_approved_by,
  ]);

  return attachApprovalNames([data], profilesById)[0] ?? data;
}

export async function getAdminLessons(
  supabase: SupabaseClient,
  filters: { courseId?: string } = {},
) {
  let query = supabase
    .from("lessons")
    .select("id, course_id, slug, title, description, cover_image, status, sort_order, estimated_minutes, retry_mode, retry_cooldown_seconds, retry_requires_reread, quiz_requires_lesson_completion, max_earning_attempts, ai_text_status, ai_media_status, ai_publish_status, ai_generated, ai_generation_notes, text_approved_at, text_approved_by, media_approved_at, media_approved_by, created_at, updated_at")
    .order("sort_order", { ascending: true });

  if (filters.courseId) {
    query = query.eq("course_id", filters.courseId);
  }

  const { data, error } = await query.returns<AdminLessonRow[]>();

  if (error) {
    throw error;
  }

  const lessons = data ?? [];
  const profilesById = await getProfilesByIds(
    supabase,
    lessons.flatMap((lesson) => [lesson.text_approved_by, lesson.media_approved_by]),
  );

  return attachApprovalNames(lessons, profilesById);
}

export async function getAdminLesson(supabase: SupabaseClient, lessonId: string) {
  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("id, course_id, slug, title, description, cover_image, status, sort_order, estimated_minutes, retry_mode, retry_cooldown_seconds, retry_requires_reread, quiz_requires_lesson_completion, max_earning_attempts, ai_text_status, ai_media_status, ai_publish_status, ai_generated, ai_generation_notes, text_approved_at, text_approved_by, media_approved_at, media_approved_by, created_at, updated_at")
    .eq("id", lessonId)
    .maybeSingle<AdminLessonRow>();

  if (error) {
    throw error;
  }

  if (!lesson) {
    return null;
  }

  const [pagesResult, blocksResult, quizResult] = await Promise.all([
    supabase
      .from("lesson_pages")
      .select("id, lesson_id, page_number, title, subtitle, page_type, cover_image, created_at, updated_at")
      .eq("lesson_id", lessonId)
      .order("page_number", { ascending: true })
      .returns<AdminLessonPageRow[]>(),
    supabase
      .from("lesson_content_blocks")
      .select("id, page_id, block_type, sort_order, payload")
      .order("sort_order", { ascending: true })
      .returns<AdminLessonBlockRow[]>(),
    supabase
      .from("quizzes")
      .select("id, lesson_id, title, version, status, ai_text_status, ai_generated, ai_generation_notes, text_approved_at, text_approved_by")
      .eq("lesson_id", lessonId)
      .maybeSingle<AdminQuizRow>(),
  ]);

  if (pagesResult.error) throw pagesResult.error;
  if (blocksResult.error) throw blocksResult.error;
  if (quizResult.error) throw quizResult.error;

  const pages = pagesResult.data ?? [];
  const pageIds = new Set(pages.map((page) => page.id));
  const blocks = (blocksResult.data ?? []).filter((block) => pageIds.has(block.page_id));
  let questions: AdminQuizQuestionRow[] = [];

  if (quizResult.data) {
    const [questionsResult, optionsResult] = await Promise.all([
      supabase
        .from("quiz_questions")
        .select("id, quiz_id, question_order, question_type, prompt, explanation, xp")
        .eq("quiz_id", quizResult.data.id)
        .order("question_order", { ascending: true })
        .returns<AdminQuizQuestionRow[]>(),
      supabase
        .from("quiz_options")
        .select("id, question_id, option_order, label, is_correct")
        .order("option_order", { ascending: true })
        .returns<AdminQuizOptionRow[]>(),
    ]);

    if (questionsResult.error) throw questionsResult.error;
    if (optionsResult.error) throw optionsResult.error;

    const questionIds = new Set((questionsResult.data ?? []).map((question) => question.id));
    const optionsByQuestionId = new Map<string, AdminQuizOptionRow[]>();

    for (const option of (optionsResult.data ?? []).filter((option) => questionIds.has(option.question_id))) {
      const existing = optionsByQuestionId.get(option.question_id) ?? [];
      existing.push(option);
      optionsByQuestionId.set(option.question_id, existing);
    }

    questions = (questionsResult.data ?? []).map((question) => ({
      ...question,
      options: optionsByQuestionId.get(question.id) ?? [],
    }));
  }

  const profilesById = await getProfilesByIds(supabase, [
    lesson.text_approved_by,
    lesson.media_approved_by,
    quizResult.data?.text_approved_by ?? null,
  ]);

  const [lessonWithNames] = attachApprovalNames([lesson], profilesById);
  const quizWithNames = quizResult.data
    ? {
        ...quizResult.data,
        text_approved_by_name: quizResult.data.text_approved_by
          ? profilesById.get(quizResult.data.text_approved_by)?.display_name ?? null
          : null,
      }
    : null;

  return {
    lesson: lessonWithNames,
    pages,
    blocks,
    quiz: quizWithNames,
    questions,
  };
}

export async function getAdminLearningMediaAssets(
  supabase: SupabaseClient,
  filters: { courseId?: string; lessonId?: string } = {},
) {
  let query = supabase
    .from("learning_media_assets")
    .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, alt_text, caption, metadata, review_status, sort_order, created_at, updated_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (filters.courseId) {
    query = query.eq("course_id", filters.courseId);
  }

  if (filters.lessonId) {
    query = query.eq("lesson_id", filters.lessonId);
  }

  const { data, error } = await query.returns<AdminLearningMediaAssetRow[]>();

  if (error) {
    throw error;
  }

  const assets = data ?? [];
  const lessonIds = Array.from(new Set(assets.map((asset) => asset.lesson_id).filter(Boolean))) as string[];

  if (lessonIds.length === 0) {
    return assets;
  }

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, title")
    .in("id", lessonIds)
    .returns<Array<Pick<AdminLessonRow, "id" | "title">>>();

  if (lessonsError) {
    throw lessonsError;
  }

  const lessonsById = new Map((lessons ?? []).map((lesson) => [lesson.id, lesson]));

  return assets.map((asset) => ({
    ...asset,
    lesson: asset.lesson_id ? lessonsById.get(asset.lesson_id) ?? null : null,
  }));
}

export async function getAdminRewards(
  supabase: SupabaseClient,
  filters: { campaignId?: string; distributionMode?: "direct" | "perk_bundle" } = {},
) {
  const baseSelect =
    "id, campaign_id, title, description, cost_xp, status, is_enabled, fulfillment_type, visibility_mode, total_uploaded, total_available, per_user_limit, limit_period, starts_at, ends_at, offer_expires_at, updated_at";
  let query = supabase
    .from("rewards")
    .select(`${baseSelect}, distribution_mode`)
    .order("sort_order", { ascending: true });

  if (filters.campaignId) {
    query =
      filters.campaignId === "none"
        ? query.is("campaign_id", null)
        : query.eq("campaign_id", filters.campaignId);
  }

  if (filters.distributionMode) {
    query = query.eq("distribution_mode", filters.distributionMode);
  }

  let data: AdminRewardRow[] | null = null;
  const { data: nextData, error } = await query.returns<AdminRewardRow[]>();

  if (error) {
    if (!isMissingDistributionModeError(error)) {
      throw error;
    }

    let legacyQuery = supabase
      .from("rewards")
      .select(baseSelect)
      .order("sort_order", { ascending: true });

    if (filters.campaignId) {
      legacyQuery =
        filters.campaignId === "none"
          ? legacyQuery.is("campaign_id", null)
          : legacyQuery.eq("campaign_id", filters.campaignId);
    }

    const legacyResult = await legacyQuery.returns<LegacyAdminRewardRow[]>();

    if (legacyResult.error) {
      throw legacyResult.error;
    }

    data = (legacyResult.data ?? [])
      .map(withDerivedDistributionMode)
      .filter((reward) =>
        filters.distributionMode ? reward.distribution_mode === filters.distributionMode : true,
      );
  } else {
    data = (nextData ?? []).filter((reward) =>
      filters.distributionMode ? reward.distribution_mode === filters.distributionMode : true,
    );
  }

  const campaigns = await getCampaignsByIds(
    supabase,
    (data ?? []).map((reward) => reward.campaign_id ?? ""),
  );

  return (data ?? []).map((reward) => ({
    ...reward,
    campaign: reward.campaign_id ? campaigns.get(reward.campaign_id) ?? null : null,
  }));
}

export async function getAdminPerkPrograms(
  supabase: SupabaseClient,
  filters: { campaignId?: string } = {},
): Promise<AdminPerkProgramRow[]> {
  const perks = await getAdminRewards(supabase, {
    campaignId: filters.campaignId,
    distributionMode: "perk_bundle",
  });

  if (perks.length === 0) {
    return [];
  }

  const perkIds = perks.map((perk) => perk.id);
  const [prizesResult, fallbackResult] = await Promise.all([
    supabase
      .from("perk_bundle_prizes")
      .select("id, bundle_reward_id, is_enabled")
      .in("bundle_reward_id", perkIds)
      .returns<Array<{ id: string; bundle_reward_id: string; is_enabled: boolean }>>(),
    supabase
      .from("rewards")
      .select("id, fulfillment_config")
      .in("id", perkIds)
      .returns<Array<{ id: string; fulfillment_config: Record<string, unknown> | null }>>(),
  ]);

  if (prizesResult.error) {
    throw prizesResult.error;
  }

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  const startOfTodayIso = getStartOfTodayInLagosIso();
  const prizeCounts = new Map<string, { total: number; enabled: number }>();

  for (const prize of prizesResult.data ?? []) {
    const current = prizeCounts.get(prize.bundle_reward_id) ?? { total: 0, enabled: 0 };
    current.total += 1;
    if (prize.is_enabled) {
      current.enabled += 1;
    }
    prizeCounts.set(prize.bundle_reward_id, current);
  }

  const fallbackConfigured = new Map<string, boolean>(
    (fallbackResult.data ?? []).map((row) => {
      const config =
        row.fulfillment_config && typeof row.fulfillment_config === "object"
          ? row.fulfillment_config
          : {};
      const fallback =
        config.fallback && typeof config.fallback === "object" && !Array.isArray(config.fallback)
          ? config.fallback
          : null;
      return [row.id, Boolean(fallback)];
    }),
  );

  const drawStats = await Promise.all(
    perkIds.map(async (perkId) => {
      const [allResult, todayResult] = await Promise.all([
        supabase
          .from("perk_bundle_draws")
          .select("id", { count: "exact", head: true })
          .eq("bundle_reward_id", perkId),
        supabase
          .from("perk_bundle_draws")
          .select("id", { count: "exact", head: true })
          .eq("bundle_reward_id", perkId)
          .gte("created_at", startOfTodayIso),
      ]);

      if (allResult.error) throw allResult.error;
      if (todayResult.error) throw todayResult.error;

      return [perkId, { total: allResult.count ?? 0, today: todayResult.count ?? 0 }] as const;
    }),
  );

  const drawCountMap = new Map(drawStats);

  return perks.map((perk) => {
    const prizeCount = prizeCounts.get(perk.id) ?? { total: 0, enabled: 0 };
    const draws = drawCountMap.get(perk.id) ?? { total: 0, today: 0 };

    return {
      reward: perk,
      prizeCount: prizeCount.total,
      enabledPrizeCount: prizeCount.enabled,
      drawsTotal: draws.total,
      drawsToday: draws.today,
      fallbackConfigured: fallbackConfigured.get(perk.id) ?? false,
    };
  });
}

export async function getAdminRewardDetail(supabase: SupabaseClient, rewardId: string) {
  const detailSelect =
    "id, campaign_id, title, description, cost_xp, status, is_enabled, fulfillment_type, visibility_mode, total_uploaded, total_available, per_user_limit, limit_period, offer_expires_at, updated_at, thumbnail, terms, claim_steps, fulfillment_config, redemption_window_days, sort_order, starts_at, ends_at";
  const { data: reward, error } = await supabase
    .from("rewards")
    .select(`${detailSelect}, distribution_mode`)
    .eq("id", rewardId)
    .maybeSingle<AdminRewardDetail>();

  let resolvedReward: AdminRewardDetail | null = reward ?? null;

  if (error) {
    if (!isMissingDistributionModeError(error)) {
      throw error;
    }

    const legacyResult = await supabase
      .from("rewards")
      .select(detailSelect)
      .eq("id", rewardId)
      .maybeSingle<LegacyAdminRewardRow & Omit<AdminRewardDetail, keyof AdminRewardRow>>();

    if (legacyResult.error) {
      throw legacyResult.error;
    }

    resolvedReward = legacyResult.data ? withDerivedDistributionMode(legacyResult.data) : null;
  }

  if (!resolvedReward) {
    return null;
  }

  const [itemsResult, adjustmentsResult, perkPrizesResult, perkRewardCandidatesResult] = await Promise.all([
    supabase
      .from("reward_inventory_items")
      .select("id, campaign_id, item_type, payload, status, available_from, expires_at, uploaded_at, assigned_at, redeemed_at, batch_label, partner_reference")
      .eq("reward_id", rewardId)
      .order("uploaded_at", { ascending: false })
      .limit(50)
      .returns<AdminInventoryItem[]>(),
    supabase
      .from("reward_inventory_adjustments")
      .select("id, reward_id, campaign_id, delta, reason, created_at, batch_label, partner_reference")
      .eq("reward_id", rewardId)
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<AdminInventoryAdjustment[]>(),
    supabase
      .from("perk_bundle_prizes")
      .select("id, bundle_reward_id, prize_type, source_reward_id, title, thumbnail, config, weight, total_win_cap, daily_win_cap, available_from, expires_at, sort_order, is_enabled, created_at, updated_at")
      .eq("bundle_reward_id", rewardId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<AdminPerkPrizeRow[]>(),
    supabase
      .from("rewards")
      .select("id, title, fulfillment_type, visibility_mode, distribution_mode, status, is_enabled, total_available")
      .neq("id", rewardId)
      .order("title", { ascending: true })
      .returns<AdminRewardCandidateRow[]>(),
  ]);

  if (itemsResult.error) {
    throw itemsResult.error;
  }

  if (adjustmentsResult.error) {
    throw adjustmentsResult.error;
  }

  if (perkPrizesResult.error) {
    throw perkPrizesResult.error;
  }

  let perkRewardCandidates = perkRewardCandidatesResult.data ?? [];

  if (perkRewardCandidatesResult.error) {
    if (!isMissingDistributionModeError(perkRewardCandidatesResult.error)) {
      throw perkRewardCandidatesResult.error;
    }

    const legacyCandidatesResult = await supabase
      .from("rewards")
      .select("id, title, fulfillment_type, visibility_mode, status, is_enabled, total_available")
      .neq("id", rewardId)
      .order("title", { ascending: true })
      .returns<LegacyAdminRewardRow[]>();

    if (legacyCandidatesResult.error) {
      throw legacyCandidatesResult.error;
    }

    perkRewardCandidates = (legacyCandidatesResult.data ?? [])
      .map(withDerivedDistributionMode)
      .filter((candidate) => candidate.distribution_mode !== "perk_bundle");
  } else {
    perkRewardCandidates = perkRewardCandidates.filter(
      (candidate) => candidate.distribution_mode !== "perk_bundle",
    );
  }

  if (perkRewardCandidates.length > 0) {
    const assignmentCountsResult = await supabase
      .rpc("admin_reward_assignment_counts", {
        p_reward_ids: perkRewardCandidates.map((candidate) => candidate.id),
      })
      .returns<AdminRewardAssignmentCountRow[]>();

    if (assignmentCountsResult.error && !isMissingPerkPrizeInventoryAssignmentError(assignmentCountsResult.error)) {
      throw assignmentCountsResult.error;
    }

    const assignmentCountRows = Array.isArray(assignmentCountsResult.data)
      ? assignmentCountsResult.data
      : [];
    const assignmentCounts = new Map(
      assignmentCountRows.map((row: AdminRewardAssignmentCountRow) => [row.reward_id, row]),
    );

    perkRewardCandidates = perkRewardCandidates.map((candidate) => {
      const stats = assignmentCounts.get(candidate.id);
      return {
        ...candidate,
        total_available: (stats?.total_available ?? candidate.total_available ?? 0) as number,
        direct_available: (stats?.direct_available ?? candidate.total_available ?? 0) as number,
        assigned_available: (stats?.assigned_available ?? 0) as number,
      };
    });
  }

  const allPerkRewardCandidates = perkRewardCandidates;
  const sourceRewards = new Map(
    allPerkRewardCandidates.map((candidate) => [candidate.id, candidate]),
  );
  const existingRewardPrizeIds = new Set(
    (perkPrizesResult.data ?? [])
      .filter((prize) => prize.prize_type === "reward" && Boolean(prize.source_reward_id))
      .map((prize) => prize.source_reward_id as string),
  );
  perkRewardCandidates = allPerkRewardCandidates.filter(
    (candidate) => !existingRewardPrizeIds.has(candidate.id),
  );

  const isPerk = resolvedReward.distribution_mode === "perk_bundle";
  let perkPrizePerformance = new Map<string, AdminPerkPrizePerformance>();
  let perkPrizeReleaseBuckets = new Map<string, AdminPerkPrizeReleaseBucketRow[]>();
  let perkDrawHistory: AdminPerkDrawRow[] = [];
  let perkAnalytics: AdminPerkAnalytics = {
    activePrizeCount: 0,
    drawsTotal: 0,
    drawsToday: 0,
    fallbackDrawsTotal: 0,
    fallbackDrawsToday: 0,
    fallbackRateTotal: 0,
    fallbackRateToday: 0,
  };
  let perkTrend: AdminPerkTrendPoint[] = [];
  let perkDistribution: AdminPerkDistributionRow[] = [];

  if (isPerk) {
    const startOfTodayIso = getStartOfTodayInLagosIso();
    const prizeRows = perkPrizesResult.data ?? [];
    const trendStartDate = new Date();
    trendStartDate.setUTCDate(trendStartDate.getUTCDate() - 13);
    trendStartDate.setUTCHours(0, 0, 0, 0);
    const trendStartIso = trendStartDate.toISOString();

    const [
      recentDrawsResult,
      totalDrawsResult,
      todayDrawsResult,
      fallbackTotalResult,
      fallbackTodayResult,
      trendDrawsResult,
      releaseBucketsResult,
      prizeAssignmentCountsResult,
    ] =
      await Promise.all([
        supabase
          .from("perk_bundle_draws")
          .select("id, bundle_reward_id, user_id, redemption_id, prize_id, awarded_reward_id, awarded_fulfillment_type, awarded_title, awarded_thumbnail, awarded_payload, award_status, created_at")
          .eq("bundle_reward_id", rewardId)
          .order("created_at", { ascending: false })
          .limit(25)
          .returns<AdminPerkDrawRow[]>(),
        supabase
          .from("perk_bundle_draws")
          .select("id", { count: "exact", head: true })
          .eq("bundle_reward_id", rewardId),
        supabase
          .from("perk_bundle_draws")
          .select("id", { count: "exact", head: true })
          .eq("bundle_reward_id", rewardId)
          .gte("created_at", startOfTodayIso),
        supabase
          .from("perk_bundle_draws")
          .select("id", { count: "exact", head: true })
          .eq("bundle_reward_id", rewardId)
          .is("prize_id", null),
        supabase
          .from("perk_bundle_draws")
          .select("id", { count: "exact", head: true })
          .eq("bundle_reward_id", rewardId)
          .is("prize_id", null)
          .gte("created_at", startOfTodayIso),
        supabase
          .from("perk_bundle_draws")
          .select("id, prize_id, created_at")
          .eq("bundle_reward_id", rewardId)
          .gte("created_at", trendStartIso)
          .order("created_at", { ascending: true })
          .returns<Array<{ id: string; prize_id: string | null; created_at: string }>>(),
        supabase
          .from("perk_prize_release_buckets")
          .select("id, prize_id, label, starts_at, ends_at, release_cap, sort_order, is_enabled, created_at, updated_at")
          .in("prize_id", prizeRows.map((prize) => prize.id))
          .order("sort_order", { ascending: true })
          .order("starts_at", { ascending: true })
          .returns<AdminPerkPrizeReleaseBucketRow[]>(),
        supabase
          .rpc("admin_perk_prize_assignment_counts", {
            p_prize_ids: prizeRows.map((prize) => prize.id),
          })
          .returns<AdminPerkPrizeAssignmentCountRow[]>(),
      ]);

    if (recentDrawsResult.error) throw recentDrawsResult.error;
    if (totalDrawsResult.error) throw totalDrawsResult.error;
    if (todayDrawsResult.error) throw todayDrawsResult.error;
    if (fallbackTotalResult.error) throw fallbackTotalResult.error;
    if (fallbackTodayResult.error) throw fallbackTodayResult.error;
    if (trendDrawsResult.error) throw trendDrawsResult.error;
    if (releaseBucketsResult.error && !isMissingPerkReleaseBucketError(releaseBucketsResult.error)) {
      throw releaseBucketsResult.error;
    }
    if (
      prizeAssignmentCountsResult.error
      && !isMissingPerkPrizeInventoryAssignmentError(prizeAssignmentCountsResult.error)
    ) {
      throw prizeAssignmentCountsResult.error;
    }

    const prizeAssignmentCountRows = Array.isArray(prizeAssignmentCountsResult.data)
      ? prizeAssignmentCountsResult.data
      : [];
    const prizeAssignmentCounts = new Map(
      prizeAssignmentCountRows.map((row: AdminPerkPrizeAssignmentCountRow) => [row.prize_id, row.assigned_available]),
    );

    const performanceRows = await Promise.all(
      prizeRows.map(async (prize) => {
        const [totalResult, todayResult] = await Promise.all([
          supabase
            .from("perk_bundle_draws")
            .select("id", { count: "exact", head: true })
            .eq("prize_id", prize.id),
          supabase
            .from("perk_bundle_draws")
            .select("id", { count: "exact", head: true })
            .eq("prize_id", prize.id)
            .gte("created_at", startOfTodayIso),
        ]);

        if (totalResult.error) throw totalResult.error;
        if (todayResult.error) throw todayResult.error;

        const drawsTotal = totalResult.count ?? 0;
        const drawsToday = todayResult.count ?? 0;

        return {
          prizeId: prize.id,
          drawsTotal,
          drawsToday,
          remainingTotal:
            prize.total_win_cap === null ? null : Math.max(0, prize.total_win_cap - drawsTotal),
          remainingToday:
            prize.daily_win_cap === null ? null : Math.max(0, prize.daily_win_cap - drawsToday),
        } satisfies AdminPerkPrizePerformance;
      }),
    );

    perkPrizePerformance = new Map(performanceRows.map((row) => [row.prizeId, row]));

    const bucketRows = releaseBucketsResult.data ?? [];
    const bucketsByPrize = new Map<string, AdminPerkPrizeReleaseBucketRow[]>();

    for (const bucket of bucketRows) {
      const drawsInBucket = trendDrawsResult.data?.filter((draw) => {
        if (draw.prize_id !== bucket.prize_id) return false;
        const createdAt = new Date(draw.created_at).getTime();
        const startsAt = new Date(bucket.starts_at).getTime();
        const endsAt = bucket.ends_at ? new Date(bucket.ends_at).getTime() : null;
        return createdAt >= startsAt && (endsAt === null || createdAt < endsAt);
      }).length ?? 0;

      const nextBucket = {
        ...bucket,
        drawsInBucket,
        remainingInBucket: Math.max(0, bucket.release_cap - drawsInBucket),
      };

      const current = bucketsByPrize.get(bucket.prize_id) ?? [];
      current.push(nextBucket);
      bucketsByPrize.set(bucket.prize_id, current);
    }

    perkPrizeReleaseBuckets = bucketsByPrize;

    const recentDraws = recentDrawsResult.data ?? [];
    const [profiles, awardedRewards] = await Promise.all([
      getProfilesByIds(
        supabase,
        recentDraws.map((draw) => draw.user_id),
      ),
      getRewardsByIds(
        supabase,
        recentDraws.map((draw) => draw.awarded_reward_id ?? ""),
      ),
    ]);

    perkDrawHistory = recentDraws.map((draw) => ({
      ...draw,
      profile: profiles.get(draw.user_id),
      awarded_reward: draw.awarded_reward_id ? awardedRewards.get(draw.awarded_reward_id) ?? null : null,
    }));

    const drawsTotal = totalDrawsResult.count ?? 0;
    const drawsToday = todayDrawsResult.count ?? 0;
    const fallbackDrawsTotal = fallbackTotalResult.count ?? 0;
    const fallbackDrawsToday = fallbackTodayResult.count ?? 0;
    const trendDraws = trendDrawsResult.data ?? [];
    const trendMap = new Map<string, { draws: number; fallbackDraws: number }>();

    for (let offset = 13; offset >= 0; offset -= 1) {
      const pointDate = new Date();
      pointDate.setUTCDate(pointDate.getUTCDate() - offset);
      const key = pointDate.toISOString().slice(0, 10);
      trendMap.set(key, { draws: 0, fallbackDraws: 0 });
    }

    for (const draw of trendDraws) {
      const key = draw.created_at.slice(0, 10);
      const current = trendMap.get(key);
      if (!current) continue;
      current.draws += 1;
      if (!draw.prize_id) {
        current.fallbackDraws += 1;
      }
    }

    perkTrend = Array.from(trendMap.entries()).map(([date, value]) => ({
      date,
      draws: value.draws,
      fallbackDraws: value.fallbackDraws,
    }));

    const totalPrizeDraws = performanceRows.reduce((sum, row) => sum + row.drawsTotal, 0);
    perkDistribution = prizeRows
      .map((prize) => {
        const draws = perkPrizePerformance.get(prize.id)?.drawsTotal ?? 0;
        const linkedReward = prize.source_reward_id ? sourceRewards.get(prize.source_reward_id) : null;
        return {
          key: prize.id,
          label: linkedReward?.title ?? prize.title ?? prize.source_reward_id ?? "Prize",
          draws,
          share: totalPrizeDraws > 0 ? draws / totalPrizeDraws : 0,
        };
      })
      .filter((row) => row.draws > 0)
      .sort((a, b) => b.draws - a.draws);

    if (fallbackDrawsTotal > 0) {
      perkDistribution.push({
        key: "fallback",
        label: "Fallback",
        draws: fallbackDrawsTotal,
        share: drawsTotal > 0 ? fallbackDrawsTotal / drawsTotal : 0,
      });
    }

    perkAnalytics = {
      activePrizeCount: prizeRows.filter((prize) => prize.is_enabled).length,
      drawsTotal,
      drawsToday,
      fallbackDrawsTotal,
      fallbackDrawsToday,
      fallbackRateTotal: drawsTotal > 0 ? fallbackDrawsTotal / drawsTotal : 0,
      fallbackRateToday: drawsToday > 0 ? fallbackDrawsToday / drawsToday : 0,
    };

    perkPrizesResult.data = prizeRows.map((prize) => ({
      ...prize,
      assigned_available: Number(prizeAssignmentCounts.get(prize.id) ?? 0),
      source_reward_direct_available: prize.source_reward_id
        ? Number(sourceRewards.get(prize.source_reward_id)?.direct_available ?? 0)
        : 0,
      source_reward_total_available: prize.source_reward_id
        ? Number(sourceRewards.get(prize.source_reward_id)?.total_available ?? 0)
        : 0,
      source_reward_assigned_available: prize.source_reward_id
        ? Number(sourceRewards.get(prize.source_reward_id)?.assigned_available ?? 0)
        : 0,
    }));
  }

  return {
    reward: {
      ...resolvedReward,
      campaign: resolvedReward.campaign_id
        ? (await getCampaignsByIds(supabase, [resolvedReward.campaign_id])).get(resolvedReward.campaign_id) ?? null
        : null,
    },
    inventoryItems: itemsResult.data ?? [],
    adjustments: adjustmentsResult.data ?? [],
    perkPrizes: (perkPrizesResult.data ?? []).map((prize) => ({
      ...prize,
      source_reward: prize.source_reward_id ? sourceRewards.get(prize.source_reward_id) ?? null : null,
      performance: perkPrizePerformance.get(prize.id) ?? null,
      releaseBuckets: perkPrizeReleaseBuckets.get(prize.id) ?? [],
    })),
    perkRewardCandidates,
    perkDrawHistory,
    perkAnalytics,
    perkTrend,
    perkDistribution,
  };
}

export async function getAdminPerkDraws(
  supabase: SupabaseClient,
  rewardId: string,
  limit = 250,
) {
  const { data, error } = await supabase
    .from("perk_bundle_draws")
    .select("id, bundle_reward_id, user_id, redemption_id, prize_id, awarded_reward_id, awarded_fulfillment_type, awarded_title, awarded_thumbnail, awarded_payload, award_status, created_at")
    .eq("bundle_reward_id", rewardId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<AdminPerkDrawRow[]>();

  if (error) {
    throw error;
  }

  const draws = data ?? [];
  const [profiles, awardedRewards] = await Promise.all([
    getProfilesByIds(
      supabase,
      draws.map((draw) => draw.user_id),
    ),
    getRewardsByIds(
      supabase,
      draws.map((draw) => draw.awarded_reward_id ?? ""),
    ),
  ]);

  return draws.map((draw) => ({
    ...draw,
    profile: profiles.get(draw.user_id),
    awarded_reward: draw.awarded_reward_id ? awardedRewards.get(draw.awarded_reward_id) ?? null : null,
  }));
}

export async function getAdminRedemptions(
  supabase: SupabaseClient,
  filters: AdminRedemptionFilters = {},
  limit = 100,
) {
  let query = supabase
    .from("reward_redemptions")
    .select(
      "id, user_id, reward_id, status, claim_state, reward_title_snapshot, xp_cost_at_redemption, fulfillment_type, claim_data, user_message, redemption_expires_at, refunded_at, fulfilled_at, admin_note, requested_at",
    )
    .order("requested_at", { ascending: false });

  if (filters.claimState) {
    query = query.eq("claim_state", filters.claimState);
  }

  if (filters.fulfillmentType) {
    query = query.eq("fulfillment_type", filters.fulfillmentType);
  }

  if (filters.rewardId) {
    query = query.eq("reward_id", filters.rewardId);
  }

  if (filters.dateFrom) {
    query = query.gte("requested_at", filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte("requested_at", filters.dateTo);
  }

  const { data, error } = await query.limit(limit).returns<AdminRedemptionRow[]>();

  if (error) {
    throw error;
  }

  let redemptions = data ?? [];

  const [profiles, rewards] = await Promise.all([
    getProfilesByIds(
      supabase,
      redemptions.map((redemption) => redemption.user_id),
    ),
    getRewardsByIds(
      supabase,
      redemptions.map((redemption) => redemption.reward_id),
    ),
  ]);

  if (filters.campaignId) {
    redemptions = redemptions.filter((redemption) => {
      const reward = rewards.get(redemption.reward_id);
      return filters.campaignId === "none"
        ? !reward?.campaign_id
        : reward?.campaign_id === filters.campaignId;
    });
  }

  return redemptions.map((redemption) => ({
    ...redemption,
    profile: profiles.get(redemption.user_id),
    reward: rewards.get(redemption.reward_id) ?? null,
  }));
}

async function getRewardsByIds(supabase: SupabaseClient, rewardIds: string[]) {
  const uniqueIds = Array.from(new Set(rewardIds)).filter(Boolean);

  if (uniqueIds.length === 0) {
    return new Map<string, AdminRewardRow>();
  }

  const baseSelect =
    "id, campaign_id, title, description, cost_xp, status, is_enabled, fulfillment_type, visibility_mode, total_uploaded, total_available, per_user_limit, limit_period, offer_expires_at, updated_at";
  const { data, error } = await supabase
    .from("rewards")
    .select(`${baseSelect}, distribution_mode`)
    .in("id", uniqueIds)
    .returns<AdminRewardRow[]>();

  let resolvedData: AdminRewardRow[] | null = data ?? null;

  if (error) {
    if (!isMissingDistributionModeError(error)) {
      throw error;
    }

    const legacyResult = await supabase
      .from("rewards")
      .select(baseSelect)
      .in("id", uniqueIds)
      .returns<LegacyAdminRewardRow[]>();

    if (legacyResult.error) {
      throw legacyResult.error;
    }

    resolvedData = (legacyResult.data ?? []).map(withDerivedDistributionMode);
  }

  return new Map((resolvedData ?? []).map((reward) => [reward.id, reward]));
}

export async function getAdminCampaignAnalytics(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<AdminCampaignAnalytics> {
  const { data: rewards, error: rewardsError } = await supabase
    .from("rewards")
    .select(
      "id, campaign_id, title, description, cost_xp, status, is_enabled, fulfillment_type, visibility_mode, total_uploaded, total_available, per_user_limit, limit_period, offer_expires_at, updated_at",
    )
    .eq("campaign_id", campaignId)
    .returns<AdminRewardRow[]>();

  if (rewardsError) {
    throw rewardsError;
  }

  const rewardRows = rewards ?? [];
  const rewardIds = rewardRows.map((reward) => reward.id);

  if (rewardIds.length === 0) {
    return {
      totalRewards: 0,
      enabledRewards: 0,
      totalInventoryUploaded: 0,
      totalInventoryAvailable: 0,
      redemptionsRequested: 0,
      redemptionsFulfilled: 0,
      redemptionsRefunded: 0,
      xpSpent: 0,
      pendingManualSubmissions: 0,
      reallocatedIn: 0,
      reallocatedOut: 0,
      rewardMetrics: [],
    };
  }

  const [redemptionsResult, reallocationsInResult, reallocationsOutResult] = await Promise.all([
    supabase
      .from("reward_redemptions")
      .select("id, reward_id, claim_state, xp_cost_at_redemption, fulfillment_type")
      .in("reward_id", rewardIds)
      .returns<Array<{
        id: string;
        reward_id: string;
        claim_state: string;
        xp_cost_at_redemption: number | null;
        fulfillment_type: string | null;
      }>>(),
    supabase
      .from("reward_inventory_reallocations")
      .select("quantity")
      .eq("to_campaign_id", campaignId)
      .returns<Array<{ quantity: number }>>(),
    supabase
      .from("reward_inventory_reallocations")
      .select("quantity")
      .eq("from_campaign_id", campaignId)
      .returns<Array<{ quantity: number }>>(),
  ]);

  if (redemptionsResult.error) throw redemptionsResult.error;

  const redemptions = redemptionsResult.data ?? [];
  const redemptionsByReward = new Map<string, typeof redemptions>();

  for (const redemption of redemptions) {
    const current = redemptionsByReward.get(redemption.reward_id) ?? [];
    current.push(redemption);
    redemptionsByReward.set(redemption.reward_id, current);
  }

  const rewardMetrics = rewardRows.map((reward) => {
    const rewardRedemptions = redemptionsByReward.get(reward.id) ?? [];
    const activeRedemptions = rewardRedemptions.filter(
      (redemption) => redemption.claim_state !== "refunded" && redemption.claim_state !== "cancelled",
    );

    return {
      rewardId: reward.id,
      title: reward.title,
      fulfillmentType: reward.fulfillment_type,
      costXp: reward.cost_xp,
      totalUploaded: reward.total_uploaded,
      totalAvailable: reward.total_available,
      purchases: activeRedemptions.length,
      fulfilled: rewardRedemptions.filter((redemption) => redemption.claim_state === "fulfilled").length,
      refunded: rewardRedemptions.filter((redemption) => redemption.claim_state === "refunded").length,
      xpSpent: activeRedemptions.reduce(
        (sum, redemption) => sum + (redemption.xp_cost_at_redemption ?? 0),
        0,
      ),
    };
  });

  return {
    totalRewards: rewardRows.length,
    enabledRewards: rewardRows.filter((reward) => reward.is_enabled).length,
    totalInventoryUploaded: rewardRows.reduce((sum, reward) => sum + reward.total_uploaded, 0),
    totalInventoryAvailable: rewardRows.reduce((sum, reward) => sum + reward.total_available, 0),
    redemptionsRequested: redemptions.filter(
      (redemption) => redemption.claim_state !== "refunded" && redemption.claim_state !== "cancelled",
    ).length,
    redemptionsFulfilled: redemptions.filter((redemption) => redemption.claim_state === "fulfilled").length,
    redemptionsRefunded: redemptions.filter((redemption) => redemption.claim_state === "refunded").length,
    xpSpent: rewardMetrics.reduce((sum, reward) => sum + reward.xpSpent, 0),
    pendingManualSubmissions: redemptions.filter(
      (redemption) => redemption.fulfillment_type === "manual" && redemption.claim_state === "details_submitted",
    ).length,
    reallocatedIn: reallocationsInResult.error
      ? 0
      : (reallocationsInResult.data ?? []).reduce((sum, item) => sum + item.quantity, 0),
    reallocatedOut: reallocationsOutResult.error
      ? 0
      : (reallocationsOutResult.data ?? []).reduce((sum, item) => sum + item.quantity, 0),
    rewardMetrics,
  };
}

export async function getAdminMissions(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("missions")
    .select(
      "id, title, description, category, reward_type, reward_xp, reward_id, repeatability, validation_type, validation_config, status, starts_at, ends_at, sort_order, reward:rewards!missions_reward_id_fkey(id, title, fulfillment_type)",
    )
    .order("sort_order", { ascending: true })
    .returns<AdminMissionRow[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getAdminMission(supabase: SupabaseClient, missionId: string) {
  const { data, error } = await supabase
    .from("missions")
    .select(
      "id, title, description, category, reward_type, reward_xp, reward_id, repeatability, validation_type, validation_config, status, starts_at, ends_at, sort_order, reward:rewards!missions_reward_id_fkey(id, title, fulfillment_type)",
    )
    .eq("id", missionId)
    .maybeSingle<AdminMissionRow>();

  if (error) {
    throw error;
  }

  return data;
}

export async function getAdminMissionRewardCandidates(supabase: SupabaseClient) {
  const candidatesResult = await supabase
    .from("rewards")
    .select("id, title, fulfillment_type, visibility_mode, distribution_mode, status, is_enabled, total_available")
    .order("title", { ascending: true })
    .returns<AdminRewardCandidateRow[]>();

  if (candidatesResult.error) {
    if (!isMissingDistributionModeError(candidatesResult.error)) {
      throw candidatesResult.error;
    }

    const legacyCandidatesResult = await supabase
      .from("rewards")
      .select("id, title, fulfillment_type, visibility_mode, status, is_enabled, total_available")
      .order("title", { ascending: true })
      .returns<LegacyAdminRewardRow[]>();

    if (legacyCandidatesResult.error) {
      throw legacyCandidatesResult.error;
    }

    return (legacyCandidatesResult.data ?? [])
      .map(withDerivedDistributionMode)
      .filter((candidate) => candidate.distribution_mode !== "perk_bundle");
  }

  return (candidatesResult.data ?? []).filter(
    (candidate) => candidate.distribution_mode !== "perk_bundle",
  );
}

export async function getAdminRecommendationSections(
  supabase: SupabaseClient,
): Promise<AdminRecommendationSection[]> {
  const [sectionsResult, itemsResult, courses, lessons] = await Promise.all([
    supabase
      .from("recommendation_sections")
      .select("id, slug, placement, eyebrow, title, subtitle, status, sort_order, starts_at, ends_at, created_at, updated_at")
      .eq("placement", "dashboard")
      .order("sort_order", { ascending: true })
      .returns<AdminRecommendationSectionRow[]>(),
    supabase
      .from("recommendation_items")
      .select("id, section_id, item_type, item_id, sort_order, created_at")
      .order("sort_order", { ascending: true })
      .returns<AdminRecommendationItemRow[]>(),
    getAdminCourses(supabase),
    getAdminLessons(supabase),
  ]);

  if (sectionsResult.error) {
    throw sectionsResult.error;
  }

  if (itemsResult.error) {
    throw itemsResult.error;
  }

  const courseMap = new Map(courses.map((course) => [course.id, course]));
  const lessonMap = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const itemsBySection = new Map<string, AdminRecommendationItemRow[]>();

  for (const item of itemsResult.data ?? []) {
    const current = itemsBySection.get(item.section_id) ?? [];
    current.push(item);
    itemsBySection.set(item.section_id, current);
  }

  return (sectionsResult.data ?? []).map((section) => ({
    ...section,
    items: (itemsBySection.get(section.id) ?? []).map((item) => {
      if (item.item_type === "course") {
        const course = courseMap.get(item.item_id);
        return {
          ...item,
          label: course?.title ?? item.item_id,
          status: course?.status ?? "missing",
        };
      }

      const lesson = lessonMap.get(item.item_id);
      return {
        ...item,
        label: lesson?.title ?? item.item_id,
        status: lesson?.status ?? "missing",
      };
    }),
  }));
}

export async function getAdminProofSubmissions(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("mission_proofs")
    .select(
      "id, user_id, mission_id, award_scope, proof_type, value, status, rejection_reason, created_at, reviewed_at",
    )
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<AdminProofRow[]>();

  if (error) {
    throw error;
  }

  const proofs = data ?? [];
  const [profiles, missions] = await Promise.all([
    getProfilesByIds(
      supabase,
      proofs.map((proof) => proof.user_id),
    ),
    getAdminMissions(supabase),
  ]);
  const missionMap = new Map(missions.map((mission) => [mission.id, mission]));
  const grouped = new Map<string, AdminProofSubmission>();

  for (const proof of proofs) {
    const key = `${proof.user_id}:${proof.mission_id}:${proof.award_scope}`;
    const existing = grouped.get(key);
    const nextStatus =
      proof.status === "rejected"
        ? "rejected"
        : existing?.status === "rejected"
          ? "rejected"
          : proof.status === "submitted"
            ? "submitted"
            : existing?.status ?? "approved";

    grouped.set(key, {
      key,
      userId: proof.user_id,
      missionId: proof.mission_id,
      awardScope: proof.award_scope,
      status: nextStatus,
      createdAt: existing?.createdAt ?? proof.created_at,
      reviewedAt: proof.reviewed_at ?? existing?.reviewedAt ?? null,
      proofs: [...(existing?.proofs ?? []), proof],
      profile: profiles.get(proof.user_id),
      mission: missionMap.get(proof.mission_id),
    });
  }

  return Array.from(grouped.values()).map((submission) => {
    const submittedProofs = submission.proofs.filter((proof) => proof.status === "submitted");
    const rejectedProofs = submission.proofs.filter((proof) => proof.status === "rejected");
    const approvedProofs = submission.proofs.filter((proof) => proof.status === "approved");

    if (submittedProofs.length > 0) {
      return {
        ...submission,
        status: "submitted",
        createdAt: submittedProofs[0]?.created_at ?? submission.createdAt,
        reviewedAt: null,
        proofs: submittedProofs,
      };
    }

    if (rejectedProofs.length > 0) {
      return {
        ...submission,
        status: "rejected",
        proofs: rejectedProofs,
      };
    }

    return {
      ...submission,
      status: "approved",
      proofs: approvedProofs.length > 0 ? approvedProofs : submission.proofs,
    };
  });
}

export async function getAdminUsers(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, referral_code, xp_balance_cached, role, created_at, redemption_unlocked_at, fraud_review_status",
    )
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<AdminProfileRow[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getAdminXpSettings(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("xp_settings")
    .select("id, default_daily_quiz_xp_limit, admin_manual_grant_daily_limit, updated_at")
    .eq("id", 1)
    .maybeSingle<AdminXpSettingsRow>();

  if (error) {
    throw error;
  }

  return data;
}

export async function getAdminManualXpGrantStatus(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("admin_manual_xp_grant_status");

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as AdminManualXpGrantStatusRow | null;
}

export async function getAdminXpLedger(
  supabase: SupabaseClient,
  filters: AdminXpLedgerFilters = {},
) {
  let userIds: string[] | null = null;

  if (filters.userQuery?.trim()) {
    const userQuery = filters.userQuery.trim().replace(/[,%()]/g, " ");
    const { data: matchedProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select(
        "id, display_name, referral_code, xp_balance_cached, role, created_at, redemption_unlocked_at, fraud_review_status",
      )
      .or(
        [
          `display_name.ilike.%${userQuery}%`,
          `referral_code.ilike.%${userQuery}%`,
          `id.ilike.%${userQuery}%`,
        ].join(","),
      )
      .limit(100)
      .returns<AdminProfileRow[]>();

    if (profilesError) {
      throw profilesError;
    }

    userIds = (matchedProfiles ?? []).map((profile) => profile.id);
    if (userIds.length === 0) {
      return [];
    }
  }

  let query = supabase
    .from("xp_transactions")
    .select("id, user_id, amount, direction, source_type, source_id, award_scope, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (userIds) {
    query = query.in("user_id", userIds);
  }

  if (filters.direction) {
    query = query.eq("direction", filters.direction);
  }

  if (filters.sourceType) {
    query = query.eq("source_type", filters.sourceType);
  }

  if (filters.dateFrom) {
    query = query.gte("created_at", `${filters.dateFrom}T00:00:00.000Z`);
  }

  if (filters.dateTo) {
    query = query.lte("created_at", `${filters.dateTo}T23:59:59.999Z`);
  }

  const { data, error } = await query.returns<AdminXpTransactionRow[]>();

  if (error) {
    throw error;
  }

  const profiles = await getProfilesByIds(
    supabase,
    (data ?? []).map((transaction) => transaction.user_id),
  );

  return (data ?? []).map((transaction) => ({
    ...transaction,
    profile: profiles.get(transaction.user_id),
  }));
}
