import { redirect } from "next/navigation";
import { markAllNotificationsRead, markNotificationRead } from "@/app/notifications/actions";
import { BottomNav } from "@/components/navigation/BottomNav";
import { LearnerTopChrome } from "@/components/navigation/LearnerTopChrome";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GiftIcon, InfoIcon, PersonCircleIcon, TrophyIcon } from "@/components/ui/Icons";
import { isLiveMode } from "@/lib/app-mode";
import { getUnreadNotificationCount, getUserNotifications } from "@/lib/notifications";
import { loadNotificationPageState } from "@/lib/observability";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";

const categoryMeta = {
  account: {
    icon: PersonCircleIcon,
    tone: "text-[#a65319]",
  },
  missions: {
    icon: TrophyIcon,
    tone: "text-[#946400]",
  },
  rewards: {
    icon: GiftIcon,
    tone: "text-[var(--ve-green)]",
  },
  system: {
    icon: InfoIcon,
    tone: "text-[var(--ve-muted-strong)]",
  },
} as const;

function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function splitNotificationTime(value: string) {
  const [date, time] = formatNotificationTime(value).split(", ");

  return {
    date: date ?? "",
    time: time ?? "",
  };
}

function isMissionCompletionNotification(eventType: string, title: string) {
  const event = eventType.toLowerCase();
  const heading = title.toLowerCase();

  return (
    (event.includes("mission") && event.includes("complete"))
    || heading.includes("mission completed")
  );
}

export default async function NotificationsPage() {
  const supabase = await createSupabaseServerClient();
  const { user, profile } = await getCurrentUserProfile(supabase);

  if (isLiveMode && !user) {
    redirect("/login");
  }

  let notifications: Awaited<ReturnType<typeof getUserNotifications>> = [];
  let unreadCount = 0;
  let notificationLoadFailed = false;
  const displayName =
    profile?.display_name && !profile.display_name.includes("@")
      ? profile.display_name
      : "Learner";

  if (supabase && user) {
    const state = await loadNotificationPageState({
      notificationsPromise: getUserNotifications(supabase, user.id, 40),
      unreadCountPromise: getUnreadNotificationCount(supabase, user.id),
      userId: user.id,
    });

    notifications = state.notifications;
    unreadCount = state.unreadCount;
    notificationLoadFailed = state.notificationLoadFailed;
  }

  return (
    <main className="learner-system notifications-learner flex min-h-screen flex-col bg-[var(--ve-shell)]">
      <div className="hidden lg:block">
        <LearnerTopChrome
          active="Home"
          avatarUrl={profile?.avatar_url}
          displayName={displayName}
          email={user?.email}
          unreadNotificationCount={unreadCount}
        />
      </div>
      <section className="mx-auto w-full max-w-[430px] flex-1 px-5 pb-28 pt-8 lg:max-w-[1116px] lg:px-0 lg:pb-16 lg:pt-12">
        <div className="flex items-start justify-between gap-4 lg:border-b lg:border-[var(--ve-line-soft)] lg:pb-5">
          <div>
            <h1 className="text-2xl font-black leading-8 text-[var(--foreground)] lg:text-[2rem] lg:leading-10">
              Notifications
            </h1>
            <p className="mt-2 hidden max-w-[28rem] text-sm font-semibold leading-6 text-[var(--ve-muted-strong)] lg:block">
              Review account, mission, reward, and system updates from Project Ve.
            </p>
          </div>
          {unreadCount > 0 ? (
            <form action={markAllNotificationsRead}>
              <button className="text-xs font-black text-[var(--ve-green)] lg:rounded-[8px] lg:border lg:border-[var(--ve-line-soft)] lg:bg-[var(--ve-card-subtle)] lg:px-4 lg:py-2" type="submit">
                Read all
              </button>
            </form>
          ) : null}
        </div>

        {notificationLoadFailed ? (
          <Card className="mt-6 rounded-[8px] p-5 lg:bg-[var(--ve-card-subtle)]">
            <h2 className="text-base font-black">Notifications unavailable</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
              We could not load notifications right now. Try again shortly.
            </p>
          </Card>
        ) : notifications.length > 0 ? (
          <div className="mt-5 space-y-3 lg:mt-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
            {notifications.map((notification) => {
              const unread = !notification.readAt;
              const meta = categoryMeta[notification.category];
              const timestamp = splitNotificationTime(notification.createdAt);
              const showCta =
                Boolean(notification.ctaHref)
                && !isMissionCompletionNotification(notification.eventType, notification.title);

              return (
                <Card
                  className={`rounded-[8px] p-0 shadow-[0_10px_24px_rgba(var(--ve-shadow-rgb),0.06)] lg:bg-[var(--ve-card-subtle)] lg:shadow-[0_18px_44px_rgba(var(--ve-shadow-rgb),0.07)] ${
                    unread
                      ? "border-[color:color-mix(in_srgb,#946400_60%,var(--ve-line-soft))] bg-[var(--ve-card)]"
                      : "border-[var(--ve-line-soft)] bg-[var(--ve-card)]"
                  }`}
                  key={notification.id}
                >
                  <div className={`border-l-4 px-4 py-4 lg:px-5 lg:py-5 ${unread ? "border-[#946400]" : "border-transparent"}`}>
                    <div className="grid grid-cols-[1.5rem_1fr_auto] gap-2">
                      <span className={`mt-1 grid place-items-center ${meta.tone}`}>
                        <meta.icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-start gap-1.5">
                          <span className={`pt-1 text-[10px] font-black uppercase tracking-[0.1em] ${meta.tone}`}>
                            {notification.category === "missions" ? "Mission" : notification.category}
                          </span>
                          <h2 className="text-xl font-black leading-[1.08] tracking-[-0.02em] text-[var(--foreground)] lg:text-[1.35rem]">
                            {notification.title}
                          </h2>
                        </div>
                        <p className="mt-4 text-sm font-medium leading-6 text-[var(--ve-muted-strong)]">
                          {notification.body}
                        </p>
                      </div>
                      <div className="w-12 text-right text-[11px] font-medium leading-4 text-[var(--ve-muted)]">
                        <span className="block">{timestamp.date}</span>
                        <span className="block">{timestamp.time}</span>
                        {unread ? (
                          <span className="mt-2 inline-flex size-2 rounded-full bg-[var(--ve-green)]" />
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-2">
                      {showCta && notification.ctaHref ? (
                        <Button className="h-8 rounded-[16px] px-4 text-xs" href={notification.ctaHref} variant="outline">
                          {notification.ctaLabel ?? "Open"}
                        </Button>
                      ) : null}
                      {unread ? (
                        <form action={markNotificationRead}>
                          <input name="notificationId" type="hidden" value={notification.id} />
                          <button
                            aria-label={`Mark ${notification.title} as read`}
                            className="grid size-7 place-items-center rounded-full text-[var(--ve-muted-strong)]"
                            type="submit"
                          >
                            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <path
                                d="m6 12.5 3.7 3.7L18 8"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2.2"
                              />
                            </svg>
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })}
            <p className="py-5 text-center text-xs font-black text-[var(--ve-muted-strong)] lg:col-span-2">
              You are all caught up!
            </p>
          </div>
        ) : (
          <Card className="mt-6 rounded-[8px] p-5 lg:max-w-[34rem] lg:bg-[var(--ve-card-subtle)]">
            <h2 className="text-base font-black">No notifications</h2>
          </Card>
        )}
      </section>
      <div className="lg:hidden">
        <BottomNav active="Notifications" />
      </div>
    </main>
  );
}
