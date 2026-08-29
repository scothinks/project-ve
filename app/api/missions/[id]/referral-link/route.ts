import { NextResponse } from "next/server";
import { getStringField, readJsonObject, validationErrorResponse } from "@/lib/request-validation";
import { createContextualReferralShareLink } from "@/lib/supabase-missions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const bodyResult = await readJsonObject(request);
  if (!bodyResult.ok) return validationErrorResponse(bodyResult.issues);

  const issues: Array<{ path: string; message: string }> = [];
  const programmeId = getStringField(bodyResult.data, "programmeId", issues);
  if (!programmeId || issues.length > 0) return validationErrorResponse(issues);

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Referral links are temporarily unavailable." }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to create a referral link." }, { status: 401 });
  }

  try {
    const { id } = await params;
    return NextResponse.json(await createContextualReferralShareLink({
      missionId: id,
      origin: new URL(request.url).origin,
      programmeId,
      supabase,
    }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create referral link." },
      { status: 400 },
    );
  }
}
