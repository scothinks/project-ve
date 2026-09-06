'use client';
import { useEffect, useState } from 'react';

// A silent stream must not prevent the delay notice from becoming visible.
export function useAuthoringDelay(active: boolean, updatedAt: string | undefined, thresholdMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return active && !!updatedAt && now - Date.parse(updatedAt) > thresholdMs;
}
