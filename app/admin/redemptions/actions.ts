"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { sanitizePlainTextInput } from "@/lib/input-safety";

export async function refundRedemption(formData: FormData) {
  const redemptionId = String(formData.get("redemptionId") ?? "");
  const reason = sanitizePlainTextInput(String(formData.get("reason") ?? ""), 500);
  const { supabase } = await requireAdmin();

  if (!redemptionId) {
    throw new Error("Redemption is required.");
  }

  const { error } = await supabase.rpc("refund_reward_redemption", {
    p_redemption_id: redemptionId,
    p_reason: reason || "Admin refund",
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/redemptions");
  revalidatePath("/admin/xp-ledger");
  redirect(appendAdminNotice("/admin/redemptions", "XP refunded."));
}

export async function fulfillRedemption(formData: FormData) {
  const redemptionId = String(formData.get("redemptionId") ?? "");
  const note = sanitizePlainTextInput(String(formData.get("note") ?? ""), 500);
  const { supabase } = await requireAdmin();

  if (!redemptionId) {
    throw new Error("Redemption is required.");
  }

  const { error } = await supabase.rpc("admin_mark_reward_redemption_fulfilled", {
    p_redemption_id: redemptionId,
    p_note: note || "Fulfilled by admin",
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/redemptions");
  revalidatePath("/admin/xp-ledger");
  redirect(appendAdminNotice("/admin/redemptions", "Redemption marked fulfilled."));
}
