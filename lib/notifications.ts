import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UserNotification = {
  id: string;
  category: "missions" | "rewards" | "account" | "system";
  eventType: string;
  title: string;
  body: string;
  ctaHref: string | null;
  ctaLabel: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPreferences = {
  inAppEnabled: boolean;
  webPushEnabled: boolean;
  rewardsEnabled: boolean;
  missionsEnabled: boolean;
  accountEnabled: boolean;
  systemEnabled: boolean;
};

type DbUserNotification = {
  id: string;
  category: UserNotification["category"];
  event_type: string;
  title: string;
  body: string;
  cta_href: string | null;
  cta_label: string | null;
  read_at: string | null;
  created_at: string;
};

type DbNotificationPreferences = {
  in_app_enabled: boolean;
  web_push_enabled: boolean;
  rewards_enabled: boolean;
  missions_enabled: boolean;
  account_enabled: boolean;
  system_enabled: boolean;
};

function mapNotification(row: DbUserNotification): UserNotification {
  return {
    id: row.id,
    category: row.category,
    eventType: row.event_type,
    title: row.title,
    body: row.body,
    ctaHref: row.cta_href,
    ctaLabel: row.cta_label,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function getUserNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 25,
) {
  const { data, error } = await supabase
    .from("user_notifications")
    .select("id, category, event_type, title, body, cta_href, cta_label, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<DbUserNotification[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapNotification);
}

export async function getUnreadNotificationCount(
  supabase: SupabaseClient,
  userId: string,
) {
  const { count, error } = await supabase
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function getNotificationPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("in_app_enabled, web_push_enabled, rewards_enabled, missions_enabled, account_enabled, system_enabled")
    .eq("user_id", userId)
    .maybeSingle<DbNotificationPreferences>();

  if (error) {
    throw error;
  }

  return {
    inAppEnabled: data?.in_app_enabled ?? true,
    webPushEnabled: data?.web_push_enabled ?? false,
    rewardsEnabled: data?.rewards_enabled ?? true,
    missionsEnabled: data?.missions_enabled ?? true,
    accountEnabled: data?.account_enabled ?? true,
    systemEnabled: data?.system_enabled ?? true,
  };
}
