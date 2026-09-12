import "server-only";
import { cookies } from "next/headers";
import { getOAuthSignupProofSecret } from "@/lib/security-env";
import { decodeReceipt, receiptCookie } from "./receipt";
import { getSafeAuthNextPath } from "@/lib/auth-redirect";
export async function readWelcomeReceipt() {
  const token = (await cookies()).get(receiptCookie)?.value;
  return token ? decodeReceipt(token, getOAuthSignupProofSecret()) : null;
}
export function welcomeSaveHref(next: string) {
  const safe = getSafeAuthNextPath(next);
  return `/welcome/save?next=${encodeURIComponent(safe.startsWith("/welcome/save") ? "/xp-store" : safe)}`;
}
