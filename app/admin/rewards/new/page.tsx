import { RewardEditorForm } from "@/components/admin/RewardEditorForm";
import { AdminCard, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { getAdminCampaigns, getAdminOrganizations, getAdminProgrammes, requireAdminWorkspaceRole } from "@/lib/admin";
import { createReward } from "../[id]/actions";
import { PLATFORM_CATALOG_WORKSPACE_ID } from "@/features/admin/shared/workspace";

export default async function NewAdminRewardPage() {
  const { supabase, workspace } = await requireAdminWorkspaceRole([
    "organisation_owner",
    "organisation_admin",
    "programme_manager",
  ]);
  const isCatalogWorkspace = workspace.id === PLATFORM_CATALOG_WORKSPACE_ID;
  const [campaigns, organizations, programmes] = await Promise.all([
    getAdminCampaigns(supabase),
    isCatalogWorkspace ? Promise.resolve([]) : getAdminOrganizations(supabase),
    isCatalogWorkspace ? Promise.resolve([]) : getAdminProgrammes(supabase),
  ]);
  const isOrganizationWorkspace = workspace.type === "organization" && !isCatalogWorkspace;

  return (
    <>
      <AdminPageHeader
        backHref="/admin/rewards"
        backLabel="Rewards"
        eyebrow="XP Store"
        title="Add reward"
        subtitle="Create a new reward offer, configure its fulfillment, and publish when ready."
      />
      <AdminCard>
        <RewardEditorForm
          action={createReward}
          campaigns={campaigns}
          lockDistributionMode="direct"
          mode="create"
          organizations={organizations}
          programmes={programmes}
          reward={{
            id: "",
            title: "",
            description: "",
            costXp: 10,
            status: "draft",
            isEnabled: false,
            distributionMode: "direct",
            fulfillmentType: "manual",
            visibilityMode: "store",
            fulfillmentConfig: {},
            perUserLimit: 1,
            limitPeriod: "lifetime",
            organizationId: isOrganizationWorkspace ? organizations[0]?.id ?? "" : "",
            ownerScope: isOrganizationWorkspace ? "organization_owned" : "platform_owned",
            redemptionWindowDays: "",
            sharedWithProgrammes: false,
            sortOrder: 100,
            sponsoredProgrammeId: "",
            offerExpiresAt: "",
            thumbnailUrl: "",
            thumbnailIconName: "gift",
            thumbnailLegacyIcon: "",
            thumbnailColor: "#f4fbf7",
            terms: "",
            claimSteps: ["Confirm the redemption."],
            totalAvailable: 0,
            campaignId: campaigns.find((campaign) => campaign.status === "active")?.id ?? null,
          }}
        />
      </AdminCard>
    </>
  );
}
