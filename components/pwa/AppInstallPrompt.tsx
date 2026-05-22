"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "ve_install_prompt_dismissed_until";
const DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function isIosDevice(userAgent: string) {
  return /iphone|ipad|ipod/i.test(userAgent);
}

function isStandaloneMode() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function AppInstallPrompt() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosPrompt, setShowIosPrompt] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [standalone, setStandalone] = useState(true);

  const hiddenRoute = useMemo(
    () => pathname.startsWith("/admin") || pathname.startsWith("/login"),
    [pathname],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setStandalone(isStandaloneMode());
    const dismissedUntil = Number(window.localStorage.getItem(DISMISS_KEY) ?? "0");
    setDismissed(dismissedUntil > Date.now());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (!isStandaloneMode()) {
        setDeferredPrompt(event as BeforeInstallPromptEvent);
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const standaloneMode = isStandaloneMode();
    setStandalone(standaloneMode);

    if (standaloneMode) {
      setShowIosPrompt(false);
      return;
    }

    const userAgent = window.navigator.userAgent;
    const isIos = isIosDevice(userAgent);
    const isSafari = /safari/i.test(userAgent) && !/crios|fxios|edgios/i.test(userAgent);
    setShowIosPrompt(isIos && isSafari);
  }, []);

  function dismissPrompt() {
    const until = Date.now() + DISMISS_WINDOW_MS;
    window.localStorage.setItem(DISMISS_KEY, String(until));
    setDismissed(true);
    setShowIosHelp(false);
  }

  async function installApp() {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
      dismissPrompt();
    }
  }

  const shouldShow =
    !hiddenRoute && !dismissed && !standalone && (Boolean(deferredPrompt) || showIosPrompt);

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-[420px] rounded-[22px] border border-[#efe7da] bg-[var(--ve-shell)] p-4 shadow-[0_18px_40px_rgba(16,16,16,0.14)]">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#087f5b]">
              Install
            </p>
            <p className="mt-1 text-sm font-black text-[var(--foreground)]">
              Save Project VE to your home screen.
            </p>
          </div>

          {deferredPrompt ? (
            <Button className="h-10 shrink-0 px-5 text-sm" onClick={installApp} type="button">
              Install
            </Button>
          ) : (
            <button
              className="shrink-0 rounded-full border border-[var(--ve-line)] px-4 py-2 text-sm font-black text-[var(--foreground)]"
              onClick={() => setShowIosHelp((current) => !current)}
              type="button"
            >
              How
            </button>
          )}

          <button
            aria-label="Dismiss install prompt"
            className="h-9 w-9 shrink-0 rounded-full bg-[var(--ve-panel)] text-lg font-black text-[var(--ve-muted-strong)]"
            onClick={dismissPrompt}
            type="button"
          >
            ×
          </button>
        </div>

        {showIosPrompt && showIosHelp ? (
          <div className="mt-3 rounded-[18px] border border-[#efe7da] bg-[var(--ve-panel)] px-4 py-3">
            <p className="text-sm font-semibold leading-6 text-[#575757]">
              In Safari, tap <span className="font-black text-[var(--foreground)]">Share</span>, then choose{" "}
              <span className="font-black text-[var(--foreground)]">Add to Home Screen</span>.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
