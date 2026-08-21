import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const reviewDir = path.resolve(".review/anchor-13c-m2");
const screenshotsDir = path.join(reviewDir, "screenshots");
const fixture = JSON.parse(await fs.readFile(path.join(reviewDir, "fixture.json"), "utf8"));
const baseUrl = process.env.REVIEW_BASE_URL ?? "http://127.0.0.1:3100";
const reviewPassword = process.env.A13_M2_REVIEW_PASSWORD;

if (!reviewPassword) {
  throw new Error("A13_M2_REVIEW_PASSWORD is required for local screenshot capture.");
}

function parseEnvOutput(output) {
  return Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.match(/^([A-Z0-9_]+)="?([^"]*)"?$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]),
  );
}

function readLocalSupabaseEnv() {
  const result = spawnSync(
    process.execPath,
    ["scripts/supabase-cli.mjs", "status", "-o", "env"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    return {};
  }

  return parseEnvOutput(result.stdout);
}

const statusEnv = readLocalSupabaseEnv();
const serviceRoleKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? statusEnv.SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  throw new Error("Local Supabase service role key is required.");
}

const supabase = createClient(fixture.supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function screenshot(page, name, options = {}) {
  await page.waitForLoadState("domcontentloaded");
  await page.addStyleTag({
    content: "nextjs-portal,#nextjs-portal{display:none!important;visibility:hidden!important;}",
  }).catch(() => undefined);
  if (!options.preserveScroll) {
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => undefined);
  }
  await page.waitForTimeout(1_250);
  await page.screenshot({
    animations: "disabled",
    fullPage: false,
    path: path.join(screenshotsDir, `${name}.png`),
  });
}

async function goto(page, href) {
  const target = new URL(href, baseUrl);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(target.href, { timeout: 60_000, waitUntil: "domcontentloaded" });
    } catch (error) {
      if (!String(error).includes("ERR_ABORTED")) {
        throw error;
      }
    }

    await page.waitForTimeout(750);
    const current = new URL(page.url());
    const landed =
      current.pathname === target.pathname
      && (!target.search || current.search === target.search);

    if (landed) {
      return;
    }
  }

  throw new Error(`Navigation did not land on ${target.pathname}${target.search}; current URL is ${page.url()}`);
}

async function completeProgrammeLessons() {
  const { data: programmeCourses, error: coursesError } = await supabase
    .from("programme_courses")
    .select("course_id")
    .eq("programme_id", fixture.programmeId);

  if (coursesError) {
    throw new Error(`programme course lookup failed: ${coursesError.message}`);
  }

  const courseIds = (programmeCourses ?? []).map((row) => row.course_id);
  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id")
    .in("course_id", courseIds);

  if (lessonsError) {
    throw new Error(`lesson lookup failed: ${lessonsError.message}`);
  }

  const lessonIds = (lessons ?? []).map((row) => row.id);
  const { data: pages, error: pagesError } = await supabase
    .from("lesson_pages")
    .select("id, lesson_id")
    .in("lesson_id", lessonIds);

  if (pagesError) {
    throw new Error(`page lookup failed: ${pagesError.message}`);
  }

  const now = new Date().toISOString();
  const pagesByLesson = new Map();
  for (const page of pages ?? []) {
    const rows = pagesByLesson.get(page.lesson_id) ?? [];
    rows.push(page.id);
    pagesByLesson.set(page.lesson_id, rows);
  }

  const { error: programmeCompletionError } = await supabase
    .from("programme_lesson_page_completions")
    .upsert(
      (pages ?? []).map((page) => ({
        user_id: fixture.userId,
        programme_id: fixture.programmeId,
        lesson_id: page.lesson_id,
        page_id: page.id,
        completed_at: now,
      })),
      { onConflict: "user_id,programme_id,lesson_id,page_id" },
    );

  if (programmeCompletionError) {
    throw new Error(`programme page completion upsert failed: ${programmeCompletionError.message}`);
  }

  const { error: lessonProgressError } = await supabase
    .from("lesson_progress")
    .upsert(
      lessonIds.map((lessonId) => {
        const completedPages = pagesByLesson.get(lessonId) ?? [];
        return {
          user_id: fixture.userId,
          lesson_id: lessonId,
          completed_pages: completedPages,
          completed_modules: completedPages,
          completed_at: now,
        };
      }),
      { onConflict: "user_id,lesson_id" },
    );

  if (lessonProgressError) {
    throw new Error(`lesson progress upsert failed: ${lessonProgressError.message}`);
  }
}

async function answerCurrentAndRemainingAssessmentQuestions(page, totalQuestions) {
  for (let questionIndex = 2; questionIndex < totalQuestions; questionIndex += 1) {
    await page.locator("button[aria-pressed]").nth(questionIndex % 3).click();
    const buttonName = questionIndex === totalQuestions - 1 ? "Finish" : "Next Question";
    await page.getByRole("button", { name: buttonName }).click();
  }
}

await fs.mkdir(screenshotsDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  serviceWorkers: "block",
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  viewport: { width: 390, height: 844 },
});
await context.addInitScript(() => {
  window.localStorage.setItem(
    "ve_install_prompt_dismissed_until",
    String(Date.now() + 30 * 24 * 60 * 60 * 1000),
  );
  const style = document.createElement("style");
  style.textContent = "nextjs-portal,#nextjs-portal{display:none!important;visibility:hidden!important;}";
  document.documentElement.appendChild(style);
});
const page = await context.newPage();

try {
  await goto(page, `/login?next=/o/${fixture.slug}`);
  await page.locator('input[type="email"]').fill(fixture.email);
  await page.locator('input[type="password"]').fill(reviewPassword);
  await page.getByRole("button", { name: /^Login$/ }).click();
  await page.waitForFunction(
    (slug) => window.location.pathname === `/o/${slug}`,
    fixture.slug,
    { timeout: 60_000 },
  );

  await screenshot(page, "A13-47-org-home-active-mobile");

  await goto(page, `/o/${fixture.slug}/learn`);
  await screenshot(page, "A13-51-org-learning-required-assessment-mobile");

  await goto(page, `/o/${fixture.slug}/learn/a13-m2-procedural-justice?programmeId=${fixture.programmeId}`);
  await screenshot(page, "A13-50-org-course-detail-mobile");

  await goto(page, `/o/${fixture.slug}/assessments/${fixture.assessmentId}?programmeId=${fixture.programmeId}`);
  await page.locator("button[aria-pressed]").nth(0).click();
  await page.getByRole("button", { name: "Next Question" }).click();
  await page.locator("button[aria-pressed]").nth(1).click();
  await page.getByRole("button", { name: "Next Question" }).click();
  await screenshot(page, "A13-52-org-assessment-flow-mobile", { preserveScroll: true });

  await answerCurrentAndRemainingAssessmentQuestions(page, 10);
  await page.waitForFunction(
    (slug) =>
      window.location.pathname === `/o/${slug}/learn`
      && new URLSearchParams(window.location.search).get("assessment") === "completed",
    fixture.slug,
    { timeout: 60_000 },
  );
  await screenshot(page, "A13-53-org-assessment-complete-recommendations-mobile");

  await goto(page, `/o/${fixture.slug}/learn`);
  await screenshot(page, "A13-49-org-learning-library-mobile");

  await completeProgrammeLessons();
  await goto(page, `/o/${fixture.slug}`);
  await screenshot(page, "A13-48-org-home-caught-up-mobile");
} finally {
  await browser.close();
}

console.log(`Screenshots written to ${screenshotsDir}`);
