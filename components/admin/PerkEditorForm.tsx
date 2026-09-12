"use client";

import { EconomyDateInput } from "@/components/admin/economy/EconomyDateInput";
import { EconomyForm } from "@/components/admin/economy/EconomyForm";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { RewardThumbnailFields } from "@/components/admin/RewardThumbnailFields";
import type { RewardActionState } from "@/app/admin/rewards/[id]/actions";
import type { AdminCampaignRow } from "@/lib/admin";

type PerkEditorValue = {
  id: string;
  title: string;
  description: string;
  costXp: number;
  visibilityMode: string;
  perUserLimit: number;
  limitPeriod: string;
  redemptionWindowDays: number | "";
  sortOrder: number;
  offerExpiresAt: string;
  thumbnailUrl: string;
  thumbnailIconName: string;
  thumbnailLegacyIcon: string;
  thumbnailColor: string;
  terms: string;
  claimSteps: string[];
  campaignId?: string | null;
  totalAvailable?: number;
  fallback: {
    prizeType: "native_xp" | "xp_boost";
    title: string;
    amount: number;
    multiplier: number;
    durationHours: number;
    uses: number;
  };
};

type PerkEditorFormProps = {
  action: (
    previousState: RewardActionState,
    formData: FormData,
  ) => Promise<RewardActionState>;
  mode: "create" | "edit";
  perk: PerkEditorValue;
  campaigns?: AdminCampaignRow[];
};

function fieldClasses() {
  return "mt-1 w-full rounded-[12px] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--ui-focus)]";
}

function labelClasses() {
  return "text-xs font-black uppercase tracking-[0.12em] text-[var(--ui-text-muted)]";
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="rounded-[14px] bg-[var(--ui-action)] px-5 py-3 text-sm font-black text-[var(--ui-on-action)] disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

export function PerkEditorForm({
  action,
  mode,
  perk,
  campaigns = [],
}: PerkEditorFormProps) {
  const [state, formAction] = useActionState(action, {
    ok: false,
    message: "",
  });
  const [visibilityMode, setVisibilityMode] = useState(perk.visibilityMode);
  const [limitPeriod, setLimitPeriod] = useState(perk.limitPeriod);
  const [perUserLimit, setPerUserLimit] = useState(
    Math.max(1, perk.perUserLimit || 1),
  );
  const [claimSteps, setClaimSteps] = useState(
    perk.claimSteps.length > 0
      ? perk.claimSteps
      : ["Redeem the perk to reveal a surprise reward."],
  );
  const [fallbackType, setFallbackType] = useState<"native_xp" | "xp_boost">(
    perk.fallback.prizeType,
  );
  const [fallbackTitle, setFallbackTitle] = useState(perk.fallback.title);
  const [fallbackAmount, setFallbackAmount] = useState(perk.fallback.amount);
  const [fallbackMultiplier, setFallbackMultiplier] = useState(
    perk.fallback.multiplier,
  );
  const [fallbackDurationHours, setFallbackDurationHours] = useState(
    perk.fallback.durationHours,
  );
  const [fallbackUses, setFallbackUses] = useState(perk.fallback.uses);

  const fulfillmentConfig = useMemo(() => {
    if (fallbackType === "xp_boost") {
      return {
        fallback: {
          prizeType: "xp_boost",
          title: fallbackTitle.trim() || "XP Boost",
          multiplier: fallbackMultiplier,
          durationHours: fallbackDurationHours,
          uses: fallbackUses,
        },
      };
    }

    return {
      fallback: {
        prizeType: "native_xp",
        title: fallbackTitle.trim() || "Bonus XP",
        amount: fallbackAmount,
      },
    };
  }, [
    fallbackAmount,
    fallbackDurationHours,
    fallbackMultiplier,
    fallbackTitle,
    fallbackType,
    fallbackUses,
  ]);

  return (
    <EconomyForm
      action={formAction}
      className="space-y-5"
      steps={[
        {
          id: "basics",
          title: "The perk",
          description: "",
          content: (
            <>
              <div className="space-y-5">
                <p className="text-xs font-semibold leading-5 text-[var(--ui-text-muted)]">
                  Saving here keeps this perk in draft. Publish or pause it from
                  the Perks overview when the pool and inventory are ready.
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  <label>
                    <span className={labelClasses()}>Perk name</span>
                    <input
                      className={fieldClasses()}
                      defaultValue={perk.title}
                      maxLength={140}
                      name="title"
                      required
                    />
                  </label>
                  <label>
                    <span className={labelClasses()}>XP cost</span>
                    <input
                      className={fieldClasses()}
                      defaultValue={perk.costXp}
                      min={1}
                      name="costXp"
                      required
                      type="number"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className={labelClasses()}>Learner description</span>
                  <textarea
                    className={`${fieldClasses()} min-h-20 resize-none`}
                    defaultValue={perk.description}
                    maxLength={500}
                    name="description"
                  />
                </label>
              </div>
            </>
          ),
        },
        {
          id: "availability",
          title: "Availability",
          description:
            "Dates control when learners can open this perk. Leave the end date empty for no scheduled end.",
          content: (
            <>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <label>
                    <span className={labelClasses()}>Campaign</span>
                    <select
                      className={fieldClasses()}
                      defaultValue={perk.campaignId ?? ""}
                      name="campaignId"
                    >
                      <option value="">No campaign</option>
                      {campaigns.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className={labelClasses()}>Visibility</span>
                    <select
                      className={fieldClasses()}
                      name="visibilityMode"
                      onChange={(event) =>
                        setVisibilityMode(event.target.value)
                      }
                      value={visibilityMode}
                    >
                      <option value="store">Store</option>
                      <option value="campaign_only">Campaign only</option>
                      <option value="hidden">Hidden</option>
                      <option value="system_only">System only</option>
                    </select>
                  </label>
                  <div className="rounded-[12px] border border-[var(--ui-border)] bg-[var(--ui-surface-inset)] px-4 py-3">
                    <span className={labelClasses()}>Publishing</span>
                    <p className="mt-2 text-sm font-black text-[var(--ui-text)]">
                      Managed from Perks overview
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ui-text-muted)]">
                      Use the overview to publish, pause, or return this perk to
                      draft.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label>
                    <span className={labelClasses()}>Offer ends</span>
                    <EconomyDateInput
                      className={fieldClasses()}
                      defaultValue={perk.offerExpiresAt}
                      name="offerExpiresAt"
                      type="datetime-local"
                    />
                  </label>
                  <label>
                    <span className={labelClasses()}>Redeem window days</span>
                    <input
                      className={fieldClasses()}
                      defaultValue={perk.redemptionWindowDays}
                      min={1}
                      name="redemptionWindowDays"
                      type="number"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label>
                    <span className={labelClasses()}>Limit period</span>
                    <select
                      className={fieldClasses()}
                      name="limitPeriod"
                      onChange={(event) => setLimitPeriod(event.target.value)}
                      value={limitPeriod}
                    >
                      <option value="none">None</option>
                      <option value="lifetime">Lifetime</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="campaign">Campaign</option>
                    </select>
                  </label>
                  {limitPeriod === "none" ? (
                    <>
                      <div className="rounded-[12px] border border-[var(--ui-border)] bg-[var(--ui-surface-inset)] px-4 py-3">
                        <span className={labelClasses()}>Per-user limit</span>
                        <p className="mt-2 text-sm font-black text-[var(--ui-text)]">
                          No per-user limit
                        </p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ui-text-muted)]">
                          Anyone with enough XP can open this perk while the
                          prize pool and campaign rules allow.
                        </p>
                      </div>
                      <input name="perUserLimit" type="hidden" value="1" />
                    </>
                  ) : (
                    <label>
                      <span className={labelClasses()}>Per-user limit</span>
                      <input
                        className={fieldClasses()}
                        min={1}
                        name="perUserLimit"
                        onChange={(event) =>
                          setPerUserLimit(Number(event.target.value))
                        }
                        required
                        type="number"
                        value={perUserLimit}
                      />
                    </label>
                  )}
                </div>
              </div>
            </>
          ),
        },
        {
          id: "card",
          title: "Learner card",
          description: "",
          content: (
            <>
              <div className="space-y-4">
                <RewardThumbnailFields
                  color={perk.thumbnailColor}
                  iconName={perk.thumbnailIconName}
                  legacyIcon={perk.thumbnailLegacyIcon}
                  title={perk.title || "Perk"}
                  url={perk.thumbnailUrl}
                />
                <label className="block">
                  <span className={labelClasses()}>Terms</span>
                  <textarea
                    className={`${fieldClasses()} min-h-20 resize-none`}
                    defaultValue={perk.terms}
                    maxLength={1000}
                    name="terms"
                  />
                </label>
              </div>
            </>
          ),
        },
        {
          id: "fallback",
          title: "When no prize is available",
          description:
            "Fallback is used only when no eligible prize can be awarded. It has no fixed selection share.",
          content: (
            <>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <label>
                    <span className={labelClasses()}>Fallback type</span>
                    <select
                      className={fieldClasses()}
                      onChange={(event) =>
                        setFallbackType(
                          event.target.value as "native_xp" | "xp_boost",
                        )
                      }
                      value={fallbackType}
                    >
                      <option value="native_xp">Bonus XP</option>
                      <option value="xp_boost">XP boost</option>
                    </select>
                  </label>
                  <label className="md:col-span-2">
                    <span className={labelClasses()}>Fallback title</span>
                    <input
                      className={fieldClasses()}
                      onChange={(event) => setFallbackTitle(event.target.value)}
                      value={fallbackTitle}
                    />
                  </label>
                </div>
                {fallbackType === "xp_boost" ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    <label>
                      <span className={labelClasses()}>Multiplier</span>
                      <input
                        className={fieldClasses()}
                        min={1.01}
                        onChange={(event) =>
                          setFallbackMultiplier(Number(event.target.value))
                        }
                        step="0.1"
                        type="number"
                        value={fallbackMultiplier}
                      />
                    </label>
                    <label>
                      <span className={labelClasses()}>Duration hours</span>
                      <input
                        className={fieldClasses()}
                        min={1}
                        onChange={(event) =>
                          setFallbackDurationHours(Number(event.target.value))
                        }
                        type="number"
                        value={fallbackDurationHours}
                      />
                    </label>
                    <label>
                      <span className={labelClasses()}>Uses</span>
                      <input
                        className={fieldClasses()}
                        min={1}
                        onChange={(event) =>
                          setFallbackUses(Number(event.target.value))
                        }
                        type="number"
                        value={fallbackUses}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">
                    <label>
                      <span className={labelClasses()}>Fallback XP</span>
                      <input
                        className={fieldClasses()}
                        min={1}
                        onChange={(event) =>
                          setFallbackAmount(Number(event.target.value))
                        }
                        type="number"
                        value={fallbackAmount}
                      />
                    </label>
                  </div>
                )}
              </div>
            </>
          ),
        },
        {
          id: "claim",
          title: "Claim steps",
          description: "",
          content: (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-end">
                  <button
                    className="rounded-[12px] bg-[var(--ui-surface-inset)] px-3 py-2 text-xs font-black"
                    onClick={() => setClaimSteps((current) => [...current, ""])}
                    type="button"
                  >
                    Add step
                  </button>
                </div>
                <div className="space-y-2">
                  {claimSteps.map((step, index) => (
                    <div
                      className="flex gap-2"
                      key={`perk-claim-step-${index}`}
                    >
                      <input
                        className={fieldClasses()}
                        onChange={(event) =>
                          setClaimSteps((current) =>
                            current.map((currentStep, stepIndex) =>
                              stepIndex === index
                                ? event.target.value
                                : currentStep,
                            ),
                          )
                        }
                        placeholder={`Step ${index + 1}`}
                        value={step}
                      />
                      <button
                        className="mt-1 rounded-[12px] bg-[color:color-mix(in_srgb,var(--ui-danger-bg)_74%,var(--ui-surface))] px-3 text-xs font-black text-[var(--ui-danger)]"
                        onClick={() =>
                          setClaimSteps((current) =>
                            current.filter(
                              (_, stepIndex) => stepIndex !== index,
                            ),
                          )
                        }
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ),
        },
      ]}
      reviewAction={
        <>
          <SubmitButton
            label={mode === "create" ? "Save draft" : "Save draft"}
          />
        </>
      }
    >
      {mode === "edit" ? (
        <input defaultValue={perk.id} name="rewardId" type="hidden" />
      ) : null}
      <input name="distributionMode" type="hidden" value="perk_bundle" />
      <input name="fulfillmentType" type="hidden" value="manual" />
      <input name="status" type="hidden" value="draft" />
      <input name="isEnabled" type="hidden" value="false" />
      <input name="sortOrder" type="hidden" value={String(perk.sortOrder)} />
      <input
        name="claimSteps"
        type="hidden"
        value={claimSteps.filter(Boolean).join("\n")}
      />
      <input
        name="fulfillmentConfig"
        type="hidden"
        value={JSON.stringify(fulfillmentConfig)}
      />
      {state.message ? (
        <p
          className={`rounded-[14px] px-4 py-3 text-sm font-black ${
            state.ok
              ? "bg-[var(--ui-success-bg)] text-[var(--ui-success)]"
              : "bg-[color:color-mix(in_srgb,var(--ui-danger-bg)_74%,var(--ui-surface))] text-[var(--ui-danger)]"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </EconomyForm>
  );
}
