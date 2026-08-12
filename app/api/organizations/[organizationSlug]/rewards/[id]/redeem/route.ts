import { NextResponse } from "next/server";
import { requireOrgLearnerRoute } from "@/app/o/[organizationSlug]/workspace";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ organizationSlug: string; id: string }> },
) {
  try {
    const { organizationSlug, id } = await params;
    const { supabase, workspace } = await requireOrgLearnerRoute(
      Promise.resolve({ organizationSlug }),
    );
    const { data: reward, error: rewardError } = await supabase
      .from("rewards")
      .select("id, organization_id")
      .eq("id", id)
      .eq("organization_id", workspace.organizationId)
      .maybeSingle();

    if (rewardError) throw rewardError;
    if (!reward) {
      return NextResponse.json({ error: "This reward is not available in the organisation workspace." }, { status: 404 });
    }

    const { data, error } = await supabase.rpc("redeem_reward", { p_reward_id: reward.id });
    if (error) throw error;
    return NextResponse.json({ redemption: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not redeem this reward." },
      { status: 400 },
    );
  }
}
