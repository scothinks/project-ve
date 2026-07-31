"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createAdMakeGoodRecommendationsCommand,
  purgeOldAdRuntimeDataCommand,
  refreshAdBillingSnapshotCommand,
  saveAdCampaignCommand,
  saveAdCreativeVersionCommand,
  saveAdFlightCommand,
  saveAdPartnerCommand,
  saveAdPlacementFallbackCommand,
  setAdEntityStatusCommand,
  type AdminAdsCommandResult,
} from "@/features/ads/admin/commands";
import { requireAdmin } from "@/features/admin/application/context";
import { appendAdminNotice } from "@/lib/admin-feedback";

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

function finishAdAction(result: AdminAdsCommandResult): never {
  revalidateAds();
  redirect(appendAdminNotice(result.returnPath, result.notice));
}

export async function saveAdPlacementFallback(formData: FormData) {
  const result = await saveAdPlacementFallbackCommand(await requireAdmin(), formData);
  finishAdAction(result);
}

export async function saveAdPartner(formData: FormData) {
  const result = await saveAdPartnerCommand(await requireAdmin(), formData);
  finishAdAction(result);
}

export async function saveAdCampaign(formData: FormData) {
  const result = await saveAdCampaignCommand(await requireAdmin(), formData);
  finishAdAction(result);
}

export async function saveAdCreativeVersion(formData: FormData) {
  const result = await saveAdCreativeVersionCommand(await requireAdmin(), formData);
  finishAdAction(result);
}

export async function saveAdFlight(formData: FormData) {
  const result = await saveAdFlightCommand(await requireAdmin(), formData);
  finishAdAction(result);
}

export async function setAdEntityStatus(formData: FormData) {
  const result = await setAdEntityStatusCommand(await requireAdmin(), formData);
  finishAdAction(result);
}

export async function refreshAdBillingSnapshot(formData: FormData) {
  const result = await refreshAdBillingSnapshotCommand(await requireAdmin(), formData);
  finishAdAction(result);
}

export async function createAdMakeGoodRecommendations() {
  const result = await createAdMakeGoodRecommendationsCommand(await requireAdmin());
  finishAdAction(result);
}

export async function purgeOldAdRuntimeData() {
  const result = await purgeOldAdRuntimeDataCommand(await requireAdmin());
  finishAdAction(result);
}
