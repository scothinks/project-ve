"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChatIcon, SearchIcon } from "@/components/ui/Icons";
import { OpenExternalIcon } from "@/components/missions/MissionIcons";

declare global {
  interface Window {
    YTFeedbackForm?: {
      renderFeedbackButton: (
        container: HTMLElement,
        options: {
          backendURL: string;
          formUUID: string;
          theme: "light" | "dark";
          language: string;
        },
      ) => void;
    };
  }
}

const YOU_TRACK_BACKEND_URL = "https://ayika.youtrack.cloud";
const YOU_TRACK_FORM_ID = "c421907f-2c33-463a-8bac-f6c701537096";
const YOU_TRACK_SCRIPT_URL = `${YOU_TRACK_BACKEND_URL}/static/simplified/form/form-entry.js?auto=false`;

type SupportEmbedProps = {
  faqHref?: string;
};

export function SupportEmbed({ faqHref = "/faq" }: SupportEmbedProps) {
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => setTheme(mediaQuery.matches ? "dark" : "light");

    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);

    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, []);

  useEffect(() => {
    const container = buttonContainerRef.current;
    if (!container) return;

    container.innerHTML = "";
    setLoadError(false);

    const renderButton = () => {
      if (!window.YTFeedbackForm || !container) {
        setLoadError(true);
        return;
      }

      container.innerHTML = "";
      window.YTFeedbackForm.renderFeedbackButton(container, {
        backendURL: YOU_TRACK_BACKEND_URL,
        formUUID: YOU_TRACK_FORM_ID,
        theme,
        language: "en",
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${YOU_TRACK_SCRIPT_URL}"]`,
    );

    if (existingScript) {
      if (window.YTFeedbackForm) {
        renderButton();
      } else {
        existingScript.addEventListener("load", renderButton, { once: true });
        existingScript.addEventListener("error", () => setLoadError(true), { once: true });
      }

      return () => {
        existingScript.removeEventListener("load", renderButton);
      };
    }

    const script = document.createElement("script");
    script.src = YOU_TRACK_SCRIPT_URL;
    script.async = true;
    script.onload = renderButton;
    script.onerror = () => setLoadError(true);
    document.body.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [theme]);

  function openSupportForm() {
    buttonContainerRef.current?.querySelector<HTMLButtonElement>("button")?.click();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[20px] border border-black/5 bg-[var(--ve-panel)] p-5 lg:rounded-[24px] lg:bg-[var(--ve-card)] lg:p-10 lg:text-center lg:shadow-sm">
        <div className="flex items-center gap-3 lg:hidden">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--ve-green-soft)] text-[var(--ve-green)]">
            <ChatIcon className="size-5" />
          </span>
          <h2 className="text-lg font-black">Submit a Request</h2>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)] lg:mt-0 lg:text-base lg:leading-7">
          This will open the Project VE support request experience in a secure dialog where you
          can detail your issue.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row lg:justify-center">
          <div className="relative flex-1 sm:flex-none">
            <button
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--ve-green)] px-8 text-sm font-black text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
              onClick={openSupportForm}
              type="button"
            >
              Open support form
              <OpenExternalIcon className="size-[18px]" />
            </button>
            <div
              className="support-widget-mount absolute inset-0 opacity-0"
              ref={buttonContainerRef}
            />
          </div>
          <Link
            className="hidden min-h-12 items-center justify-center gap-2 rounded-[14px] border border-[var(--ve-green)] px-8 text-sm font-black text-[var(--ve-green)] transition hover:bg-[var(--ve-green-soft)] lg:inline-flex"
            href={faqHref}
          >
            Browse FAQs
          </Link>
        </div>
      </div>

      {loadError ? (
        <div className="flex items-start gap-2 rounded-[14px] border border-[#f1ddd7] bg-[#fff7f4] p-3">
          <p className="text-sm font-semibold leading-6 text-[#c94f2e]">
            The support form could not load. Refresh the page and try again.
          </p>
        </div>
      ) : null}

      <div className="flex justify-center lg:hidden">
        <Link
          className="inline-flex items-center gap-1.5 text-sm font-black text-[var(--ve-green)]"
          href={faqHref}
        >
          <SearchIcon className="size-4" />
          Browse FAQs instead
        </Link>
      </div>
    </div>
  );
}
