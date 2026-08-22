# Anchor 13C-D2 Desktop Handoff

## Exact Stitch Screen IDs

- A13-54 — Organisation Learner Home / Active — Desktop: `projects/8002921966592102055/screens/b0162cf85ff147dbaa73c1eec8d2309c`
- A13-55 — Organisation Learner Home / Caught Up — Desktop: `projects/8002921966592102055/screens/bdf518856b2c438db096db0fda23f8a7`
- A13-56 — Organisation Learning / Library — Desktop: `projects/8002921966592102055/screens/95e82f5f5b434743a180e2adaabdfa3f`
- A13-57 — Organisation Course Detail — Desktop: `projects/8002921966592102055/screens/a517d6debfab460dbd61be54a724f1fa`
- A13-58 — Organisation Learning / Required Assessment State — Desktop (Final): `projects/8002921966592102055/screens/2ef65dc779ec461b82c351db7345d868`
- A13-59 — Organisation Assessment Flow — Desktop (Final): `projects/8002921966592102055/screens/5bde11c2e1e54eb3a0b304787249a2ca`
- A13-60 — Organisation Learning / Assessment Complete + Recommendations — Desktop: `projects/8002921966592102055/screens/57ca98ea66da4590bef53ab9806f9a1c`

## Files Changed

- `app/o/[organizationSlug]/page.tsx`
- `app/o/[organizationSlug]/learn/page.tsx`
- `app/o/[organizationSlug]/learn/[courseId]/page.tsx`
- `app/o/[organizationSlug]/assessments/[assessmentVersionId]/page.tsx`
- `app/globals.css`
- `components/organizations/OrgLearnerMobile.tsx`
- `components/onboarding/ValuesAssessmentFlow.tsx`

## Learner Primitives Reused

- `OrgLearnerHeader`, `OrgBottomNav`, `OrgPointsPill`, `OrgProgressMeter`, and `OrgActionLink`
- `LearnerWorkspaceSwitcher` for runtime workspace switching
- `CourseLibrary` editorial learner variant
- `ValuesAssessmentFlow` state machine and form submission behavior

## Learner Primitives Introduced

- `OrgLearnerChrome` for desktop organisation learner chrome, horizontal navigation, configured points label, and workspace switcher placement.
- Desktop-only org learner CSS hooks for home active/caught-up, learning required/completion states, course detail, and organisation assessment layout.

## Responsive Desktop Changes

- Desktop org learner routes now use a wide 1116px canvas instead of the locked mobile frame.
- Desktop uses the Stitch-style `Project Ve` brand at left, horizontal organisation learner nav, and runtime organisation/points context at right.
- Mobile keeps the compact header, 390px learner canvas, and bottom nav behavior used by A13-47 through A13-53.
- Required assessment, caught-up, completion recommendations, course detail, and assessment flow receive desktop-specific layout rules without changing their mobile state logic.

## Route / State Mapping

- A13-54 maps to `/o/[organizationSlug]` when learning or assessment work remains.
- A13-55 maps to `/o/[organizationSlug]` after required assessment and programme lessons are complete.
- A13-56 maps to `/o/[organizationSlug]/learn` when no required assessment blocks the library.
- A13-57 maps to `/o/[organizationSlug]/learn/[courseId]?programmeId=[programmeId]`.
- A13-58 remains a Learning-page state at `/o/[organizationSlug]/learn` when an incomplete required checkpoint exists.
- A13-59 maps to `/o/[organizationSlug]/assessments/[assessmentVersionId]?programmeId=[programmeId]`.
- A13-60 remains a post-assessment Learning-page state at `/o/[organizationSlug]/learn?assessment=completed&programmeId=[programmeId]&assessmentVersionId=[assessmentVersionId]`.

## Runtime vs Stitch Sample Differences

- Runtime organisation names, programme names, course titles, thumbnails, progress, and balances come from the seeded/local tenant data and may differ from Stitch copy.
- The points label is not hardcoded; the local fixture configures `Police Points`, but production labels resolve from the organisation XP account.
- Runtime recommendation cards come from the personalised recommendation engine and available tagged content rather than static Stitch examples.
- Icons are from existing app primitives and CSS; Stitch-specific static screenshot assets are not embedded.

## Configured Currency Handling

- Desktop and mobile render `workspace.xpAccount.label` and `workspace.xpAccount.balance`.
- Course and assessment labels continue through existing `unitLabel` / `formatXpLabel` paths.
- No hardcoded XP label was added to app code; `Police Points` appears only as runtime fixture data and in this handoff as the local validation tenant label.

## Validation Results

- Passed `npm run typecheck`.
- Passed focused ESLint: `npx eslint 'app/o/[organizationSlug]/page.tsx' 'app/o/[organizationSlug]/learn/page.tsx' 'app/o/[organizationSlug]/learn/[courseId]/page.tsx' 'app/o/[organizationSlug]/assessments/[assessmentVersionId]/page.tsx' components/organizations/OrgLearnerMobile.tsx components/onboarding/ValuesAssessmentFlow.tsx`.
- Passed `git diff --check`.
- Passed no-screenshot Playwright runtime validation for desktop home active, home caught-up, learning library, course detail, A13-58 required assessment state, A13-59 Back/Next/Finish, assessment submission, A13-60 redirect/completion/recommendations, configured points label, workspace switching, and mobile A13-47 through A13-53 rendering checks.
- Second pass corrected visible mismatches against the attached Stitch overview: desktop chrome brand/context split, A13-54 right-rail placement, A13-55 centered caught-up state, A13-58 centered required-assessment card, and A13-60 centered completion hero plus three-card recommendations.

## Admin Isolation

- This slice did not require admin route/component changes.
- Existing dirty admin files in the worktree were left untouched and are unrelated to this implementation.

## Remaining Fidelity Gaps

- Runtime copy and imagery follow real tenant/course/recommendation data, so they are not pixel-identical to the Stitch sample text and images.
- Desktop layout is matched structurally through HTML/CSS reference inspection and DOM/computed checks; no screenshots were generated for this task per instruction.
