import { NextResponse } from "next/server";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";
import { isDemoMode } from "@/lib/app-mode";
import { createMissionRepository } from "@/features/app/repositories/missions";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { user, profile } = await getCurrentUserProfile(supabase);
  const missionRepository = createMissionRepository(supabase);
  const origin = new URL(request.url).origin;

  if (user) {
    return NextResponse.json({
      missions: await missionRepository.getSummaries({
        userId: user.id,
        referralCode: profile?.referral_code ?? null,
        origin,
      }),
    });
  }

  if (isDemoMode) {
    return NextResponse.json({
      missions: await missionRepository.getSummaries({
        userId: "demo-user",
        origin,
        referralCode: null,
      }),
    });
  }

  return NextResponse.json({ error: "Please sign in to view missions." }, { status: 401 });
}
