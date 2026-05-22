import { NextResponse } from "next/server";
import { getMissionSummaries } from "@/lib/demo-progress-store";
import { getSupabaseMissionSummaries } from "@/lib/supabase-missions";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { user, profile } = await getCurrentUserProfile();
  const origin = new URL(request.url).origin;

  if (supabase && user) {
    return NextResponse.json({
      missions: await getSupabaseMissionSummaries({
        supabase,
        userId: user.id,
        referralCode: profile?.referral_code ?? null,
        origin,
      }),
    });
  }

  return NextResponse.json({
    missions: getMissionSummaries(
      user?.id,
      origin,
      profile?.referral_code,
    ),
  });
}
