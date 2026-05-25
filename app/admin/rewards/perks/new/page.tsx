import { PerkEditorForm } from "@/components/admin/PerkEditorForm";
import { AdminCard, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { getAdminCampaigns, requireAdmin } from "@/lib/admin";
import { createReward } from "../../[id]/actions";

export default async function NewAdminPerkPage() {
  const { supabase } = await requireAdmin();
  const campaigns = await getAdminCampaigns(supabase);

  return (
    <>
      <AdminPageHeader
        backHref="/admin/rewards/perks"
        backLabel="Perks"
        eyebrow="XP Store"
        title="Add perk"
        subtitle="Create the low-XP wrapper first. After saving, you will configure the live prize pool and release controls."
      />
      <AdminCard>
        <PerkEditorForm
          action={createReward}
          campaigns={campaigns}
          mode="create"
          perk={{
            id: "",
            title: "",
            description: "",
            costXp: 10,
            visibilityMode: "store",
            perUserLimit: 1,
            limitPeriod: "lifetime",
            redemptionWindowDays: "",
            sortOrder: 100,
            offerExpiresAt: "",
            thumbnailUrl: "",
            thumbnailIconName: "sparkles",
            thumbnailLegacyIcon: "",
            thumbnailColor: "#f3ecff",
            terms: "",
            claimSteps: ["Redeem the perk to reveal a surprise reward."],
            totalAvailable: 0,
            campaignId: campaigns.find((campaign) => campaign.status === "active")?.id ?? null,
            fallback: {
              prizeType: "native_xp",
              title: "Bonus XP",
              amount: 5,
              multiplier: 2,
              durationHours: 24,
              uses: 1,
            },
          }}
        />
      </AdminCard>
    </>
  );
}
