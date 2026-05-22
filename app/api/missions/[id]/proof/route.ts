import { NextResponse } from "next/server";
import type { MissionProof } from "@/lib/missions";
import { submitSupabaseMissionProof } from "@/lib/supabase-missions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ProofBody = {
  proof?: Array<{
    type: MissionProof["type"];
    value: string;
  }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const body = (await request.json()) as ProofBody;
  const proof = (body.proof ?? []).filter(
    (item) => item && typeof item.type === "string" && typeof item.value === "string" && item.value.trim().length > 0,
  );

  if (!proof.length) {
    return NextResponse.json({ error: "Proof is required." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Mission proof submission is unavailable until the live backend is configured." },
        { status: 503 },
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Create an account or log in to submit mission proof." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      await submitSupabaseMissionProof({
        supabase,
        userId: user.id,
        missionId: id,
        proof,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not submit proof." },
      { status: 400 },
    );
  }
}
