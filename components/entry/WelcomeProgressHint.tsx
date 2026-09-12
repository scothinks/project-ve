"use client";
import { useEffect } from "react";
import { seedProgressHint } from "@/features/entry/progress-sync";
// Compatibility for receipts created before the background worker was deployed.
export function WelcomeProgressHint({ revision }: { revision: string }) {
  useEffect(() => { seedProgressHint(revision); }, [revision]);
  return null;
}
