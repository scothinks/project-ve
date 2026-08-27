import { LearnerWorkspaceSwitcher } from "@/components/navigation/LearnerWorkspaceSwitcher";
import { OrgBottomNav, OrgLearnerChrome } from "@/components/organizations/OrgLearnerMobile";
import { OrgNotificationsList } from "@/components/organizations/OrgNotificationsList";
import { requireOrgLearnerRoute } from "@/app/o/[organizationSlug]/workspace";
import { getOrganizationUserNotifications } from "@/lib/notifications";
import { getMyOrganizationState } from "@/features/organizations/application/my-orgs";

type OrganizationNotificationsPageProps = {
  params: Promise<{ organizationSlug: string }>;
};

export default async function OrganizationNotificationsPage({
  params,
}: OrganizationNotificationsPageProps) {
  const { organizationSlug } = await params;
  const { supabase, user, workspace } = await requireOrgLearnerRoute(Promise.resolve({ organizationSlug }));
  const organizationName = workspace.branding.shortName || workspace.branding.name;
  const [notifications, myOrgsState] = await Promise.all([
    getOrganizationUserNotifications(supabase, user.id, workspace.organizationId, 40),
    getMyOrganizationState(supabase, user.id),
  ]);

  return (
    <main className="learner-system orgs-learner min-h-screen">
      <OrgLearnerChrome
        active="Home"
        balance={workspace.xpAccount.balance}
        logoUrl={workspace.branding.logoUrl}
        organizationName={organizationName}
        organizationSlug={workspace.organizationSlug}
        pointsLabel={workspace.xpAccount.label}
        workspaceSwitcher={
          <LearnerWorkspaceSwitcher
            currentOrganizationSlug={workspace.organizationSlug}
            organizations={myOrgsState.organizations}
          />
        }
      />
      <section className="learner-page learner-page--standard pb-28">
        <div>
          <h1 className="text-[1.55rem] font-black tracking-[-0.02em] text-[var(--foreground)]">
            Notifications
          </h1>
          <p className="mt-1 text-sm font-semibold text-[var(--ve-muted)]">{organizationName}</p>
        </div>
        <OrgNotificationsList notifications={notifications} />
      </section>
      <OrgBottomNav active="Home" organizationSlug={workspace.organizationSlug} />
    </main>
  );
}
