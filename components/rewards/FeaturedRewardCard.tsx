"use client";

import Link from "next/link";
import { RewardThumbnailVisual } from "@/components/rewards/RewardThumbnailVisual";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { StoreReward } from "@/lib/rewards";
import { formatXpLabel } from "@/lib/xp-format";

function RewardThumbnail({ reward }: { reward: StoreReward }) {
  return (
    <RewardThumbnailVisual
      defaultColor="#fff8df"
      iconClassName="h-[42%] w-[42%] text-[#a66d00]"
      textClassName="text-[1.1rem] font-semibold tracking-[-0.02em] text-[#a66d00]"
      thumbnail={reward.thumbnail}
      title={reward.title}
    />
  );
}

export function FeaturedRewardCard({
  reward,
  compact = false,
}: {
  reward: StoreReward;
  compact?: boolean;
}) {
  return (
    <Link href="/xp-store" className="block h-full">
      <Card
        className={`dashboard-featured-reward-card flex h-full flex-col overflow-hidden border border-[#fff1bf] ${
          compact ? "dashboard-featured-reward-card--compact" : ""
        }`}
        variant="store"
      >
        <div className={`dashboard-featured-reward-card__media relative shrink-0 ${compact ? "h-16" : "h-28"}`}>
          <RewardThumbnail reward={reward} />
          <div className="dashboard-featured-reward-card__media-scrim absolute inset-0 bg-gradient-to-t from-black/30 via-black/5 to-transparent" />
          <div
            className={`dashboard-featured-reward-card__cost absolute left-4 right-4 flex items-end justify-end ${
              compact ? "bottom-3" : "bottom-4"
            }`}
          >
            <StatusBadge
              className={`shrink-0 px-3 py-1 ${
                compact ? "text-[0.68rem]" : "text-[clamp(0.68rem,2.4vw,0.75rem)]"
              }`}
              tone="store"
            >
              {formatXpLabel(reward.costXp)}
            </StatusBadge>
          </div>
        </div>
        <div className={`dashboard-featured-reward-card__body flex flex-1 flex-col ${compact ? "p-3.5" : "p-5"}`}>
          <h3
            className={`${
              compact
                ? "min-h-[2.6rem] text-[0.98rem] leading-[1.32] line-clamp-2"
                : "min-h-[4.9rem] text-[1.12rem] leading-7 line-clamp-3"
            } font-semibold tracking-[-0.025em] text-[var(--foreground)]`}
          >
            {reward.title}
          </h3>
          <p
            className={`${
              compact
                ? "text-[0.82rem] leading-5 line-clamp-2"
                : "text-[0.95rem] leading-6 line-clamp-3"
            } ${compact ? "mt-1.5" : "mt-2"} font-medium text-[var(--ve-muted)]`}
          >
            {reward.description}
          </p>
        </div>
      </Card>
    </Link>
  );
}
