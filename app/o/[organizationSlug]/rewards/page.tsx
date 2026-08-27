import { LearnerWorkspaceSwitcher } from "@/components/navigation/LearnerWorkspaceSwitcher";
import { OrgBottomNav, OrgLearnerChrome } from "@/components/organizations/OrgLearnerMobile";
import { XPStore } from "@/components/rewards/XPStore";
import { getOrganizationWorkspaceRewardSnapshot } from "@/features/organizations/application/learner-workspace";
import { getMyOrganizationState } from "@/features/organizations/application/my-orgs";
import { withLoggedFallback } from "@/lib/app-errors";
import { requireOrgLearnerRoute, type OrgRouteParams } from "@/app/o/[organizationSlug]/workspace";

export default async function OrganizationRewardsPage({
  params,
}: {
  params: OrgRouteParams;
}) {
  const { supabase, user, workspace } = await requireOrgLearnerRoute(params);
  const organizationName = workspace.branding.shortName || workspace.branding.name;
  const [rewardSnapshot, myOrgsState] = await Promise.all([
    withLoggedFallback({
      context: {
        operation: "org_workspace.reward_store.load",
        resourceId: workspace.organizationId,
        userId: user.id,
      },
      fallback: null,
      promise: getOrganizationWorkspaceRewardSnapshot({ supabase, userId: user.id, workspace }),
    }),
    getMyOrganizationState(supabase, user.id),
  ]);

  return (
    <main className="learner-system orgs-learner min-h-screen">
      <OrgLearnerChrome
        active="Store"
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
      <XPStore
        apiPath={`/api/organizations/${workspace.organizationSlug}/rewards`}
        initialSnapshot={rewardSnapshot}
        redeemPathPrefix={`/api/organizations/${workspace.organizationSlug}/rewards`}
        storeName={`${organizationName} Store`}
        workspaceLabel={workspace.xpAccount.label}
      />
      <OrgBottomNav active="Store" organizationSlug={workspace.organizationSlug} />
    </main>
  );
}
