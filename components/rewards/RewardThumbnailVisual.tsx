"use client";

import { useState } from "react";
import { TablerRewardIcon } from "@/components/rewards/TablerRewardIcon";
import { getRewardIconNameFromLegacy, type RewardIconName } from "@/lib/reward-icons";
import type { RewardThumbnail } from "@/lib/rewards";
import { cn } from "@/lib/utils";

type RewardThumbnailVisualProps = {
  thumbnail: RewardThumbnail;
  title: string;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  imageClassName?: string;
  defaultColor?: string;
};

function isHexColor(value: string | undefined | null): value is string {
  return Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value));
}

function mixHexColors(primary: string, secondary: string, ratio: number) {
  const safeRatio = Math.max(0, Math.min(1, ratio));
  const primaryChannels = primary.match(/[0-9a-fA-F]{2}/g)?.map((part) => Number.parseInt(part, 16));
  const secondaryChannels = secondary.match(/[0-9a-fA-F]{2}/g)?.map((part) => Number.parseInt(part, 16));

  if (!primaryChannels || !secondaryChannels || primaryChannels.length !== 3 || secondaryChannels.length !== 3) {
    return secondary;
  }

  const mixed = primaryChannels.map((value, index) =>
    Math.round(value * safeRatio + secondaryChannels[index]! * (1 - safeRatio)),
  );

  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function getInitialsFallback(title: string) {
  const cleaned = title.trim();

  if (!cleaned) {
    return "VE";
  }

  if (cleaned.toLowerCase().includes("xp")) {
    return "XP";
  }

  return cleaned.slice(0, 4).toUpperCase();
}

export function RewardThumbnailVisual({
  thumbnail,
  title,
  className,
  iconClassName,
  textClassName,
  imageClassName,
  defaultColor = "#f4fbf7",
}: RewardThumbnailVisualProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const legacyIconName = getRewardIconNameFromLegacy(thumbnail.icon);
  const accentColor = isHexColor(thumbnail.color) ? thumbnail.color : undefined;
  const backgroundColor = accentColor
    ? mixHexColors(accentColor, "#ffffff", 0.14)
    : defaultColor;
  const iconName =
    thumbnail.iconSet === "tabler" && thumbnail.iconName
      ? (thumbnail.iconName as RewardIconName)
      : legacyIconName;
  const fallbackText = thumbnail.icon ?? getInitialsFallback(title);

  if (thumbnail.url && !imageFailed) {
    return (
      <img
        alt=""
        className={cn("h-full w-full object-cover", imageClassName)}
        onError={() => setImageFailed(true)}
        src={thumbnail.url}
      />
    );
  }

  return (
    <div
      className={cn("grid h-full w-full place-items-center", className)}
      style={{ backgroundColor }}
    >
      {iconName ? (
        <TablerRewardIcon
          className={cn("h-[55%] w-[55%] text-[var(--ve-green)]", iconClassName)}
          name={iconName}
          stroke={1.9}
          style={accentColor ? { color: accentColor } : undefined}
        />
      ) : (
        <span
          className={cn("text-[11px] font-black text-[var(--ve-green)]", textClassName)}
          style={accentColor ? { color: accentColor } : undefined}
        >
          {fallbackText}
        </span>
      )}
    </div>
  );
}
