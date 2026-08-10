"use client";

import { useEffect } from "react";
import {
  contextualReferralStorageKey,
  normalizeReferralInviteKind,
  normalizeReferralInviteToken,
  publicReferralStorageKey,
  referralKindStorageKey,
  type ReferralInviteKind,
} from "@/lib/referral-invites";

const referralVisitorStorageKey = "project-ve-referral-visitor-key";

type ReferralCodeCaptureProps = {
  code: string;
  kind?: ReferralInviteKind;
};

export function ReferralCodeCapture({ code, kind = "public" }: ReferralCodeCaptureProps) {
  useEffect(() => {
    const inviteKind = normalizeReferralInviteKind(kind);
    const token = normalizeReferralInviteToken(code, inviteKind);

    if (!token) {
      return;
    }

    window.localStorage.setItem(referralKindStorageKey, inviteKind);

    if (inviteKind === "contextual") {
      window.localStorage.setItem(contextualReferralStorageKey, token);
      window.localStorage.removeItem(publicReferralStorageKey);
      return;
    }

    window.localStorage.setItem(publicReferralStorageKey, token);
    window.localStorage.removeItem(contextualReferralStorageKey);

    const visitorKey = (() => {
      const existing = window.localStorage.getItem(referralVisitorStorageKey);

      if (existing) {
        return existing;
      }

      const next =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `referral-visitor-${Date.now()}`;
      window.localStorage.setItem(referralVisitorStorageKey, next);
      return next;
    })();

    void fetch("/api/referrals/visit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: token,
        visitorKey,
        userAgent: window.navigator.userAgent,
      }),
    }).catch(() => undefined);
  }, [code, kind]);

  return null;
}
