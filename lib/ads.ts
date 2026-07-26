import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { hashRiskValue } from "@/lib/auth-risk";

export type AdPlacementKey =
  | "lesson_footer_card"
  | "home_feed_card"
  | "course_detail_card"
  | "missions_card"
  | "xp_store_card";

export type DirectAdFormat = "native_card" | "image_banner" | "text_card" | "video_card";

export type DirectAdDecisionContext = {
  placementKey: AdPlacementKey;
  route: string;
  userId?: string | null;
  courseId?: string | null;
  courseCategory?: string | null;
  lessonId?: string | null;
  pageId?: string | null;
  pageNumber?: number | null;
  pageType?: string | null;
  contentValueTags?: string[];
  segmentKeys?: string[];
};

export type DirectAdCardModel = {
  decisionId: string;
  placementKey: AdPlacementKey;
  format: DirectAdFormat;
  isPaid: boolean;
  sponsorLabel: string;
  disclosureLabel: string;
  eyebrow?: string | null;
  headline: string;
  body?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  logoUrl?: string | null;
  ctaLabel?: string | null;
  clickUrl?: string | null;
  legalText?: string | null;
  theme?: Record<string, unknown>;
};

type ContentValueTagRow = {
  content_type: string;
  content_id: string;
  dimension_id: string;
  weight: number;
  recommended_level: string | null;
  outcome_type: string | null;
};

type UserValueProfileRow = {
  assessment_completed_at: string | null;
  readiness_level: string;
  primary_dimension_id: string | null;
  secondary_dimension_id: string | null;
};

type UserValueScoreRow = {
  dimension_id: string;
  score: number;
  confidence: number;
};

type PlacementRow = {
  key: AdPlacementKey;
  status: string;
  allowed_creative_formats: DirectAdFormat[];
  supports_video: boolean;
  supports_sequence: boolean;
  default_frequency_cap: Record<string, unknown> | null;
};

type PartnerRow = {
  id: string;
  name: string;
  status: string;
  terms_accepted_at: string | null;
};

type CampaignRow = {
  id: string;
  partner_id: string;
  name: string;
  status: string;
  campaign_type: "guaranteed" | "priority" | "house" | "bonus";
  starts_at: string | null;
  ends_at: string | null;
  included_content_tags: string[] | null;
  excluded_content_tags: string[] | null;
  included_course_categories: string[] | null;
  excluded_course_categories: string[] | null;
  included_course_ids: string[] | null;
  excluded_course_ids: string[] | null;
  included_lesson_ids: string[] | null;
  excluded_lesson_ids: string[] | null;
  excluded_page_types: string[] | null;
  competitor_exclusion_keys: string[] | null;
  priority: number;
  pacing_mode: "even" | "asap" | "manual";
  pricing_model: string;
  spend_cap_amount: number | null;
  allow_overspend: boolean;
  overspend_tolerance_percent: number;
  contracted_impressions: number | null;
  contracted_viewable_impressions: number | null;
};

type CreativeRow = {
  id: string;
  campaign_id: string;
  status: string;
  creative_format: DirectAdFormat;
  weight: number;
};

type CreativeVersionRow = {
  id: string;
  creative_id: string;
  status: string;
  headline: string | null;
  body: string | null;
  eyebrow: string | null;
  image_asset_id: string | null;
  image_alt: string | null;
  logo_asset_id: string | null;
  cta_label: string | null;
  cta_url: string | null;
  sponsor_label: string;
  disclosure_label: string;
  legal_text: string | null;
  theme: Record<string, unknown> | null;
};

type AssetRow = {
  id: string;
  storage_bucket: string;
  storage_path: string;
  public_url: string | null;
  asset_type: string;
  mime_type: string;
  status: string;
};

type FlightRow = {
  id: string;
  campaign_id: string;
  creative_id: string;
  creative_version_id: string;
  placement_key: AdPlacementKey;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  priority: number;
  weight: number;
  targeting_rules: Record<string, unknown> | null;
  frequency_caps: Record<string, unknown> | null;
  sequence_rules: Record<string, unknown> | null;
  brand_safety_rules: Record<string, unknown> | null;
  competitor_exclusion_keys: string[] | null;
};

type RuntimeCounts = {
  sessionPaidImpressions?: number;
  userCampaignImpressions24h?: number;
  userCreativeVersionImpressions24h?: number;
  userPartnerImpressions7d?: number;
  campaignBillableImpressions?: number;
  campaignBillableViewableImpressions?: number;
  campaignBillableClicks?: number;
  campaignBillableSpend?: number;
};

const activeStatuses = new Set(["active", "published", "approved"]);
const decisionTimeoutMs = 100;

function isActiveDateRange(startsAt: string | null, endsAt: string | null) {
  const now = Date.now();
  const start = startsAt ? new Date(startsAt).getTime() : null;
  const end = endsAt ? new Date(endsAt).getTime() : null;

  return (start === null || start <= now) && (end === null || end >= now);
}

function intersects(left: string[] | null | undefined, right: string[] | null | undefined) {
  if (!left?.length || !right?.length) return false;
  const rightSet = new Set(right.map((item) => item.toLowerCase()));
  return left.some((item) => rightSet.has(item.toLowerCase()));
}

function includesAny(required: string[] | null | undefined, available: string[] | null | undefined) {
  if (!required?.length) return true;
  return intersects(required, available);
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function asNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getFrequencyCaps(placement: PlacementRow, flight: FlightRow) {
  const placementCaps = placement.default_frequency_cap ?? {};
  const flightCaps = flight.frequency_caps ?? {};

  return {
    sessionMaxPaidAds: asNumber(
      flightCaps.sessionMaxPaidAds ?? placementCaps.sessionMaxPaidAds,
      5,
    ),
    userDailyCampaignImpressions: asNumber(
      flightCaps.userDailyCampaignImpressions ?? placementCaps.userDailyCampaignImpressions,
      3,
    ),
    userDailyCreativeVersionImpressions: asNumber(
      flightCaps.userDailyCreativeVersionImpressions ??
        placementCaps.userDailyCreativeVersionImpressions,
      2,
    ),
    userWeeklyPartnerImpressions: asNumber(
      flightCaps.userWeeklyPartnerImpressions ?? placementCaps.userWeeklyPartnerImpressions,
      5,
    ),
  };
}

function getSequenceScore(flight: FlightRow, pageNumber?: number | null) {
  const sequencePage = Number(flight.sequence_rules?.pageNumber ?? 0);

  if (!sequencePage || !pageNumber) return 0;
  return sequencePage === pageNumber ? 20 : -15;
}

function getExperimentAssignment(flight: FlightRow, sessionKeyHash: string | null) {
  const experimentKey = String(flight.targeting_rules?.experimentKey ?? "").trim();
  const variants = Array.isArray(flight.targeting_rules?.variants)
    ? flight.targeting_rules.variants.map((variant) => String(variant)).filter(Boolean)
    : [];

  if (!experimentKey || !variants.length) {
    return { experimentKey: null, variantKey: null };
  }

  const basis = `${sessionKeyHash ?? "anonymous"}:${flight.id}:${experimentKey}`;
  let hash = 0;

  for (const char of basis) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return {
    experimentKey,
    variantKey: variants[hash % variants.length] ?? null,
  };
}

function getPacingScore(campaign: CampaignRow, counts: RuntimeCounts) {
  if (campaign.pacing_mode === "asap") return 12;
  if (campaign.pacing_mode === "manual") return 0;

  const deliveryGoal =
    campaign.contracted_viewable_impressions ?? campaign.contracted_impressions ?? 0;

  if (!deliveryGoal || !campaign.starts_at || !campaign.ends_at) return 0;

  const start = new Date(campaign.starts_at).getTime();
  const end = new Date(campaign.ends_at).getTime();
  const now = Date.now();
  const totalDuration = Math.max(end - start, 1);
  const elapsed = Math.min(Math.max(now - start, 0), totalDuration);
  const expectedDeliveryRatio = elapsed / totalDuration;
  const delivered =
    counts.campaignBillableViewableImpressions ?? counts.campaignBillableImpressions ?? 0;
  const actualDeliveryRatio = delivered / deliveryGoal;

  if (actualDeliveryRatio < expectedDeliveryRatio * 0.8) return 18;
  if (actualDeliveryRatio > expectedDeliveryRatio * 1.2) return -18;
  return 0;
}

function getAssetPublicUrl(supabase: SupabaseClient, asset: AssetRow | undefined) {
  if (!asset) return null;
  if (asset.public_url) return asset.public_url;

  const { data } = supabase.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path);
  return data.publicUrl || null;
}

async function getSessionHash() {
  const cookieStore = await cookies();
  const deviceId = cookieStore.get("project-ve-device-id")?.value ?? null;
  return hashRiskValue(deviceId);
}

function buildHouseAd(context: DirectAdDecisionContext): DirectAdCardModel | null {
  const defaults: Record<AdPlacementKey, Pick<DirectAdCardModel, "eyebrow" | "headline" | "body" | "ctaLabel" | "clickUrl">> = {
    lesson_footer_card: {
      eyebrow: "Keep going",
      headline: "Earn more XP after this lesson",
      body: "Finish the quiz, then check Missions for practical actions that can unlock more progress.",
      ctaLabel: "Open Missions",
      clickUrl: "/missions",
    },
    home_feed_card: {
      eyebrow: "Recommended next",
      headline: "Pick up where your learning left off",
      body: "Continue a course or complete a mission to keep your progress moving.",
      ctaLabel: "Browse Courses",
      clickUrl: "/courses",
    },
    course_detail_card: {
      eyebrow: "Before you continue",
      headline: "Match lessons to your goals",
      body: "Use your values profile to prioritize the courses that fit your current goals.",
      ctaLabel: "View Profile",
      clickUrl: "/profile",
    },
    missions_card: {
      eyebrow: "More ways to progress",
      headline: "Complete missions to turn lessons into action",
      body: "Missions help you apply what you learn and earn XP.",
      ctaLabel: "View Missions",
      clickUrl: "/missions",
    },
    xp_store_card: {
      eyebrow: "Use your XP",
      headline: "Redeem rewards when you reach your goal",
      body: "Keep learning and completing missions to unlock more reward options.",
      ctaLabel: "View Rewards",
      clickUrl: "/xp-store",
    },
  };
  const fallback = defaults[context.placementKey];

  return {
    decisionId: `house-${context.placementKey}-${context.lessonId ?? "lesson"}-${context.pageId ?? "page"}`,
    placementKey: context.placementKey,
    format: "native_card",
    isPaid: false,
    sponsorLabel: "Project VE",
    disclosureLabel: "Project VE",
    ...fallback,
  };
}

export async function getAdContentValueTags(
  supabase: SupabaseClient | null,
  input: {
    courseId?: string | null;
    lessonId?: string | null;
    missionId?: string | null;
  },
) {
  if (!supabase) return [];

  const filters = [
    input.courseId ? { content_type: "course", content_id: input.courseId } : null,
    input.lessonId ? { content_type: "lesson", content_id: input.lessonId } : null,
    input.missionId ? { content_type: "mission", content_id: input.missionId } : null,
  ].filter((item): item is { content_type: string; content_id: string } => Boolean(item));

  if (!filters.length) return [];

  const rows: ContentValueTagRow[] = [];

  for (const filter of filters) {
    const { data } = await supabase
      .from("content_value_tags")
      .select("content_type, content_id, dimension_id, weight, recommended_level, outcome_type")
      .eq("content_type", filter.content_type)
      .eq("content_id", filter.content_id)
      .returns<ContentValueTagRow[]>();

    rows.push(...(data ?? []));
  }

  return Array.from(
    new Set(
      rows.flatMap((row) => [
        row.dimension_id,
        row.recommended_level ? `level_${row.recommended_level}` : "",
        row.outcome_type ? `outcome_${row.outcome_type}` : "",
      ]).filter(Boolean),
    ),
  );
}

export async function getLearnerAdSegments(
  supabase: SupabaseClient | null,
  userId: string | null | undefined,
) {
  if (!supabase || !userId) return ["anonymous_or_demo"];

  const segments = new Set<string>(["authenticated_learner"]);
  const [{ data: profile }, { data: scores }, { count: completedLessonCount }] =
    await Promise.all([
      supabase
        .from("user_value_profiles")
        .select("assessment_completed_at, readiness_level, primary_dimension_id, secondary_dimension_id")
        .eq("user_id", userId)
        .maybeSingle<UserValueProfileRow>(),
      supabase
        .from("user_value_dimension_scores")
        .select("dimension_id, score, confidence")
        .eq("user_id", userId)
        .order("score", { ascending: false })
        .limit(3)
        .returns<UserValueScoreRow[]>(),
      supabase
        .from("lesson_progress")
        .select("lesson_id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("completed_at", "is", null),
    ]);

  if (profile?.assessment_completed_at) {
    segments.add("values_assessment_completed");
  } else {
    segments.add("values_assessment_pending");
  }

  if (profile?.readiness_level) {
    segments.add(`readiness_${profile.readiness_level}`);
  }

  if (profile?.primary_dimension_id) {
    segments.add(`primary_${profile.primary_dimension_id}`);
  }

  if (profile?.secondary_dimension_id) {
    segments.add(`secondary_${profile.secondary_dimension_id}`);
  }

  for (const score of scores ?? []) {
    if (score.score >= 60 && score.confidence >= 0.3) {
      segments.add(`values_${score.dimension_id}_high`);
    }
  }

  if (!completedLessonCount) {
    segments.add("new_learner");
  } else if (completedLessonCount >= 5) {
    segments.add("active_course_learner");
  } else {
    segments.add("early_course_learner");
  }

  return Array.from(segments);
}

function passesContextTargeting(campaign: CampaignRow, context: DirectAdDecisionContext) {
  const contentTags = context.contentValueTags ?? [];
  const courseIds = context.courseId ? [context.courseId] : [];
  const lessonIds = context.lessonId ? [context.lessonId] : [];
  const courseCategories = context.courseCategory ? [context.courseCategory] : [];
  const pageTypes = context.pageType ? [context.pageType] : [];

  if (!includesAny(campaign.included_content_tags, contentTags)) return false;
  if (!includesAny(campaign.included_course_categories, courseCategories)) return false;
  if (!includesAny(campaign.included_course_ids, courseIds)) return false;
  if (!includesAny(campaign.included_lesson_ids, lessonIds)) return false;

  if (intersects(campaign.excluded_content_tags, contentTags)) return false;
  if (intersects(campaign.excluded_course_categories, courseCategories)) return false;
  if (intersects(campaign.excluded_course_ids, courseIds)) return false;
  if (intersects(campaign.excluded_lesson_ids, lessonIds)) return false;
  if (intersects(campaign.excluded_page_types, pageTypes)) return false;

  return true;
}

function passesRuleTargeting(flight: FlightRow, context: DirectAdDecisionContext) {
  const targeting = flight.targeting_rules ?? {};
  const includedSegments = asStringArray(targeting.includedSegmentKeys);
  const excludedSegments = asStringArray(targeting.excludedSegmentKeys);
  const contextSegments = context.segmentKeys ?? [];

  if (!includesAny(includedSegments, contextSegments)) return false;
  if (intersects(excludedSegments, contextSegments)) return false;

  return true;
}

function getBrandSafetyExclusionReason(flight: FlightRow, context: DirectAdDecisionContext) {
  const rules = flight.brand_safety_rules ?? {};
  const excludedTags = asStringArray(rules.excludedContentTags);
  const excludedPageTypes = asStringArray(rules.excludedPageTypes);
  const requiredPageTypes = asStringArray(rules.includedPageTypes);
  const contentTags = context.contentValueTags ?? [];
  const pageTypes = context.pageType ? [context.pageType] : [];

  if (intersects(excludedTags, contentTags)) return "brand_safety_excluded_content_tag";
  if (intersects(excludedPageTypes, pageTypes)) return "brand_safety_excluded_page_type";
  if (!includesAny(requiredPageTypes, pageTypes)) return "brand_safety_missing_required_page_type";

  return null;
}

function getCompetitorKeys(campaign: CampaignRow, flight: FlightRow) {
  return Array.from(
    new Set([...(campaign.competitor_exclusion_keys ?? []), ...(flight.competitor_exclusion_keys ?? [])]),
  );
}

async function passesFrequencyCaps(params: {
  supabase: SupabaseClient;
  sessionKeyHash: string | null;
  partner: PartnerRow;
  campaign: CampaignRow;
  creativeVersion: CreativeVersionRow;
  placement: PlacementRow;
  flight: FlightRow;
}): Promise<RuntimeCounts | null> {
  const { supabase, sessionKeyHash, partner, campaign, creativeVersion, placement, flight } =
    params;
  const caps = getFrequencyCaps(placement, flight);
  const { data } = await supabase.rpc("get_ad_runtime_counts", {
    p_session_key_hash: sessionKeyHash,
    p_partner_id: partner.id,
    p_campaign_id: campaign.id,
    p_creative_version_id: creativeVersion.id,
    p_placement_key: placement.key,
  });
  const counts = (data ?? {}) as RuntimeCounts;

  if ((counts.sessionPaidImpressions ?? 0) >= caps.sessionMaxPaidAds) return null;
  if ((counts.userCampaignImpressions24h ?? 0) >= caps.userDailyCampaignImpressions) return null;
  if (
    (counts.userCreativeVersionImpressions24h ?? 0) >=
    caps.userDailyCreativeVersionImpressions
  ) {
    return null;
  }
  if ((counts.userPartnerImpressions7d ?? 0) >= caps.userWeeklyPartnerImpressions) return null;

  if (campaign.spend_cap_amount !== null) {
    const tolerance = campaign.allow_overspend
      ? 1 + Math.max(0, campaign.overspend_tolerance_percent) / 100
      : 1;
    const effectiveCap = Math.floor(campaign.spend_cap_amount * tolerance);

    if ((counts.campaignBillableSpend ?? 0) >= effectiveCap) {
      return null;
    }
  }

  return counts;
}

async function withTimeout<T>(promise: Promise<T>, timeoutValue: T) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeout = setTimeout(() => resolve(timeoutValue), decisionTimeoutMs);
  });

  const result = await Promise.race([promise, timeoutPromise]);
  if (timeout) clearTimeout(timeout);
  return result;
}

async function getPaidAdDecision(
  supabase: SupabaseClient,
  context: DirectAdDecisionContext,
): Promise<DirectAdCardModel | null> {
  const sessionKeyHash = await getSessionHash();
  const [{ data: placement }, { data: flights }] = await Promise.all([
    supabase
      .from("ad_placements")
      .select("key, status, allowed_creative_formats, supports_video, supports_sequence, default_frequency_cap")
      .eq("key", context.placementKey)
      .maybeSingle<PlacementRow>(),
    supabase
      .from("ad_flights")
      .select("id, campaign_id, creative_id, creative_version_id, placement_key, status, starts_at, ends_at, priority, weight, targeting_rules, frequency_caps, sequence_rules, brand_safety_rules, competitor_exclusion_keys")
      .eq("placement_key", context.placementKey)
      .order("priority", { ascending: false })
      .limit(25)
      .returns<FlightRow[]>(),
  ]);

  if (!placement || placement.status !== "active" || !flights?.length) return null;

  const activeFlights = flights.filter(
    (flight) => activeStatuses.has(flight.status) && isActiveDateRange(flight.starts_at, flight.ends_at),
  );

  if (!activeFlights.length) return null;

  const campaignIds = Array.from(new Set(activeFlights.map((flight) => flight.campaign_id)));
  const creativeIds = Array.from(new Set(activeFlights.map((flight) => flight.creative_id)));
  const creativeVersionIds = Array.from(
    new Set(activeFlights.map((flight) => flight.creative_version_id)),
  );

  const [
    { data: campaigns },
    { data: creatives },
    { data: creativeVersions },
  ] = await Promise.all([
	    supabase
	      .from("ad_campaigns")
	      .select("id, partner_id, name, status, campaign_type, starts_at, ends_at, included_content_tags, excluded_content_tags, included_course_categories, excluded_course_categories, included_course_ids, excluded_course_ids, included_lesson_ids, excluded_lesson_ids, excluded_page_types, competitor_exclusion_keys, priority, pacing_mode, pricing_model, spend_cap_amount, allow_overspend, overspend_tolerance_percent, contracted_impressions, contracted_viewable_impressions")
	      .in("id", campaignIds)
	      .returns<CampaignRow[]>(),
    supabase
      .from("ad_creatives")
      .select("id, campaign_id, status, creative_format, weight")
      .in("id", creativeIds)
      .returns<CreativeRow[]>(),
    supabase
      .from("ad_creative_versions")
      .select("id, creative_id, status, headline, body, eyebrow, image_asset_id, image_alt, logo_asset_id, cta_label, cta_url, sponsor_label, disclosure_label, legal_text, theme")
      .in("id", creativeVersionIds)
      .returns<CreativeVersionRow[]>(),
  ]);

  const campaignMap = new Map((campaigns ?? []).map((campaign) => [campaign.id, campaign]));
  const creativeMap = new Map((creatives ?? []).map((creative) => [creative.id, creative]));
  const versionMap = new Map((creativeVersions ?? []).map((version) => [version.id, version]));
  const partnerIds = Array.from(new Set((campaigns ?? []).map((campaign) => campaign.partner_id)));
  const { data: partners } = await supabase
    .from("ad_partners")
    .select("id, name, status, terms_accepted_at")
    .in("id", partnerIds)
    .returns<PartnerRow[]>();
  const partnerMap = new Map((partners ?? []).map((partner) => [partner.id, partner]));

  const assetIds = Array.from(
    new Set(
      (creativeVersions ?? [])
        .flatMap((version) => [version.image_asset_id, version.logo_asset_id])
        .filter((assetId): assetId is string => Boolean(assetId)),
    ),
  );
  const { data: assets } = assetIds.length
    ? await supabase
        .from("ad_creative_assets")
        .select("id, storage_bucket, storage_path, public_url, asset_type, mime_type, status")
        .in("id", assetIds)
        .returns<AssetRow[]>()
    : { data: [] as AssetRow[] };
	  const assetMap = new Map((assets ?? []).map((asset) => [asset.id, asset]));
	  const { data: recentCompetitorKeysData } = sessionKeyHash
	    ? await supabase.rpc("get_ad_session_competitor_keys", {
	        p_session_key_hash: sessionKeyHash,
	      })
	    : { data: [] as string[] };
	  const recentCompetitorKeys = Array.isArray(recentCompetitorKeysData)
	    ? recentCompetitorKeysData
	    : [];
	  const ineligibleReasons: Record<string, string> = {};

	  const candidates: Array<{
	    flight: FlightRow;
	    campaign: CampaignRow;
	    creative: CreativeRow;
	    creativeVersion: CreativeVersionRow;
	    partner: PartnerRow;
	    score: number;
	    counts: RuntimeCounts;
	    experimentKey: string | null;
	    variantKey: string | null;
	  }> = [];

  for (const flight of activeFlights) {
    const campaign = campaignMap.get(flight.campaign_id);
    const creative = creativeMap.get(flight.creative_id);
    const creativeVersion = versionMap.get(flight.creative_version_id);
    const partner = campaign ? partnerMap.get(campaign.partner_id) : undefined;

    if (!campaign || !creative || !creativeVersion || !partner) {
      ineligibleReasons[flight.id] = "missing_related_entity";
      continue;
    }
    if (!activeStatuses.has(campaign.status) || !isActiveDateRange(campaign.starts_at, campaign.ends_at)) {
      ineligibleReasons[flight.id] = "campaign_inactive";
      continue;
    }
    if (!activeStatuses.has(partner.status)) {
      ineligibleReasons[flight.id] = "partner_inactive";
      continue;
    }
    if (campaign.campaign_type !== "house" && !partner.terms_accepted_at) {
      ineligibleReasons[flight.id] = "partner_terms_missing";
      continue;
    }
    if (!activeStatuses.has(creative.status)) {
      ineligibleReasons[flight.id] = "creative_inactive";
      continue;
    }
    if (creativeVersion.status !== "approved") {
      ineligibleReasons[flight.id] = "creative_version_not_approved";
      continue;
    }
    if (!placement.allowed_creative_formats.includes(creative.creative_format)) {
      ineligibleReasons[flight.id] = "placement_format_incompatible";
      continue;
    }
    if (creative.creative_format === "video_card" && !placement.supports_video) {
      ineligibleReasons[flight.id] = "placement_video_not_supported";
      continue;
    }
    if (!passesContextTargeting(campaign, context)) {
      ineligibleReasons[flight.id] = "context_targeting_mismatch";
      continue;
    }
    if (!passesRuleTargeting(flight, context)) {
      ineligibleReasons[flight.id] = "segment_targeting_mismatch";
      continue;
    }

    const brandSafetyReason = getBrandSafetyExclusionReason(flight, context);

    if (brandSafetyReason) {
      ineligibleReasons[flight.id] = brandSafetyReason;
      continue;
    }

    const competitorKeys = getCompetitorKeys(campaign, flight);

    if (intersects(competitorKeys, recentCompetitorKeys)) {
      ineligibleReasons[flight.id] = "session_competitor_exclusion";
      continue;
    }

    const counts = await passesFrequencyCaps({
      supabase,
      sessionKeyHash,
      partner,
      campaign,
      creativeVersion,
      placement,
      flight,
    });

    if (!counts) {
      ineligibleReasons[flight.id] = "frequency_or_budget_cap";
      continue;
    }

    const experiment = getExperimentAssignment(flight, sessionKeyHash);

    const score =
      campaign.priority * 10 +
      flight.priority * 10 +
      creative.weight +
      flight.weight +
      getSequenceScore(flight, context.pageNumber) +
      getPacingScore(campaign, counts);

    candidates.push({
      flight,
      campaign,
      creative,
      creativeVersion,
      partner,
      score,
      counts,
      experimentKey: experiment.experimentKey,
      variantKey: experiment.variantKey,
    });
  }

  const selected = candidates.sort((first, second) => second.score - first.score)[0];

  if (!selected) return null;

  const imageAsset = selected.creativeVersion.image_asset_id
    ? assetMap.get(selected.creativeVersion.image_asset_id)
    : undefined;
  const logoAsset = selected.creativeVersion.logo_asset_id
    ? assetMap.get(selected.creativeVersion.logo_asset_id)
    : undefined;

  const decisionContext = {
    route: context.route,
    courseId: context.courseId ?? null,
    courseCategory: context.courseCategory ?? null,
    lessonId: context.lessonId ?? null,
    pageId: context.pageId ?? null,
    pageNumber: context.pageNumber ?? null,
    pageType: context.pageType ?? null,
    contentValueTags: context.contentValueTags ?? [],
    segmentKeys: context.segmentKeys ?? [],
  };
  const { data: decisionRow, error: decisionError } = await supabase.rpc("record_ad_decision", {
    p_user_id: context.userId ?? null,
    p_session_key_hash: sessionKeyHash,
    p_partner_id: selected.partner.id,
    p_campaign_id: selected.campaign.id,
    p_flight_id: selected.flight.id,
    p_creative_id: selected.creative.id,
    p_creative_version_id: selected.creativeVersion.id,
    p_placement_key: context.placementKey,
    p_decision_context: decisionContext,
    p_eligible_flight_count: candidates.length,
    p_ineligible_reasons: ineligibleReasons,
    p_score_breakdown: {
      selectedScore: selected.score,
      campaignPriority: selected.campaign.priority,
      flightPriority: selected.flight.priority,
      sequenceScore: getSequenceScore(selected.flight, context.pageNumber),
      pacingScore: getPacingScore(selected.campaign, selected.counts),
    },
    p_experiment_key: selected.experimentKey,
    p_variant_key: selected.variantKey,
  });
  const decisionId = (decisionRow as { decisionId?: string } | null)?.decisionId;

  if (decisionError || !decisionId) return null;

  return {
    decisionId,
    placementKey: context.placementKey,
    format: selected.creative.creative_format,
    isPaid: selected.campaign.campaign_type !== "house",
    sponsorLabel: selected.creativeVersion.sponsor_label || selected.partner.name,
    disclosureLabel: selected.creativeVersion.disclosure_label || "Sponsored",
    eyebrow: selected.creativeVersion.eyebrow,
    headline: selected.creativeVersion.headline || selected.campaign.name,
    body: selected.creativeVersion.body,
    imageUrl: getAssetPublicUrl(supabase, imageAsset),
    imageAlt: selected.creativeVersion.image_alt || imageAsset?.mime_type || "Sponsor creative",
    logoUrl: getAssetPublicUrl(supabase, logoAsset),
    ctaLabel: selected.creativeVersion.cta_label,
    clickUrl: selected.creativeVersion.cta_url ? `/api/ads/click/${decisionId}` : null,
    legalText: selected.creativeVersion.legal_text,
    theme: selected.creativeVersion.theme ?? {},
  };
}

export async function getAdDecision(
  supabase: SupabaseClient | null,
  context: DirectAdDecisionContext,
) {
  if (!supabase) {
    return buildHouseAd(context);
  }

  return withTimeout(getPaidAdDecision(supabase, context), buildHouseAd(context));
}
