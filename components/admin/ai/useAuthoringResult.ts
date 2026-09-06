"use client";
import { useEffect, useState } from "react";
import type { AuthoringResult } from "@/features/ai-generation/authoring/contracts";

export class AuthoringRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function authoringRequest<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/admin/ai/authoring", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new AuthoringRequestError(data.error ?? "This action could not be completed.", response.status);
  return data as T;
}

export function useAuthoringResult(id: string | undefined, active: boolean, onResult: (r: AuthoringResult) => void) {
  const [reconnecting, setReconnecting] = useState(false);
  useEffect(() => {
    if (!id || !active) return;
    let disposed = false;
    let polling = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      try {
        const response = await fetch(`/api/admin/ai/authoring?id=${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Result unavailable");
        const result = await response.json() as AuthoringResult;
        if (!disposed) { onResult(result); setReconnecting(false); }
      } catch { if (!disposed) setReconnecting(true); }
      if (!disposed && polling) timer = setTimeout(read, 5000);
    };
    void read();
    const stream = new EventSource(`/api/admin/ai/authoring/events?id=${encodeURIComponent(id)}`);
    stream.onmessage = (event) => { if (!disposed) { onResult(JSON.parse(event.data)); setReconnecting(false); } };
    const fallback = () => {
      stream.close();
      if (polling || disposed) return;
      polling = true;
      setReconnecting(true);
      timer = setTimeout(read, 2000);
    };
    stream.onerror = fallback;
    stream.addEventListener("unavailable", fallback);
    return () => { disposed = true; stream.close(); clearTimeout(timer); };
  }, [id, active, onResult]);
  return reconnecting;
}
