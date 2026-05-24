import "server-only";

import { createHash } from "crypto";
import type { NextRequest } from "next/server";

const localRiskSalt = "project-ve-local-risk-salt";

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

  const salt = process.env.FRAUD_HASH_SALT ?? localRiskSalt;
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

export async function verifyTurnstileToken(token: string | null | undefined, ipAddress: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

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
