"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { sanitizePlainTextInput } from "@/lib/input-safety";

function parseOptionalDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function setLinkedRewardsEnabled(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  campaignId: string,
  isEnabled: boolean,
) {
  const { data: rewards, error } = await supabase
    .from("rewards")
    .select("id")
    .eq("campaign_id", campaignId);

  if (error) {
    throw new Error(error.message);
  }

  for (const reward of rewards ?? []) {
    const { error: rewardError } = await supabase.rpc("admin_set_reward_enabled", {
      p_reward_id: reward.id,
      p_is_enabled: isEnabled,
    });

    if (rewardError) {
      throw new Error(rewardError.message);
    }
  }
}

export async function saveCampaign(formData: FormData) {
  const campaignId = sanitizePlainTextInput(String(formData.get("campaignId") ?? ""), 120);
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase.rpc("admin_upsert_campaign", {
    p_campaign_id: campaignId,
    p_name: sanitizePlainTextInput(String(formData.get("name") ?? ""), 160),
    p_description: sanitizePlainTextInput(String(formData.get("description") ?? ""), 800),
    p_starts_at: parseOptionalDate(formData.get("startsAt")),
    p_ends_at: parseOptionalDate(formData.get("endsAt")),
    p_budget_label: sanitizePlainTextInput(String(formData.get("budgetLabel") ?? ""), 140),
  });

  if (error) {
    throw error;
  }

  const result = data as { campaignId?: string } | null;
  const nextId = result?.campaignId ?? campaignId;

  revalidatePath("/admin/campaigns");
  revalidatePath("/admin/rewards");

  if (nextId) {
    redirect(appendAdminNotice(`/admin/campaigns/${nextId}`, "Campaign saved."));
  }

  redirect(appendAdminNotice("/admin/campaigns", "Campaign saved."));
}

export async function setCampaignEnabled(formData: FormData) {
  const campaignId = sanitizePlainTextInput(String(formData.get("campaignId") ?? ""), 120);
  const isEnabled = String(formData.get("isEnabled") ?? "") === "true";
  const redirectTo = sanitizePlainTextInput(String(formData.get("redirectTo") ?? "/admin/campaigns"), 400);
  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("admin_set_campaign_enabled", {
    p_campaign_id: campaignId,
    p_is_enabled: isEnabled,
  });

  if (error) {
    throw new Error(error.message);
  }

  await setLinkedRewardsEnabled(supabase, campaignId, isEnabled);

  revalidatePath("/admin/campaigns");
  revalidatePath("/admin/rewards");
  revalidatePath("/xp-store");
  redirect(
    appendAdminNotice(
      redirectTo,
      isEnabled ? "Campaign enabled." : "Campaign disabled.",
    ),
  );
}
