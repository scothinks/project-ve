import "server-only";
import { cookies } from "next/headers";
import { getOAuthSignupProofSecret } from "@/lib/security-env";
import { decodeReceipt, receiptCookie } from "./receipt";
import { progressAckCookie, progressRevision } from "./progress-sync";
export async function readWelcomeReceipt() {
  const jar = await cookies();
  const token = jar.get(receiptCookie)?.value;
  // Optional XP context must not make login or recovery depend on XP configuration.
  try {
    const receipt = token ? decodeReceipt(token, getOAuthSignupProofSecret()) : null;
    return receipt && jar.get(progressAckCookie)?.value !== progressRevision(receipt) ? receipt : null;
  } catch { return null; }
}
