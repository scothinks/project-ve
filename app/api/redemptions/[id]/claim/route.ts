import { NextRequest, NextResponse } from "next/server";
import {
  getObjectField,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/request-validation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { asSupabaseJson } from "@/lib/supabase-rpc";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const bodyResult = await readJsonObject(request);

  if (!bodyResult.ok) {
    return validationErrorResponse(bodyResult.issues);
  }

  const issues: ValidationIssue[] = [];
  const claimData = getObjectField(bodyResult.data, "claimData", issues, { required: false }) ?? {};

  if (issues.length > 0) {
    return validationErrorResponse(issues);
  }

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
    p_claim_data: asSupabaseJson(claimData),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ redemption: data });
}
