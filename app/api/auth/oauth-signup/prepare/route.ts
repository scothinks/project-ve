import { NextRequest, NextResponse } from "next/server";
import { getRiskContext, verifyTurnstileToken } from "@/lib/auth-risk";
import { setOAuthSignupProofCookie } from "@/lib/oauth-signup-proof";

type PrepareOAuthSignupBody = {
  captchaToken?: string | null;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as PrepareOAuthSignupBody;
  const { ipAddress, ipHash, deviceHash } = getRiskContext(request);
  const captchaPassed = await verifyTurnstileToken(body.captchaToken, ipAddress);

  if (!captchaPassed) {
    return NextResponse.json(
      { error: "Please complete the signup check and try again." },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ ok: true });
  setOAuthSignupProofCookie(response, { ipHash, deviceHash });
  return response;
}
