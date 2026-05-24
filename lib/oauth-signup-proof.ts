import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

type OAuthSignupProofPayload = {
  purpose: "oauth-signup";
  iat: number;
  exp: number;
  ipHash: string | null;
  deviceHash: string | null;
  nonce: string;
};

const cookieName = "project-ve-oauth-signup-proof";
const maxAgeSeconds = 60 * 10;
const localProofSecret = "project-ve-local-oauth-proof-secret";

function getProofSecret() {
  return process.env.FRAUD_HASH_SALT ?? process.env.TURNSTILE_SECRET_KEY ?? localProofSecret;
}

function sign(value: string) {
  return createHmac("sha256", getProofSecret()).update(value).digest("base64url");
}

function encodePayload(payload: OAuthSignupProofPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value: string) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as OAuthSignupProofPayload;
  } catch {
    return null;
  }
}

function getCookieOptions(maxAge = maxAgeSeconds) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function setOAuthSignupProofCookie(
  response: NextResponse,
  {
    ipHash,
    deviceHash,
  }: {
    ipHash: string | null;
    deviceHash: string | null;
  },
) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: OAuthSignupProofPayload = {
    purpose: "oauth-signup",
    iat: issuedAt,
    exp: issuedAt + maxAgeSeconds,
    ipHash,
    deviceHash,
    nonce: crypto.randomUUID(),
  };
  const encodedPayload = encodePayload(payload);
  const token = `${encodedPayload}.${sign(encodedPayload)}`;

  response.cookies.set(cookieName, token, getCookieOptions());
}

export function clearOAuthSignupProofCookie(response: NextResponse) {
  response.cookies.set(cookieName, "", getCookieOptions(0));
}

export function readOAuthSignupProofCookie(request: NextRequest) {
  const token = request.cookies.get(cookieName)?.value;

  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  const payload = decodePayload(encodedPayload);

  if (!payload || payload.purpose !== "oauth-signup") {
    return null;
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}
