"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { appendAdminNotice } from "@/lib/admin-feedback";
import { sanitizePlainTextInput } from "@/lib/input-safety";

export async function grantUserXp(formData: FormData) {
  const targetUserId = String(formData.get("targetUserId") ?? "").trim();
  const rawAmount = String(formData.get("amount") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/admin/users").trim() || "/admin/users";
  const reason = sanitizePlainTextInput(String(formData.get("reason") ?? ""), 200).trim();
  const amount = Number.parseInt(rawAmount, 10);
  const { supabase } = await requireAdmin();

  if (!targetUserId) {
    throw new Error("Target user is required.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Grant amount must be greater than 0.");
  }

  const { error } = await supabase.rpc("admin_grant_user_xp", {
    p_target_user_id: targetUserId,
    p_amount: amount,
    p_reason: reason || null,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/xp-ledger");
  redirect(appendAdminNotice(redirectTo, `${amount} XP granted.`));
}
