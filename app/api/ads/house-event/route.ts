import { NextRequest, NextResponse } from "next/server";
import { getRiskContext, hashRiskValue } from "@/lib/auth-risk";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type HouseAdEventBody = {
  eventType?: "impression" | "viewable_impression" | "click";
  fallbackKey?: string;
  placementKey?: string;
  eventDedupeKey?: string;
  clientEventTime?: string;
  metadata?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as HouseAdEventBody;

  if (
    body.eventType !== "impression" &&
    body.eventType !== "viewable_impression" &&
    body.eventType !== "click"
  ) {
    return NextResponse.json({ error: "Unsupported house ad event type." }, { status: 400 });
  }

  if (!body.fallbackKey || !body.placementKey) {
    return NextResponse.json(
      { error: "fallbackKey and placementKey are required." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "House ad tracking is unavailable." }, { status: 503 });
  }

  const { ipHash, deviceHash } = getRiskContext(request);
  const userAgentHash = hashRiskValue(request.headers.get("user-agent"));
  const { data, error } = await supabase.rpc("record_ad_house_fallback_event", {
    p_event_type: body.eventType,
    p_fallback_key: body.fallbackKey,
    p_placement_key: body.placementKey,
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
