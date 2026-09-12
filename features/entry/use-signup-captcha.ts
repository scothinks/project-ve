"use client";
import { useEffect, useState } from "react";
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
declare global {
  interface Window {
    turnstile?: {
      render: (
        selector: string,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

export function useSignupCaptcha(enabled: boolean) {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [turnstileWidgetId, setTurnstileWidgetId] = useState<string | null>(null);
  useEffect(() => {
    if (!turnstileSiteKey || !enabled) return;
    let widget: string | undefined; let disposed = false;
    function render() {
      if (disposed || widget || !window.turnstile || !document.getElementById("project-ve-turnstile")) return;
      widget = window.turnstile.render("#project-ve-turnstile", {
        sitekey: turnstileSiteKey as string,
        callback: setCaptchaToken,
        "expired-callback": () => setCaptchaToken(null),
        "error-callback": () => setCaptchaToken(null),
      });
      setTurnstileWidgetId(widget);
    }
    let script = document.getElementById("project-ve-turnstile-script") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script"); script.id = "project-ve-turnstile-script";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true; script.defer = true; document.body.append(script);
    }
    script.addEventListener("load", render); render();
    return () => { disposed = true; script?.removeEventListener("load", render); if(widget) window.turnstile?.remove?.(widget); setTurnstileWidgetId(null); setCaptchaToken(null); };
  }, [enabled]);

return {captchaToken, setCaptchaToken, turnstileWidgetId};
}
