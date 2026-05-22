"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

export function SupportEmbed() {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);

  useEffect(() => {
    if (scriptLoaded || scriptFailed) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setScriptFailed(true);
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, [scriptFailed, scriptLoaded]);

  return (
    <div className="rounded-[20px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-5 py-5 shadow-sm">
      {!scriptLoaded && !scriptFailed ? (
        <div className="rounded-[16px] bg-[var(--ve-panel-soft)] px-4 py-3 text-sm font-semibold text-[var(--ve-muted-strong)]">
          Loading support form...
        </div>
      ) : null}

      {scriptFailed ? (
        <div className="rounded-[16px] border border-[#f1d2d2] bg-[#fff0f0] px-4 py-3 text-sm font-semibold leading-6 text-[#8a3f3f]">
          The support form did not load. Refresh this page and try again. If it still does not
          appear, try again later.
        </div>
      ) : null}

      <div id="youtrack-support-form" className={scriptLoaded ? "min-h-[320px]" : "min-h-0"} />

      <Script
        id="c421907f-2c33-463a-8bac-f6c701537096"
        src="https://ayika.youtrack.cloud/static/simplified/form/form-entry.js"
        strategy="afterInteractive"
        data-yt-url="https://ayika.youtrack.cloud"
        data-theme="light"
        data-lang="en"
        onLoad={() => {
          setScriptLoaded(true);
          setScriptFailed(false);
        }}
        onError={() => {
          setScriptFailed(true);
        }}
      />
    </div>
  );
}
