"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AdminCampaignRow, AdminRewardRow } from "@/lib/admin";
import {
  dryRunInventoryBatch,
  uploadInventoryBatch,
  type InventoryBatchDryRunState,
} from "@/app/admin/inventory/actions";

const initialInventoryBatchDryRunState: InventoryBatchDryRunState = {
  ok: false,
  message: "",
  totalRows: 0,
  validRows: 0,
  blankRows: 0,
  duplicateRows: 0,
  existingDuplicateRows: 0,
  itemType: "",
  rewardTitle: "",
  sample: [],
  errors: [],
  warnings: [],
};

function fieldClasses() {
  return "mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-2 text-sm font-semibold outline-none focus:border-[#087f5b]";
}

function labelClasses() {
  return "text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]";
}

function BatchActionButtons({
  canImport,
  dryRunAction,
  onDryRun,
}: {
  canImport: boolean;
  dryRunAction: (formData: FormData) => void;
  onDryRun: () => void;
}) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="rounded-[14px] bg-[var(--ve-panel)] px-5 py-3 text-sm font-black text-[var(--foreground)] disabled:opacity-60"
        disabled={pending}
        formAction={dryRunAction}
        onClick={onDryRun}
        type="submit"
      >
        {pending ? "Checking..." : "Dry run"}
      </button>
      <button
        className="rounded-[14px] bg-[#087f5b] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
        disabled={pending || !canImport}
        type="submit"
      >
        Import batch
      </button>
    </div>
  );
}

export function InventoryBatchUploadForm({
  activeCampaignId,
  campaigns,
  rewards,
  selectedRewardId,
}: {
  activeCampaignId: string;
  campaigns: AdminCampaignRow[];
  rewards: AdminRewardRow[];
  selectedRewardId?: string;
}) {
  const itemRewards = useMemo(
    () =>
      rewards.filter(
        (reward) =>
          reward.fulfillment_type === "voucher_code" || reward.fulfillment_type === "qr_code",
      ),
    [rewards],
  );
  const defaultRewardId = itemRewards.some((reward) => reward.id === selectedRewardId)
    ? selectedRewardId ?? ""
    : "";
  const [state, formAction] = useActionState(
    dryRunInventoryBatch,
    initialInventoryBatchDryRunState,
  );
  const [reviewed, setReviewed] = useState(false);
  const [inventoryText, setInventoryText] = useState("");
  const [originalFileName, setOriginalFileName] = useState("");
  const [rewardId, setRewardId] = useState(defaultRewardId);

  useEffect(() => {
    setRewardId(defaultRewardId);
  }, [defaultRewardId]);

  const selectedReward = itemRewards.find((reward) => reward.id === rewardId);
  const canImport = reviewed && state.ok;
  const markDirty = () => setReviewed(false);

  return (
    <form action={uploadInventoryBatch} className="mt-5 space-y-4">
      <input name="inventoryText" type="hidden" value={inventoryText} />
      <input name="originalFileName" type="hidden" value={originalFileName} />

      <div className="grid gap-4 lg:grid-cols-3">
        <label>
          <span className={labelClasses()}>Campaign</span>
          <select
            className={fieldClasses()}
            name="campaignId"
            defaultValue={activeCampaignId}
            onChange={markDirty}
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
          <span className={labelClasses()}>Reward</span>
          <select
            className={fieldClasses()}
            name="rewardId"
            onChange={(event) => {
              setRewardId(event.target.value);
              markDirty();
            }}
            required
            value={rewardId}
          >
            <option value="">Select voucher or QR reward</option>
            {itemRewards.map((reward) => (
              <option key={reward.id} value={reward.id}>
                {reward.title} ({reward.fulfillment_type.replaceAll("_", " ")})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelClasses()}>Source</span>
          <select className={fieldClasses()} name="source" onChange={markDirty} defaultValue="partner">
            <option value="partner">Partner</option>
            <option value="manual">Manual</option>
            <option value="internal">Internal</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <label>
          <span className={labelClasses()}>Available from</span>
          <input className={fieldClasses()} name="availableFrom" onChange={markDirty} type="datetime-local" />
        </label>
        <label>
          <span className={labelClasses()}>Expires</span>
          <input className={fieldClasses()} name="expiresAt" onChange={markDirty} type="datetime-local" />
        </label>
        <label>
          <span className={labelClasses()}>Batch label</span>
          <input className={fieldClasses()} maxLength={160} name="batchLabel" onChange={markDirty} />
        </label>
        <label>
          <span className={labelClasses()}>Partner ref</span>
          <input className={fieldClasses()} maxLength={160} name="partnerReference" onChange={markDirty} />
        </label>
      </div>

      <label className="block">
        <span className={labelClasses()}>Upload file</span>
        <input
          accept=".csv,.txt,text/csv,text/plain"
          className={fieldClasses()}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }
            setOriginalFileName(file.name);
            setInventoryText(await file.text());
            markDirty();
          }}
          type="file"
        />
      </label>

      <label className="block">
        <span className={labelClasses()}>
          {selectedReward?.fulfillment_type === "qr_code" ? "QR payloads" : "Voucher codes"}
        </span>
        <textarea
          className={`${fieldClasses()} min-h-48 resize-y font-mono text-xs`}
          onChange={(event) => {
            setInventoryText(event.target.value);
            setOriginalFileName("");
            markDirty();
          }}
          placeholder={
            selectedReward?.fulfillment_type === "qr_code"
              ? "One QR payload per line, or CSV with qr_payload column"
              : "One voucher code per line, or CSV with code column"
          }
          value={inventoryText}
        />
      </label>

      <BatchActionButtons
        canImport={canImport}
        dryRunAction={formAction}
        onDryRun={() => setReviewed(true)}
      />

      {state.message ? (
        <div
          className={`rounded-[16px] border p-4 text-sm font-bold ${
            state.ok
              ? "border-[#ccebdc] bg-[#f4fbf7] text-[#087f5b]"
              : "border-[#ffe0e0] bg-[#fff7f7] text-[#c00000]"
          }`}
        >
          <p>{state.message}</p>
          <div className="mt-3 grid gap-2 text-[var(--foreground)] sm:grid-cols-4">
            <p>{state.totalRows} rows</p>
            <p>{state.validRows} valid</p>
            <p>{state.duplicateRows} duplicates</p>
            <p>{state.existingDuplicateRows} already uploaded</p>
          </div>
        </div>
      ) : null}

      {state.errors.length > 0 ? (
        <div className="rounded-[16px] bg-[#fff0f0] p-4">
          <p className="text-sm font-black text-[#c00000]">Issues to fix</p>
          <ul className="mt-2 space-y-1 text-sm font-semibold text-[#7a1d1d]">
            {state.errors.slice(0, 12).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
          {state.errors.length > 12 ? (
            <p className="mt-2 text-xs font-bold text-[var(--ve-muted)]">
              {state.errors.length - 12} more issue(s) hidden.
            </p>
          ) : null}
        </div>
      ) : null}

      {state.warnings.length > 0 ? (
        <div className="rounded-[16px] bg-[#fff8df] p-4">
          <p className="text-sm font-black text-[#a66d00]">Warnings</p>
          <ul className="mt-2 space-y-1 text-sm font-semibold text-[#755100]">
            {state.warnings.slice(0, 8).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {state.sample.length > 0 ? (
        <div className="rounded-[16px] bg-[var(--ve-panel)] p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
            Preview sample
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {state.sample.map((item) => (
              <p className="truncate rounded-[10px] bg-[var(--ve-card)] px-3 py-2 font-mono text-xs font-bold" key={item}>
                {item}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </form>
  );
}
