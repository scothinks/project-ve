# Anchor 13B-M2 Mobile Learner Profile / Notifications / Transcript Handoff

## Scope

Implemented the locked mobile learner slice only:

- A13-19 - Learner Profile / Account - Mobile
- A13-20 - Notification Preferences - Mobile
- A13-21 - Help & Legal - Mobile
- A13-22 - Notifications Feed - Mobile
- A13-23 - Learner Transcript - Mobile

No desktop implementation was added. No commit, push, PR, or remote CI was triggered.

## Stitch Screen IDs

- A13-19 - Learner Profile / Account - Mobile (Repaired): `f4fc4fe68c9a4368889a3315f0dda9b8`
- A13-20 - Notification Preferences - Mobile (Repaired): `1566423785aa456c944dd777b43a4333`
- A13-21 - Help & Legal - Mobile (Repaired): `140415f790674c758c34facaa4a2a60e`
- A13-22 - Notifications Feed - Mobile: `4630e95f08004bdebb2c99ee8f8d9b02`
- A13-23 - Learner Transcript - Mobile: `d54f83c141334bc9a2b21f9d29bf3b29`

## Changed Files

- `app/profile/page.tsx`
- `components/profile/ProfileForm.tsx`
- `app/notifications/page.tsx`
- `app/profile/transcript/page.tsx`
- `components/navigation/BottomNav.tsx`

No `/admin/**` files were modified for this slice.

## Implementation Notes

Reused existing learner runtime behavior:

- Profile updates still use the existing `update_my_profile` RPC path.
- Password changes still use the existing Supabase auth update path.
- Notification preferences still persist through the existing `notification_preferences` update path.
- Push alerts reuse the existing browser push subscription logic and real permission/support states.
- Notifications feed still uses existing notification data/actions for read state, `Read all`, individual read, timestamps, category, body, and optional runtime CTA.
- Transcript still uses `getLearnerTranscript` and repository-backed course/programme progress semantics.

Introduced or reshaped learner UI primitives inside the existing profile component:

- Shared Account / Notifications / Help & Legal profile tabs.
- Learner mobile account shortcut rows for Transcript and Notification Preferences.
- Stitch-aligned toggle rows and grouped preference surfaces.
- Stitch-aligned help/legal rows.
- Notifications feed card treatment with subtle category indicators.
- Transcript cards with programme/course grouping, progress percentage, completion date, and neutral remaining-requirement copy.

## Screenshots

- `./a13-19-profile-account.png`
- `./a13-20-notification-preferences.png`
- `./a13-21-help-legal.png`
- `./a13-22-notifications-feed.png`
- `./a13-23-learner-transcript.png`

All screenshots were captured from the local app at mobile viewport size `390x844`.

## Runtime Differences / Gaps

- The screenshots were captured in demo/local runtime, so the Notifications Feed and Transcript captures show runtime empty states when no backed data is available. The implemented pages preserve real data loaders rather than hardcoding Stitch sample records.
- A13-22 CTA rendering remains runtime-driven. Mission completion notifications suppress manual reward-claim CTA treatment; newly available mission CTAs render only when supplied by stored notification data.
- A13-23 only shows neutral missing-requirement counts from available transcript data and does not invent named requirements.

## Validation

- `npm run lint` - passed.
- `git diff --check` - passed.
- `npx next typegen` - passed after a stale generated `.next/types` route-type error appeared during `npm run typecheck`.
- `npm run typecheck` - not fully completed after typegen regeneration; the rerun became silent for several minutes and was stopped manually. A direct `npx tsc --noEmit --pretty false` pass completed before regenerating route types, and no app TypeScript errors were observed in the changed files.

## Review Artifacts

- `handoff.md`
- `changes.diff`
- Five mobile screenshots listed above
