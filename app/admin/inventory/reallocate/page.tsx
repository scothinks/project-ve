import { EconomyPageHeader as AdminPageHeader } from "@/components/admin/economy/EconomyPrimitives";
import { EconomyDateInput } from "@/components/admin/economy/EconomyDateInput";
import { EconomyForm } from "@/components/admin/economy/EconomyForm";
import {
  AdminCard,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { getAdminCampaigns, getAdminRewards, requireAdminWorkspaceRole } from "@/lib/admin";
import { reallocateInventory } from "../actions";

const INVENTORY_ROLES = ["organisation_owner", "organisation_admin", "programme_manager"];

function fieldClasses() {
  return "mt-1 w-full rounded-[12px] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--ui-focus)]";
}

function labelClasses() {
  return "text-xs font-black uppercase tracking-[0.12em] text-[var(--ui-text-muted)]";
}

type ReallocateInventoryPageProps = {
  searchParams?: Promise<{ saved?: string; rewardId?: string; campaignId?: string }>;
};

export default async function ReallocateInventoryPage({ searchParams }: ReallocateInventoryPageProps) {
  const params = (await searchParams) ?? {};
  const { supabase, workspace } = await requireAdminWorkspaceRole(INVENTORY_ROLES);
  const [campaigns, rewards] = await Promise.all([
    getAdminCampaigns(supabase),
    getAdminRewards(supabase, {}, workspace.type === "organization" ? workspace.id : undefined),
  ]);

  return (
    <>
      <AdminPageHeader
        backHref="/admin/rewards"
        backLabel="Rewards"
        eyebrow="Inventory"
        title="Move stock"
        subtitle="Move unused reward stock from one campaign to another while keeping an audit trail."
      />

      {params.saved ? (
        <div className="mb-4">
          <AdminStatusBadge tone="good">Inventory reallocated.</AdminStatusBadge>
        </div>
      ) : null}

      <AdminCard className="max-w-4xl">
        <EconomyForm action={reallocateInventory} className="mt-5 space-y-5" steps={[{ id: "step-0", title: "Choose stock to move", description: "", content: <><div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className={labelClasses()}>Reward</span>
              <select className={fieldClasses()} name="rewardId" defaultValue={params.rewardId ?? ""} required>
                <option value="">Select reward</option>
                {rewards.map((reward) => (
                  <option key={reward.id} value={reward.id}>
                    {reward.title} ({reward.total_available}/{reward.total_uploaded})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClasses()}>Quantity</span>
              <input className={fieldClasses()} min={1} name="quantity" required type="number" />
            </label>
            <label>
              <span className={labelClasses()}>From campaign</span>
              <select className={fieldClasses()} name="fromCampaignId" defaultValue={params.campaignId ?? ""} required>
                <option value="">Select source</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClasses()}>To campaign</span>
              <select className={fieldClasses()} name="toCampaignId" required>
                <option value="">Select destination</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
            </label>
          </div></> },{ id: "step-1", title: "Availability", description: "Dates control when this stock is available. Moving stock does not extend provider or code validity. Leave optional dates empty to keep the existing timing.", content: <><div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className={labelClasses()}>Available from</span>
              <EconomyDateInput className={fieldClasses()} name="availableFrom" type="datetime-local" />
            </label>
            <label>
              <span className={labelClasses()}>Expires</span>
              <EconomyDateInput className={fieldClasses()} name="expiresAt" type="datetime-local" />
            </label>
          </div></> },{ id: "step-2", title: "Reason for the move", description: "", content: <><label className="block">
            <span className={labelClasses()}>Reason</span>
            <input
              className={fieldClasses()}
              maxLength={300}
              name="reason"
              placeholder="Unused stock moved to the next campaign"
              required
            />
          </label></> }]} reviewAction={<button className="rounded-[14px] bg-[var(--ui-action)] px-5 py-3 text-sm font-black text-[var(--ui-on-action)]" type="submit">
            Reallocate inventory
          </button>} />
      </AdminCard>
    </>
  );
}
