import { NextResponse } from "next/server";
import type { MissionProof } from "@/lib/missions";
import {
  getArrayField,
  getEnumField,
  getOptionalStringField,
  getStringField,
  isJsonObject,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/request-validation";
import { submitSupabaseMissionProof } from "@/lib/supabase-missions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const bodyResult = await readJsonObject(request);

  if (!bodyResult.ok) {
    return validationErrorResponse(bodyResult.issues);
  }

  const issues: ValidationIssue[] = [];
  const rawProof = getArrayField(bodyResult.data, "proof", issues, { required: false }) ?? [];
  const organizationId = getOptionalStringField(bodyResult.data, "organizationId", issues);
  const programmeId = getOptionalStringField(bodyResult.data, "programmeId", issues);
  const proof: Array<{ type: MissionProof["type"]; value: string }> = [];

  rawProof.forEach((item, index) => {
    if (!isJsonObject(item)) {
      issues.push({ path: `proof.${index}`, message: "Expected an object." });
      return;
    }

    const type = getEnumField(
      item,
      "type",
      ["image", "video", "text", "link", "location"],
      issues,
    );
    const value = getStringField(item, "value", issues);

    if (type && value) {
      proof.push({ type, value });
    }
  });

  if (issues.length > 0) {
    return validationErrorResponse(issues);
  }

  if (!proof.length) {
    return validationErrorResponse([{ path: "proof", message: "Must include at least one item." }]);
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
        organizationId,
        programmeId,
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
