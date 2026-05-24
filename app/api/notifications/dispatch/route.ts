import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, getSupabaseAdminConfig } from "@/lib/supabase-admin";
import { sendWebPushNotification } from "@/lib/web-push";

type PendingDeliveryRow = {
  attempt_count: number;
  id: string;
  notification: {
    body: string;
    created_at: string;
    cta_href: string | null;
    event_type: string;
    id: string;
    read_at: string | null;
    title: string;
    user_id: string;
  } | null;
  subscription: {
    device_key: string;
    endpoint: string;
    failure_count: number;
    id: string;
    subscription: Record<string, unknown>;
    user_id: string;
  } | null;
};

type ValidPendingDeliveryRow = {
  attempt_count: number;
  id: string;
  notification: NonNullable<PendingDeliveryRow["notification"]>;
  subscription: NonNullable<PendingDeliveryRow["subscription"]>;
};

const PUSH_EVENT_PRIORITIES: Record<string, number> = {
  continue_learning: 110,
  mission_proof_rejected: 100,
  mission_proof_approved: 95,
  free_xp_grant: 90,
  reward_redemption_refunded: 85,
  reward_redemption_fulfilled: 84,
  reward_redemption_created: 83,
  reward_redemption_expired: 82,
  new_reward: 60,
  new_mission: 55,
  new_course: 50,
  new_lesson: 45,
};

function getPushPriority(eventType: string) {
  return PUSH_EVENT_PRIORITIES[eventType] ?? null;
}

function buildSummaryPushPayload(notificationCount: number) {
  return {
    body: "Open notifications to review them.",
    title: `${notificationCount} new ${notificationCount === 1 ? "update" : "updates"}`,
    url: "/notifications",
  };
}

async function markDeliveriesSkipped(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  deliveryIds: string[],
  reason: string,
) {
  if (deliveryIds.length === 0) {
    return;
  }

  const timestamp = new Date().toISOString();

  await adminSupabase
    .from("user_push_deliveries")
    .update({
      failed_at: timestamp,
      last_attempted_at: timestamp,
      last_error: reason,
      status: "skipped",
    })
    .in("id", deliveryIds);
}

async function markDeliveriesSent(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  deliveries: ValidPendingDeliveryRow[],
  responseCode: number,
) {
  if (deliveries.length === 0) {
    return;
  }

  const timestamp = new Date().toISOString();

  for (const delivery of deliveries) {
    await adminSupabase
      .from("user_push_deliveries")
      .update({
        attempt_count: delivery.attempt_count + 1,
        last_attempted_at: timestamp,
        last_error: null,
        response_code: responseCode,
        sent_at: timestamp,
        status: "sent",
      })
      .eq("id", delivery.id);
  }
}

async function markDeliveriesFailedOrRetried(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  deliveries: ValidPendingDeliveryRow[],
  errorMessage: string,
  statusCode?: number,
) {
  const timestamp = new Date().toISOString();

  for (const delivery of deliveries) {
    const nextAttemptCount = delivery.attempt_count + 1;
    const shouldFail = statusCode === 404 || statusCode === 410 || nextAttemptCount >= 3;

    await adminSupabase
      .from("user_push_deliveries")
      .update({
        attempt_count: nextAttemptCount,
        failed_at: shouldFail ? timestamp : null,
        last_attempted_at: timestamp,
        last_error: errorMessage,
        response_code: statusCode ?? null,
        status: shouldFail ? "failed" : "pending",
      })
      .eq("id", delivery.id);
  }
}

function isAuthorized(request: NextRequest) {
  const manualSecret = process.env.NOTIFICATION_DISPATCH_SECRET;
  const cronSecret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization");
  const direct = request.headers.get("x-notification-dispatch-secret");

  return (
    (Boolean(manualSecret) && (bearer === `Bearer ${manualSecret}` || direct === manualSecret))
    || (Boolean(cronSecret) && bearer === `Bearer ${cronSecret}`)
  );
}

async function syncWebPushPreference(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
) {
  const { count } = await adminSupabase
    .from("user_push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("disabled_at", null);

  await adminSupabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: userId,
        web_push_enabled: (count ?? 0) > 0,
      },
      { onConflict: "user_id" },
    );
}

async function handleDispatch(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const adminConfig = getSupabaseAdminConfig();

  if (!adminConfig.hasSupabaseUrl || !adminConfig.hasServiceRoleKey) {
    return NextResponse.json({ error: "Supabase admin access is not configured." }, { status: 503 });
  }

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: "VAPID keys are not configured." }, { status: 503 });
  }

  const configuredLimit = Number.parseInt(process.env.NOTIFICATION_DISPATCH_LIMIT ?? "100", 10);
  const defaultLimit = Number.isFinite(configuredLimit)
    ? Math.min(Math.max(configuredLimit, 1), 500)
    : 100;
  const limitParam = Number.parseInt(
    request.nextUrl.searchParams.get("limit") ?? String(defaultLimit),
    10,
  );
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : defaultLimit;
  const adminSupabase = createSupabaseAdminClient();
  const { data: generatedReminders, error: reminderError } =
    await adminSupabase.rpc("generate_continue_learning_reminders");

  if (reminderError) {
    return NextResponse.json({ error: reminderError.message }, { status: 400 });
  }

  const { data, error } = await adminSupabase
    .from("user_push_deliveries")
    .select(
      "id, attempt_count, notification:user_notifications!user_push_deliveries_notification_id_fkey(id, title, body, cta_href, user_id, event_type, read_at, created_at), subscription:user_push_subscriptions!user_push_deliveries_subscription_id_fkey(id, user_id, endpoint, subscription, device_key, failure_count)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit)
    .returns<PendingDeliveryRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  let sent = 0;
  let failed = 0;
  let retried = 0;
  let skipped = 0;
  const validDeliveries: ValidPendingDeliveryRow[] = [];

  for (const delivery of data ?? []) {
    if (!delivery.notification || !delivery.subscription) {
      await markDeliveriesSkipped(
        adminSupabase,
        [delivery.id],
        "Missing notification or subscription record.",
      );
      skipped += 1;
      continue;
    }

    validDeliveries.push({
      attempt_count: delivery.attempt_count,
      id: delivery.id,
      notification: delivery.notification,
      subscription: delivery.subscription,
    });
  }

  const deliveriesByUser = new Map<string, ValidPendingDeliveryRow[]>();

  for (const delivery of validDeliveries) {
    const userId = delivery.subscription.user_id;
    const existing = deliveriesByUser.get(userId) ?? [];
    existing.push(delivery);
    deliveriesByUser.set(userId, existing);
  }

  for (const userDeliveries of deliveriesByUser.values()) {
    const readDeliveries = userDeliveries.filter((delivery) => delivery.notification.read_at !== null);
    const disallowedDeliveries = userDeliveries.filter(
      (delivery) => delivery.notification.read_at === null
        && getPushPriority(delivery.notification.event_type) === null,
    );
    const eligibleDeliveries = userDeliveries.filter(
      (delivery) => delivery.notification.read_at === null
        && getPushPriority(delivery.notification.event_type) !== null,
    );

    if (readDeliveries.length > 0) {
      await markDeliveriesSkipped(
        adminSupabase,
        readDeliveries.map((delivery) => delivery.id),
        "Notification already read before push dispatch.",
      );
      skipped += readDeliveries.length;
    }

    if (disallowedDeliveries.length > 0) {
      await markDeliveriesSkipped(
        adminSupabase,
        disallowedDeliveries.map((delivery) => delivery.id),
        "Push suppressed by delivery policy.",
      );
      skipped += disallowedDeliveries.length;
    }

    if (eligibleDeliveries.length === 0) {
      continue;
    }

    const deliveriesBySubscription = new Map<string, ValidPendingDeliveryRow[]>();

    for (const delivery of eligibleDeliveries) {
      const existing = deliveriesBySubscription.get(delivery.subscription.id) ?? [];
      existing.push(delivery);
      deliveriesBySubscription.set(delivery.subscription.id, existing);
    }

    for (const subscriptionDeliveries of deliveriesBySubscription.values()) {
      const subscription = subscriptionDeliveries[0].subscription;
      const rankedSubscriptionDeliveries = [...subscriptionDeliveries].sort((left, right) => {
        const leftPriority = getPushPriority(left.notification.event_type) ?? 0;
        const rightPriority = getPushPriority(right.notification.event_type) ?? 0;

        if (rightPriority !== leftPriority) {
          return rightPriority - leftPriority;
        }

        return (
          new Date(right.notification.created_at).getTime()
          - new Date(left.notification.created_at).getTime()
        );
      });
      const topSubscriptionDelivery = rankedSubscriptionDeliveries[0];

      if (!topSubscriptionDelivery) {
        continue;
      }

      const sendSingleForSubscription = rankedSubscriptionDeliveries.length === 1;
      const topSubscriptionDeliveries = subscriptionDeliveries.filter(
        (delivery) => delivery.notification.id === topSubscriptionDelivery.notification.id,
      );
      const suppressedDeliveries = subscriptionDeliveries.filter(
        (delivery) => delivery.notification.id !== topSubscriptionDelivery.notification.id,
      );

      try {
        const responseCode = await sendWebPushNotification(
          {
            ...subscription.subscription,
            endpoint: subscription.endpoint,
          },
          sendSingleForSubscription
            ? {
                body: topSubscriptionDelivery.notification.body,
                title: topSubscriptionDelivery.notification.title,
                url: topSubscriptionDelivery.notification.cta_href ?? "/notifications",
              }
            : buildSummaryPushPayload(rankedSubscriptionDeliveries.length),
        );

        await markDeliveriesSent(
          adminSupabase,
          sendSingleForSubscription
            ? topSubscriptionDeliveries
            : subscriptionDeliveries,
          responseCode,
        );

        if (sendSingleForSubscription && suppressedDeliveries.length > 0) {
          await markDeliveriesSkipped(
            adminSupabase,
            suppressedDeliveries.map((delivery) => delivery.id),
            "Suppressed by higher priority push in the same dispatch window.",
          );
          skipped += suppressedDeliveries.length;
        }

        await adminSupabase
          .from("user_push_subscriptions")
          .update({
            failure_count: 0,
            last_error: null,
            last_seen_at: new Date().toISOString(),
            disabled_at: null,
          })
          .eq("id", subscription.id);

        sent += 1;
      } catch (errorValue) {
        const error = errorValue as Error & { status?: number };
        const isPermanent = error.status === 404 || error.status === 410;
        const failedDeliveries = sendSingleForSubscription
          ? topSubscriptionDeliveries
          : subscriptionDeliveries;

        await markDeliveriesFailedOrRetried(
          adminSupabase,
          failedDeliveries,
          error.message,
          error.status,
        );

        await adminSupabase
          .from("user_push_subscriptions")
          .update({
            failure_count: (subscription.failure_count ?? 0) + 1,
            last_error: error.message,
            disabled_at: isPermanent ? new Date().toISOString() : null,
          })
          .eq("id", subscription.id);

        if (isPermanent) {
          await syncWebPushPreference(adminSupabase, subscription.user_id);
        }

        const reachedRetryLimit = failedDeliveries.some(
          (delivery) => delivery.attempt_count + 1 >= 3,
        );

        if (isPermanent || reachedRetryLimit) {
          failed += 1;
        } else {
          retried += 1;
        }
      }
    }
  }

  return NextResponse.json({
    failed,
    generatedReminders: generatedReminders ?? 0,
    processed: (data ?? []).length,
    retried,
    sent,
    skipped,
  });
}

export async function GET(request: NextRequest) {
  return handleDispatch(request);
}

export async function POST(request: NextRequest) {
  return handleDispatch(request);
}
