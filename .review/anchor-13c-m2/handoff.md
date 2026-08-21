# Anchor 13C M2 Handoff

## Scope

Implemented the locked Organisation Learner Home + Learning mobile slice for A13-47 through A13-53, then tightened the pass so the Stitch board is treated as the intended outcome rather than a loose reference. Work stayed local only: no commit, push, PR, or remote CI.

Admin isolation: no `/admin/**` files were edited for this slice. The worktree already contains unrelated dirty admin and platform files; they were left intact.

## Stitch References

- A13-47 — Organisation Learner Home / Active — Mobile (Repaired): `b6c74e53120d45b6b3ca9d82dc98c397`
- A13-48 — Organisation Learner Home / Caught Up — Mobile (Repaired): `af4453a72647439f8aba78c35974deb9`
- A13-49 — Organisation Learning / Library — Mobile (Repaired): `c2a3e9ee15ff4c43af4fffe6abd63d57`
- A13-50 — Organisation Course Detail — Mobile (Repaired): `d6027af7547e4fbfb3188c52d7cb52ff`
- A13-51 — Organisation Learning / Required Assessment State — Mobile (Repaired): `c9fc9258a64743c788d2b47264ff9704`
- A13-52 — Organisation Assessment Flow — Mobile (Repaired): `35d9bce1919d429f9c0ac0d415689bc7`
- A13-53 — Organisation Learning / Assessment Complete + Recommendations — Mobile (Repaired): `d3a0353e0ce44b439e4a544585388f80`

Stitch source assets are in `.review/anchor-13c-m2/stitch/`. The A13-53 Stitch PNG downloaded as a mostly blank/defective screenshot above bottom nav; `.review/anchor-13c-m2/stitch/A13-53.html` was retained as the text/state reference and confirms the completion + recommendations content.

## Implementation Summary

- Added org-aware mobile learner primitives in `components/organizations/OrgLearnerMobile.tsx`: org header, points pill, progress meter, action link, and org bottom-nav href mapping.
- Added the compact org Learning top bar for the A13-53 completion-return state.
- Made `BottomNav` support caller-provided hrefs and safe-area fixed mobile positioning.
- Rebuilt `/o/[organizationSlug]` as a compact org learner home with active and caught-up states, real org XP labels/balances, real programme/course/assessment data, and no public Project Ve top chrome.
- Rebuilt `/o/[organizationSlug]/learn` as the org Learning surface with separate library, required-assessment, and assessment-complete recommendation states.
- Rebuilt `/o/[organizationSlug]/learn/[courseId]` as the compact org mobile course detail with hero, programme badge, progress, resume CTA, and syllabus states.
- Updated org assessment route to use the org mobile chrome and a dedicated compact `ValuesAssessmentFlow` organization variant.
- Updated org learner child pages to use org bottom-nav hrefs so Home/Lessons/Missions/Store/Orgs stay inside the org workspace.
- Updated course-library routing and resume links to preserve org/programme delivery context.
- Fixed org workspace course loading to use full course data where contextual programme progress needs lesson pages.
- Fixed course resume fallback so partially completed courses resume the first incomplete lesson and show `Continue Course` / `Continue Learning`.

## Confirmations

- A13-51 remains a `/o/[organizationSlug]/learn` state, not a separate assessment route.
- A13-53 remains a `/o/[organizationSlug]/learn?assessment=completed...` state, not a separate results route.
- A13-29 through A13-34 public learner routes were not edited for this slice.
- Admin routes were not edited by this slice.
- Bottom nav stays org-aware for org learner pages.

## Review Artifacts

- Handoff: `.review/anchor-13c-m2/handoff.md`
- Scoped diff: `.review/anchor-13c-m2/changes.diff`
- Local fixture seed: `.review/anchor-13c-m2/seed-local.mjs`
- Local dev launcher: `.review/anchor-13c-m2/start-local-dev.mjs`
- Screenshot capture: `.review/anchor-13c-m2/capture-mobile.mjs`

Representative mobile screenshots:

- `.review/anchor-13c-m2/screenshots/A13-47-org-home-active-mobile.png`
- `.review/anchor-13c-m2/screenshots/A13-48-org-home-caught-up-mobile.png`
- `.review/anchor-13c-m2/screenshots/A13-49-org-learning-library-mobile.png`
- `.review/anchor-13c-m2/screenshots/A13-50-org-course-detail-mobile.png`
- `.review/anchor-13c-m2/screenshots/A13-51-org-learning-required-assessment-mobile.png`
- `.review/anchor-13c-m2/screenshots/A13-52-org-assessment-flow-mobile.png`
- `.review/anchor-13c-m2/screenshots/A13-53-org-assessment-complete-recommendations-mobile.png`

## Local Fixture Notes

Screenshots use a disposable local Supabase organization fixture:

- Organization: `Metropolitan Police Academy`
- Slug: `a13-m2-police-academy`
- Programme: `Frontline Ethics Programme`
- Assessment: `Ethics in Action`
- Points label: `Police Points`, configured through the organization XP account

The fixture uses real local Supabase auth, memberships, programme enrolment, programme assessment delivery, lesson progress, contextual assessment completion, and recommendation profile data. No remote project was used. The review scripts require `A13_M2_REVIEW_PASSWORD` if rerun; the generated fixture JSON does not store passwords or service keys.

Runtime/sample-data differences from Stitch:

- Course/recommendation images are local fixture Unsplash images rather than exact Stitch visual assets.
- Copy and organization naming are target-aligned local fixture data, not production tenant data.
- The A13-52 fixture now uses a 10-question assessment and captures question 3 of 10 at 30% with the target scenario copy.

## Validation

- `npm run typecheck` passed.
- `npm run lint` passed cleanly.
- `git diff --check` passed.
- Local Playwright capture completed against `http://127.0.0.1:3100` with local Supabase overrides.

## Notes

- `.review/anchor-13c-m2/changes.diff` is scoped to this slice's learner/org files plus the new org mobile primitive. Some tracked files, especially `app/globals.css` and `components/course/CourseLibrary.tsx`, were already dirty before this work, so the scoped diff may include same-file pre-existing changes.
- No commit, push, PR, deployment, or remote CI was performed.
