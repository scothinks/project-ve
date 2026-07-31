import { normalizeEmailInput, sanitizePlainTextInput } from "../../../lib/input-safety.ts";
import type { RewardRedemption, StoreReward } from "../../../lib/rewards.ts";

export type Tab = "store" | "history";

export const fulfillmentLabels: Record<StoreReward["fulfillmentType"], string> = {
  manual: "Details form",
  voucher_code: "Voucher code",
  qr_code: "QR pass",
  external_link: "Partner link",
  native: "Instant unlock",
};

export const distributionLabels: Record<StoreReward["distributionMode"], string> = {
  direct: "Direct reward",
  perk_bundle: "Surprise perk",
};

export const claimStateLabels: Record<RewardRedemption["claimState"], string> = {
  purchased: "Ready",
  claim_started: "Started",
  details_submitted: "Processing",
  fulfilled: "Fulfilled",
  expired: "Expired",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export function shouldShowRedemptionMessage(redemption: RewardRedemption) {
  if (
    redemption.fulfillmentType === "manual"
    && redemption.claimState === "details_submitted"
    && redemption.userMessage === "Submitted for processing."
  ) {
    return false;
  }

  if (
    (redemption.fulfillmentType === "voucher_code" && redemption.userMessage === "Your voucher code is ready.")
    || (redemption.fulfillmentType === "qr_code" && redemption.userMessage === "Your QR pass is ready.")
    || (redemption.fulfillmentType === "external_link" && redemption.userMessage === "Your reward link is ready.")
    || (redemption.fulfillmentType === "native" && redemption.userMessage === "Your native reward has been applied.")
  ) {
    return false;
  }

  return Boolean(redemption.userMessage);
}

export function getNativeOutcomeDetails(redemption: RewardRedemption) {
  const payload = redemption.fulfillmentPayload;
  const amount = Number(payload.amount ?? 0);
  const multiplier = Number(payload.multiplier ?? 0);
  const durationHours = Number(payload.durationHours ?? 0);
  const uses = Number(payload.uses ?? 0);

  if (multiplier > 0) {
    const durationCopy =
      durationHours > 0
        ? ` for ${durationHours} hour${durationHours === 1 ? "" : "s"}`
        : "";
    const usesCopy = uses > 0 ? ` and ${uses} use${uses === 1 ? "" : "s"}` : "";

    return {
      eyebrow: "Boost Unlocked",
      emphasis: `${multiplier}x XP`,
      description: `${multiplier}x XP boost is now active${durationCopy}${usesCopy}.`,
    };
  }

  return {
    eyebrow: "XP Unlocked",
    emphasis: amount > 0 ? `+${amount} XP` : redemption.rewardTitle,
    description: amount > 0
      ? `${amount} XP has been added to your balance.`
      : "This XP reward has been added to your balance.",
  };
}

export function parseText(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function sanitizeFieldValue(value: string, type: string) {
  if (type === "email") {
    return normalizeEmailInput(value);
  }

  return sanitizePlainTextInput(value, type === "textarea" ? 2000 : 500);
}

export function buildPseudoQrSvg(value: string) {
  const size = 29;
  const quietZone = 2;
  const cell = 6;
  const fullSize = (size + quietZone * 2) * cell;
  const bytes = Array.from(new TextEncoder().encode(value || "PROJECT-VE-PASS"));
  let seed = bytes.reduce((total, byte, index) => (total * 131 + byte + index) >>> 0, 2166136261);
  const rects: string[] = [];

  const hasFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);

  const drawCell = (x: number, y: number) => {
    rects.push(
      `<rect x="${(x + quietZone) * cell}" y="${(y + quietZone) * cell}" width="${cell}" height="${cell}" rx="1" ry="1" />`,
    );
  };

  const drawFinder = (startX: number, startY: number) => {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const edge = x === 0 || x === 6 || y === 0 || y === 6;
        const center = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (edge || center) {
          drawCell(startX + x, startY + y);
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (hasFinder(x, y)) {
        continue;
      }

      seed = (seed * 1664525 + 1013904223) >>> 0;
      const byte = bytes[(x + y) % bytes.length] ?? 0;
      const shouldFill = ((seed >>> 28) ^ byte ^ x ^ (y << 1)) % 2 === 0;

      if (shouldFill) {
        drawCell(x, y);
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fullSize} ${fullSize}" fill="none"><rect width="${fullSize}" height="${fullSize}" rx="24" fill="#ffffff"/><g fill="#111111">${rects.join("")}</g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
