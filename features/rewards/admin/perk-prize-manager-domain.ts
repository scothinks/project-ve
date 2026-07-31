import type { AdminPerkPrizeRow } from "@/lib/admin";
import { getRewardThumbnailEditorState } from "../../../lib/reward-icons.ts";

export type PrizeType = "reward" | "native_xp" | "xp_boost";

export function toDateInputValue(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

export function describePrize(prize: AdminPerkPrizeRow) {
  if (prize.prize_type === "reward") {
    return prize.source_reward?.title ?? prize.source_reward_id ?? "Linked reward";
  }

  if (prize.prize_type === "native_xp") {
    return `${Number(prize.config.amount ?? 0)} XP bonus`;
  }

  return `${Number(prize.config.multiplier ?? 0)}x XP boost`;
}

export function prizeTypeLabel(prizeType: PrizeType) {
  if (prizeType === "reward") return "Real reward";
  if (prizeType === "native_xp") return "Bonus XP";
  return "XP boost";
}

export function getNativeXpDefaultTitle(amount: number) {
  return amount > 0 ? `+${amount} XP` : "Bonus XP";
}

export function getXpBoostDefaultTitle(multiplier: number) {
  return multiplier > 0 ? `${multiplier}x XP Boost` : "XP Boost";
}

export function getPerkPrizeThumbnailDefaults(prize: AdminPerkPrizeRow) {
  const color = typeof prize.thumbnail?.color === "string" ? prize.thumbnail.color : "";
  const { iconName, legacyIcon } = getRewardThumbnailEditorState({
    icon: typeof prize.thumbnail?.icon === "string" ? prize.thumbnail.icon : undefined,
    iconSet: prize.thumbnail?.iconSet === "tabler" ? "tabler" : undefined,
    iconName: typeof prize.thumbnail?.iconName === "string" ? prize.thumbnail.iconName : undefined,
    color,
  });

  return {
    color,
    iconName,
    legacyIcon,
  };
}

export function canSavePrizeDetails(prize: AdminPerkPrizeRow) {
  return prize.prize_type !== "reward" || (prize.assigned_available ?? 0) > 0;
}

export function getFocusedPrizeNotice(focusedPrizeId: string | undefined, noticeCode: string | undefined, prizeId: string) {
  if (focusedPrizeId !== prizeId) return "";
  if (noticeCode === "prize-saved") return "Prize changes saved.";
  if (noticeCode === "prize-enabled") return "Prize enabled.";
  if (noticeCode === "prize-disabled") return "Prize disabled.";
  return "";
}

export function getAddPrizeHelperCopy(prizeType: PrizeType) {
  if (prizeType === "reward") {
    return "Add one or more real rewards into this perk. Save them first, then assign stock to each prize and tune release behavior only where needed.";
  }
  if (prizeType === "native_xp") {
    return "Add a lightweight XP outcome for consolation or quick wins.";
  }
  return "Add a temporary XP boost outcome without touching real reward inventory.";
}
