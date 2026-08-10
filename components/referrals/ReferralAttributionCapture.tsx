"use client";

import { useEffect, useMemo } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  contextualReferralStorageKey,
  normalizeReferralInviteKind,
  normalizeReferralInviteToken,
  publicReferralStorageKey,
  referralKindStorageKey,
} from "@/lib/referral-invites";

const referralAttemptedStorageKey = "project-ve-referral-code-attempted";

export function ReferralAttributionCapture() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    async function applyReferral() {
      const params = new URLSearchParams(window.location.search);
      const queryKind = params.get("refKind");
      const storedKind = window.localStorage.getItem(referralKindStorageKey);
      const kind = normalizeReferralInviteKind(queryKind ?? storedKind);
      const storageKey = kind === "contextual" ? contextualReferralStorageKey : publicReferralStorageKey;
      const rawCode = params.get("ref") ?? window.localStorage.getItem(storageKey);
      const code = rawCode ? normalizeReferralInviteToken(rawCode, kind) : "";

      if (!code) {
        return;
      }

      const attemptedKey = `${kind}:${code}`;

      if (window.sessionStorage.getItem(referralAttemptedStorageKey) === attemptedKey) {
        return;
      }

      window.sessionStorage.setItem(referralAttemptedStorageKey, attemptedKey);

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
          referralKind: kind,
          referredUserHint,
        }),
      });

      if (response.ok) {
        window.localStorage.removeItem(publicReferralStorageKey);
        window.localStorage.removeItem(contextualReferralStorageKey);
        window.localStorage.removeItem(referralKindStorageKey);
        window.sessionStorage.removeItem(referralAttemptedStorageKey);
        return;
      }

      if (response.status === 400) {
        window.localStorage.removeItem(storageKey);
      }
    }

    void applyReferral().catch(() => undefined);
  }, [supabase]);

  return null;
}
