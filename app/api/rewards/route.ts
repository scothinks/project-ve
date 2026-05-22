import { NextResponse } from "next/server";
import { demoRewardStoreSnapshot } from "@/lib/rewards";
import { getRewardStoreSnapshot } from "@/lib/supabase-rewards";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message = typeof record.message === "string" ? record.message : "";
    const details = typeof record.details === "string" ? record.details : "";

    if (message && /visibility_mode|distribution_mode|perk_bundle_prizes|redeem_perk_bundle/i.test(message + details)) {
      return "XP Store setup is incomplete. Apply the latest database migrations and reload.";
    }

    if (message) {
      return message;
    }
  }

  return "Could not load XP Store.";
}

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json(demoRewardStoreSnapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const [{ user, profile }, supabase] = await Promise.all([
    getCurrentUserProfile(),
    createSupabaseServerClient(),
  ]);

  if (!user || !profile || !supabase) {
    return NextResponse.json({ error: "Please sign in to use the XP Store." }, { status: 401 });
  }

  try {
    const snapshot = await getRewardStoreSnapshot(
      supabase,
      user.id,
      profile.xp_balance_cached ?? 0,
    );

    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
