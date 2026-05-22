"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { RewardActionState } from "@/app/admin/rewards/[id]/actions";
import type { AdminCampaignRow } from "@/lib/admin";

type RewardField = {
  id: string;
  label: string;
  type: "text" | "tel" | "email" | "textarea";
  required: boolean;
};

type RewardEditorValue = {
  id: string;
  title: string;
  description: string;
  costXp: number;
  status: string;
  isEnabled: boolean;
  distributionMode: string;
  fulfillmentType: string;
  visibilityMode: string;
  fulfillmentConfig: Record<string, unknown>;
  perUserLimit: number;
  limitPeriod: string;
  redemptionWindowDays: number | "";
  sortOrder: number;
  offerExpiresAt: string;
  thumbnailUrl: string;
  thumbnailIcon: string;
  thumbnailColor: string;
  terms: string;
  claimSteps: string[];
  campaignId?: string | null;
  totalAvailable?: number;
};

type RewardEditorFormProps = {
  action: (
    previousState: RewardActionState,
    formData: FormData,
  ) => Promise<RewardActionState>;
  mode: "create" | "edit";
  reward: RewardEditorValue;
  campaigns?: AdminCampaignRow[];
  lockDistributionMode?: "direct" | "perk_bundle";
};

const fieldTypes = ["text", "tel", "email", "textarea"] as const;

function fieldClasses() {
  return "mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[#087f5b]";
}

function labelClasses() {
  return "text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]";
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="rounded-[14px] bg-[#087f5b] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getInitialFields(config: Record<string, unknown>): RewardField[] {
  const fields = Array.isArray(config.fields) ? config.fields : [];
  const parsed = fields
    .map((field) => {
      if (!field || typeof field !== "object" || Array.isArray(field)) {
        return null;
      }

      const record = field as Record<string, unknown>;
      const type = fieldTypes.includes(record.type as RewardField["type"])
        ? (record.type as RewardField["type"])
        : "text";

      return {
        id: asString(record.id),
        label: asString(record.label),
        type,
        required: Boolean(record.required),
      };
    })
    .filter((field): field is RewardField => Boolean(field));

  return parsed.length > 0
    ? parsed
    : [
        { id: "fullName", label: "Full name", type: "text", required: true },
        { id: "phone", label: "Phone", type: "tel", required: true },
        { id: "email", label: "Email", type: "email", required: true },
      ];
}

export function RewardEditorForm({
  action,
  mode,
  reward,
  campaigns = [],
  lockDistributionMode,
}: RewardEditorFormProps) {
  const [state, formAction] = useActionState(action, { ok: false, message: "" });
  const [distributionMode, setDistributionMode] = useState(lockDistributionMode ?? reward.distributionMode);
  const [fulfillmentType, setFulfillmentType] = useState(
    reward.fulfillmentType === "perk_bundle" ? "manual" : reward.fulfillmentType,
  );
  const [visibilityMode, setVisibilityMode] = useState(reward.visibilityMode);
  const [limitPeriod, setLimitPeriod] = useState(reward.limitPeriod);
  const [perUserLimit, setPerUserLimit] = useState(Math.max(1, reward.perUserLimit || 1));
  const [claimSteps, setClaimSteps] = useState(
    reward.claimSteps.length > 0 ? reward.claimSteps : ["Confirm the redemption."],
  );
  const [fields, setFields] = useState<RewardField[]>(() =>
    getInitialFields(reward.fulfillmentConfig),
  );
  const [externalUrl, setExternalUrl] = useState(asString(reward.fulfillmentConfig.url));
  const [externalLabel, setExternalLabel] = useState(
    asString(reward.fulfillmentConfig.buttonLabel, "Open reward"),
  );
  const [nativeEffect, setNativeEffect] = useState(
    asString(reward.fulfillmentConfig.effect, "xp_bonus"),
  );
  const [nativeAmount, setNativeAmount] = useState(asNumber(reward.fulfillmentConfig.amount, 100));
  const [nativeMultiplier, setNativeMultiplier] = useState(
    asNumber(reward.fulfillmentConfig.multiplier, 2),
  );
  const [nativeDurationHours, setNativeDurationHours] = useState(
    asNumber(reward.fulfillmentConfig.durationHours, 24),
  );
  const [nativeUses, setNativeUses] = useState(asNumber(reward.fulfillmentConfig.uses, 3));
  const initialFallback = (() => {
    const fallback =
      reward.fulfillmentConfig.fallback && typeof reward.fulfillmentConfig.fallback === "object"
        ? (reward.fulfillmentConfig.fallback as Record<string, unknown>)
        : {};
    return fallback;
  })();
  const [perkFallbackType, setPerkFallbackType] = useState(
    asString(initialFallback.prizeType, "native_xp"),
  );
  const [perkFallbackTitle, setPerkFallbackTitle] = useState(
    asString(initialFallback.title, "Bonus XP"),
  );
  const [perkFallbackAmount, setPerkFallbackAmount] = useState(
    asNumber(initialFallback.amount, 5),
  );
  const [perkFallbackMultiplier, setPerkFallbackMultiplier] = useState(
    asNumber(initialFallback.multiplier, 2),
  );
  const [perkFallbackDurationHours, setPerkFallbackDurationHours] = useState(
    asNumber(initialFallback.durationHours, 24),
  );
  const [perkFallbackUses, setPerkFallbackUses] = useState(asNumber(initialFallback.uses, 3));
  const [partner, setPartner] = useState(asString(reward.fulfillmentConfig.partner));

  const fulfillmentConfig = useMemo(() => {
    if (fulfillmentType === "manual") {
      return {
        fields: fields
          .map((field) => ({
            id: field.id.trim(),
            label: field.label.trim(),
            type: field.type,
            required: field.required,
          }))
          .filter((field) => field.id && field.label),
      };
    }

    if (fulfillmentType === "external_link") {
      return {
        url: externalUrl.trim(),
        buttonLabel: externalLabel.trim() || "Open reward",
      };
    }

    if (fulfillmentType === "native") {
      if (nativeEffect === "xp_boost") {
        return {
          effect: "xp_boost",
          multiplier: nativeMultiplier,
          durationHours: nativeDurationHours,
          uses: nativeUses,
        };
      }

      return {
        effect: "xp_bonus",
        amount: nativeAmount,
      };
    }

    if (distributionMode === "perk_bundle") {
      if (perkFallbackType === "xp_boost") {
        return {
          fallback: {
            prizeType: "xp_boost",
            title: perkFallbackTitle.trim() || "XP Boost",
            multiplier: perkFallbackMultiplier,
            durationHours: perkFallbackDurationHours,
            uses: perkFallbackUses,
          },
        };
      }

      return {
        fallback: {
          prizeType: "native_xp",
          title: perkFallbackTitle.trim() || "Bonus XP",
          amount: perkFallbackAmount,
        },
      };
    }

    return partner.trim() ? { partner: partner.trim() } : {};
  }, [
    externalLabel,
    externalUrl,
    fields,
    distributionMode,
    fulfillmentType,
    nativeAmount,
    nativeDurationHours,
    nativeEffect,
    nativeMultiplier,
    nativeUses,
    perkFallbackAmount,
    perkFallbackDurationHours,
    perkFallbackMultiplier,
    perkFallbackTitle,
    perkFallbackType,
    perkFallbackUses,
    partner,
  ]);

  function updateField(index: number, patch: Partial<RewardField>) {
    setFields((current) =>
      current.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field)),
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {mode === "edit" ? <input name="rewardId" type="hidden" defaultValue={reward.id} /> : null}
      <input name="claimSteps" type="hidden" value={claimSteps.filter(Boolean).join("\n")} />
      <input name="fulfillmentConfig" type="hidden" value={JSON.stringify(fulfillmentConfig)} />

      <div className="grid gap-4 md:grid-cols-2">
        {mode === "edit" ? (
          <label>
            <span className={labelClasses()}>Reward ID</span>
            <input className={fieldClasses()} disabled defaultValue={reward.id} />
          </label>
        ) : null}
        <label>
          <span className={labelClasses()}>Name</span>
          <input className={fieldClasses()} maxLength={140} name="title" required defaultValue={reward.title} />
          {mode === "create" ? (
            <span className="mt-1 block text-xs font-semibold text-[var(--ve-muted)]">
              Reward ID is generated automatically from the name.
            </span>
          ) : null}
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label>
          <span className={labelClasses()}>Cost</span>
          <input className={fieldClasses()} min={1} name="costXp" required type="number" defaultValue={reward.costXp} />
        </label>
        {mode === "create" && fulfillmentType !== "voucher_code" && fulfillmentType !== "qr_code" ? (
          <label>
            <span className={labelClasses()}>Initial available quantity</span>
            <input
              className={fieldClasses()}
              min={0}
              name="totalAvailable"
              type="number"
              defaultValue={reward.totalAvailable ?? 0}
            />
          </label>
        ) : null}
      </div>

      <label className="block">
        <span className={labelClasses()}>Description</span>
        <textarea
          className={`${fieldClasses()} min-h-20 resize-none`}
          maxLength={500}
          name="description"
          defaultValue={reward.description}
        />
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label>
          <span className={labelClasses()}>Campaign</span>
          <select className={fieldClasses()} name="campaignId" defaultValue={reward.campaignId ?? ""}>
            <option value="">No campaign</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </label>
        {lockDistributionMode ? (
          <input name="distributionMode" type="hidden" value={lockDistributionMode} />
        ) : (
          <label>
            <span className={labelClasses()}>Reward mode</span>
            <select
              className={fieldClasses()}
              name="distributionMode"
              onChange={(event) => {
                const nextMode = event.target.value;
                setDistributionMode(nextMode);
                if (nextMode === "perk_bundle" && visibilityMode !== "store") {
                  setVisibilityMode("store");
                }
              }}
              value={distributionMode}
            >
              <option value="direct">Direct reward</option>
              <option value="perk_bundle">Low-XP perk</option>
            </select>
          </label>
        )}
        <label>
          <span className={labelClasses()}>Status</span>
          <select className={fieldClasses()} name="status" defaultValue={reward.status}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        {distributionMode === "direct" ? (
        <label>
          <span className={labelClasses()}>Fulfillment</span>
          <select
            className={fieldClasses()}
            name="fulfillmentType"
            onChange={(event) => {
              const nextType = event.target.value;
              setFulfillmentType(nextType);
              if (nextType === "native" && visibilityMode === "store") {
                setVisibilityMode("system_only");
              }
            }}
            value={fulfillmentType}
          >
            <option value="manual">Manual form</option>
            <option value="voucher_code">Voucher code</option>
            <option value="qr_code">QR code</option>
            <option value="external_link">External link</option>
            <option value="native">Native</option>
          </select>
        </label>
        ) : (
          <div className="rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-panel)] px-4 py-3">
            <span className={labelClasses()}>Fulfillment</span>
            <p className="mt-2 text-sm font-black text-[var(--foreground)]">Prize pool wrapper</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
              Learners redeem this item to reveal a prize. The actual won reward keeps its own fulfillment type.
            </p>
            <input name="fulfillmentType" type="hidden" value="manual" />
          </div>
        )}
        <label>
          <span className={labelClasses()}>Visibility</span>
          <select
            className={fieldClasses()}
            name="visibilityMode"
            onChange={(event) => setVisibilityMode(event.target.value)}
            value={visibilityMode}
          >
            <option value="store">Store</option>
            <option value="system_only">System only</option>
            <option value="campaign_only">Campaign only</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
        <label>
          <span className={labelClasses()}>Sort order</span>
          <input className={fieldClasses()} name="sortOrder" type="number" defaultValue={reward.sortOrder} />
        </label>
      </div>

      <div className="rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-panel)] px-4 py-3">
        <p className="text-sm font-black text-[var(--foreground)]">
          {visibilityMode === "store"
            ? "Learners can discover and redeem this reward in the XP Store."
            : visibilityMode === "system_only"
              ? "This reward is hidden from the XP Store and meant for missions, fallback rewards, or admin-triggered flows."
              : visibilityMode === "campaign_only"
                ? "This reward stays out of the public store and is reserved for campaign-driven experiences."
                : "This reward is hidden from learners until you switch it back on."}
        </p>
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
            <div className="rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-panel)] px-4 py-3">
              <span className={labelClasses()}>Per-user limit</span>
              <p className="mt-2 text-sm font-black text-[var(--foreground)]">No per-user limit</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                Anyone with enough XP can redeem this reward whenever stock and campaign rules allow.
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
              onChange={(event) => setPerUserLimit(Number(event.target.value))}
              required
              type="number"
              value={perUserLimit}
            />
          </label>
        )}
        <label>
          <span className={labelClasses()}>Redeem window days</span>
          <input
            className={fieldClasses()}
            min={1}
            name="redemptionWindowDays"
            type="number"
            defaultValue={reward.redemptionWindowDays}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label>
          <span className={labelClasses()}>Offer expires</span>
          <input
            className={fieldClasses()}
            name="offerExpiresAt"
            type="datetime-local"
            defaultValue={reward.offerExpiresAt}
          />
        </label>
        <label>
          <span className={labelClasses()}>Thumbnail icon</span>
          <input className={fieldClasses()} maxLength={24} name="thumbnailIcon" defaultValue={reward.thumbnailIcon} />
        </label>
        <label>
          <span className={labelClasses()}>Thumbnail color</span>
          <input className={fieldClasses()} maxLength={32} name="thumbnailColor" defaultValue={reward.thumbnailColor} />
        </label>
      </div>

      <label className="block">
        <span className={labelClasses()}>Thumbnail URL</span>
        <input className={fieldClasses()} maxLength={1000} name="thumbnailUrl" defaultValue={reward.thumbnailUrl} />
      </label>

      <label className="block">
        <span className={labelClasses()}>Terms</span>
        <textarea
          className={`${fieldClasses()} min-h-20 resize-none`}
          maxLength={1000}
          name="terms"
          defaultValue={reward.terms}
        />
      </label>

      <section className="rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black">Claim steps</h2>
            <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
              Learners see these after redeeming.
            </p>
          </div>
          <button
            className="rounded-[12px] bg-[var(--ve-panel)] px-3 py-2 text-xs font-black"
            onClick={() => setClaimSteps((current) => [...current, ""])}
            type="button"
          >
            Add step
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {claimSteps.map((step, index) => (
            <div className="flex gap-2" key={`claim-step-${index}`}>
              <input
                className={fieldClasses()}
                onChange={(event) =>
                  setClaimSteps((current) =>
                    current.map((currentStep, stepIndex) =>
                      stepIndex === index ? event.target.value : currentStep,
                    ),
                  )
                }
                placeholder={`Step ${index + 1}`}
                value={step}
              />
              <button
                className="mt-1 rounded-[12px] bg-[#fff0f0] px-3 text-xs font-black text-[#c00000]"
                onClick={() =>
                  setClaimSteps((current) => current.filter((_, stepIndex) => stepIndex !== index))
                }
                type="button"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4">
        <h2 className="text-sm font-black">
          {distributionMode === "perk_bundle" ? "Perk setup" : "Fulfillment setup"}
        </h2>
        {distributionMode === "direct" && fulfillmentType === "manual" ? (
          <div className="mt-4 space-y-3">
            {fields.map((field, index) => (
              <div className="grid gap-2 rounded-[14px] bg-[var(--ve-panel)] p-3 md:grid-cols-[1fr_1fr_8rem_5rem_auto]" key={`field-${index}`}>
                <input
                  className={fieldClasses()}
                  onChange={(event) => updateField(index, { id: event.target.value })}
                  placeholder="fieldId"
                  value={field.id}
                />
                <input
                  className={fieldClasses()}
                  onChange={(event) => updateField(index, { label: event.target.value })}
                  placeholder="Label"
                  value={field.label}
                />
                <select
                  className={fieldClasses()}
                  onChange={(event) =>
                    updateField(index, { type: event.target.value as RewardField["type"] })
                  }
                  value={field.type}
                >
                  {fieldTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <label className="mt-1 flex items-center gap-2 text-xs font-black">
                  <input
                    checked={field.required}
                    onChange={(event) => updateField(index, { required: event.target.checked })}
                    type="checkbox"
                  />
                  Required
                </label>
                <button
                  className="mt-1 rounded-[12px] bg-[#fff0f0] px-3 text-xs font-black text-[#c00000]"
                  onClick={() => setFields((current) => current.filter((_, fieldIndex) => fieldIndex !== index))}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="rounded-[12px] bg-[var(--ve-panel)] px-3 py-2 text-xs font-black"
              onClick={() =>
                setFields((current) => [
                  ...current,
                  { id: "", label: "", type: "text", required: false },
                ])
              }
              type="button"
            >
              Add field
            </button>
          </div>
        ) : null}

        {distributionMode === "direct" && fulfillmentType === "external_link" ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label>
              <span className={labelClasses()}>Partner URL</span>
              <input className={fieldClasses()} onChange={(event) => setExternalUrl(event.target.value)} value={externalUrl} />
            </label>
            <label>
              <span className={labelClasses()}>Button label</span>
              <input className={fieldClasses()} onChange={(event) => setExternalLabel(event.target.value)} value={externalLabel} />
            </label>
          </div>
        ) : null}

        {distributionMode === "direct" && fulfillmentType === "native" ? (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label>
              <span className={labelClasses()}>Native effect</span>
              <select className={fieldClasses()} onChange={(event) => setNativeEffect(event.target.value)} value={nativeEffect}>
                <option value="xp_bonus">XP Bonus</option>
                <option value="xp_boost">XP Boost</option>
              </select>
            </label>
            {nativeEffect === "xp_bonus" ? (
              <label>
                <span className={labelClasses()}>Bonus XP</span>
                <input className={fieldClasses()} min={1} onChange={(event) => setNativeAmount(Number(event.target.value))} type="number" value={nativeAmount} />
              </label>
            ) : (
              <>
                <label>
                  <span className={labelClasses()}>Multiplier</span>
                  <input className={fieldClasses()} min={1.01} onChange={(event) => setNativeMultiplier(Number(event.target.value))} step="0.1" type="number" value={nativeMultiplier} />
                </label>
                <label>
                  <span className={labelClasses()}>Duration hours</span>
                  <input className={fieldClasses()} min={1} onChange={(event) => setNativeDurationHours(Number(event.target.value))} type="number" value={nativeDurationHours} />
                </label>
                <label>
                  <span className={labelClasses()}>Uses</span>
                  <input className={fieldClasses()} min={1} onChange={(event) => setNativeUses(Number(event.target.value))} type="number" value={nativeUses} />
                </label>
              </>
            )}
          </div>
        ) : null}

        {distributionMode === "perk_bundle" ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-[14px] bg-[var(--ve-panel)] p-4">
              <h3 className="text-sm font-black">Fallback prize</h3>
              <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                Used if every configured perk prize is sold out, capped, or not yet released.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label>
                <span className={labelClasses()}>Fallback type</span>
                <select
                  className={fieldClasses()}
                  onChange={(event) => setPerkFallbackType(event.target.value)}
                  value={perkFallbackType}
                >
                  <option value="native_xp">Bonus XP</option>
                  <option value="xp_boost">XP boost</option>
                </select>
              </label>
              <label className="md:col-span-2">
                <span className={labelClasses()}>Fallback title</span>
                <input
                  className={fieldClasses()}
                  onChange={(event) => setPerkFallbackTitle(event.target.value)}
                  value={perkFallbackTitle}
                />
              </label>
            </div>
            {perkFallbackType === "xp_boost" ? (
              <div className="grid gap-4 md:grid-cols-3">
                <label>
                  <span className={labelClasses()}>Multiplier</span>
                  <input
                    className={fieldClasses()}
                    min={1.01}
                    onChange={(event) => setPerkFallbackMultiplier(Number(event.target.value))}
                    step="0.1"
                    type="number"
                    value={perkFallbackMultiplier}
                  />
                </label>
                <label>
                  <span className={labelClasses()}>Duration hours</span>
                  <input
                    className={fieldClasses()}
                    min={1}
                    onChange={(event) => setPerkFallbackDurationHours(Number(event.target.value))}
                    type="number"
                    value={perkFallbackDurationHours}
                  />
                </label>
                <label>
                  <span className={labelClasses()}>Uses</span>
                  <input
                    className={fieldClasses()}
                    min={1}
                    onChange={(event) => setPerkFallbackUses(Number(event.target.value))}
                    type="number"
                    value={perkFallbackUses}
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
                    onChange={(event) => setPerkFallbackAmount(Number(event.target.value))}
                    type="number"
                    value={perkFallbackAmount}
                  />
                </label>
              </div>
            )}
            <p className="text-xs font-semibold leading-5 text-[var(--ve-muted)]">
              Configure the actual prize pool after saving this reward.
            </p>
          </div>
        ) : null}

        {distributionMode === "direct" && (fulfillmentType === "voucher_code" || fulfillmentType === "qr_code") ? (
          <div className="mt-4">
            <label>
              <span className={labelClasses()}>Partner label</span>
              <input className={fieldClasses()} onChange={(event) => setPartner(event.target.value)} value={partner} />
            </label>
            <p className="mt-2 text-xs font-semibold text-[var(--ve-muted)]">
              Codes and QR payloads are uploaded as batches from the inventory page.
            </p>
          </div>
        ) : null}
      </section>

      <label className="flex items-center gap-3 rounded-[14px] bg-[var(--ve-panel)] px-4 py-3 text-sm font-black">
        <input name="isEnabled" type="checkbox" defaultChecked={reward.isEnabled} />
        Enabled
      </label>

      {state.message ? (
        <p
          className={`rounded-[14px] px-4 py-3 text-sm font-black ${
            state.ok ? "bg-[#e4f4ed] text-[#087f5b]" : "bg-[#fff0f0] text-[#c00000]"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <SubmitButton label={mode === "create" ? "Create reward" : "Save reward"} />
    </form>
  );
}
