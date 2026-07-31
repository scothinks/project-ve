import type { WorkflowMediaAssetRow } from "../data/workflow.ts";
import type { MediaTarget } from "../domain/media-planning.ts";

export const MEDIA_GENERATION_CONCURRENCY = 2;

export type MediaGenerationCounts = {
  failedCount: number;
  generatedCount: number;
  reusedCount: number;
  skippedCount: number;
};

export type MediaGenerationOutcome = keyof Omit<MediaGenerationCounts, "skippedCount">;

export type CompletedMediaGenerationResult = {
  generatedAt: string | null;
  model: string | null;
  provider: string | null;
  revisedPrompt: string | null;
  storagePath: string | null;
  url: string | null;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function buildCompletedMediaAsset(
  asset: WorkflowMediaAssetRow,
  target: MediaTarget,
  result: CompletedMediaGenerationResult,
): WorkflowMediaAssetRow {
  return {
    ...asset,
    url: result.url,
    storage_path: result.storagePath,
    provider: result.provider,
    model: result.model,
    generation_status: "completed",
    generation_error: null,
    metadata: {
      ...asRecord(asset.metadata),
      generatedAt: result.generatedAt,
      revisedPrompt: result.revisedPrompt,
      targetKind: target.kind,
      targetPageId: target.kind === "page_cover" ? target.pageId : null,
    },
  };
}

export async function runWithBoundedConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
) {
  const results: R[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(limit, 1), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        results.push(await worker(item));
      }
    }),
  );

  return results;
}

export function summarizeMediaOutcomes(
  outcomes: MediaGenerationOutcome[],
  skippedCount: number,
): MediaGenerationCounts {
  return outcomes.reduce<MediaGenerationCounts>(
    (counts, outcome) => ({
      ...counts,
      [outcome]: counts[outcome] + 1,
    }),
    {
      failedCount: 0,
      generatedCount: 0,
      reusedCount: 0,
      skippedCount,
    },
  );
}

export async function processMediaGenerationWorkItems<T>(
  workItems: T[],
  worker: (item: T) => Promise<MediaGenerationOutcome>,
  skippedCount: number,
  concurrency = MEDIA_GENERATION_CONCURRENCY,
) {
  const outcomes = await runWithBoundedConcurrency(workItems, concurrency, worker);
  return summarizeMediaOutcomes(outcomes, skippedCount);
}
