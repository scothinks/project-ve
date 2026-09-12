"use client";
import { useEffect } from "react";
import { seedProgressHint } from "@/features/entry/progress-sync";
// Compatibility with bookmarked or emailed links from the previous release.
export function SaveWelcomeProgress({next, revision}: {next: string; revision: string}) {
  useEffect(() => {
    seedProgressHint(revision);
    window.location.replace(next);
  }, [next, revision]);
  return null;
}
