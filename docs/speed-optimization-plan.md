# Speed Optimization Plan

## Objective

Improve perceived and server-side performance across the public app and admin CMS without reducing personalization, rewards, mission, or direct ads functionality.

## Baseline Findings

- Middleware currently refreshes Supabase auth on nearly every non-static request.
- Public pages rely heavily on dynamic server rendering.
- Dashboard data loading is mostly sequential and combines critical and non-critical work.
- Learning detail pages overfetch by loading the full published catalog to render a single course, lesson, or quiz.
- Mission summary reads perform per-mission progress and award checks, and may write/sync during page reads.
- Ads decisioning is on the render path and adds latency, but it is not the original or only cause of app slowness.
- Public images mostly use raw `img`, which hurts perceived speed and LCP.

## Phase 1 — Instrumentation and Safety

- Add lightweight server timing utilities for development/staging.
- Capture route loader durations around auth, catalog, progress, missions, rewards, recommendations, and ads.
- Keep production logging low-noise and controlled by env flag.

## Phase 2 — Remove Global Request Tax

- Do not call `supabase.auth.getUser()` in middleware for every route.
- Scope middleware auth refresh to protected app/admin paths and auth callbacks.
- Keep the device cookie used by ads/risk protection available on relevant routes.

## Phase 3 — Targeted Learning Loaders

- Add targeted course, lesson, and quiz loaders that query only required rows.
- Stop `getLearningCourse()`, `getLearningLesson()`, and `getLearningQuiz()` from loading the full catalog.
- Preserve seed/demo fallback behavior when Supabase is not configured.

## Phase 4 — Public Route Waterfall Reduction

- Parallelize independent dashboard reads after auth/assessment gating.
- Parallelize course and lesson page ad-prep work where safe.
- Keep first paint focused on primary learning/reward content.
- Move or defer non-critical data when practical.

## Phase 5 — Mission and Rewards Read Optimization

- Avoid write/sync work in read-only render paths.
- Add a read-only mission summary mode for dashboard and mission list rendering.
- Keep explicit sync/award behavior in claim/proof/action flows.
- Avoid duplicate reward reads where SSR already has data.

## Phase 6 — Ads Render-Path Optimization

- Keep fallback behavior intact.
- Avoid unnecessary paid decision work when a fallback can be returned quickly.
- Cache or memoize placement fallback metadata per request where possible.
- Keep ad decision timeout bounded and fail soft.

## Phase 7 — Admin/CMS Performance

- Keep ads admin pages route-scoped with route-specific data loaders.
- Add pagination/filtering before admin event tables grow large.
- Keep destructive jobs explicit and separate from page render.

## Phase 8 — Frontend Perceived Speed

- Replace high-impact public `img` usage with optimized image handling where dimensions are known.
- Prioritize dashboard, course cards, lesson hero images, reward thumbnails, and ad images.

## Completion Criteria

- Middleware no longer makes a Supabase auth network call for every public request.
- Single course/lesson/quiz pages no longer load the full learning catalog.
- Dashboard has fewer sequential await waterfalls.
- Mission list/dashboard rendering avoids award-sync writes.
- Ads fallback remains controlled by CMS and visible when enabled and paid inventory is unavailable.
- `npm run typecheck` and `npm run build` pass.
- Final audit maps implementation back to each phase and lists any remaining intentional follow-ups.

## Implementation Audit

### Completed

- Added `PERF_LOGS=1` server timing support for high-impact dashboard loaders.
- Scoped middleware auth refresh so public/marketing and non-auth routes avoid the global Supabase `getUser()` request tax.
- Added targeted published course, lesson, and quiz loaders so detail pages no longer load the full catalog.
- Batched dashboard reads into primary and secondary parallel groups.
- Reused an existing Supabase server client in hot routes to avoid duplicate client/cookie setup.
- Made mission summaries read-only by default and parallelized per-mission progress/award reads.
- Server-rendered the initial XP Store snapshot to avoid waiting for the client fetch before showing rewards.
- Started paid ad decisioning and fallback lookup in the same timeout window instead of serializing fallback before paid decisioning.
- Converted high-impact public images to `next/image`.
- Confirmed `npm run typecheck` and `npm run build` pass.
- Ran local production route timing against `next start` on representative routes.
- Closed a measured `/courses` gap by adding a cached public course-summary loader and skipping auth/profile work when no Supabase auth cookie exists.

### Local Production Timing

Measured from a local production server with a warmed Next cache. These timings validate server response time only; browser Lighthouse/Web Vitals should still be captured in staging.

| Route | Status | Avg total | P95 sample |
| --- | ---: | ---: | ---: |
| `/` | 200 | 5.0ms | 5.5ms |
| `/courses` | 200 | 5.4ms | 5.9ms |
| `/dashboard` | 307 | 5.3ms | 5.8ms |
| `/missions` | 200 | 110.8ms | 112.6ms |
| `/xp-store` | 307 | 7.9ms | 12.2ms |
| `/advertise` | 200 | 1.8ms | 2.9ms |

### Remaining Follow-Ups

- Some admin unused-variable lint warnings predate this work and remain intentionally untouched.
- A deeper database-level mission summary RPC would further reduce query count, but the current implementation removes read-path writes and parallelizes the existing logic without requiring a migration.
- Browser-level Lighthouse/Web Vitals should be captured in staging because local server timing does not measure hydration, image loading, real device CPU, or mobile network behavior.
- Investigate why `/api/referrals/accept` fires during simple learner navigation such as dashboard → courses → course detail. Current likely source is `ReferralAttributionCapture` on `/dashboard`; confirm whether stale `project-ve-referral-code` localStorage or missing accepted/refused state causes repeated 400s, then gate or clear it so normal course browsing does not produce referral API noise.
