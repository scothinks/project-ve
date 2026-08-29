import "server-only";

export async function measureAsync<T>(label: string, task: () => PromiseLike<T>): Promise<T> {
  const start = performance.now();

  try {
    return await task();
  } finally {
    if (process.env.PERF_LOGS === "1") {
      const duration = Math.round(performance.now() - start);
      console.info(`[perf] ${label} ${duration}ms`);
    }
  }
}
