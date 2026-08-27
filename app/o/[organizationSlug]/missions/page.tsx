import { headers } from "next/headers";
import { MissionPanel } from "@/components/missions/MissionPanel";
import { StarBadgeIcon } from "@/components/missions/MissionIcons";
import { LearnerWorkspaceSwitcher } from "@/components/navigation/LearnerWorkspaceSwitcher";
import { OrgBottomNav, OrgLearnerChrome } from "@/components/organizations/OrgLearnerMobile";
import { Card } from "@/components/ui/Card";
import { getOrganizationWorkspaceMissions } from "@/features/organizations/application/learner-workspace";
import { getMyOrganizationState } from "@/features/organizations/application/my-orgs";
import { formatXpLabel } from "@/lib/xp-format";
import { requireOrgLearnerRoute, type OrgRouteParams } from "@/app/o/[organizationSlug]/workspace";

function getOrigin(headersList: Headers) {
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const host = headersList.get("host") ?? "localhost";
  return `${proto}://${host}`;
}

export default async function OrganizationMissionsPage({
  params,
}: {
  params: OrgRouteParams;
}) {
  const { profile, supabase, user, workspace } = await requireOrgLearnerRoute(params);
  const [missions, myOrgsState] = await Promise.all([
    getOrganizationWorkspaceMissions({
      origin: getOrigin(await headers()),
      profile,
      supabase,
      workspace,
    }),
    getMyOrganizationState(supabase, user.id),
  ]);
  const organizationName = workspace.branding.shortName || workspace.branding.name;

  return (
    <main className="learner-system orgs-learner min-h-screen">
      <OrgLearnerChrome
        active="Missions"
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
      <section className="learner-page learner-page--standard">
        <div className="mb-5 flex flex-col gap-1.5">
          <div className="flex items-end justify-between gap-3">
            <h1 className="text-[1.55rem] font-black tracking-[-0.02em] text-[var(--foreground)]">
              Missions
            </h1>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--ve-card-muted)] px-3 py-1.5 text-[0.78rem] font-black tabular-nums text-[var(--ve-muted-strong)]">
              <StarBadgeIcon className="size-3.5 text-[#a66d00]" />
              {formatXpLabel(workspace.xpAccount.balance, workspace.xpAccount.label)}
            </span>
          </div>
          <p className="max-w-[30rem] text-[0.82rem] font-medium leading-5 text-[var(--ve-muted)]">
            Complete field exercises to earn {workspace.xpAccount.label} and reinforce your organisation learning.
          </p>
        </div>
        {missions.length > 0 ? (
          <MissionPanel
            apiPath={`/api/organizations/${encodeURIComponent(workspace.organizationSlug)}/missions`}
            initialMissions={missions}
            organizationName={organizationName}
            pointsLabel={workspace.xpAccount.label}
          />
        ) : (
          <Card className="p-5 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]" variant="quiet">
            No missions are assigned in this organisation workspace yet.
          </Card>
        )}
      </section>
      <OrgBottomNav active="Missions" organizationSlug={workspace.organizationSlug} />
    </main>
  );
}
