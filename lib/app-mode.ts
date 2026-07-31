export type AppMode = "demo" | "live";

const rawAppMode = process.env.APP_MODE?.trim().toLowerCase();

function resolveAppMode(): AppMode {
  if (rawAppMode === "demo" || rawAppMode === "live") {
    return rawAppMode;
  }

  if (rawAppMode) {
    throw new Error("APP_MODE must be either 'demo' or 'live'.");
  }

  return "live";
}

export const appMode = resolveAppMode();
export const isDemoMode = appMode === "demo";
export const isLiveMode = appMode === "live";
