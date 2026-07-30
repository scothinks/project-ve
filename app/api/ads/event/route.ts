import { NextRequest, NextResponse } from "next/server";
import { getRiskContext, hashRiskValue } from "@/lib/auth-risk";
import {
  getEnumField,
  getObjectField,
  getOptionalStringField,
  getStringField,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/request-validation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { asSupabaseJson, nullableRpcText } from "@/lib/supabase-rpc";

export async function POST(request: NextRequest) {
  const bodyResult = await readJsonObject(request);

  if (!bodyResult.ok) {
    return validationErrorResponse(bodyResult.issues);
  }

  const issues: ValidationIssue[] = [];
  const eventType = getEnumField(
    bodyResult.data,
    "eventType",
    ["impression", "viewable_impression"],
    issues,
  );
  const decisionId = getStringField(bodyResult.data, "decisionId", issues);
  const eventDedupeKey = getOptionalStringField(bodyResult.data, "eventDedupeKey", issues);
  const clientEventTime = getOptionalStringField(bodyResult.data, "clientEventTime", issues);
  const metadata = getObjectField(bodyResult.data, "metadata", issues, { required: false }) ?? {};

  if (issues.length > 0 || !eventType || !decisionId) {
    return validationErrorResponse(issues);
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Ads tracking is unavailable." }, { status: 503 });
  }

  const { ipHash, deviceHash } = getRiskContext(request);
  const userAgentHash = hashRiskValue(request.headers.get("user-agent"));
  const { data, error } = await supabase.rpc("record_ad_event", {
    p_event_type: eventType,
    p_decision_id: decisionId,
    p_event_dedupe_key: nullableRpcText(eventDedupeKey),
    p_client_event_time: nullableRpcText(clientEventTime),
    p_ip_hash: nullableRpcText(ipHash),
    p_device_hash: nullableRpcText(deviceHash),
    p_user_agent_hash: nullableRpcText(userAgentHash),
    p_metadata: asSupabaseJson(metadata),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data ?? { status: "recorded" });
}
