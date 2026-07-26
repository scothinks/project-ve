import { NextRequest, NextResponse } from "next/server";
import { getRiskContext, hashRiskValue } from "@/lib/auth-risk";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type ClickRouteProps = {
  params: Promise<{ decisionId: string }>;
};

function isSafeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest, { params }: ClickRouteProps) {
  const { decisionId } = await params;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const { data: target, error: targetError } = await supabase.rpc("get_ad_click_target", {
    p_decision_id: decisionId,
  });
  const ctaUrl = (target as { ctaUrl?: string } | null)?.ctaUrl;

  if (targetError || !ctaUrl || !isSafeHttpsUrl(ctaUrl)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const { ipHash, deviceHash } = getRiskContext(request);
  const userAgentHash = hashRiskValue(request.headers.get("user-agent"));
  const eventDedupeKey = `click:${decisionId}:${Date.now()}`;

  await supabase.rpc("record_ad_event", {
    p_event_type: "click",
    p_decision_id: decisionId,
    p_event_dedupe_key: eventDedupeKey,
    p_client_event_time: new Date().toISOString(),
    p_ip_hash: ipHash,
    p_device_hash: deviceHash,
    p_user_agent_hash: userAgentHash,
    p_metadata: {
      referrer: request.headers.get("referer"),
    },
  });

  return NextResponse.redirect(ctaUrl);
}
