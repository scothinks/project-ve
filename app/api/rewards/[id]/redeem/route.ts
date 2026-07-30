import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Reward redemption is unavailable until the live backend is configured." },
      { status: isSupabaseConfigured ? 500 : 503 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Please sign in to redeem XP." }, { status: 401 });
  }

  const { data: reward, error: rewardError } = await supabase
    .from("rewards")
    .select("fulfillment_type, distribution_mode")
    .eq("id", id)
    .maybeSingle();

  if (rewardError) {
    return NextResponse.json({ error: rewardError.message }, { status: 400 });
  }

  const rpcName =
    reward?.distribution_mode === "perk_bundle"
      ? "redeem_perk_bundle"
      : "redeem_reward";
  const { data, error } = await supabase.rpc(rpcName, {
    p_reward_id: id,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message.replaceAll("exchange", "redeem") },
      { status: 400 },
    );
  }

  return NextResponse.json({ redemption: data });
}
