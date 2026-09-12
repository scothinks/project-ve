import { EconomyDateInput } from "@/components/admin/economy/EconomyDateInput";
import { EconomyForm } from "@/components/admin/economy/EconomyForm";
import type { AdminCampaignRow } from "@/lib/admin";
import { saveCampaign } from "@/app/admin/campaigns/actions";

function fieldClasses() {
  return "mt-1 w-full rounded-[12px] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--ui-focus)]";
}

function labelClasses() {
  return "text-xs font-black uppercase tracking-[0.12em] text-[var(--ui-text-muted)]";
}

function toDateInputValue(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
}

export function CampaignForm({
  campaign,
}: {
  campaign?: AdminCampaignRow | null;
}) {
  return (
    <EconomyForm
      action={saveCampaign}
      className="space-y-5"
      steps={[
        {
          id: "purpose",
          title: "Campaign purpose",
          description: "",
          content: (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className={labelClasses()}>Name</span>
                  <input
                    className={fieldClasses()}
                    maxLength={160}
                    name="name"
                    required
                    defaultValue={campaign?.name ?? ""}
                  />
                </label>
                {campaign ? (
                  <label>
                    <span className={labelClasses()}>Slug</span>
                    <input
                      className={`${fieldClasses()} text-[var(--ui-text-muted)]`}
                      disabled
                      readOnly
                      value={campaign.slug}
                    />
                  </label>
                ) : (
                  <div className="rounded-[14px] bg-[var(--ui-surface-inset)] p-4">
                    <p className={labelClasses()}>Slug</p>
                    <p className="mt-2 text-sm font-bold text-[var(--ui-text-muted)]">
                      Generated automatically from the campaign name.
                    </p>
                  </div>
                )}
              </div>
              <label className="block">
                <span className={labelClasses()}>Description</span>
                <textarea
                  className={`${fieldClasses()} min-h-24 resize-none`}
                  maxLength={800}
                  name="description"
                  defaultValue={campaign?.description ?? ""}
                />
              </label>
              <label className="block">
                <span className={labelClasses()}>Reporting label</span>
                <input
                  className={fieldClasses()}
                  maxLength={140}
                  name="budgetLabel"
                  defaultValue={campaign?.budget_label ?? ""}
                  placeholder="Q3 partner budget"
                />
              </label>
            </>
          ),
        },
        {
          id: "dates",
          title: "Availability",
          description:
            "The campaign opens on its start date and stops offering rewards on its end date. Leave either empty to omit that boundary.",
          content: (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className={labelClasses()}>Starts</span>
                  <EconomyDateInput
                    className={fieldClasses()}
                    name="startsAt"
                    type="datetime-local"
                    defaultValue={toDateInputValue(campaign?.starts_at ?? null)}
                  />
                </label>
                <label>
                  <span className={labelClasses()}>Ends</span>
                  <EconomyDateInput
                    className={fieldClasses()}
                    name="endsAt"
                    type="datetime-local"
                    defaultValue={toDateInputValue(campaign?.ends_at ?? null)}
                  />
                </label>
              </div>
            </>
          ),
        },
      ]}
      reviewAction={
        <>
          <button
            className="rounded-[14px] bg-[var(--ui-action)] px-5 py-3 text-sm font-black text-[var(--ui-on-action)]"
            type="submit"
          >
            Save campaign
          </button>
        </>
      }
      reviewNote={
        <>
          <p className="rounded-[14px] bg-[var(--ui-surface-inset)] p-4 text-sm font-bold leading-6 text-[var(--ui-text-muted)]">
            Saving keeps the campaign configured. Use Enable from the campaign
            list when it should become eligible for the XP Store.
          </p>
        </>
      }
    >
      <input name="campaignId" type="hidden" value={campaign?.id ?? ""} />
    </EconomyForm>
  );
}
