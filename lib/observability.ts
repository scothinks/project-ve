import {
  InvariantViolationError,
  logAppError,
  type AppErrorContext,
} from "./app-errors.ts";

type ErrorLogger = (error: unknown, context: AppErrorContext) => void;

export function resolveDashboardXpBalance({
  isConfigured,
  logger = logAppError,
  profile,
  userId,
}: {
  isConfigured: boolean;
  logger?: ErrorLogger;
  profile: { xp_balance_cached: number } | null;
  userId: string | null | undefined;
}) {
  if (isConfigured && userId && !profile) {
    logger(new InvariantViolationError("Authenticated user has no profile row."), {
      operation: "dashboard.profile.load",
      userId,
    });
  }

  return profile?.xp_balance_cached ?? 0;
}

export async function loadNotificationPageState<TNotification>({
  logger = logAppError,
  notificationsPromise,
  unreadCountPromise,
  userId,
}: {
  logger?: ErrorLogger;
  notificationsPromise: Promise<TNotification[]>;
  unreadCountPromise: Promise<number>;
  userId: string;
}) {
  try {
    const [notifications, unreadCount] = await Promise.all([
      notificationsPromise,
      unreadCountPromise,
    ]);

    return {
      notificationLoadFailed: false,
      notifications,
      unreadCount,
    };
  } catch (error) {
    logger(error, {
      operation: "notifications.page.load",
      userId,
    });

    return {
      notificationLoadFailed: true,
      notifications: [],
      unreadCount: 0,
    };
  }
}
