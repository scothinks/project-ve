"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  parseBulkPerkRewardPrizesForm,
  parsePerkInventoryMutationForm,
  parsePerkPrizeIdForm,
  parsePerkPrizeToggleForm,
  parsePerkReleaseBucketDeleteForm,
  parsePerkReleaseBucketForm,
  parseRewardPayloadForm,
  parseRewardStatusForm,
  parseRewardToggleForm,
  parseSavePerkPrizeForm,
  type RewardMutationPayload,
} from "@/lib/admin-reward-validation";
import { requireAdmin } from "@/lib/admin";
import { ValidationError } from "@/lib/app-errors";
import { formatValidationIssues } from "@/lib/form-data-validation";
import { isRewardIconName } from "@/lib/reward-icons";
import type { ValidationResult } from "@/lib/request-validation";

export type RewardActionState = {
  ok: boolean;
  message: string;
};

const defaultActionState: RewardActionState = {
  ok: false,
  message: "",
};

function requireValidForm<T>(validation: ValidationResult<T>) {
  if (!validation.ok) {
    throw new ValidationError(`Invalid reward form data. ${formatValidationIssues(validation.issues)}`);
  }

  return validation.data;
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
  const iconSetRaw = record.iconSet;
  const iconNameRaw = typeof record.iconName === "string" ? record.iconName : "";
  const legacyIcon = typeof record.icon === "string" ? record.icon : undefined;
  const iconName = isRewardIconName(iconNameRaw) ? iconNameRaw : undefined;

  return {
    url: typeof record.url === "string" ? record.url : undefined,
    icon: legacyIcon,
    iconSet: iconSetRaw === "tabler" && iconName ? "tabler" : undefined,
    iconName: iconSetRaw === "tabler" ? iconName : undefined,
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
      .maybeSingle();

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

async function callRewardMutationRpc(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  rpcName: "admin_update_reward" | "admin_create_reward",
  payload: RewardMutationPayload,
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

  return supabase.rpc(rpcName, {
    ...createArgs,
    p_distribution_mode: payload.distributionMode,
  });
}

async function callRewardOwnershipRpc(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  rewardId: string,
  payload: RewardMutationPayload,
) {
  return supabase.rpc("admin_set_reward_lms_ownership", {
    p_organization_id: payload.ownerScope === "platform_owned" ? null : payload.organizationId,
    p_owner_scope: payload.ownerScope,
    p_reward_id: rewardId,
    p_shared_with_programmes: payload.ownerScope === "platform_owned" ? payload.sharedWithProgrammes : false,
    p_sponsored_programme_id: payload.ownerScope === "programme_sponsored" ? payload.sponsoredProgrammeId : null,
  });
}

export async function updateReward(
  previousState: RewardActionState = defaultActionState,
  formData: FormData,
): Promise<RewardActionState> {
  void previousState;
  const payload = requireValidForm(parseRewardPayloadForm(formData));
  const { supabase } = await requireAdmin();
  const { error } = await callRewardMutationRpc(supabase, "admin_update_reward", payload);

  if (error) {
    return { ok: false, message: error.message };
  }

  const { error: ownershipError } = await callRewardOwnershipRpc(supabase, payload.rewardId, payload);

  if (ownershipError) {
    return { ok: false, message: ownershipError.message };
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
  const payload = requireValidForm(parseRewardPayloadForm(formData));
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
  const { error: ownershipError } = await callRewardOwnershipRpc(supabase, createdRewardId, payload);

  if (ownershipError) {
    return { ok: false, message: ownershipError.message };
  }

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
  const { isEnabled, redirectTo, rewardId } = requireValidForm(parseRewardToggleForm(formData));
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
  const { isEnabled, redirectTo, rewardId, status } = requireValidForm(parseRewardStatusForm(formData));
  const { supabase } = await requireAdmin();

  const { data: existingReward, error: existingRewardError } = await supabase
    .from("rewards")
    .select(
      "id, title, description, cost_xp, thumbnail, offer_expires_at, terms, claim_steps, distribution_mode, fulfillment_type, visibility_mode, fulfillment_config, per_user_limit, limit_period, redemption_window_days, sort_order, campaign_id, owner_scope, organization_id, sponsored_programme_id, shared_with_programmes",
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
    organizationId: reward.organization_id,
    ownerScope: reward.owner_scope ?? "platform_owned",
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
    sharedWithProgrammes: Boolean(reward.shared_with_programmes),
    sortOrder: reward.sort_order,
    sponsoredProgrammeId: reward.sponsored_programme_id,
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

function appendNotice(redirectTo: string, notice: string) {
  const separator = redirectTo.includes("?") ? "&" : "?";
  return `${redirectTo}${separator}notice=${encodeURIComponent(notice)}`;
}

function appendQueryValue(redirectTo: string, key: string, value: string) {
  const separator = redirectTo.includes("?") ? "&" : "?";
  return `${redirectTo}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export async function savePerkPrize(formData: FormData) {
  const input = requireValidForm(parseSavePerkPrizeForm(formData));
  const {
    bundleRewardId,
    dailyWinCap,
    isEnabled,
    prizeType,
    redirectTo,
    sortOrder,
    thumbnail,
    title,
    weight,
  } = input;
  const prizeIdRaw = input.prizeId;
  let sourceRewardId = input.sourceRewardId;

  let config: Record<string, unknown> = {};
  if (prizeType === "native_xp") {
    config = {
      amount: input.amount,
    };
  } else if (prizeType === "xp_boost") {
    config = {
      multiplier: input.multiplier,
      durationHours: input.durationHours,
      uses: input.uses,
    };
  }

  const { supabase } = await requireAdmin();
  const totalWinCap = prizeType === "reward" ? null : input.totalWinCap;
  const availableFrom = prizeType === "reward" ? null : input.availableFrom;
  const expiresAt = prizeType === "reward" ? null : input.expiresAt;

  if (prizeIdRaw && prizeType === "reward" && !sourceRewardId) {
    const { data: existingPrize, error: existingPrizeError } = await supabase
      .from("perk_bundle_prizes")
      .select("source_reward_id")
      .eq("id", prizeIdRaw)
      .maybeSingle();

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
      .maybeSingle();

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
  const { bundleRewardId, isEnabled, prizeId, redirectTo } = requireValidForm(parsePerkPrizeToggleForm(formData));
  const { supabase } = await requireAdmin();

  const { data: existingPrize, error: existingPrizeError } = await supabase
    .from("perk_bundle_prizes")
    .select(
      "id, bundle_reward_id, prize_type, source_reward_id, title, thumbnail, config, weight, total_win_cap, daily_win_cap, available_from, expires_at, sort_order",
    )
    .eq("id", prizeId)
    .maybeSingle();

  if (existingPrizeError) {
    throw existingPrizeError;
  }

  if (!existingPrize) {
    throw new Error("Prize not found.");
  }

  const prize = existingPrize as {
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
  };

  const { error } = await supabase.rpc("admin_upsert_perk_bundle_prize", {
    p_prize_id: prize.id,
    p_bundle_reward_id: prize.bundle_reward_id,
    p_prize_type: prize.prize_type,
    p_source_reward_id: prize.source_reward_id,
    p_title: prize.title,
    p_thumbnail: prize.thumbnail ?? {},
    p_config: prize.config ?? {},
    p_weight: prize.weight,
    p_total_win_cap: prize.total_win_cap,
    p_daily_win_cap: prize.daily_win_cap,
    p_available_from: prize.available_from,
    p_expires_at: prize.expires_at,
    p_sort_order: prize.sort_order,
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
  const {
    availableFrom,
    baseSortOrder,
    baseWeight,
    bundleRewardId,
    dailyWinCap,
    expiresAt,
    isEnabled,
    redirectTo,
    sourceRewardIds,
    totalWinCap,
  } = requireValidForm(parseBulkPerkRewardPrizesForm(formData));
  const { supabase } = await requireAdmin();
  const { data: existingPrizes, error: existingPrizesError } = await supabase
    .from("perk_bundle_prizes")
    .select("source_reward_id")
    .eq("bundle_reward_id", bundleRewardId)
    .eq("prize_type", "reward");

  if (existingPrizesError) {
    throw existingPrizesError;
  }

  const existingRewardIds = new Set(
    ((existingPrizes ?? []) as Array<{ source_reward_id: string | null }>)
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
  const { bundleRewardId, prizeId } = requireValidForm(parsePerkPrizeIdForm(formData));
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
  const { availableFrom, bundleRewardId, expiresAt, prizeId, quantity, reason } = requireValidForm(
    parsePerkInventoryMutationForm(formData, "Inventory assignment"),
  );
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
  const { bundleRewardId, prizeId, quantity, reason } = requireValidForm(
    parsePerkInventoryMutationForm(formData, "Inventory release"),
  );
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
  const {
    bucketId,
    bundleRewardId,
    endsAt,
    isEnabled,
    label,
    prizeId,
    releaseCap,
    sortOrder,
    startsAt,
  } = requireValidForm(parsePerkReleaseBucketForm(formData));
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
  const { bucketId, bundleRewardId } = requireValidForm(parsePerkReleaseBucketDeleteForm(formData));
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
