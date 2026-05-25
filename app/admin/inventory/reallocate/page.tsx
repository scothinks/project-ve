import {
  AdminCard,
  AdminPageHeader,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { getAdminCampaigns, getAdminRewards, requireAdmin } from "@/lib/admin";
import { reallocateInventory } from "../actions";

function fieldClasses() {
  return "mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--ve-green)]";
}

function labelClasses() {
  return "text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]";
}

type ReallocateInventoryPageProps = {
  searchParams?: Promise<{ saved?: string }>;
};

export default async function ReallocateInventoryPage({ searchParams }: ReallocateInventoryPageProps) {
  const params = (await searchParams) ?? {};
  const { supabase } = await requireAdmin();
  const [campaigns, rewards] = await Promise.all([
    getAdminCampaigns(supabase),
    getAdminRewards(supabase),
  ]);

  return (
    <>
      <AdminPageHeader
        backHref="/admin/rewards"
        backLabel="Rewards"
        eyebrow="Inventory"
        title="Reallocate inventory"
        subtitle="Move unused reward stock from one campaign to another while keeping an audit trail."
      />

      {params.saved ? (
        <div className="mb-4">
          <AdminStatusBadge tone="good">Inventory reallocated.</AdminStatusBadge>
        </div>
      ) : null}

      <AdminCard className="max-w-4xl">
        <form action={reallocateInventory} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className={labelClasses()}>Reward</span>
              <select className={fieldClasses()} name="rewardId" required>
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
              <select className={fieldClasses()} name="fromCampaignId" required>
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
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className={labelClasses()}>Available from</span>
              <input className={fieldClasses()} name="availableFrom" type="datetime-local" />
            </label>
            <label>
              <span className={labelClasses()}>Expires</span>
              <input className={fieldClasses()} name="expiresAt" type="datetime-local" />
            </label>
          </div>

          <label className="block">
            <span className={labelClasses()}>Reason</span>
            <input
              className={fieldClasses()}
              maxLength={300}
              name="reason"
              placeholder="Unused stock moved to the next campaign"
              required
            />
          </label>

          <button className="rounded-[14px] bg-[var(--ve-green)] px-5 py-3 text-sm font-black text-white" type="submit">
            Reallocate inventory
          </button>
        </form>
      </AdminCard>
    </>
  );
}
