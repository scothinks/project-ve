"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { pendingProgressRevision, progressSavedEvent, progressWakeEvent } from "@/features/entry/progress-sync";

export function WelcomeProgressSync() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    // Do not claim against a previous session while someone is switching accounts
    // or recovering a password. The destination starts work after authentication.
    if (pathname.startsWith("/login") || pathname.startsWith("/auth")) return;
    let stopped = false;
    let running = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function claim() {
      const revision = pendingProgressRevision();
      if (stopped || running || !navigator.onLine || !revision) return;
      running = true;
      let retry = false;
      try {
        const response = await fetch("/api/welcome/progress", {
          method: "POST", headers: {"Content-Type": "application/json"},
          body: JSON.stringify({action: "claim"}), keepalive: true,
          signal: AbortSignal.timeout(15000),
        });
        if (response.ok) {
          const data = await response.json();
          if (!stopped) {
            window.dispatchEvent(new CustomEvent(progressSavedEvent, {detail: data}));
            // Assessment and the open lesson retain their state and focus. Pages
            // that display the balance get fresh server HTML after a new award.
            if (data.awardedXp > 0 && ["/dashboard", "/xp-store", "/notifications"].includes(pathname)) router.refresh();
          }
          const remaining = pendingProgressRevision();
          if (remaining && remaining !== revision) attempts = 0;
          retry = Boolean(remaining);
        } else {
          // 401/403/409 await another navigation or browser wake; never hold auth.
          retry = response.status >= 500 || response.status === 429;
        }
      } catch { retry = true; }
      finally {
        running = false;
        if (!stopped && retry && attempts < 3) {
          timer = setTimeout(() => { void claim(); }, [2000, 10000, 30000][attempts++]);
        }
      }
    }
    function wake() {
      if (document.visibilityState === "hidden") return;
      clearTimeout(timer);
      attempts = 0;
      void claim();
    }
    wake();
    window.addEventListener(progressWakeEvent, wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener(progressWakeEvent, wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [pathname, router]);
  return null;
}
