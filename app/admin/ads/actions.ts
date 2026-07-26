"use server";

import { createHash } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { sanitizePlainTextInput } from "@/lib/input-safety";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxNativeImageBytes = 1024 * 1024;
const allowedCreativeFormats = new Set(["native_card", "text_card"]);

function slugify(value: string, fallback: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

function parseOptionalDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseInteger(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStringList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((item) => sanitizePlainTextInput(item, 80).trim())
    .filter(Boolean);
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

function requireHttpsUrl(value: string, fieldLabel: string) {
  if (!value) return "";

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      throw new Error(`${fieldLabel} must use HTTPS.`);
    }
    return url.toString();
  } catch {
    throw new Error(`${fieldLabel} must be a valid HTTPS URL.`);
  }
}

function revalidateAds() {
  revalidatePath("/admin/ads");
  revalidatePath("/lessons/[id]", "page");
  revalidatePath("/dashboard");
  revalidatePath("/courses/[id]", "page");
  revalidatePath("/missions");
  revalidatePath("/xp-store");
}

export async function saveAdPartner(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const partnerId = sanitizePlainTextInput(String(formData.get("partnerId") ?? ""), 120);
  const name = sanitizePlainTextInput(String(formData.get("name") ?? ""), 160).trim();
  const status = String(formData.get("status") ?? "draft");
  const termsAccepted = String(formData.get("termsAccepted") ?? "") === "true";

  if (!name) throw new Error("Partner name is required.");

  const id = partnerId || `ad-partner-${slugify(name, "partner")}`;
  const websiteUrl = requireHttpsUrl(
    sanitizePlainTextInput(String(formData.get("websiteUrl") ?? ""), 300).trim(),
    "Website URL",
  );

  const { error } = await supabase.rpc("admin_upsert_ad_partner", {
    p_payload: {
      id,
      name,
      slug: slugify(name, id),
      status,
      contactName: sanitizePlainTextInput(String(formData.get("contactName") ?? ""), 160).trim(),
      contactEmail: sanitizePlainTextInput(String(formData.get("contactEmail") ?? ""), 160).trim(),
      websiteUrl,
      allowedCtaDomains: parseStringList(formData.get("allowedCtaDomains")).map((domain) =>
        domain.toLowerCase(),
      ),
      termsAccepted,
      termsVersion: "ads-v1",
      actorId: profile.id,
      contractReference: sanitizePlainTextInput(String(formData.get("contractReference") ?? ""), 160).trim(),
      notes: sanitizePlainTextInput(String(formData.get("notes") ?? ""), 1000).trim(),
    },
  });

  if (error) throw error;

  revalidateAds();
  redirect(appendAdminNotice("/admin/ads", "Ad partner saved."));
}

export async function saveAdCampaign(formData: FormData) {
  const { supabase } = await requireAdmin();
  const campaignId = sanitizePlainTextInput(String(formData.get("campaignId") ?? ""), 120);
  const partnerId = sanitizePlainTextInput(String(formData.get("partnerId") ?? ""), 120);
  const name = sanitizePlainTextInput(String(formData.get("name") ?? ""), 180).trim();

  if (!partnerId) throw new Error("Partner is required.");
  if (!name) throw new Error("Campaign name is required.");

  const id = campaignId || `ad-campaign-${slugify(name, "campaign")}`;

  const { error } = await supabase.rpc("admin_upsert_ad_campaign", {
    p_payload: {
      id,
      partnerId,
      name,
      status: String(formData.get("status") ?? "draft"),
      campaignType: String(formData.get("campaignType") ?? "guaranteed"),
      startsAt: parseOptionalDate(formData.get("startsAt")),
      endsAt: parseOptionalDate(formData.get("endsAt")),
      timezone: sanitizePlainTextInput(String(formData.get("timezone") ?? "Africa/Lagos"), 80),
      budgetLabel: sanitizePlainTextInput(String(formData.get("budgetLabel") ?? ""), 120).trim(),
      pricingModel: String(formData.get("pricingModel") ?? "flat_fee"),
      rateAmount: parseInteger(formData.get("rateAmount")),
      currency: sanitizePlainTextInput(String(formData.get("currency") ?? "NGN"), 3).toUpperCase(),
      minorUnit: parseInteger(formData.get("minorUnit"), 2),
      roundingMode: String(formData.get("roundingMode") ?? "half_up"),
      grossBudgetAmount: parseInteger(formData.get("grossBudgetAmount"), 0) || "",
      billableBudgetAmount: parseInteger(formData.get("billableBudgetAmount"), 0) || "",
      spendCapAmount: parseInteger(formData.get("spendCapAmount"), 0) || "",
      allowOverspend: String(formData.get("allowOverspend") ?? "") === "true",
      overspendTolerancePercent: parseInteger(formData.get("overspendTolerancePercent"), 0),
      contractedImpressions: parseInteger(formData.get("contractedImpressions"), 0) || "",
      contractedClicks: parseInteger(formData.get("contractedClicks"), 0) || "",
      contractedViewableImpressions: parseInteger(formData.get("contractedViewableImpressions"), 0) || "",
      includedContentTags: parseStringList(formData.get("includedContentTags")),
      excludedContentTags: parseStringList(formData.get("excludedContentTags")),
      includedCourseCategories: parseStringList(formData.get("includedCourseCategories")),
      excludedCourseCategories: parseStringList(formData.get("excludedCourseCategories")),
      includedCourseIds: parseStringList(formData.get("includedCourseIds")),
      excludedCourseIds: parseStringList(formData.get("excludedCourseIds")),
      includedLessonIds: parseStringList(formData.get("includedLessonIds")),
      excludedLessonIds: parseStringList(formData.get("excludedLessonIds")),
      excludedPageTypes: parseStringList(formData.get("excludedPageTypes")),
      competitorExclusionKeys: parseStringList(formData.get("competitorExclusionKeys")),
      priority: parseInteger(formData.get("priority")),
      pacingMode: String(formData.get("pacingMode") ?? "even"),
      makeGoodPolicy: sanitizePlainTextInput(String(formData.get("makeGoodPolicy") ?? ""), 1000).trim(),
      notes: sanitizePlainTextInput(String(formData.get("notes") ?? ""), 1000).trim(),
    },
  });

  if (error) throw error;

  revalidateAds();
  redirect(appendAdminNotice("/admin/ads", "Ad campaign saved."));
}

async function uploadCreativeImage(formData: FormData, partnerId: string) {
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
  const altText = sanitizePlainTextInput(String(formData.get("imageAlt") ?? ""), 160).trim();

  if (altText.length < 10) {
    throw new Error("Creative image alt text must be at least 10 characters.");
  }

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
  const { supabase } = await requireAdmin();
  const campaignId = sanitizePlainTextInput(String(formData.get("campaignId") ?? ""), 120);
  const creativeId = sanitizePlainTextInput(String(formData.get("creativeId") ?? ""), 120);
  const name = sanitizePlainTextInput(String(formData.get("name") ?? ""), 180).trim();
  const headline = sanitizePlainTextInput(String(formData.get("headline") ?? ""), 160).trim();
  const sponsorLabel = sanitizePlainTextInput(String(formData.get("sponsorLabel") ?? ""), 120).trim();
  const disclosureLabel =
    sanitizePlainTextInput(String(formData.get("disclosureLabel") ?? "Sponsored"), 40).trim() ||
    "Sponsored";
  const ctaUrl = requireHttpsUrl(
    sanitizePlainTextInput(String(formData.get("ctaUrl") ?? ""), 400).trim(),
    "CTA URL",
  );

  if (!campaignId) throw new Error("Campaign is required.");
  if (!name) throw new Error("Creative name is required.");
  if (!headline) throw new Error("Headline is required.");
  if (!sponsorLabel) throw new Error("Sponsor label is required.");
  if (!disclosureLabel) throw new Error("Disclosure label is required.");

  const { data: campaign, error: campaignError } = await supabase
    .from("ad_campaigns")
    .select("id, partner_id")
    .eq("id", campaignId)
    .maybeSingle<{ id: string; partner_id: string }>();

  if (campaignError) throw campaignError;
  if (!campaign) throw new Error("Campaign not found.");

  const id = creativeId || `ad-creative-${slugify(name, "creative")}`;
  const creativeFormat = String(formData.get("creativeFormat") ?? "native_card");

  if (!allowedCreativeFormats.has(creativeFormat)) {
    throw new Error("Only native card and text card creatives are supported in V1.");
  }

  const imageAssetId = await uploadCreativeImage(formData, campaign.partner_id);

  if (creativeFormat === "native_card" && !imageAssetId) {
    throw new Error("Native card creatives require an uploaded image asset.");
  }

  const { error: creativeError } = await supabase.rpc("admin_upsert_ad_creative", {
    p_payload: {
      id,
      campaignId,
      name,
      status: String(formData.get("creativeStatus") ?? "active"),
      creativeFormat,
      weight: parseInteger(formData.get("weight"), 1) || 1,
    },
  });

  if (creativeError) throw creativeError;

  const versionStatus = String(formData.get("versionStatus") ?? "submitted");

  if (versionStatus === "approved") {
    throw new Error("Create the version as draft/submitted, then approve it through review.");
  }

  const { error: versionError } = await supabase.rpc("admin_insert_ad_creative_version", {
    p_payload: {
      creativeId: id,
      status: versionStatus,
      headline,
      body: sanitizePlainTextInput(String(formData.get("body") ?? ""), 500).trim(),
      eyebrow: sanitizePlainTextInput(String(formData.get("eyebrow") ?? ""), 80).trim(),
      imageAssetId: imageAssetId ?? "",
      imageAlt: sanitizePlainTextInput(String(formData.get("imageAlt") ?? ""), 160).trim(),
      ctaLabel: sanitizePlainTextInput(String(formData.get("ctaLabel") ?? ""), 80).trim(),
      ctaUrl,
      sponsorLabel,
      disclosureLabel,
      legalText: sanitizePlainTextInput(String(formData.get("legalText") ?? ""), 300).trim(),
      theme: {},
    },
  });

  if (versionError) throw versionError;

  revalidateAds();
  redirect(appendAdminNotice("/admin/ads", "Creative version saved."));
}

export async function saveAdFlight(formData: FormData) {
  const { supabase } = await requireAdmin();
  const campaignId = sanitizePlainTextInput(String(formData.get("campaignId") ?? ""), 120);
  const creativeVersionId = sanitizePlainTextInput(String(formData.get("creativeVersionId") ?? ""), 120);
  const placementKey = sanitizePlainTextInput(String(formData.get("placementKey") ?? ""), 80);

  if (!campaignId) throw new Error("Campaign is required.");
  if (!creativeVersionId) throw new Error("Creative version is required.");
  if (!placementKey) throw new Error("Placement is required.");

  const sequencePageNumber = parseInteger(formData.get("sequencePageNumber"));
  const { error } = await supabase.rpc("admin_insert_ad_flight", {
    p_payload: {
      campaignId,
      creativeVersionId,
      placementKey,
      status: String(formData.get("status") ?? "active"),
      startsAt: parseOptionalDate(formData.get("startsAt")),
      endsAt: parseOptionalDate(formData.get("endsAt")),
      priority: parseInteger(formData.get("priority")),
      weight: parseInteger(formData.get("weight"), 1) || 1,
      targetingRules: {
        includedSegmentKeys: parseStringList(formData.get("includedSegmentKeys")),
        excludedSegmentKeys: parseStringList(formData.get("excludedSegmentKeys")),
        experimentKey: sanitizePlainTextInput(String(formData.get("experimentKey") ?? ""), 80).trim(),
        variants: parseStringList(formData.get("experimentVariants")),
      },
      frequencyCaps: {
        sessionMaxPaidAds: parseInteger(formData.get("sessionMaxPaidAds"), 5),
        userDailyCampaignImpressions: parseInteger(formData.get("userDailyCampaignImpressions"), 3),
        userDailyCreativeVersionImpressions: parseInteger(
          formData.get("userDailyCreativeVersionImpressions"),
          2,
        ),
        userWeeklyPartnerImpressions: parseInteger(formData.get("userWeeklyPartnerImpressions"), 5),
      },
      sequenceRules: sequencePageNumber > 0 ? { pageNumber: sequencePageNumber } : {},
      brandSafetyRules: {
        excludedContentTags: parseStringList(formData.get("brandExcludedContentTags")),
        excludedPageTypes: parseStringList(formData.get("brandExcludedPageTypes")),
        includedPageTypes: parseStringList(formData.get("brandIncludedPageTypes")),
      },
      competitorExclusionKeys: parseStringList(formData.get("competitorExclusionKeys")),
      deliveryGoalImpressions: parseInteger(formData.get("deliveryGoalImpressions"), 0) || "",
      deliveryGoalClicks: parseInteger(formData.get("deliveryGoalClicks"), 0) || "",
    },
  });

  if (error) throw error;

  revalidateAds();
  redirect(appendAdminNotice("/admin/ads", "Ad flight saved."));
}

export async function setAdEntityStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const entityType = sanitizePlainTextInput(String(formData.get("entityType") ?? ""), 80);
  const entityId = sanitizePlainTextInput(String(formData.get("entityId") ?? ""), 120);
  const status = String(formData.get("status") ?? "paused");
  const reason = sanitizePlainTextInput(String(formData.get("reason") ?? ""), 300).trim();

  const { error } = await supabase.rpc("admin_set_ad_entity_status", {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_status: status,
    p_reason: reason || null,
  });

  if (error) throw error;

  revalidateAds();
  redirect(appendAdminNotice("/admin/ads", "Ad status updated."));
}

export async function refreshAdBillingSnapshot(formData: FormData) {
  const { supabase } = await requireAdmin();
  const campaignId = sanitizePlainTextInput(String(formData.get("campaignId") ?? ""), 120);
  const periodStart = parseOptionalDate(formData.get("periodStart"));
  const periodEnd = parseOptionalDate(formData.get("periodEnd"));

  if (!campaignId) throw new Error("Campaign is required.");
  if (!periodStart || !periodEnd) throw new Error("Billing period start and end are required.");

  const { error } = await supabase.rpc("refresh_ad_billing_snapshot", {
    p_campaign_id: campaignId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });

  if (error) throw error;

  revalidateAds();
  redirect(appendAdminNotice("/admin/ads", "Billing snapshot refreshed."));
}

export async function createAdMakeGoodRecommendations() {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("create_ad_make_good_recommendations");

  if (error) throw error;

  revalidateAds();
  redirect(appendAdminNotice("/admin/ads", "Make-good recommendations refreshed."));
}

export async function purgeOldAdRuntimeData() {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("purge_old_ad_runtime_data");

  if (error) throw error;

  revalidateAds();
  redirect(appendAdminNotice("/admin/ads", "Ad retention cleanup completed."));
}
