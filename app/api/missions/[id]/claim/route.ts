import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const supabase = await createSupabaseServerClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Mission claiming is unavailable until the live backend is configured." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Mission rewards are awarded automatically when completed." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not claim mission." },
      { status: 400 },
    );
  }
}
