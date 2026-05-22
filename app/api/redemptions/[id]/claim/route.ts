import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    claimData?: Record<string, unknown>;
  };

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Reward claim submission is unavailable until the live backend is configured." },
      { status: isSupabaseConfigured ? 500 : 503 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Please sign in to submit reward details." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("submit_manual_redemption_details", {
    p_redemption_id: id,
    p_claim_data: body.claimData ?? {},
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ redemption: data });
}
