"use client";

import { useEffect } from "react";

const referralStorageKey = "project-ve-referral-code";

type ReferralCodeCaptureProps = {
  code: string;
};

export function ReferralCodeCapture({ code }: ReferralCodeCaptureProps) {
  useEffect(() => {
    window.localStorage.setItem(referralStorageKey, code);
  }, [code]);

  return null;
}
