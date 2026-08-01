import "server-only";

import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { getFraudHashSalt, getTurnstileSecret } from "@/lib/security-env";

export function getIpAddress(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function getDeviceId(request: NextRequest) {
  return request.cookies.get("project-ve-device-id")?.value ?? null;
}

export function hashRiskValue(value: string | null | undefined) {
  if (!value || value === "unknown") {
    return null;
  }

  const salt = getFraudHashSalt();
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

export function getRiskContext(request: NextRequest) {
  const ipAddress = getIpAddress(request);
  const deviceId = getDeviceId(request);

  return {
    ipAddress,
    deviceId,
    ipHash: hashRiskValue(ipAddress),
    deviceHash: hashRiskValue(deviceId),
  };
}

function isLocalE2ETurnstileBypassEnabled() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  return (
    process.env.PROJECT_VE_LOCAL_E2E === "1" &&
    process.env.VERCEL !== "1" &&
    /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(supabaseUrl)
  );
}

export async function verifyTurnstileToken(token: string | null | undefined, ipAddress: string) {
  const secret = getTurnstileSecret();

  if (isLocalE2ETurnstileBypassEnabled()) {
    return true;
  }

  if (!secret) {
    return true;
  }

  if (!token) {
    return false;
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      secret,
      response: token,
      remoteip: ipAddress,
    }),
  });
  const data = (await response.json()) as { success?: boolean };

  return Boolean(data.success);
}
