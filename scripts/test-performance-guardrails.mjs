import { spawnSync } from "node:child_process";

const contractTests = [
  "tests/unit/route-auth-policy.test.mjs",
  "tests/unit/learning-course-card-model.test.mjs",
  "tests/unit/learner-workspace-context.test.mjs",
  "tests/unit/mission-state-read-model.test.mjs",
  "tests/unit/dashboard-first-useful-html.test.mjs",
];

const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--test", ...contractTests],
  { stdio: "inherit" },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
