import { NextResponse } from "next/server";
import {
  getOptionalStringField,
  getStringField,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/request-validation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const bodyResult = await readJsonObject(request);

  if (!bodyResult.ok) {
    return validationErrorResponse(bodyResult.issues);
  }

  const issues: ValidationIssue[] = [];
  const referralCode = getStringField(bodyResult.data, "referralCode", issues);
  getOptionalStringField(bodyResult.data, "referredUserHint", issues);

  if (issues.length > 0 || !referralCode) {
    return validationErrorResponse(issues);
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
      p_referral_code: referralCode,
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
