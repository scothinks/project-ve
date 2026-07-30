"use server";

import { createHash } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  parseAdBillingSnapshotForm,
  parseAdCampaignForm,
  parseAdCreativeVersionForm,
  parseAdEntityStatusForm,
  parseAdFlightForm,
  parseAdPartnerForm,
  parseAdPlacementFallbackForm,
  slugifyAdValue,
} from "@/lib/admin-ad-validation";
import { requireAdmin } from "@/lib/admin";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { ValidationError } from "@/lib/app-errors";
import { formatValidationIssues } from "@/lib/form-data-validation";
import type { ValidationResult } from "@/lib/request-validation";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxNativeImageBytes = 1024 * 1024;

function requireValidForm<T>(result: ValidationResult<T>) {
  if (!result.ok) {
    throw new ValidationError(`Invalid ad form data. ${formatValidationIssues(result.issues)}`);
  }

  return result.data;
}

function getImageDimensions(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/png" && bytes.length >= 24) {
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  }

  if (mimeType === "image/jpeg") {
    let offset = 2;

    while (offset < bytes.length) {
      if (bytes[offset] !== 0xff) break;

      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);

      if ([0xc0, 0xc1, 0xc2, 0xc3].includes(marker)) {
        return {
          height: bytes.readUInt16BE(offset + 5),
          width: bytes.readUInt16BE(offset + 7),
        };
      }

      offset += 2 + length;
    }
  }

  if (mimeType === "image/webp" && bytes.toString("ascii", 0, 4) === "RIFF") {
    const chunkType = bytes.toString("ascii", 12, 16);

    if (chunkType === "VP8X" && bytes.length >= 30) {
      return {
        width: 1 + bytes.readUIntLE(24, 3),
        height: 1 + bytes.readUIntLE(27, 3),
      };
    }

    if (chunkType === "VP8 " && bytes.length >= 30) {
      return {
        width: bytes.readUInt16LE(26) & 0x3fff,
        height: bytes.readUInt16LE(28) & 0x3fff,
      };
    }

    if (chunkType === "VP8L" && bytes.length >= 25) {
      const bits = bytes.readUInt32LE(21);

      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
  }

  return null;
}

function validateNativeImageDimensions(width: number, height: number) {
  const ratio = width / height;
  const targetRatio = 16 / 9;
  const withinTolerance = Math.abs(ratio - targetRatio) <= targetRatio * 0.03;

  if (width < 600 || height < 338 || !withinTolerance) {
    throw new Error("Native card image must be at least 600×338 and close to 16:9.");
  }
}

function revalidateAds() {
  revalidatePath("/admin/ads");
  revalidatePath("/admin/ads/launch");
  revalidatePath("/admin/ads/review");
  revalidatePath("/admin/ads/reporting");
  revalidatePath("/admin/ads/inventory");
  revalidatePath("/lessons/[id]", "page");
  revalidatePath("/dashboard");
  revalidatePath("/courses/[id]", "page");
  revalidatePath("/missions");
  revalidatePath("/xp-store");
}

export async function saveAdPlacementFallback(formData: FormData) {
  const input = requireValidForm(parseAdPlacementFallbackForm(formData));
  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("admin_update_ad_placement_fallback", {
    p_placement_key: input.placementKey,
    p_enabled: input.enabled,
    p_eyebrow: input.eyebrow,
    p_headline: input.headline,
    p_body: input.body,
    p_cta_label: input.ctaLabel,
    p_cta_url: input.ctaUrl,
  });

  if (error) throw error;

  revalidateAds();
  redirect(appendAdminNotice("/admin/ads/inventory", "Placement fallback campaign updated."));
}

export async function saveAdPartner(formData: FormData) {
  const input = requireValidForm(parseAdPartnerForm(formData));
  const { supabase, profile } = await requireAdmin();

  const { error } = await supabase.rpc("admin_upsert_ad_partner", {
    p_payload: {
      id: input.id,
      name: input.name,
      slug: input.slug,
      status: input.status,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      websiteUrl: input.websiteUrl,
      allowedCtaDomains: input.allowedCtaDomains,
      termsAccepted: input.termsAccepted,
      termsVersion: "ads-v1",
      actorId: profile.id,
      contractReference: input.contractReference,
      notes: input.notes,
    },
  });

  if (error) throw error;

  revalidateAds();
  redirect(appendAdminNotice("/admin/ads/launch", "Ad partner saved."));
}

export async function saveAdCampaign(formData: FormData) {
  const input = requireValidForm(parseAdCampaignForm(formData));
  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("admin_upsert_ad_campaign", {
    p_payload: {
      id: input.id,
      partnerId: input.partnerId,
      name: input.name,
      status: input.status,
      campaignType: input.campaignType,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timezone: input.timezone,
      budgetLabel: input.budgetLabel,
      pricingModel: input.pricingModel,
      rateAmount: input.rateAmount,
      currency: input.currency,
      minorUnit: input.minorUnit,
      roundingMode: input.roundingMode,
      grossBudgetAmount: input.grossBudgetAmount,
      billableBudgetAmount: input.billableBudgetAmount,
      spendCapAmount: input.spendCapAmount,
      allowOverspend: input.allowOverspend,
      overspendTolerancePercent: input.overspendTolerancePercent,
      contractedImpressions: input.contractedImpressions,
      contractedClicks: input.contractedClicks,
      contractedViewableImpressions: input.contractedViewableImpressions,
      includedContentTags: input.includedContentTags,
      excludedContentTags: input.excludedContentTags,
      includedCourseCategories: input.includedCourseCategories,
      excludedCourseCategories: input.excludedCourseCategories,
      includedCourseIds: input.includedCourseIds,
      excludedCourseIds: input.excludedCourseIds,
      includedLessonIds: input.includedLessonIds,
      excludedLessonIds: input.excludedLessonIds,
      excludedPageTypes: input.excludedPageTypes,
      competitorExclusionKeys: input.competitorExclusionKeys,
      priority: input.priority,
      pacingMode: input.pacingMode,
      makeGoodPolicy: input.makeGoodPolicy,
      notes: input.notes,
    },
  });

  if (error) throw error;

  revalidateAds();
  redirect(appendAdminNotice("/admin/ads/launch", "Ad campaign saved."));
}

async function uploadCreativeImage(formData: FormData, partnerId: string, altText: string) {
  const file = formData.get("imageFile");

  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  if (!allowedImageTypes.has(file.type)) {
    throw new Error("Creative image must be JPG, PNG, or WebP.");
  }

  if (file.size > maxNativeImageBytes) {
    throw new Error("Creative image must be 1MB or smaller.");
  }

  const { supabase } = await requireAdmin();
  const bytes = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const dimensions = getImageDimensions(bytes, file.type);

  if (!dimensions) {
    throw new Error("Creative image dimensions could not be read.");
  }

  validateNativeImageDimensions(dimensions.width, dimensions.height);

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const storagePath = `${partnerId}/${Date.now()}-${checksum.slice(0, 12)}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("ad-creatives")
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const publicUrl = supabase.storage.from("ad-creatives").getPublicUrl(storagePath).data.publicUrl;
  const { data: asset, error: assetError } = await supabase.rpc("admin_register_ad_creative_asset", {
    p_payload: {
      partnerId,
      storageBucket: "ad-creatives",
      storagePath,
      publicUrl,
      assetType: "image",
      mimeType: file.type,
      fileSizeBytes: file.size,
      width: dimensions.width,
      height: dimensions.height,
      checksum,
      altText,
      status: "approved",
    },
  });

  if (assetError) throw assetError;
  return (asset as { assetId?: string } | null)?.assetId ?? null;
}

export async function saveAdCreativeVersion(formData: FormData) {
  const input = requireValidForm(parseAdCreativeVersionForm(formData));
  const { supabase } = await requireAdmin();

  const { data: campaign, error: campaignError } = await supabase
    .from("ad_campaigns")
    .select("id, partner_id")
    .eq("id", input.campaignId)
    .maybeSingle();

  if (campaignError) throw campaignError;
  if (!campaign) throw new Error("Campaign not found.");

  const id = input.creativeId || `ad-creative-${slugifyAdValue(input.name, "creative")}`;
  const imageAssetId = await uploadCreativeImage(formData, campaign.partner_id, input.imageAlt);

  if (input.creativeFormat === "native_card" && !imageAssetId) {
    throw new Error("Native card creatives require an uploaded image asset.");
  }

  const { error: creativeError } = await supabase.rpc("admin_upsert_ad_creative", {
    p_payload: {
      id,
      campaignId: input.campaignId,
      name: input.name,
      status: input.creativeStatus,
      creativeFormat: input.creativeFormat,
      weight: input.weight,
    },
  });

  if (creativeError) throw creativeError;

  const { error: versionError } = await supabase.rpc("admin_insert_ad_creative_version", {
    p_payload: {
      creativeId: id,
      status: input.versionStatus,
      headline: input.headline,
      body: input.body,
      eyebrow: input.eyebrow,
      imageAssetId: imageAssetId ?? "",
      imageAlt: input.imageAlt,
      ctaLabel: input.ctaLabel,
      ctaUrl: input.ctaUrl,
      sponsorLabel: input.sponsorLabel,
      disclosureLabel: input.disclosureLabel,
      legalText: input.legalText,
      theme: {},
    },
  });

  if (versionError) throw versionError;

  revalidateAds();
  redirect(appendAdminNotice("/admin/ads/launch", "Creative version saved."));
}

export async function saveAdFlight(formData: FormData) {
  const input = requireValidForm(parseAdFlightForm(formData));
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_insert_ad_flight", {
    p_payload: {
      campaignId: input.campaignId,
      creativeVersionId: input.creativeVersionId,
      placementKey: input.placementKey,
      status: input.status,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      priority: input.priority,
      weight: input.weight,
      targetingRules: {
        includedSegmentKeys: input.includedSegmentKeys,
        excludedSegmentKeys: input.excludedSegmentKeys,
        experimentKey: input.experimentKey,
        variants: input.experimentVariants,
      },
      frequencyCaps: {
        sessionMaxPaidAds: input.sessionMaxPaidAds,
        userDailyCampaignImpressions: input.userDailyCampaignImpressions,
        userDailyCreativeVersionImpressions: input.userDailyCreativeVersionImpressions,
        userWeeklyPartnerImpressions: input.userWeeklyPartnerImpressions,
      },
      sequenceRules: input.sequenceRules,
      brandSafetyRules: {
        excludedContentTags: input.brandExcludedContentTags,
        excludedPageTypes: input.brandExcludedPageTypes,
        includedPageTypes: input.brandIncludedPageTypes,
      },
      competitorExclusionKeys: input.competitorExclusionKeys,
      deliveryGoalImpressions: input.deliveryGoalImpressions,
      deliveryGoalClicks: input.deliveryGoalClicks,
    },
  });

  if (error) throw error;

  revalidateAds();
  redirect(appendAdminNotice("/admin/ads/launch", "Ad flight saved."));
}

export async function setAdEntityStatus(formData: FormData) {
  const input = requireValidForm(parseAdEntityStatusForm(formData));
  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("admin_set_ad_entity_status", {
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_status: input.status,
    p_reason: input.reason,
  });

  if (error) throw error;

  revalidateAds();
  redirect(appendAdminNotice(input.returnPath, "Ad status updated."));
}

export async function refreshAdBillingSnapshot(formData: FormData) {
  const input = requireValidForm(parseAdBillingSnapshotForm(formData));
  const { supabase } = await requireAdmin();
  if (!input.periodStart || !input.periodEnd) {
    throw new ValidationError("Invalid ad form data. periodStart: Required. periodEnd: Required.");
  }

  const { error } = await supabase.rpc("refresh_ad_billing_snapshot", {
    p_campaign_id: input.campaignId,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
  });

  if (error) throw error;

  revalidateAds();
  redirect(appendAdminNotice("/admin/ads/reporting", "Billing snapshot refreshed."));
}

export async function createAdMakeGoodRecommendations() {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("create_ad_make_good_recommendations");

  if (error) throw error;

  revalidateAds();
  redirect(appendAdminNotice("/admin/ads/reporting", "Make-good recommendations refreshed."));
}

export async function purgeOldAdRuntimeData() {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("purge_old_ad_runtime_data");

  if (error) throw error;

  revalidateAds();
  redirect(appendAdminNotice("/admin/ads/reporting", "Ad retention cleanup completed."));
}
