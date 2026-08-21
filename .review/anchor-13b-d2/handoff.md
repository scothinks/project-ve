# Anchor 13B-D2 Desktop Learner Profile / Notifications / Transcript Handoff

## Scope

Implemented the locked desktop learner slice only:

- A13-24 - Learner Profile / Account - Desktop
- A13-25 - Notification Preferences - Desktop
- A13-26 - Help & Legal - Desktop
- A13-27 - Notifications Feed - Desktop
- A13-28 - Learner Transcript - Desktop

No dashboard, courses, missions, store, org, or admin routes were redesigned. No commit, push, PR, or remote CI was triggered.

## Stitch Screen IDs

- A13-24 - Learner Profile / Account - Desktop (Repaired): `492220ac5b7c400cae575403b65d4532`
- A13-25 - Notification Preferences - Desktop (Repaired): `4fc8dae0ab1f45f5b0a1bc15e7551689`
- A13-26 - Help & Legal - Desktop (Repaired): `d74cfa55dc2643d7a0742a1e270e8496`
- A13-27 - Notifications Feed - Desktop: `33f25d611ba543e985fc276f77e3ccb0`
- A13-28 - Learner Transcript - Desktop (Repaired): `56bf13a7dc32499f9d73867d4a79ec21`

## Changed Files

- `app/profile/page.tsx`
- `components/profile/ProfileForm.tsx`
- `app/notifications/page.tsx`
- `app/profile/transcript/page.tsx`
- `app/globals.css`

No `/admin/**` files were modified for this slice.

## Learner Primitives Reused

- `LearnerTopChrome` for desktop learner navigation: Home, Lessons, Missions, Store, Orgs.
- `BottomNav` remains mobile-only on these routes.
- Existing `ProfileForm` state and actions for profile RPC updates, password updates, sign out, notification preferences, and push subscriptions.
- Existing notification data/actions for read state, `Read all`, individual mark-read, category, timestamp, body, and optional CTA.
- Existing transcript RPC normalization from `getLearnerTranscript`.
- Existing learner tokens for warm background, green actions, soft surfaces, borders, and shadows.

## Desktop Primitives Introduced

- Responsive profile local rail for Account / Notifications / Help & Legal.
- Desktop account composition with profile details, account security, and Your Learning related links.
- Desktop notification preference grouping with two-column category sections and real push state.
- Desktop help/legal card grid.
- Desktop notifications feed composition with top learner chrome and wider card layout.
- Standalone desktop transcript layout with Programmes and Courses columns plus a lightweight Back to Profile link.

## Responsive Changes

- Desktop behavior begins at `lg` while mobile A13-19 through A13-23 retain the compact profile/feed/transcript shells.
- Desktop content uses the existing learner topbar and `1116px` max-width pattern from the learner dashboard/store/courses surfaces.
- Mobile bottom navigation is hidden on desktop for these routes.
- Route-scoped learner backgrounds were added for `profile-learner`, `notifications-learner`, and `transcript-learner`; no global Admin defaults were changed.

## Screenshots

- `./a13-24-profile-account-desktop-1440.png`
- `./a13-25-notification-preferences-desktop-1440.png`
- `./a13-26-help-legal-desktop-1440.png`
- `./a13-27-notifications-feed-desktop-1440.png`
- `./a13-28-learner-transcript-desktop-1440.png`
- `./a13-24-profile-account-desktop-1280.png`
- `./a13-28-learner-transcript-desktop-1280.png`

Mobile regression captures:

- `./mobile-regression-a13-19-profile-account.png`
- `./mobile-regression-a13-20-notification-preferences.png`
- `./mobile-regression-a13-21-help-legal.png`
- `./mobile-regression-a13-22-notifications-feed.png`
- `./mobile-regression-a13-23-learner-transcript.png`

## Runtime Differences / Gaps

- Local screenshots were captured in demo mode, so A13-27 and A13-28 show real empty states instead of Stitch sample notification/transcript records.
- CTA rendering remains runtime-driven. Mission completion notifications still avoid manual reward-claim CTA treatment.
- Transcript cards still depend on real `get_my_lms_transcript` data and show only neutral remaining-requirement counts when supplied.
- Desktop topbar highlights Home because Profile is not a primary learner destination and no sixth primary nav item was added.

## Validation

- `npm run lint` - passed.
- `npm run typecheck` - passed.
- `npx tsc --noEmit --pretty false --incremental false` - passed.
- `git diff --check` - passed.
- Playwright screenshot QA captured desktop `1440px`, representative `1280px`, and mobile regression `390px` outputs.

## Review Artifacts

- `handoff.md`
- `changes.diff`
- Desktop and mobile screenshots listed above
