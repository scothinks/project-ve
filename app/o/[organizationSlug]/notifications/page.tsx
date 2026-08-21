import { markNotificationRead } from "@/app/notifications/actions";
import { orgHref, requireOrgLearnerRoute } from "@/app/o/[organizationSlug]/workspace";
import { AppHeader } from "@/components/navigation/AppHeader";
import { OrgBottomNav } from "@/components/organizations/OrgLearnerMobile";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getOrganizationUserNotifications } from "@/lib/notifications";

const categoryTone = {
  account:
    "bg-[color:color-mix(in_srgb,var(--ve-sky-soft)_92%,var(--ve-card))] text-[var(--ve-sky)]",
  missions:
    "bg-[color:color-mix(in_srgb,var(--ve-mission-soft)_92%,var(--ve-card))] text-[var(--ve-mission)]",
  rewards:
    "bg-[color:color-mix(in_srgb,var(--ve-green-soft)_92%,var(--ve-card))] text-[var(--ve-green)]",
  system:
    "bg-[color:color-mix(in_srgb,var(--ve-violet-soft)_92%,var(--ve-card))] text-[var(--ve-violet)]",
} as const;

type OrganizationNotificationsPageProps = {
  params: Promise<{ organizationSlug: string }>;
};

function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function OrganizationNotificationsPage({
  params,
}: OrganizationNotificationsPageProps) {
  const { organizationSlug } = await params;
  const { supabase, user, workspace } = await requireOrgLearnerRoute(Promise.resolve({ organizationSlug }));
  const notifications = await getOrganizationUserNotifications(supabase, user.id, workspace.organizationId, 40);

  return (
    <main className="mobile-shell flex min-h-screen flex-col bg-[var(--ve-shell)]">
      <AppHeader title="Notifications" backHref={orgHref(workspace, "/profile")} showMenu={false} />
      <section className="learner-page learner-page--standard flex-1 space-y-5">
        <div>
          <Button className="h-10 px-4" href="/notifications" variant="soft">
            Global notifications
          </Button>
        </div>

        {notifications.length > 0 ? (
          <div className="learner-card-grid">
            {notifications.map((notification) => {
              const unread = !notification.readAt;

              return (
                <Card
                  className={
                    unread
                      ? "border border-[color:color-mix(in_srgb,var(--ve-green)_24%,var(--ve-line-soft))] bg-[var(--ve-card)] p-4"
                      : "bg-[var(--ve-card-muted)] p-4"
                  }
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
                      <span className="mt-1 inline-flex size-2.5 rounded-full bg-[var(--ve-green)]" />
                    ) : null}
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2">
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
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-5">
            <h2 className="text-base font-black">No organisation notifications</h2>
          </Card>
        )}
      </section>
      <OrgBottomNav active="Home" organizationSlug={workspace.organizationSlug} />
    </main>
  );
}
