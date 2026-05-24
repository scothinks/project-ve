import { redirect } from "next/navigation";
import { markAllNotificationsRead, markNotificationRead } from "@/app/notifications/actions";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getUnreadNotificationCount, getUserNotifications } from "@/lib/notifications";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";

const categoryTone = {
  account: "bg-[#edf7ff] text-[#1e5a96]",
  missions: "bg-[#fff1eb] text-[#b6532f]",
  rewards: "bg-[#f4fbf7] text-[#087f5b]",
  system: "bg-[#f7f5ff] text-[#5f4ca7]",
} as const;

function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function NotificationsPage() {
  const { user } = await getCurrentUserProfile();

  if (isSupabaseConfigured && !user) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const notifications =
    supabase && user ? await getUserNotifications(supabase, user.id, 40).catch(() => []) : [];
  const unreadCount =
    supabase && user ? await getUnreadNotificationCount(supabase, user.id).catch(() => 0) : 0;

  return (
    <main className="mobile-shell flex min-h-screen flex-col bg-[#fffaf4]">
      <AppHeader title="Notifications" backHref="/profile" showMenu={false} />
      <section className="flex-1 space-y-5 px-6 py-6 pb-28">
        {unreadCount > 0 ? (
          <form action={markAllNotificationsRead}>
            <Button className="h-10 px-4" type="submit" variant="soft">
              Read all
            </Button>
          </form>
        ) : null}

        {notifications.length > 0 ? (
          notifications.map((notification) => {
            const unread = !notification.readAt;
            return (
              <Card
                className={unread ? "border border-[#d7efe4] bg-white p-4" : "bg-[#fffdf9] p-4"}
                key={notification.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${categoryTone[notification.category]}`}
                      >
                        {notification.category}
                      </span>
                      <p className="text-xs font-semibold text-[var(--ve-muted)]">
                        {formatNotificationTime(notification.createdAt)}
                      </p>
                    </div>
                    <h2 className="mt-2 text-base font-black text-[var(--foreground)]">
                      {notification.title}
                    </h2>
                    <p className="mt-1 text-sm font-medium leading-6 text-[var(--ve-muted-strong)]">
                      {notification.body}
                    </p>
                  </div>
                  {unread ? (
                    <span className="mt-1 inline-flex size-2.5 rounded-full bg-[#008751]" />
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <div className="flex items-center gap-2">
                    {notification.ctaHref ? (
                      <Button className="h-9 px-4 text-sm" href={notification.ctaHref} variant="ghost">
                        {notification.ctaLabel ?? "Open"}
                      </Button>
                    ) : null}
                    {unread ? (
                      <form action={markNotificationRead}>
                        <input name="notificationId" type="hidden" value={notification.id} />
                        <Button className="h-9 px-4 text-sm" type="submit" variant="soft">
                          Read
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="p-5">
            <h2 className="text-base font-black">No notifications</h2>
          </Card>
        )}
      </section>
      <BottomNav active="Home" />
    </main>
  );
}
