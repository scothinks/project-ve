import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Mission rewards are awarded automatically. Use /api/missions or proof submission endpoints.",
    },
    { status: 410 },
  );
}
