import { NextRequest, NextResponse } from "next/server";
import { getRiskContext, hashRiskValue } from "@/lib/auth-risk";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type AdEventBody = {
  eventType?: "impression" | "viewable_impression";
  decisionId?: string;
  eventDedupeKey?: string;
  clientEventTime?: string;
  metadata?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as AdEventBody;

  if (body.eventType !== "impression" && body.eventType !== "viewable_impression") {
    return NextResponse.json({ error: "Unsupported ad event type." }, { status: 400 });
  }

  if (!body.decisionId) {
    return NextResponse.json({ error: "decisionId is required." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Ads tracking is unavailable." }, { status: 503 });
  }

  const { ipHash, deviceHash } = getRiskContext(request);
  const userAgentHash = hashRiskValue(request.headers.get("user-agent"));
  const { data, error } = await supabase.rpc("record_ad_event", {
    p_event_type: body.eventType,
    p_decision_id: body.decisionId,
    p_event_dedupe_key: body.eventDedupeKey ?? null,
    p_client_event_time: body.clientEventTime ?? null,
    p_ip_hash: ipHash,
    p_device_hash: deviceHash,
    p_user_agent_hash: userAgentHash,
    p_metadata: body.metadata ?? {},
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data ?? { status: "recorded" });
}
