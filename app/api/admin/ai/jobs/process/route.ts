import { NextRequest, NextResponse } from "next/server";
import { processNextAiGenerationJob } from "@/app/admin/courses/ai-actions";

function isAuthorized(request: NextRequest) {
  const workerSecret = process.env.AI_GENERATION_WORKER_SECRET;
  const cronSecret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization");
  const direct = request.headers.get("x-ai-generation-worker-secret");

  return (
    (Boolean(workerSecret) && (bearer === `Bearer ${workerSecret}` || direct === workerSecret))
    || (Boolean(cronSecret) && bearer === `Bearer ${cronSecret}`)
  );
}

function parseLimit(request: NextRequest) {
  const value = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "1", 10);
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(3, value));
}

async function handleProcess(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limit = parseLimit(request);
  const workerId = `api-worker-${crypto.randomUUID()}`;
  const results = [];

  for (let index = 0; index < limit; index += 1) {
    const result = await processNextAiGenerationJob(workerId);
    results.push(result);

    if (!result.processed) {
      break;
    }
  }

  return NextResponse.json({
    processedCount: results.filter((result) => result.processed).length,
    results,
    workerId,
  });
}

export async function GET(request: NextRequest) {
  return handleProcess(request);
}

export async function POST(request: NextRequest) {
  return handleProcess(request);
}
