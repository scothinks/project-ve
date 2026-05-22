import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fallbackAdminManualGrantDailyLimit,
  fallbackDailyQuizXpLimit,
  xpTimezone,
} from "@/lib/xp-constants";

export {
  fallbackAdminManualGrantDailyLimit,
  fallbackDailyQuizXpLimit,
  xpTimezone,
};

type XpSettingsRow = {
  default_daily_quiz_xp_limit: number;
  admin_manual_grant_daily_limit: number;
};

type UserDailyXpLimitRow = {
  earnable_quiz_xp_limit: number;
};

function getLocalDateInTimezone(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: xpTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [{ value: year }, , { value: month }, , { value: day }] = formatter.formatToParts(now);
  return `${year}-${month}-${day}`;
}

export async function getDefaultDailyQuizXpLimit(supabase: SupabaseClient | null) {
  if (!supabase) {
    return fallbackDailyQuizXpLimit;
  }

  const { data, error } = await supabase
    .from("xp_settings")
    .select("default_daily_quiz_xp_limit")
    .eq("id", 1)
    .maybeSingle<XpSettingsRow>();

  if (error) {
    return fallbackDailyQuizXpLimit;
  }

  return data?.default_daily_quiz_xp_limit ?? fallbackDailyQuizXpLimit;
}

export async function getEffectiveDailyQuizXpLimit(
  supabase: SupabaseClient,
  userId: string,
) {
  const defaultLimit = await getDefaultDailyQuizXpLimit(supabase);
  const localDate = getLocalDateInTimezone();
  const { data, error } = await supabase
    .from("user_daily_xp_limits")
    .select("earnable_quiz_xp_limit")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .maybeSingle<UserDailyXpLimitRow>();

  if (error) {
    return defaultLimit;
  }

  return data?.earnable_quiz_xp_limit ?? defaultLimit;
}
