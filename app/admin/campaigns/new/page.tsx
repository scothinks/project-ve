import { AdminCard, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { CampaignForm } from "@/components/admin/CampaignForm";
import { requireAdmin } from "@/lib/admin";

export default async function NewCampaignPage() {
  await requireAdmin();

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
