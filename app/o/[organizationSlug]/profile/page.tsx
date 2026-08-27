import { LearnerWorkspaceSwitcher } from "@/components/navigation/LearnerWorkspaceSwitcher";
import { OrgBottomNav, OrgLearnerChrome } from "@/components/organizations/OrgLearnerMobile";
import { CompassIcon } from "@/components/organizations/OrgIcons";
import { Avatar } from "@/components/profile/Avatar";
import { Card } from "@/components/ui/Card";
import { BellIcon, ChevronRightIcon, CheckCircleIcon, GraduationCapIcon } from "@/components/ui/Icons";
import { getOrganizationUserNotifications } from "@/lib/notifications";
import { getMyOrganizationState } from "@/features/organizations/application/my-orgs";
import { orgHref, requireOrgLearnerRoute, type OrgRouteParams } from "@/app/o/[organizationSlug]/workspace";

function roleLabel(role: string) {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function OrganizationProfilePage({
  params,
}: {
  params: OrgRouteParams;
}) {
  const { supabase, user, profile, workspace } = await requireOrgLearnerRoute(params);
  const organizationName = workspace.branding.shortName || workspace.branding.name;
  const primaryRole = workspace.membershipRoles[0] ? roleLabel(workspace.membershipRoles[0]) : "Learner";
  const [notifications, myOrgsState] = await Promise.all([
    getOrganizationUserNotifications(supabase, user.id, workspace.organizationId, 40),
    getMyOrganizationState(supabase, user.id),
  ]);
  const hasUnreadNotifications = notifications.some((notification) => !notification.readAt);

  const records = [
    {
      description: "View your programme and course progress.",
      href: orgHref(workspace, "/transcript"),
      icon: <GraduationCapIcon className="size-5" />,
      showDot: false,
      title: "Learning Transcript",
    },
    {
      description: "Recent updates and announcements.",
      href: orgHref(workspace, "/notifications"),
      icon: <BellIcon className="size-5" />,
      showDot: hasUnreadNotifications,
      title: "Notifications",
    },
    {
      description: `Explore all resources for ${organizationName}.`,
      href: orgHref(workspace, "/learn"),
      icon: <CompassIcon className="size-5" />,
      showDot: false,
      title: "Organisation Learning",
    },
  ];

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
        <h1 className="org-profile-heading text-[1.55rem] font-black tracking-[-0.02em] text-[var(--foreground)]">
          Profile
        </h1>

        <div className="org-profile-layout mt-4">
          <div className="org-profile-layout__identity">
            <Card className="p-5" variant="quiet">
              <div className="flex items-center gap-4 org-profile-identity__row">
                <Avatar
                  avatarUrl={profile.avatar_url ?? ""}
                  className="size-16 org-profile-identity__avatar"
                  name={profile.display_name ?? ""}
                />
                <div className="min-w-0 org-profile-identity__copy">
                  <h2 className="text-2xl font-black text-[var(--foreground)]">
                    {profile.display_name || "Project Ve learner"}
                  </h2>
                  <div className="mt-1 flex items-center gap-1.5 text-sm font-black text-[var(--ve-green)]">
                    <CheckCircleIcon className="size-3.5" />
                    {primaryRole}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[var(--ve-muted)]">{organizationName}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[16px] bg-[var(--ve-panel)] p-4 text-center">
                  <p className="text-2xl font-black text-[var(--ve-green)]">{workspace.programmeIds.length}</p>
                  <p className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                    Assigned Programmes
                  </p>
                </div>
                <div className="rounded-[16px] bg-[var(--ve-panel)] p-4 text-center">
                  <p className="text-2xl font-black text-[var(--ve-green)]">{workspace.courseIds.length}</p>
                  <p className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                    Assigned Courses
                  </p>
                </div>
              </div>

              {workspace.membershipRoles.length > 1 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {workspace.membershipRoles.map((role) => (
                    <span
                      className="rounded-full bg-[var(--ve-card)] px-3 py-1 text-[11px] font-black text-[var(--ve-muted)]"
                      key={role}
                    >
                      {roleLabel(role)}
                    </span>
                  ))}
                </div>
              ) : null}
            </Card>
          </div>

          <div className="org-profile-layout__records">
            <h2 className="text-[1.05rem] font-black tracking-[-0.01em] text-[var(--foreground)]">
              Learning Records
            </h2>
            <div className="mt-3 flex flex-col gap-3">
              {records.map((record) => (
                <a
                  className="org-profile-record"
                  href={record.href}
                  key={record.title}
                >
                  <span className="org-profile-record__icon">
                    {record.icon}
                    {record.showDot ? <span className="org-profile-record__dot" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.98rem] font-black text-[var(--foreground)]">
                      {record.title}
                    </span>
                    <span className="mt-0.5 block text-[0.8rem] font-medium text-[var(--ve-muted)]">
                      {record.description}
                    </span>
                  </span>
                  <ChevronRightIcon className="size-5 shrink-0 text-[var(--ve-muted)]" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>
      <OrgBottomNav active="Home" organizationSlug={workspace.organizationSlug} />
    </main>
  );
}
