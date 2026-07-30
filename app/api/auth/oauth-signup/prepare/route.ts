import { NextRequest, NextResponse } from "next/server";
import { getRiskContext, verifyTurnstileToken } from "@/lib/auth-risk";
import { setOAuthSignupProofCookie } from "@/lib/oauth-signup-proof";
import {
  getOptionalStringField,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/request-validation";
import { assertRequiredSecurityEnv } from "@/lib/security-env";

export async function POST(request: NextRequest) {
  assertRequiredSecurityEnv("OAuth signup prepare");

  const bodyResult = await readJsonObject(request);

  if (!bodyResult.ok) {
    return validationErrorResponse(bodyResult.issues);
  }

  const issues: ValidationIssue[] = [];
  const captchaToken = getOptionalStringField(bodyResult.data, "captchaToken", issues);

  if (issues.length > 0) {
    return validationErrorResponse(issues);
  }

  const { ipAddress, ipHash, deviceHash } = getRiskContext(request);
  const captchaPassed = await verifyTurnstileToken(captchaToken, ipAddress);

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
