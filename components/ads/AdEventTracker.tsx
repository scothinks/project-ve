"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

type AdEventTrackerProps = {
  children: ReactNode;
  decisionId: string;
  format: string;
  placementKey: string;
};

async function postAdEvent(
  eventType: "impression" | "viewable_impression",
  decisionId: string,
  placementKey: string,
) {
  const eventDedupeKey =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `${eventType}:${decisionId}:${crypto.randomUUID()}`
      : `${eventType}:${decisionId}:${Date.now()}:${Math.random().toString(16).slice(2)}`;

  await fetch("/api/ads/event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventType,
      decisionId,
      eventDedupeKey,
      clientEventTime: new Date().toISOString(),
      metadata: {
        placementKey,
      },
    }),
    keepalive: true,
  }).catch(() => undefined);
}

export function AdEventTracker({ children, decisionId, format, placementKey }: AdEventTrackerProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const impressionSentRef = useRef(false);
  const viewableSentRef = useRef(false);

  useEffect(() => {
    if (impressionSentRef.current) return;
    impressionSentRef.current = true;
    void postAdEvent("impression", decisionId, placementKey);
  }, [decisionId, placementKey]);

  useEffect(() => {
    const element = elementRef.current;

    if (!element || viewableSentRef.current || typeof IntersectionObserver === "undefined") {
      return;
    }

    let viewabilityTimer: ReturnType<typeof setTimeout> | null = null;
    const viewabilityDurationMs = format === "video_card" ? 2000 : 1000;
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
            void postAdEvent("viewable_impression", decisionId, placementKey);
          }, viewabilityDurationMs);
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
  }, [decisionId, format, placementKey]);

  return <div ref={elementRef}>{children}</div>;
}
