import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function extractEndpoint(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  return typeof record.endpoint === "string" && record.endpoint.length > 0
    ? record.endpoint
    : null;
}

function extractDeviceKey(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function syncWebPushPreference(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  userId: string,
) {
  const { count } = await supabase
    .from("user_push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("disabled_at", null);

  await supabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: userId,
        web_push_enabled: (count ?? 0) > 0,
      },
      { onConflict: "user_id" },
    );
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const subscription = payload && typeof payload === "object"
    ? (payload as Record<string, unknown>).subscription
    : null;
  const deviceKey =
    payload && typeof payload === "object"
      ? extractDeviceKey((payload as Record<string, unknown>).deviceKey)
      : null;
  const userAgent =
    payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).userAgent === "string"
      ? String((payload as Record<string, unknown>).userAgent)
      : "";
  const endpoint = extractEndpoint(subscription);

  if (!endpoint || !subscription || !deviceKey) {
    return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  }

  await supabase
    .from("user_push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("device_key", deviceKey);

  const { error: subscriptionError } = await supabase
    .from("user_push_subscriptions")
    .insert({
      user_id: user.id,
      device_key: deviceKey,
      endpoint,
      subscription,
      user_agent: userAgent,
      last_seen_at: new Date().toISOString(),
      failure_count: 0,
      last_error: null,
      disabled_at: null,
    });

  if (subscriptionError) {
    return NextResponse.json({ error: subscriptionError.message }, { status: 400 });
  }

  await syncWebPushPreference(supabase, user.id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const deviceKey =
    payload && typeof payload === "object"
      ? extractDeviceKey((payload as Record<string, unknown>).deviceKey)
      : null;

  if (!deviceKey) {
    return NextResponse.json({ error: "Invalid device key." }, { status: 400 });
  }

  const { error: subscriptionError } = await supabase
    .from("user_push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("device_key", deviceKey);

  if (subscriptionError) {
    return NextResponse.json({ error: subscriptionError.message }, { status: 400 });
  }

  await syncWebPushPreference(supabase, user.id);

  return NextResponse.json({ ok: true });
}
