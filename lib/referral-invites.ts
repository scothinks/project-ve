import { normalizeReferralCodeInput, sanitizePlainTextInput } from "./input-safety.ts";

export const publicReferralStorageKey = "project-ve-referral-code";
export const contextualReferralStorageKey = "project-ve-contextual-referral-token";
export const referralKindStorageKey = "project-ve-referral-kind";

export type ReferralInviteKind = "public" | "contextual";

export function normalizeReferralInviteKind(value: string | null | undefined): ReferralInviteKind {
  return value === "contextual" ? "contextual" : "public";
}

export function normalizeReferralInviteToken(value: string, kind: ReferralInviteKind) {
  if (kind === "contextual") {
    return sanitizePlainTextInput(value, 96).replace(/[^a-zA-Z0-9_-]/g, "");
  }

  return normalizeReferralCodeInput(value);
}
