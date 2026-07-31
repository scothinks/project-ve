import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "This endpoint is deprecated. Use /api/quizzes/[id]/start and /api/quizzes/[id]/answer.",
    },
    { status: 410 },
  );
}
