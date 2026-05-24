"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { BottomPromptCard } from "@/components/pwa/BottomPromptCard";
import { Button } from "@/components/ui/Button";
import {
  getCurrentPushSubscription,
  isPushSupported,
  subscribeCurrentDevice,
} from "@/lib/push-client";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type PromptSignal = {
  body: string;
  event_type: "first_xp_earned" | "free_xp_grant" | "referral_link_visited";
  id: string;
};

const DISMISSED_SIGNAL_KEY = "ve_push_prompt_dismissed_signal";

function getPromptCopy(signal: PromptSignal) {
  if (signal.event_type === "referral_link_visited") {
    return {
      eyebrow: "Notifications",
      message: "Someone opened your invite link. Enable alerts to know when invites succeed.",
      title: "Turn on push alerts",
    };
  }

  return {
    eyebrow: "Notifications",
    message:
      signal.event_type === "first_xp_earned"
        ? "You earned XP. Enable alerts to catch future XP and new opportunities."
        : "You just received XP. Enable alerts to catch future XP drops and important updates.",
    title: "Turn on push alerts",
  };
}

export function PushEnablePrompt() {
  const pathname = usePathname();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const [signal, setSignal] = useState<PromptSignal | null>(null);
  const [hidden, setHidden] = useState(true);
  const [managingPush, setManagingPush] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPromptState() {
      if (
        !supabase
        || !vapidPublicKey
        || !isPushSupported()
        || Notification.permission === "denied"
        || pathname.startsWith("/admin")
        || pathname.startsWith("/invite")
        || pathname.startsWith("/login")
      ) {
        if (!cancelled) {
          setHidden(true);
          setSignal(null);
        }
        return;
      }

      const subscription = await getCurrentPushSubscription().catch(() => null);

      if (subscription) {
        if (!cancelled) {
          setHidden(true);
          setSignal(null);
        }
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setHidden(true);
          setSignal(null);
        }
        return;
      }

      const { data, error } = await supabase
        .from("user_notifications")
        .select("id, event_type, body")
        .eq("user_id", user.id)
        .is("read_at", null)
        .in("event_type", ["free_xp_grant", "referral_link_visited", "first_xp_earned"])
        .order("created_at", { ascending: false })
        .limit(1)
        .returns<PromptSignal[]>();

      if (cancelled) {
        return;
      }

      if (error || !data || data.length === 0) {
        setHidden(true);
        setSignal(null);
        return;
      }

      const nextSignal = data[0];
      const dismissedSignalId = window.localStorage.getItem(DISMISSED_SIGNAL_KEY);

      if (dismissedSignalId === nextSignal.id) {
        setHidden(true);
        setSignal(nextSignal);
        return;
      }

      setSignal(nextSignal);
      setHidden(false);
    }

    void loadPromptState();

    return () => {
      cancelled = true;
    };
  }, [pathname, supabase, vapidPublicKey]);

  function dismissPrompt() {
    if (signal) {
      window.localStorage.setItem(DISMISSED_SIGNAL_KEY, signal.id);
    }

    setHidden(true);
  }

  async function enablePush() {
    if (!vapidPublicKey) {
      setMessage("Push notifications are not configured yet.");
      return;
    }

    setManagingPush(true);
    setMessage(null);

    try {
      await subscribeCurrentDevice(vapidPublicKey);
      setHidden(true);
      setSignal(null);
    } catch (errorValue) {
      setMessage(
        errorValue instanceof Error ? errorValue.message : "Could not enable push alerts.",
      );
    } finally {
      setManagingPush(false);
    }
  }

  if (hidden || !signal) {
    return null;
  }

  const copy = getPromptCopy(signal);

  return (
    <BottomPromptCard
      dismissAriaLabel="Dismiss push prompt"
      eyebrow={copy.eyebrow}
      onDismiss={dismissPrompt}
      title={copy.title}
      description={(
        <>
          <p>{copy.message}</p>
          {message ? (
            <p className="mt-2 text-xs font-bold text-[#b42318]">{message}</p>
          ) : null}
        </>
      )}
    >
      <div className="flex gap-3">
          <Button
            className="h-10 flex-1"
            disabled={managingPush}
            onClick={() => void enablePush()}
            type="button"
          >
            {managingPush ? "Enabling..." : "Enable alerts"}
          </Button>
          <Button
            className="h-10 px-4"
            onClick={dismissPrompt}
            type="button"
            variant="outline"
          >
            Not now
          </Button>
      </div>
    </BottomPromptCard>
  );
}
