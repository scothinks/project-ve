# Anchor 13C D1 Handoff

## Scope

Implemented the desktop Organisation Entry / My Orgs / Invitations / Workspace Switcher slice for A13-41 through A13-46. Mobile A13-29 through A13-34 rendering was kept responsive and smoke-checked.

No commit, push, PR, remote CI, or `/admin/**` changes were made.

## Canonical Stitch Screens

- A13-41 — Orgs Landing — Desktop (Synchronized Callouts): `bbe0bd39b31b4dc9a2836ce508f0b2b1`
- A13-42 — My Orgs / Active Memberships + Pending Invitation — Desktop (Repaired): `ecd913d7538a4a6c831012cdf933e0d7`
- A13-43 — My Orgs Empty State — Desktop: `df1c1c29bed44c14b80d87dd9930c2f3`
- A13-44 — Organisation Invitation Detail / Decision — Desktop: `e79ba086860445bbad3c0b40bbad7c49`
- A13-45 — Invitation Accepted / Membership Added — Desktop: `e3cbafbe51354f78b039d8c222e2ea5b`
- A13-46 — Learner Workspace Switcher — Desktop: `ff45296183f54176b58c920a9caadb80`

## A13-41 Duplicate Selection

Selected `bbe0bd39b31b4dc9a2836ce508f0b2b1` because its rendered Stitch screenshot is the current photo-led desktop composition with a central community photo and approved callout vocabulary. The older callout-only direction was not used.

Implemented callouts use the Stitch vocabulary: `Volunteer Induction`, `First Aid Drill`, `Leadership Training`, `School Prefect Training`, and `Community Values Series`.

Follow-up correction: `/org` now matches the compact desktop reference with visible learner top chrome, a browser-style `Private Workspace` preview card, the Stitch team-retreat image, and all five locked callouts. Mobile now reuses the same rendered preview instead of the older separate montage image. The current captures are `screenshots/a13-41-org-landing-desktop.png` and `screenshots/mobile-org-landing-regression.png`.

## Files Changed

- `app/org/page.tsx`
- `app/org/my/page.tsx`
- `app/o/[organizationSlug]/page.tsx`
- `app/dashboard/page.tsx`
- `components/navigation/BottomNav.tsx`
- `components/navigation/LearnerTopChrome.tsx`
- `components/navigation/LearnerWorkspaceSwitcher.tsx`
- `app/globals.css`
- `public/images/org-landing-community.jpg`
- `public/images/org-landing-montage.png`
- `public/images/org-landing-stitch-design-team.jpg`
- `public/images/org-landing-stitch-photo.jpg`

`components/navigation/LearnerTopChrome.tsx`, `components/navigation/LearnerWorkspaceSwitcher.tsx`, and the `public/images/` org landing assets were already part of the local org slice before this desktop pass; they remain untracked in the current worktree.

## Primitives Reused Or Introduced

Reused existing learner navigation, `BottomNav`, `Button`, organization summary data, and invitation accept/decline server actions.

Introduced a desktop workspace slot on `LearnerTopChrome`, a shared desktop/mobile `LearnerWorkspaceSwitcher`, desktop-only org landing photo surface styles, and responsive invitation summary/detail panel styles.

## Runtime Versus Stitch Differences

- Runtime uses a local crop from the current Stitch A13-41 asset for the desktop preview photo; the UI callouts are rendered as HTML/CSS so their text remains accessible.
- Demo-mode screenshots can show public landing, empty My Orgs, and switcher mechanics. Real membership, pending invitation, invitation decision, and accepted-membership states depend on authenticated local data.
- The workspace switcher shows live organization rows when memberships exist. In demo empty state it only shows Project Ve and My Orgs.

## Validation

- `npm run typecheck` passed.
- `npm run lint` passed.
- Local server: `APP_MODE=demo npm run dev -- -p 3002`.
- Playwright screenshots captured:
  - `screenshots/a13-41-org-landing-desktop.png`
  - `screenshots/a13-43-my-orgs-empty-desktop.png`
  - `screenshots/a13-46-workspace-switcher-desktop.png`
  - `screenshots/mobile-org-landing-regression.png`
  - `screenshots/mobile-my-orgs-empty-regression.png`

## Remaining Gaps

- Did not browser-validate real A13-42 membership + pending invitation, A13-44 accept/decline, or A13-45 accepted-membership states because the local demo session has no authenticated seeded invitation/membership data.
- Did not run a full production build after this final pass; typecheck and lint passed.
- `.review/anchor-13c-d1/changes.diff` is scoped to touched org/dashboard/navigation/global files, but some of those files already had pre-existing uncommitted local changes.
