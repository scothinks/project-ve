import { getSafeAuthNextPath } from "./auth-redirect.ts";
import {
  normalizeReferralInviteKind,
  normalizeReferralInviteToken,
  type ReferralInviteKind,
} from "./referral-invites.ts";

export function buildConfirmedLoginPath({
  nextPath,
  referralCode,
  referralKind,
}: {
  nextPath?: string | string[] | null;
  referralCode?: string | null;
  referralKind?: ReferralInviteKind | string | null;
}) {
  const safeNextPath = getSafeAuthNextPath(nextPath);
  const kind = normalizeReferralInviteKind(referralKind);
  const safeReferralCode = referralCode
    ? normalizeReferralInviteToken(referralCode, kind)
    : "";
  const params = new URLSearchParams({
    confirmed: "1",
    next: safeNextPath,
  });

  if (safeReferralCode) {
    params.set("ref", safeReferralCode);
    if (kind === "contextual") {
      params.set("refKind", "contextual");
    }
  }

  return `/login?${params.toString()}`;
}
