"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { sanitizePlainTextInput } from "@/lib/input-safety";

type SupabaseActionError = {
  code?: string;
  message?: string;
};

function parseOptionalDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isMissingRpcError(error: SupabaseActionError | null) {
  if (!error) {
    return false;
  }

  return (
    error.code === "PGRST202"
    || error.code === "42883"
    || String(error.message ?? "").toLowerCase().includes("function")
  );
}

async function setLinkedRewardsEnabled(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  campaignId: string,
  isEnabled: boolean,
) {
  const { data: rewards, error } = await supabase
    .from("rewards")
    .select("id")
    .eq("campaign_id", campaignId)
    .returns<{ id: string }[]>();

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
  const nextStatus = isEnabled ? "active" : "draft";

  const { error } = await supabase.rpc("admin_set_campaign_enabled", {
    p_campaign_id: campaignId,
    p_is_enabled: isEnabled,
  });

  if (error) {
    if (!isMissingRpcError(error)) {
      throw new Error(error.message);
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, slug, name, description, starts_at, ends_at, budget_label, budget_amount")
      .eq("id", campaignId)
      .maybeSingle<{
        id: string;
        slug: string;
        name: string;
        description: string | null;
        starts_at: string | null;
        ends_at: string | null;
        budget_label: string | null;
        budget_amount: number | null;
      }>();

    if (campaignError) {
      throw new Error(campaignError.message);
    }

    if (!campaign) {
      throw new Error("Campaign not found.");
    }

    const { error: fallbackError } = await supabase.rpc("admin_upsert_campaign", {
      p_campaign_id: campaign.id,
      p_name: campaign.name,
      p_slug: campaign.slug,
      p_description: campaign.description ?? "",
      p_status: nextStatus,
      p_starts_at: campaign.starts_at,
      p_ends_at: campaign.ends_at,
      p_budget_label: campaign.budget_label ?? "",
      p_budget_amount: campaign.budget_amount,
    });

    if (fallbackError) {
      throw new Error(fallbackError.message);
    }

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
