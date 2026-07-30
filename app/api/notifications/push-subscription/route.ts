import { NextResponse } from "next/server";
import {
  getObjectField,
  getOptionalStringField,
  getStringField,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/request-validation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { asSupabaseJson } from "@/lib/supabase-rpc";

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

  const bodyResult = await readJsonObject(request);

  if (!bodyResult.ok) {
    return validationErrorResponse(bodyResult.issues);
  }

  const issues: ValidationIssue[] = [];
  const subscription = getObjectField(bodyResult.data, "subscription", issues);
  const deviceKey = getStringField(bodyResult.data, "deviceKey", issues);
  const userAgent = getOptionalStringField(bodyResult.data, "userAgent", issues, {
    allowEmpty: true,
  }) ?? "";
  const endpoint = subscription ? getStringField(subscription, "endpoint", issues) : null;

  if (issues.length > 0 || !endpoint || !subscription || !deviceKey) {
    return validationErrorResponse(issues);
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
      subscription: asSupabaseJson(subscription),
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

  const bodyResult = await readJsonObject(request);

  if (!bodyResult.ok) {
    return validationErrorResponse(bodyResult.issues);
  }

  const issues: ValidationIssue[] = [];
  const deviceKey = getStringField(bodyResult.data, "deviceKey", issues);

  if (issues.length > 0 || !deviceKey) {
    return validationErrorResponse(issues);
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
