"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { StoreReward } from "@/lib/rewards";
import { formatXpLabel } from "@/lib/xp-format";

function RewardThumbnail({ reward }: { reward: StoreReward }) {
  const [imageFailed, setImageFailed] = useState(false);
  const fallbackIcon = reward.thumbnail.icon ?? reward.title.slice(0, 4).toUpperCase();

  if (reward.thumbnail.url && !imageFailed) {
    return (
      <img
        alt=""
        className="h-full w-full object-cover"
        onError={() => setImageFailed(true)}
        src={reward.thumbnail.url}
      />
    );
  }

  return (
    <div
      className="grid h-full w-full place-items-center text-[1.1rem] font-semibold tracking-[-0.02em] text-[#a66d00]"
      style={{ backgroundColor: reward.thumbnail.color ?? "#fff8df" }}
    >
      {fallbackIcon}
    </div>
  );
}

export function FeaturedRewardCard({ reward }: { reward: StoreReward }) {
  return (
    <Link href="/xp-store" className="block min-w-[190px] flex-1">
      <Card className="flex h-full flex-col overflow-hidden border border-[#fff1bf]" variant="store">
        <div className="relative h-28 shrink-0">
          <RewardThumbnail reward={reward} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/5 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-end">
            <StatusBadge
              className="shrink-0 bg-[var(--ve-card)] text-[#a66d00] px-3 py-1 text-[clamp(0.68rem,2.4vw,0.75rem)]"
              tone="store"
            >
              {formatXpLabel(reward.costXp)}
            </StatusBadge>
          </div>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <h3 className="line-clamp-3 min-h-[4.9rem] text-[1.12rem] font-semibold leading-7 tracking-[-0.025em] text-[var(--foreground)]">
            {reward.title}
          </h3>
          <p className="mt-2 line-clamp-3 text-[0.95rem] font-medium leading-6 text-[var(--ve-muted)]">
            {reward.description}
          </p>
        </div>
      </Card>
    </Link>
  );
}
