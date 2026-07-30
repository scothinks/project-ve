"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function markNotificationRead(formData: FormData) {
  const notificationId = String(formData.get("notificationId") ?? "");
  const supabase = await createSupabaseServerClient();

  if (!supabase || !notificationId) {
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });

  revalidatePath("/", "layout");
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  await supabase.rpc("mark_all_notifications_read");

  revalidatePath("/", "layout");
  revalidatePath("/notifications");
}
