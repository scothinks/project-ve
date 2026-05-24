"use client";

import { useEffect } from "react";

const referralStorageKey = "project-ve-referral-code";
const referralVisitorStorageKey = "project-ve-referral-visitor-key";

type ReferralCodeCaptureProps = {
  code: string;
};

export function ReferralCodeCapture({ code }: ReferralCodeCaptureProps) {
  useEffect(() => {
    window.localStorage.setItem(referralStorageKey, code);

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
        code,
        visitorKey,
        userAgent: window.navigator.userAgent,
      }),
    }).catch(() => undefined);
  }, [code]);

  return null;
}
