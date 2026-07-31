import { NextResponse } from "next/server";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";
import { isDemoMode } from "@/lib/app-mode";
import { createRewardRepository } from "@/features/app/repositories/rewards";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message = typeof record.message === "string" ? record.message : "";

    if (message) {
      return message;
    }
  }

  return "Could not load XP Store.";
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const rewardRepository = createRewardRepository(supabase);

  if (isDemoMode) {
    return NextResponse.json(await rewardRepository.getStoreSnapshot("demo-user", 0), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { user, profile } = await getCurrentUserProfile(supabase);

  if (!user || !profile || !supabase) {
    return NextResponse.json({ error: "Please sign in to use the XP Store." }, { status: 401 });
  }

  try {
    const snapshot = await rewardRepository.getStoreSnapshot(
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
