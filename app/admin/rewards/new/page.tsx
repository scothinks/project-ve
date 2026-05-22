import { RewardEditorForm } from "@/components/admin/RewardEditorForm";
import { AdminCard, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { getAdminCampaigns, requireAdmin } from "@/lib/admin";
import { createReward } from "../[id]/actions";

export default async function NewAdminRewardPage() {
  const { supabase } = await requireAdmin();
  const campaigns = await getAdminCampaigns(supabase);

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
            redemptionWindowDays: "",
            sortOrder: 100,
            offerExpiresAt: "",
            thumbnailUrl: "",
            thumbnailIcon: "",
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
