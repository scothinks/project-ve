import { rmSync } from "node:fs";
import { resolve } from "node:path";

rmSync(resolve(process.cwd(), process.env.PROJECT_VE_LOCAL_E2E === "1" ? ".next-e2e" : ".next"), {
  force: true,
  maxRetries: 5,
  recursive: true,
  retryDelay: 100,
});
