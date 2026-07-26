"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

type HouseAdEventTrackerProps = {
  children: ReactNode;
  fallbackKey: string;
  placementKey: string;
};

type HouseEventType = "impression" | "viewable_impression" | "click";

async function postHouseAdEvent(
  eventType: HouseEventType,
  fallbackKey: string,
  placementKey: string,
) {
  const eventDedupeKey =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `house:${eventType}:${fallbackKey}:${crypto.randomUUID()}`
      : `house:${eventType}:${fallbackKey}:${Date.now()}:${Math.random().toString(16).slice(2)}`;

  await fetch("/api/ads/house-event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventType,
      fallbackKey,
      placementKey,
      eventDedupeKey,
      clientEventTime: new Date().toISOString(),
      metadata: {
        route: window.location.pathname,
      },
    }),
    keepalive: true,
  }).catch(() => undefined);
}

export function HouseAdEventTracker({
  children,
  fallbackKey,
  placementKey,
}: HouseAdEventTrackerProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const impressionSentRef = useRef(false);
  const viewableSentRef = useRef(false);
  const clickSentRef = useRef(false);

  useEffect(() => {
    if (impressionSentRef.current) return;
    impressionSentRef.current = true;
    void postHouseAdEvent("impression", fallbackKey, placementKey);
  }, [fallbackKey, placementKey]);

  useEffect(() => {
    const element = elementRef.current;

    if (!element || viewableSentRef.current || typeof IntersectionObserver === "undefined") {
      return;
    }

    let viewabilityTimer: ReturnType<typeof setTimeout> | null = null;
    const clearViewabilityTimer = () => {
      if (!viewabilityTimer) return;
      clearTimeout(viewabilityTimer);
      viewabilityTimer = null;
    };
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry || viewableSentRef.current) return;

        if (document.visibilityState === "visible" && entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          viewabilityTimer ??= setTimeout(() => {
            if (document.visibilityState !== "visible") {
              clearViewabilityTimer();
              return;
            }

            viewableSentRef.current = true;
            observer.disconnect();
            void postHouseAdEvent("viewable_impression", fallbackKey, placementKey);
          }, 1000);
        } else {
          clearViewabilityTimer();
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        clearViewabilityTimer();
      }
    };

    observer.observe(element);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearViewabilityTimer();
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fallbackKey, placementKey]);

  return (
    <div
      onClickCapture={(event) => {
        if (clickSentRef.current) return;
        const target = event.target;

        if (!(target instanceof Element) || !target.closest("a")) return;

        clickSentRef.current = true;
        void postHouseAdEvent("click", fallbackKey, placementKey);
      }}
      ref={elementRef}
    >
      {children}
    </div>
  );
}
