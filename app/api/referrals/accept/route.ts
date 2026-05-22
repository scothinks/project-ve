import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type AcceptReferralBody = {
  referralCode?: string;
  referredUserHint?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as AcceptReferralBody;

  if (!body.referralCode) {
    return NextResponse.json({ error: "Referral code is required." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Referral attribution is unavailable until the live backend is configured." },
        { status: 503 },
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Create an account or log in before applying this referral." },
        { status: 401 },
      );
    }

    const { data, error } = await supabase.rpc("accept_referral", {
      p_referral_code: body.referralCode,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not apply referral." },
      { status: 400 },
    );
  }
}
