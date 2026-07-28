"use client";

import { useEffect, useMemo } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const referralStorageKey = "project-ve-referral-code";
const referralAttemptedStorageKey = "project-ve-referral-code-attempted";

export function ReferralAttributionCapture() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    async function applyReferral() {
      const code =
        new URLSearchParams(window.location.search).get("ref") ??
        window.localStorage.getItem(referralStorageKey);

      if (!code) {
        return;
      }

      if (window.sessionStorage.getItem(referralAttemptedStorageKey) === code) {
        return;
      }

      window.sessionStorage.setItem(referralAttemptedStorageKey, code);

      let referredUserHint: string | undefined;

      if (supabase) {
        const { data } = await supabase.auth.getUser();
        referredUserHint = data.user?.id ?? data.user?.email ?? undefined;
      }

      const response = await fetch("/api/referrals/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          referralCode: code,
          referredUserHint,
        }),
      });

      if (response.ok) {
        window.localStorage.removeItem(referralStorageKey);
        window.sessionStorage.removeItem(referralAttemptedStorageKey);
        return;
      }

      if (response.status === 400) {
        window.localStorage.removeItem(referralStorageKey);
      }
    }

    void applyReferral().catch(() => undefined);
  }, [supabase]);

  return null;
}
