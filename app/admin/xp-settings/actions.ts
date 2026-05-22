"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { fallbackAdminManualGrantDailyLimit } from "@/lib/xp-settings";

export async function saveXpSettings(formData: FormData) {
  const { supabase } = await requireAdmin();
  const rawLimit = String(formData.get("defaultDailyQuizXpLimit") ?? "").trim();
  const defaultDailyQuizXpLimit = Number(rawLimit);
  const rawManualGrantLimit = String(formData.get("adminManualGrantDailyLimit") ?? "").trim();
  const adminManualGrantDailyLimit = Number(rawManualGrantLimit || fallbackAdminManualGrantDailyLimit);

  if (!Number.isFinite(defaultDailyQuizXpLimit) || defaultDailyQuizXpLimit < 0) {
    throw new Error("Default daily quiz XP limit must be 0 or more.");
  }

  if (!Number.isFinite(adminManualGrantDailyLimit) || adminManualGrantDailyLimit < 0) {
    throw new Error("Admin manual grant daily limit must be 0 or more.");
  }

  const { error } = await supabase.from("xp_settings").upsert({
    id: 1,
    default_daily_quiz_xp_limit: Math.floor(defaultDailyQuizXpLimit),
    admin_manual_grant_daily_limit: Math.floor(adminManualGrantDailyLimit),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/xp-settings");
  revalidatePath("/quiz/[id]", "page");
  redirect("/admin/xp-settings?saved=1");
}
