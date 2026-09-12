import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { isWelcomeTopic, type WelcomeTopic } from "./topics.ts";
export const receiptCookie = "ve-welcome-progress";
export const receiptLifetime = 60 * 60 * 24 * 30;
export type WelcomeReceipt = { purpose: "welcome-v1"; id: string; exp: number; learned: WelcomeTopic[]; completed: WelcomeTopic[] };
export function newReceipt(now = Date.now()): WelcomeReceipt {
  return { purpose: "welcome-v1", id: randomUUID(), exp: Math.floor(now / 1000) + receiptLifetime, learned: [], completed: [] };
}
function signature(value: string, secret: string) {
  if (!secret) throw new Error("Welcome receipt signing is unavailable.");
  return createHmac("sha256", secret).update("welcome-progress:v1:" + value).digest("base64url");
}
export function encodeReceipt(receipt: WelcomeReceipt, secret: string) {
  const payload = Buffer.from(JSON.stringify(receipt)).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}
export function decodeReceipt(token: string | undefined, secret: string, now = Date.now()): WelcomeReceipt | null {
  if (!token || token.length > 4096) return null;
  try {
    const [payload, sig, extra] = token.split(".");
    if (!payload || !sig || extra) return null;
    const expected = Buffer.from(signature(payload, secret)); const actual = Buffer.from(sig);
    if (actual.length !== expected.length || !timingSafeEqual(expected, actual)) return null;
    const r = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (r.purpose !== "welcome-v1" || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(r.id) || !Number.isInteger(r.exp) || r.exp <= now / 1000 || r.exp > now / 1000 + receiptLifetime + 60) return null;
    for (const list of [r.learned, r.completed]) if (!Array.isArray(list) || list.length > 3 || list.some(x => !isWelcomeTopic(x)) || new Set(list).size !== list.length) return null;
    if (r.completed.some((x: WelcomeTopic) => !r.learned.includes(x))) return null;
    return r;
  } catch { return null; }
}
