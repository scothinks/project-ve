import { AdminCard, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { CampaignForm } from "@/components/admin/CampaignForm";
import { requirePlatformRewardCampaignManager } from "@/features/campaigns/admin/access";

export default async function NewCampaignPage() {
  await requirePlatformRewardCampaignManager();

  return (
    <>
      <AdminPageHeader
        backHref="/admin/campaigns"
        backLabel="Campaigns"
        eyebrow="Planning"
        title="Add campaign"
        subtitle="Create a draft campaign before assigning rewards and inventory to its reporting period."
      />
      <AdminCard>
        <CampaignForm />
      </AdminCard>
    </>
  );
}
