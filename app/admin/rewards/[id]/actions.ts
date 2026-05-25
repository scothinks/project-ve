"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { sanitizePlainTextInput, sanitizeUrlInput } from "@/lib/input-safety";
import { isRewardIconName } from "@/lib/reward-icons";

export type RewardActionState = {
  ok: boolean;
  message: string;
};

const defaultActionState: RewardActionState = {
  ok: false,
  message: "",
};

function parsePositiveInteger(value: FormDataEntryValue | null, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseInteger(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseJsonObject(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return {};
  }

  const parsed = JSON.parse(raw) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON config must be an object.");
  }

  return parsed;
}

function parseClaimSteps(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split("\n")
    .map((step) => sanitizePlainTextInput(step, 300).trim())
    .filter(Boolean);
}

function parseOptionalText(value: FormDataEntryValue | null, maxLength = 120) {
  const parsed = sanitizePlainTextInput(String(value ?? ""), maxLength).trim();
  return parsed || null;
}

function parseThumbnailFields(formData: FormData) {
  const url = sanitizeUrlInput(String(formData.get("thumbnailUrl") ?? ""), 1000) || undefined;
  const color = sanitizePlainTextInput(String(formData.get("thumbnailColor") ?? ""), 32).trim() || undefined;
  const iconSetRaw = sanitizePlainTextInput(String(formData.get("thumbnailIconSet") ?? ""), 24).trim();
  const iconNameRaw = sanitizePlainTextInput(String(formData.get("thumbnailIconName") ?? ""), 40).trim();
  const legacyIcon = sanitizePlainTextInput(String(formData.get("thumbnailLegacyIcon") ?? ""), 24).trim() || undefined;
  const useLegacyIcon = formData.get("thumbnailUseLegacyIcon") === "true";
  const iconName = isRewardIconName(iconNameRaw) ? iconNameRaw : undefined;

  return {
    url,
    icon: useLegacyIcon ? legacyIcon : undefined,
    iconSet: iconSetRaw === "tabler" && iconName ? "tabler" : undefined,
    iconName: iconSetRaw === "tabler" ? iconName : undefined,
    color,
  };
}

function getStoredThumbnail(thumbnail: unknown) {
  if (!thumbnail || typeof thumbnail !== "object" || Array.isArray(thumbnail)) {
    return {
      url: undefined,
      icon: undefined,
      iconSet: undefined,
      iconName: undefined,
      color: undefined,
    };
  }

  const record = thumbnail as {
    url?: unknown;
    icon?: unknown;
    iconSet?: unknown;
    iconName?: unknown;
    color?: unknown;
  };

  return {
    url: typeof record.url === "string" ? record.url : undefined,
    icon: typeof record.icon === "string" ? record.icon : undefined,
    iconSet: record.iconSet === "tabler" ? "tabler" : undefined,
    iconName: typeof record.iconName === "string" && isRewardIconName(record.iconName)
      ? record.iconName
      : undefined,
    color: typeof record.color === "string" ? record.color : undefined,
  };
}

function slugifyRewardTitle(title: string) {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return `reward-${slug || "item"}`;
}

async function getUniqueRewardId(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"], title: string) {
  const baseId = slugifyRewardTitle(title);
  let candidate = baseId;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabase
      .from("rewards")
      .select("id")
      .eq("id", candidate)
      .maybeSingle<{ id: string }>();

    if (error) {
      throw error;
    }

    if (!data) {
      return candidate;
    }

    candidate = `${baseId}-${Math.random().toString(36).slice(2, 6)}`;
  }

  return `${baseId}-${Date.now().toString(36)}`;
}

function parseRewardPayload(formData: FormData) {
  const rewardId = sanitizePlainTextInput(String(formData.get("rewardId") ?? ""), 120);
  const distributionMode = String(formData.get("distributionMode") ?? "direct");
  const limitPeriod = String(formData.get("limitPeriod") ?? "lifetime");
  const thumbnail = parseThumbnailFields(formData);

  return {
    rewardId,
    title: sanitizePlainTextInput(String(formData.get("title") ?? ""), 140),
    description: sanitizePlainTextInput(String(formData.get("description") ?? ""), 500),
    costXp: parsePositiveInteger(formData.get("costXp")),
    status: String(formData.get("status") ?? "draft"),
    isEnabled: formData.get("isEnabled") === "on",
    thumbnail,
    offerExpiresAt: parseOptionalDate(formData.get("offerExpiresAt")),
    terms: sanitizePlainTextInput(String(formData.get("terms") ?? ""), 1000),
    claimSteps: parseClaimSteps(formData.get("claimSteps")),
    distributionMode,
    fulfillmentType: String(formData.get("fulfillmentType") ?? "manual"),
    visibilityMode: String(
      formData.get("visibilityMode")
      ?? (String(formData.get("fulfillmentType") ?? "manual") === "native" ? "system_only" : "store"),
    ),
    fulfillmentConfig: parseJsonObject(formData.get("fulfillmentConfig")),
    perUserLimit:
      limitPeriod === "none" ? 1 : parsePositiveInteger(formData.get("perUserLimit")),
    limitPeriod,
    redemptionWindowDays: String(formData.get("redemptionWindowDays") ?? "").trim()
      ? parsePositiveInteger(formData.get("redemptionWindowDays"))
      : null,
    sortOrder: parseInteger(formData.get("sortOrder")),
    campaignId: parseOptionalText(formData.get("campaignId"), 120),
    totalAvailable: String(formData.get("totalAvailable") ?? "").trim()
      ? Math.max(0, parseInteger(formData.get("totalAvailable")))
      : 0,
  };
}

function isMissingDistributionModeRpc(error: unknown) {
  return (
    !!error
    && typeof error === "object"
    && /p_distribution_mode|function .*admin_(update|create)_reward/i.test(
      String((error as { message?: string }).message ?? ""),
    )
  );
}

async function callRewardMutationRpc(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  rpcName: "admin_update_reward" | "admin_create_reward",
  payload: ReturnType<typeof parseRewardPayload>,
  rewardIdOverride?: string,
) {
  const nextFulfillmentType =
    payload.distributionMode === "perk_bundle" ? "manual" : payload.fulfillmentType;
  const baseArgs = {
    p_reward_id: rewardIdOverride ?? payload.rewardId,
    p_title: payload.title,
    p_description: payload.description,
    p_cost_xp: payload.costXp,
    p_status: payload.status,
    p_is_enabled: payload.isEnabled,
    p_thumbnail: payload.thumbnail,
    p_offer_expires_at: payload.offerExpiresAt,
    p_terms: payload.terms,
    p_claim_steps: payload.claimSteps,
    p_fulfillment_type: nextFulfillmentType,
    p_visibility_mode: payload.visibilityMode,
    p_fulfillment_config: payload.fulfillmentConfig,
    p_per_user_limit: payload.perUserLimit,
    p_limit_period: payload.limitPeriod,
    p_redemption_window_days: payload.redemptionWindowDays,
    p_sort_order: payload.sortOrder,
    p_campaign_id: payload.campaignId,
  };
  const createArgs = rpcName === "admin_create_reward"
    ? { p_total_available: payload.totalAvailable, ...baseArgs }
    : baseArgs;

  const nextResult = await supabase.rpc(rpcName, {
    ...createArgs,
    p_distribution_mode: payload.distributionMode,
  });

  if (!nextResult.error || !isMissingDistributionModeRpc(nextResult.error)) {
    return nextResult;
  }

  return supabase.rpc(rpcName, {
    ...createArgs,
    p_fulfillment_type:
      payload.distributionMode === "perk_bundle" ? "perk_bundle" : payload.fulfillmentType,
  });
}

export async function updateReward(
  previousState: RewardActionState = defaultActionState,
  formData: FormData,
): Promise<RewardActionState> {
  void previousState;
  const payload = parseRewardPayload(formData);
  const { supabase } = await requireAdmin();
  const { error } = await callRewardMutationRpc(supabase, "admin_update_reward", payload);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin/rewards");
  revalidatePath("/admin/rewards/perks");
  revalidatePath(`/admin/rewards/${payload.rewardId}`);
  revalidatePath(`/admin/rewards/perks/${payload.rewardId}`);
  revalidatePath(`/admin/rewards/perks/${payload.rewardId}/draws`);
  revalidatePath("/xp-store");

  return { ok: true, message: "Saved." };
}

export async function createReward(
  previousState: RewardActionState = defaultActionState,
  formData: FormData,
): Promise<RewardActionState> {
  void previousState;
  const payload = parseRewardPayload(formData);
  const { supabase } = await requireAdmin();
  const rewardId = await getUniqueRewardId(supabase, payload.title);
  const { data, error } = await callRewardMutationRpc(
    supabase,
    "admin_create_reward",
    payload,
    rewardId,
  );

  if (error) {
    return { ok: false, message: error.message };
  }

  const result = data as { rewardId?: string } | null;
  const createdRewardId = result?.rewardId ?? rewardId;

  revalidatePath("/admin/rewards");
  revalidatePath("/admin/rewards/perks");
  revalidatePath("/xp-store");
  redirect(
    payload.distributionMode === "perk_bundle"
      ? `/admin/rewards/perks/${createdRewardId}`
      : `/admin/rewards/${createdRewardId}`,
  );
}

export async function toggleRewardEnabled(formData: FormData) {
  const rewardId = sanitizePlainTextInput(String(formData.get("rewardId") ?? ""), 120);
  const isEnabled = String(formData.get("isEnabled") ?? "") === "true";
  const redirectTo = sanitizePlainTextInput(String(formData.get("redirectTo") ?? "/admin/rewards"), 400);
  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("admin_set_reward_enabled", {
    p_reward_id: rewardId,
    p_is_enabled: isEnabled,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/rewards");
  revalidatePath("/admin/rewards/perks");
  revalidatePath(`/admin/rewards/${rewardId}`);
  revalidatePath(`/admin/rewards/perks/${rewardId}`);
  revalidatePath(`/admin/rewards/perks/${rewardId}/draws`);
  revalidatePath("/xp-store");
  redirect(
    appendNotice(
      redirectTo,
      isEnabled ? "Reward enabled." : "Reward disabled.",
    ),
  );
}

export async function setRewardStatus(formData: FormData) {
  const rewardId = sanitizePlainTextInput(String(formData.get("rewardId") ?? ""), 120);
  const status = sanitizePlainTextInput(String(formData.get("status") ?? "draft"), 24);
  const isEnabled = status === "published";
  const redirectTo = sanitizePlainTextInput(String(formData.get("redirectTo") ?? "/admin/rewards/perks"), 400);
  const { supabase } = await requireAdmin();

  const { data: existingReward, error: existingRewardError } = await supabase
    .from("rewards")
    .select(
      "id, title, description, cost_xp, thumbnail, offer_expires_at, terms, claim_steps, distribution_mode, fulfillment_type, visibility_mode, fulfillment_config, per_user_limit, limit_period, redemption_window_days, sort_order, campaign_id",
    )
    .eq("id", rewardId);

  if (existingRewardError) {
    throw existingRewardError;
  }

  const reward = Array.isArray(existingReward) ? existingReward[0] : null;

  if (!reward) {
    throw new Error("Reward not found.");
  }

  const { error } = await callRewardMutationRpc(supabase, "admin_update_reward", {
    rewardId: reward.id,
    title: reward.title,
    description: reward.description ?? "",
    costXp: reward.cost_xp,
    status,
    isEnabled,
    thumbnail: getStoredThumbnail(reward.thumbnail),
    offerExpiresAt: reward.offer_expires_at,
    terms: reward.terms ?? "",
    claimSteps: Array.isArray(reward.claim_steps)
      ? reward.claim_steps.filter((step): step is string => typeof step === "string")
      : [],
    distributionMode:
      reward.distribution_mode === "perk_bundle" ? "perk_bundle" : "direct",
    fulfillmentType: reward.fulfillment_type,
    visibilityMode: reward.visibility_mode,
    fulfillmentConfig:
      reward.fulfillment_config
      && typeof reward.fulfillment_config === "object"
      && !Array.isArray(reward.fulfillment_config)
        ? (reward.fulfillment_config as Record<string, unknown>)
        : {},
    perUserLimit: reward.per_user_limit,
    limitPeriod: reward.limit_period,
    redemptionWindowDays: reward.redemption_window_days,
    sortOrder: reward.sort_order,
    campaignId: reward.campaign_id,
    totalAvailable: 0,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/rewards");
  revalidatePath("/admin/rewards/perks");
  revalidatePath(`/admin/rewards/${rewardId}`);
  revalidatePath(`/admin/rewards/perks/${rewardId}`);
  revalidatePath(`/admin/rewards/perks/${rewardId}/draws`);
  revalidatePath("/xp-store");
  redirect(
    appendNotice(
      redirectTo,
      status === "published" ? "Reward published." : "Reward moved to draft.",
    ),
  );
}

function parseOptionalPositiveInteger(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalTimestamp(value: FormDataEntryValue | null) {
  return parseOptionalDate(value);
}

function parseRequiredTimestamp(value: FormDataEntryValue | null, label: string) {
  const parsed = parseOptionalDate(value);
  if (!parsed) {
    throw new Error(`${label} is required.`);
  }
  return parsed;
}

function appendNotice(redirectTo: string, notice: string) {
  const separator = redirectTo.includes("?") ? "&" : "?";
  return `${redirectTo}${separator}notice=${encodeURIComponent(notice)}`;
}

function appendQueryValue(redirectTo: string, key: string, value: string) {
  const separator = redirectTo.includes("?") ? "&" : "?";
  return `${redirectTo}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export async function savePerkPrize(formData: FormData) {
  const bundleRewardId = sanitizePlainTextInput(String(formData.get("bundleRewardId") ?? ""), 120);
  const redirectTo = sanitizePlainTextInput(String(formData.get("redirectTo") ?? ""), 400);
  const prizeIdRaw = String(formData.get("prizeId") ?? "").trim();
  const prizeType = sanitizePlainTextInput(String(formData.get("prizeType") ?? "native_xp"), 32);
  let sourceRewardId = parseOptionalText(formData.get("sourceRewardId"), 120);
  const title = parseOptionalText(formData.get("title"), 140);
  const thumbnail = parseThumbnailFields(formData);
  const weight = parsePositiveInteger(formData.get("weight"));
  const parsedTotalWinCap = parseOptionalPositiveInteger(formData.get("totalWinCap"));
  const dailyWinCap = parseOptionalPositiveInteger(formData.get("dailyWinCap"));
  const parsedAvailableFrom = parseOptionalTimestamp(formData.get("availableFrom"));
  const parsedExpiresAt = parseOptionalTimestamp(formData.get("expiresAt"));
  const sortOrder = parseInteger(formData.get("sortOrder"));
  const isEnabled = formData.get("isEnabled") === "on";

  let config: Record<string, unknown> = {};
  if (prizeType === "native_xp") {
    config = {
      amount: parsePositiveInteger(formData.get("amount")),
    };
  } else if (prizeType === "xp_boost") {
    config = {
      multiplier: Math.max(1.1, Number(formData.get("multiplier") ?? 2)),
      durationHours: parsePositiveInteger(formData.get("durationHours"), 24),
      uses: parsePositiveInteger(formData.get("uses"), 1),
    };
  }

  const { supabase } = await requireAdmin();
  const totalWinCap = prizeType === "reward" ? null : parsedTotalWinCap;
  const availableFrom = prizeType === "reward" ? null : parsedAvailableFrom;
  const expiresAt = prizeType === "reward" ? null : parsedExpiresAt;

  if (prizeIdRaw && prizeType === "reward" && !sourceRewardId) {
    const { data: existingPrize, error: existingPrizeError } = await supabase
      .from("perk_bundle_prizes")
      .select("source_reward_id")
      .eq("id", prizeIdRaw)
      .maybeSingle<{ source_reward_id: string | null }>();

    if (existingPrizeError) {
      throw existingPrizeError;
    }

    sourceRewardId = existingPrize?.source_reward_id ?? null;
  }

  if (prizeType === "reward" && sourceRewardId && !prizeIdRaw) {
    const { data: existingPrize, error: existingPrizeError } = await supabase
      .from("perk_bundle_prizes")
      .select("id")
      .eq("bundle_reward_id", bundleRewardId)
      .eq("prize_type", "reward")
      .eq("source_reward_id", sourceRewardId)
      .maybeSingle<{ id: string }>();

    if (existingPrizeError) {
      throw existingPrizeError;
    }

    if (existingPrize) {
      revalidatePath("/admin/rewards/perks");
      revalidatePath(`/admin/rewards/perks/${bundleRewardId}`);
      revalidatePath(`/admin/rewards/perks/${bundleRewardId}/draws`);
      redirect(appendNotice(redirectTo || `/admin/rewards/perks/${bundleRewardId}`, "reward-already-added"));
    }
  }

  const { error } = await supabase.rpc("admin_upsert_perk_bundle_prize", {
    p_prize_id: prizeIdRaw || null,
    p_bundle_reward_id: bundleRewardId,
    p_prize_type: prizeType,
    p_source_reward_id: prizeType === "reward" ? sourceRewardId : null,
    p_title: title,
    p_thumbnail: thumbnail,
    p_config: config,
    p_weight: weight,
    p_total_win_cap: totalWinCap,
    p_daily_win_cap: dailyWinCap,
    p_available_from: availableFrom,
    p_expires_at: expiresAt,
    p_sort_order: sortOrder,
    p_is_enabled: isEnabled,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/rewards/perks");
  revalidatePath(`/admin/rewards/perks/${bundleRewardId}`);
  revalidatePath(`/admin/rewards/perks/${bundleRewardId}/draws`);

  if (redirectTo) {
    const redirectWithNotice = appendNotice(
      redirectTo,
      prizeIdRaw ? "prize-saved" : "prize-added",
    );
    redirect(
      prizeIdRaw
        ? appendQueryValue(redirectWithNotice, "focusPrize", prizeIdRaw)
        : redirectWithNotice,
    );
  }
}

export async function setPerkPrizeEnabled(formData: FormData) {
  const bundleRewardId = sanitizePlainTextInput(String(formData.get("bundleRewardId") ?? ""), 120);
  const prizeId = sanitizePlainTextInput(String(formData.get("prizeId") ?? ""), 120);
  const isEnabled = String(formData.get("isEnabled") ?? "") === "true";
  const redirectTo = sanitizePlainTextInput(
    String(formData.get("redirectTo") ?? `/admin/rewards/perks/${bundleRewardId}`),
    400,
  );
  const { supabase } = await requireAdmin();

  const { data: existingPrize, error: existingPrizeError } = await supabase
    .from("perk_bundle_prizes")
    .select(
      "id, bundle_reward_id, prize_type, source_reward_id, title, thumbnail, config, weight, total_win_cap, daily_win_cap, available_from, expires_at, sort_order",
    )
    .eq("id", prizeId)
    .maybeSingle<{
      id: string;
      bundle_reward_id: string;
      prize_type: string;
      source_reward_id: string | null;
      title: string | null;
      thumbnail: Record<string, unknown> | null;
      config: Record<string, unknown> | null;
      weight: number;
      total_win_cap: number | null;
      daily_win_cap: number | null;
      available_from: string | null;
      expires_at: string | null;
      sort_order: number;
    }>();

  if (existingPrizeError) {
    throw existingPrizeError;
  }

  if (!existingPrize) {
    throw new Error("Prize not found.");
  }

  const { error } = await supabase.rpc("admin_upsert_perk_bundle_prize", {
    p_prize_id: existingPrize.id,
    p_bundle_reward_id: existingPrize.bundle_reward_id,
    p_prize_type: existingPrize.prize_type,
    p_source_reward_id: existingPrize.source_reward_id,
    p_title: existingPrize.title,
    p_thumbnail: existingPrize.thumbnail ?? {},
    p_config: existingPrize.config ?? {},
    p_weight: existingPrize.weight,
    p_total_win_cap: existingPrize.total_win_cap,
    p_daily_win_cap: existingPrize.daily_win_cap,
    p_available_from: existingPrize.available_from,
    p_expires_at: existingPrize.expires_at,
    p_sort_order: existingPrize.sort_order,
    p_is_enabled: isEnabled,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/rewards/perks");
  revalidatePath(`/admin/rewards/perks/${bundleRewardId}`);
  revalidatePath(`/admin/rewards/perks/${bundleRewardId}/draws`);
  revalidatePath("/xp-store");

  const withNotice = appendNotice(
    redirectTo,
    isEnabled ? "prize-enabled" : "prize-disabled",
  );
  redirect(appendQueryValue(withNotice, "focusPrize", prizeId));
}

export async function saveBulkPerkRewardPrizes(formData: FormData) {
  const bundleRewardId = sanitizePlainTextInput(String(formData.get("bundleRewardId") ?? ""), 120);
  const redirectTo = sanitizePlainTextInput(String(formData.get("redirectTo") ?? ""), 400);
  const sourceRewardIds = Array.from(new Set(formData
    .getAll("sourceRewardIds")
    .map((value) => sanitizePlainTextInput(String(value ?? ""), 120))
    .filter(Boolean)));
  const baseWeight = parsePositiveInteger(formData.get("weight"));
  const totalWinCap = parseOptionalPositiveInteger(formData.get("totalWinCap"));
  const dailyWinCap = parseOptionalPositiveInteger(formData.get("dailyWinCap"));
  const availableFrom = parseOptionalTimestamp(formData.get("availableFrom"));
  const expiresAt = parseOptionalTimestamp(formData.get("expiresAt"));
  const baseSortOrder = parseInteger(formData.get("sortOrder"));
  const isEnabled = String(formData.get("isEnabled") ?? "on") === "on";

  if (sourceRewardIds.length === 0) {
    throw new Error("Select at least one reward to add.");
  }

  const { supabase } = await requireAdmin();
  const { data: existingPrizes, error: existingPrizesError } = await supabase
    .from("perk_bundle_prizes")
    .select("source_reward_id")
    .eq("bundle_reward_id", bundleRewardId)
    .eq("prize_type", "reward")
    .returns<Array<{ source_reward_id: string | null }>>();

  if (existingPrizesError) {
    throw existingPrizesError;
  }

  const existingRewardIds = new Set(
    (existingPrizes ?? [])
      .map((row) => row.source_reward_id)
      .filter((value): value is string => Boolean(value)),
  );
  const rewardIdsToCreate = sourceRewardIds.filter((sourceRewardId) => !existingRewardIds.has(sourceRewardId));

  for (const [index, sourceRewardId] of rewardIdsToCreate.entries()) {
    const { error } = await supabase.rpc("admin_upsert_perk_bundle_prize", {
      p_prize_id: null,
      p_bundle_reward_id: bundleRewardId,
      p_prize_type: "reward",
      p_source_reward_id: sourceRewardId,
      p_title: null,
      p_thumbnail: {},
      p_config: {},
      p_weight: baseWeight,
      p_total_win_cap: totalWinCap,
      p_daily_win_cap: dailyWinCap,
      p_available_from: availableFrom,
      p_expires_at: expiresAt,
      p_sort_order: baseSortOrder + index,
      p_is_enabled: isEnabled,
    });

    if (error) {
      throw error;
    }
  }

  revalidatePath("/admin/rewards/perks");
  revalidatePath(`/admin/rewards/perks/${bundleRewardId}`);
  revalidatePath(`/admin/rewards/perks/${bundleRewardId}/draws`);
  redirect(
    appendNotice(
      redirectTo || `/admin/rewards/perks/${bundleRewardId}`,
      rewardIdsToCreate.length > 0 ? "rewards-added" : "rewards-already-added",
    ),
  );
}

export async function deletePerkPrize(formData: FormData) {
  const bundleRewardId = sanitizePlainTextInput(String(formData.get("bundleRewardId") ?? ""), 120);
  const prizeId = String(formData.get("prizeId") ?? "").trim();
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_delete_perk_bundle_prize", {
    p_prize_id: prizeId,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/rewards/perks");
  revalidatePath(`/admin/rewards/perks/${bundleRewardId}`);
  revalidatePath(`/admin/rewards/perks/${bundleRewardId}/draws`);
}

export async function assignPerkPrizeInventory(formData: FormData) {
  const bundleRewardId = sanitizePlainTextInput(String(formData.get("bundleRewardId") ?? ""), 120);
  const prizeId = sanitizePlainTextInput(String(formData.get("prizeId") ?? ""), 120);
  const quantity = parsePositiveInteger(formData.get("quantity"));
  const reason = parseOptionalText(formData.get("reason"), 160);
  const availableFrom = parseOptionalTimestamp(formData.get("availableFrom"));
  const expiresAt = parseOptionalTimestamp(formData.get("expiresAt"));
  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("admin_assign_reward_stock_to_perk_prize", {
    p_prize_id: prizeId,
    p_quantity: quantity,
    p_reason: reason,
    p_available_from: availableFrom,
    p_expires_at: expiresAt,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/rewards");
  revalidatePath("/admin/rewards/perks");
  revalidatePath(`/admin/rewards/perks/${bundleRewardId}`);
  revalidatePath(`/admin/rewards/perks/${bundleRewardId}/draws`);
  revalidatePath("/xp-store");
}

export async function releasePerkPrizeInventory(formData: FormData) {
  const bundleRewardId = sanitizePlainTextInput(String(formData.get("bundleRewardId") ?? ""), 120);
  const prizeId = sanitizePlainTextInput(String(formData.get("prizeId") ?? ""), 120);
  const quantity = parsePositiveInteger(formData.get("quantity"));
  const reason = parseOptionalText(formData.get("reason"), 160);
  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("admin_release_reward_stock_from_perk_prize", {
    p_prize_id: prizeId,
    p_quantity: quantity,
    p_reason: reason,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/rewards");
  revalidatePath("/admin/rewards/perks");
  revalidatePath(`/admin/rewards/perks/${bundleRewardId}`);
  revalidatePath(`/admin/rewards/perks/${bundleRewardId}/draws`);
  revalidatePath("/xp-store");
}

export async function savePerkReleaseBucket(formData: FormData) {
  const prizeId = sanitizePlainTextInput(String(formData.get("prizeId") ?? ""), 120);
  const bundleRewardId = sanitizePlainTextInput(String(formData.get("bundleRewardId") ?? ""), 120);
  const bucketId = String(formData.get("bucketId") ?? "").trim();
  const label = parseOptionalText(formData.get("label"), 120);
  const startsAt = parseRequiredTimestamp(formData.get("startsAt"), "Bucket start");
  const endsAt = parseOptionalTimestamp(formData.get("endsAt"));
  const releaseCap = parsePositiveInteger(formData.get("releaseCap"));
  const sortOrder = parseInteger(formData.get("sortOrder"));
  const isEnabled = formData.get("isEnabled") === "on";
  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("admin_upsert_perk_prize_release_bucket", {
    p_bucket_id: bucketId || null,
    p_prize_id: prizeId,
    p_label: label,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_release_cap: releaseCap,
    p_sort_order: sortOrder,
    p_is_enabled: isEnabled,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/rewards/perks");
  revalidatePath(`/admin/rewards/perks/${bundleRewardId}`);
  revalidatePath(`/admin/rewards/perks/${bundleRewardId}/draws`);
}

export async function deletePerkReleaseBucket(formData: FormData) {
  const bucketId = String(formData.get("bucketId") ?? "").trim();
  const bundleRewardId = sanitizePlainTextInput(String(formData.get("bundleRewardId") ?? ""), 120);
  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("admin_delete_perk_prize_release_bucket", {
    p_bucket_id: bucketId,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/rewards/perks");
  revalidatePath(`/admin/rewards/perks/${bundleRewardId}`);
  revalidatePath(`/admin/rewards/perks/${bundleRewardId}/draws`);
}
