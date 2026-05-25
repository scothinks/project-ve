"use client";

import { useEffect, useRef, useState } from "react";

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

export function SupportEmbed() {
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

  return (
    <div className="rounded-[20px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-5 py-5 shadow-sm">
      <div className="rounded-[16px] bg-[var(--ve-panel-soft)] px-4 py-3 text-sm font-semibold text-[var(--ve-muted-strong)]">
        Open the support form
      </div>

      <div className="mt-4 rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-card-subtle)] px-4 py-5">
        <p className="text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
          Tap the feedback button to open the YouTrack form.
        </p>
        <div
          className="mt-4 flex min-h-14 items-center justify-center"
          ref={buttonContainerRef}
        />
        {loadError ? (
          <p className="mt-3 text-sm font-semibold leading-6 text-[#d96b6b]">
            The support form button did not load. Refresh the page and try again.
          </p>
        ) : null}
      </div>
    </div>
  );
}
