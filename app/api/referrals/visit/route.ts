import { NextResponse } from "next/server";
import {
  getOptionalStringField,
  getStringField,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/request-validation";
import { createSupabaseAdminClient, getSupabaseAdminConfig } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const adminConfig = getSupabaseAdminConfig();

  if (!adminConfig.hasSupabaseUrl || !adminConfig.hasServiceRoleKey) {
    return NextResponse.json({ error: "Supabase admin access is not configured." }, { status: 503 });
  }

  const bodyResult = await readJsonObject(request);

  if (!bodyResult.ok) {
    return validationErrorResponse(bodyResult.issues);
  }

  const issues: ValidationIssue[] = [];
  const code = getStringField(bodyResult.data, "code", issues);
  const visitorKey = getStringField(bodyResult.data, "visitorKey", issues);
  const userAgent = getOptionalStringField(bodyResult.data, "userAgent", issues);

  if (issues.length > 0 || !code || !visitorKey) {
    return validationErrorResponse(issues);
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data, error } = await adminSupabase.rpc("track_referral_link_visit", {
    p_referral_code: code,
    p_user_agent: userAgent ?? undefined,
    p_visitor_key: visitorKey,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data, ok: true });
}
