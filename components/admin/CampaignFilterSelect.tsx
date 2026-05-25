"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AdminCampaignRow } from "@/lib/admin";

export function CampaignFilterSelect({
  campaigns,
  value,
}: {
  campaigns: AdminCampaignRow[];
  value?: string;
}) {
  const router = useRouter();
  const [selectedValue, setSelectedValue] = useState(value ?? "");

  useEffect(() => {
    setSelectedValue(value ?? "");
  }, [value]);

  return (
    <label className="block w-full max-w-sm">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
        Campaign
      </span>
      <select
        className="mt-1 w-full rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-3 py-3 text-sm font-semibold outline-none focus:border-[var(--ve-green)]"
        name="campaign"
        onChange={(event) => {
          setSelectedValue(event.target.value);
          const params = new URLSearchParams();
          if (event.target.value) {
            params.set("campaign", event.target.value);
          }
          router.replace(params.toString() ? `/admin/rewards?${params}` : "/admin/rewards");
        }}
        value={selectedValue}
      >
        <option value="">All campaigns</option>
        <option value="none">No campaign</option>
        {campaigns.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}
