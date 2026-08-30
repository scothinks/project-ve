"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PLATFORM_CATALOG_WORKSPACE_ID, requireAdmin } from "@/lib/admin";
import { sanitizePlainTextInput } from "@/lib/input-safety";

function redirectWithError(message: string): never {
  redirect(`/admin/xp-settings?error=${encodeURIComponent(message)}`);
}

export async function saveXpSettings(formData: FormData) {
  const { supabase, workspace } = await requireAdmin();
  const rawLimit = String(formData.get("defaultDailyQuizXpLimit") ?? "").trim();
  const defaultDailyQuizXpLimit = Number(rawLimit);
  const rawManualGrantLimit = String(formData.get("adminManualGrantDailyLimit") ?? "").trim();
  const adminManualGrantDailyLimit = Number(rawManualGrantLimit);

  if (!Number.isSafeInteger(defaultDailyQuizXpLimit) || defaultDailyQuizXpLimit < 0) {
    redirectWithError("Default daily quiz XP limit must be a whole number of 0 or more.");
  }

  if (!Number.isSafeInteger(adminManualGrantDailyLimit) || adminManualGrantDailyLimit < 0) {
    redirectWithError("Admin manual grant daily limit must be a whole number of 0 or more.");
  }

  if (defaultDailyQuizXpLimit > 2_147_483_647 || adminManualGrantDailyLimit > 2_147_483_647) {
    redirectWithError("XP limits must be 2,147,483,647 or less.");
  }

  const organizationId = workspace.type === "organization"
    && workspace.id !== PLATFORM_CATALOG_WORKSPACE_ID
    ? workspace.id
    : null;
  const { error } = await supabase.rpc("admin_save_workspace_xp_settings", {
    p_admin_manual_grant_daily_limit: adminManualGrantDailyLimit,
    p_default_daily_quiz_xp_limit: defaultDailyQuizXpLimit,
    p_organization_id: organizationId,
  });

  if (error) {
    redirectWithError(error.message || "XP settings could not be saved.");
  }

  revalidatePath("/admin/xp-settings");
  revalidatePath("/quiz/[id]", "page");
  redirect("/admin/xp-settings?saved=1");
}

async function requireCatalogXpManager() {
  const context = await requireAdmin();
  if (context.workspace.id !== PLATFORM_CATALOG_WORKSPACE_ID) {
    redirectWithError("Choose the Platform Catalog workspace to manage platform Points.");
  }
  return context;
}

function parseNonNegativeNumber(value: FormDataEntryValue | null, label: string) {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed) || parsed < 0) redirectWithError(`${label} must be zero or greater.`);
  return parsed;
}

function parseOptionalNonNegativeNumber(value: FormDataEntryValue | null, label: string) {
  const raw = String(value ?? "").trim();
  return raw ? parseNonNegativeNumber(value, label) : null;
}

export async function savePlatformXpPresentation(formData: FormData) {
  const { supabase } = await requireCatalogXpManager();
  const xpAccountId = sanitizePlainTextInput(String(formData.get("xpAccountId") ?? ""), 80);
  const displayName = sanitizePlainTextInput(String(formData.get("displayName") ?? ""), 80);
  const displayNamePlural = sanitizePlainTextInput(String(formData.get("displayNamePlural") ?? ""), 80);
  const shortLabel = sanitizePlainTextInput(String(formData.get("shortLabel") ?? ""), 20);
  const icon = sanitizePlainTextInput(String(formData.get("icon") ?? "coins"), 80);
  const displayFormat = String(formData.get("displayFormat") ?? "amount_short_label");
  const status = String(formData.get("status") ?? "active");

  if (!xpAccountId || !displayName || !displayNamePlural || !shortLabel) {
    redirectWithError("Platform Points labels are required.");
  }
  if (displayFormat !== "amount_name" && displayFormat !== "amount_short_label") {
    redirectWithError("Choose a supported Points display format.");
  }
  if (status !== "active" && status !== "paused") {
    redirectWithError("Choose active or paused for the platform Points account.");
  }

  const { error } = await supabase.rpc("admin_update_platform_xp_account_presentation", {
    p_display_format: displayFormat,
    p_display_name: displayName,
    p_display_name_plural: displayNamePlural,
    p_icon: icon,
    p_short_label: shortLabel,
    p_status: status,
    p_xp_account_id: xpAccountId,
  });
  if (error) redirectWithError(error.message);
  revalidatePath("/admin/xp-settings");
  redirect("/admin/xp-settings?saved=presentation");
}

export async function savePlatformXpControls(formData: FormData) {
  const { supabase } = await requireCatalogXpManager();
  const xpAccountId = sanitizePlainTextInput(String(formData.get("xpAccountId") ?? ""), 80);
  const currencyRaw = sanitizePlainTextInput(String(formData.get("accountingCurrency") ?? ""), 3).toUpperCase();
  const issuancePeriodDays = Number.parseInt(String(formData.get("issuancePeriodDays") ?? ""), 10);
  const issuanceCapPerPeriod = Number.parseInt(String(formData.get("issuanceCapPerPeriod") ?? ""), 10);
  const issuanceCapPerUser = Number.parseInt(String(formData.get("issuanceCapPerUser") ?? ""), 10);

  if (currencyRaw && !/^[A-Z]{3}$/.test(currencyRaw)) redirectWithError("Accounting currency must be a three-letter ISO code.");
  if (!Number.isInteger(issuancePeriodDays) || issuancePeriodDays < 1 || issuancePeriodDays > 366) {
    redirectWithError("Issuance period must be between 1 and 366 days.");
  }
  if (!Number.isInteger(issuanceCapPerPeriod) || issuanceCapPerPeriod < 0) redirectWithError("Period issuance cap must be zero or greater.");
  if (!Number.isInteger(issuanceCapPerUser) || issuanceCapPerUser < 0) redirectWithError("Per-user issuance cap must be zero or greater.");

  const { error } = await supabase.rpc("admin_update_platform_xp_account_controls", {
    p_accounting_currency: currencyRaw || null,
    p_accounting_value_per_unit: parseNonNegativeNumber(formData.get("accountingValuePerUnit"), "Accounting value per unit"),
    p_exposure_hard_threshold: parseOptionalNonNegativeNumber(formData.get("exposureHardThreshold"), "Exposure hard threshold"),
    p_exposure_warning_threshold: parseOptionalNonNegativeNumber(formData.get("exposureWarningThreshold"), "Exposure warning threshold"),
    p_funded_reward_budget: parseOptionalNonNegativeNumber(formData.get("fundedRewardBudget"), "Funded reward budget"),
    p_issuance_cap_per_period: issuanceCapPerPeriod,
    p_issuance_cap_per_user: issuanceCapPerUser,
    p_issuance_period_days: issuancePeriodDays,
    p_xp_account_id: xpAccountId,
  });
  if (error) redirectWithError(error.message);
  revalidatePath("/admin/xp-settings");
  redirect("/admin/xp-settings?saved=controls");
}

export async function adjustPlatformXpAccount(formData: FormData) {
  const { supabase } = await requireCatalogXpManager();
  const xpAccountId = sanitizePlainTextInput(String(formData.get("xpAccountId") ?? ""), 80);
  const targetUserId = sanitizePlainTextInput(String(formData.get("targetUserId") ?? ""), 80);
  const amount = Number.parseInt(String(formData.get("amount") ?? ""), 10);
  const direction = String(formData.get("direction") ?? "earn") === "spend" ? "spend" : "earn";
  const reason = sanitizePlainTextInput(String(formData.get("reason") ?? ""), 200);
  if (!xpAccountId || !targetUserId || !Number.isInteger(amount) || amount <= 0) {
    redirectWithError("A learner ID and positive adjustment amount are required.");
  }
  const { error } = await supabase.rpc("admin_adjust_platform_xp_account", {
    p_amount: amount,
    p_direction: direction,
    p_reason: reason || null,
    p_target_user_id: targetUserId,
    p_xp_account_id: xpAccountId,
  });
  if (error) redirectWithError(error.message);
  revalidatePath("/admin/xp-ledger");
  redirect("/admin/xp-settings?saved=adjustment");
}
