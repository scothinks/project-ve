# Admin reward economy: plain-language redesign

Date: 2026-09-10. Implementation approved on 2026-09-12 after the refined design review.
Work continues on the single local `codex/staging` branch; tests are batched after A–H implementation at the user’s request.
Owner: @scothinks. Initiative: [Reward Economy](https://github.com/users/scothinks/projects/4).
This is a bounded CMS/LMS product extension under the [canonical guardrails](codex/skills/project-ve-guardrails/SKILL.md)
and the [CMS/LMS product remediation plan](project-ve-cms-lms-product-remediation-plan.md).
It does not reopen engineering P2, the P1.5 organisation architecture, or any accepted
metering, job, entitlement or RLS boundary.

Interactive reference prototype: <https://claude.ai/code/artifact/1508271a-ba7b-4914-a6df-8135f5fcbced>.
The prototype is a design reference, not source to lift. It covers 16 screens and the six
creation flows described below, using the `--ui-*` roles, Source typography and Aperture mark
from the identity adoption work.

## Outcome

A programme officer who is not technical can run the reward economy end to end: publish a
mission without knowing what `lesson_count_completed` means, see at a glance why a reward is
not reaching anyone, understand configured prize selection shares and conditional fallback, and add or move
stock without leaving the campaign it belongs to.

No capability is removed. Every control the current forms expose keeps a home, and every
existing server action, RPC, entitlement check and editorial boundary is reused as-is. This is
a presentation and sequencing change over working behaviour, in the same spirit as the
course-authoring reskin.

## Evidence and gaps

Source inspected at `59ea597af00e0f6a53f3018f18292d410f1be59e` in the identity adoption
worktree, which is the only revision where the `--ui-*` vocabulary exists.

| Finding | Evidence | Consequence / required change |
| --- | --- | --- |
| The mission list is an eight-column table whose headings are data-model vocabulary. | `app/admin/missions/page.tsx`, columns `Repeatability` / `Validation`; `validationLabel()` renders `lesson_count_completed` as "Lesson count". | Replace with a card list stating the rule as a sentence. Keep scope, adaptation source and upstream-update signals. |
| Mission availability is invisible until you open the record. | `startsAt` / `endsAt` (`MissionEditorForm.tsx:362,366`), `withinDays`, `minimumAccountAgeHours` | Surface the window on the card. "Always on", "ends in 6 days" and "starts 1 Oct, not visible yet" are all derivable today. |
| The mission form is 36 fields in six sections on one page. | `MissionEditorForm.tsx` field inventory; sections Mission setup / Availability / Validation rule / Proof rule / Learner presentation | Sequence it. The proof section is only meaningful for `proof_upload`, so the sequence must branch rather than show dead fields. |
| Proof review renders raw identifiers and no media. | `app/admin/proofs/page.tsx` prints `organisation {id}` / `programme {id}`; each proof renders `proof.value` as text regardless of `proof_type`. | Resolve names, preview image proofs, and show the reviewer instructions the mission already stores. |
| Rejecting a submission is an unlabelled input beside a destructive button. | Same file; `rejectionReason` input, `maxLength={500}` | Make declining its own step with reusable reasons. The learner-facing message is already persisted. |
| Storefront state is computed from seven inputs and shown only as a verdict. | `getStorefrontState()` in `app/admin/rewards/page.tsx` derives nine outcomes from status, `is_enabled`, `visibility_mode`, `starts_at`, `ends_at`, `offer_expires_at`, campaign status/window and `total_available`. | Show the checklist and which condition failed. This is the single most common support question and the answer already exists in code. |
| Reward terms are not visible on the list. | `RewardEditorForm.tsx`: `perUserLimit`/`limitPeriod`, `fulfillmentType`, `offerExpiresAt`, `redemptionWindowDays`, `ownerScope`, `sharedWithProgrammes` | Carry them on the card so an officer can answer "who can get this, how, and until when" without opening the editor. |
| The perk prize table is ten columns and exposes raw weights. | `app/admin/rewards/perks/[id]/page.tsx`, columns `Prize`…`Weight`…`Remaining total` | Present positive weight as a configured share among enabled prizes, conditional on eligibility. Keep `dailyWinCap`, per-prize enable/disable and the draw log intact. |
| Release windows have no presence in the UI hierarchy. | `savePerkReleaseBucket` / `deletePerkReleaseBucket`, RPC `admin_upsert_perk_prize_release_bucket`, fields `label`, `startsAt`, `endsAt`, `releaseCap` | Give buckets a first-class section. They are the mechanism for pacing scarce stock and are currently hard to discover. |
| A perk is a reward, but the product presents them as separate worlds. | `RewardDistributionMode = "direct" \| "perk_bundle"` in `lib/rewards.ts` | Make distribution mode an explicit choice in reward creation, and route a `perk_bundle` reward to its prize pool on publish. |
| Inventory is two standalone forms with no view of current stock. | `app/admin/inventory/new/page.tsx`, `app/admin/inventory/reallocate/page.tsx` | Put stock in the campaign and reward it belongs to. Keep both entry points working. |
| The batch dry-run is the strongest safety feature here and is nearly invisible. | `dryRunInventoryBatch`, `InventoryBatchUploadForm.tsx` "Issues to fix" / "Warnings" | Make the dry-run the explicit final step of the batch path, with per-line problems and a partial-add that names the count. |
| Every date control is a bare `datetime-local` with no consequence stated. | `MissionEditorForm.tsx`, `RewardEditorForm.tsx:575`, `PerkEditorForm.tsx:272`, `CampaignForm.tsx:55,59`, both inventory pages, `InventoryBatchUploadForm.tsx:162,166` | Keep `datetime-local`. Add the sentence that says what the date does, and a no-end-date affordance where the field is genuinely optional. |
| Campaign budget context is collected and then hidden. | `CampaignForm.tsx`: `budgetLabel`, `description` | Show them on the campaign, next to the stock movements that reference them. |
| Redemptions mixes work that needs a person with work that does not. | `app/admin/redemptions/page.tsx` filters; `fulfillRedemption`, `refundRedemption` | Default the view to what actually needs action. Automatic fulfilment types need no queue. |

## What must come first

| Dependency | Verified state | Blocks |
| --- | --- | --- |
| Identity token cutover (`--ui-*`) | Merged in PR #111 at `fcb375f`; the foundation is consolidated into the canonical staging worktree. | Use the merged `--ui-*` roles on `codex/staging`; do not create a task branch or reintroduce retired tokens. |
| Component foundation | `shadcn/ui` + Radix primitives, `dnd-kit`, Tiptap, TanStack Table are the accepted set. | Introducing any competing component, drag-and-drop or grid library. |
| Schema | No migrations in this work. Every field named above already exists. | Anything requiring a new column. If a package appears to need one, stop and raise it rather than working around it. |
| Read-path rules | Card and list surfaces must use screen-specific projections and keep operation count constant as result sets grow. | Loading full reward, mission or prize graphs to render summary cards. |

## Work packages

Each package is independently shippable, keeps the surfaces it does not touch working, and
carries its own acceptance evidence. Packages A and H bracket the rest; B–G are per surface
and may be reordered.

**A — Shared vocabulary and field primitives.** The translation layer every other package
consumes: validation types and repeatability to sentences, `getStorefrontState()` to a
pass/fail checklist with a reason per condition, prize weights to configured selection shares,
duration fields (`withinDays`, `minimumAccountAgeHours`) as number-plus-unit, and a dated
field that states its consequence and supports "no end date". Pure functions plus presentational
primitives; no route changes. Unit tests are the gate.

**B — Missions.** Card list with the availability window, scope and adaptation state. Sequenced
create/edit over the existing `createMission` / `updateMission` / `createOrganizationMission` /
`updateOrganizationMission` / `adaptPlatformMission` actions, branching to a proof step only for
`proof_upload`. Publish and pause unchanged.

**C — Proof review.** A queue with resolved names, image preview by `proof_type`, the mission's
reviewer instructions in view, and declining as its own step with reusable reasons. One
`reviewProofSubmission` call per decision, as today.

**D — Rewards.** Card list carrying the terms strip and the storefront checklist from A.
Sequenced create/edit including `distributionMode`, routing a `perk_bundle` reward to its prize
pool on publish. Reward detail showing stock by batch and its movement ledger.

**E — Perks.** Perk list and sequenced creation. Prize pool presenting configured selection shares with
`dailyWinCap` and per-prize enable/disable intact, a first-class release-window section over
`savePerkReleaseBucket`, inventory assignment, and the draw log.

**F — Campaigns and stock.** Campaign list and detail with budget label, description, stock
positions and the movement ledger. Add stock as a sequenced flow that splits into a quantity
allocation or a batch upload ending on the `dryRunInventoryBatch` result. Move stock over
`reallocateInventory` with its reason retained.

**G — Redemptions.** Filtered queue defaulting to what needs a person, with `fulfillRedemption`
and `refundRedemption` unchanged and automatic fulfilment types excluded from the action count.

**H — Reward economy hub and navigation.** The home surface aggregating attention items across
B–G, and the navigation grouping that currently lists Missions, Proof reviews, Rewards and
Reward Campaigns as flat unrelated entries with perks and inventory unreachable from the top
level. Counts must come from a bounded read, not per-surface fan-out.

## Acceptance and validation

After the full A–H implementation (user-requested batch cadence):

```bash
npm run typecheck
npm run lint
npm run test:guardrails
git diff --check
```

Plus, by what the package touches: `npm run test:unit` for A and any derived-state logic;
Playwright coverage for the sequenced flows in B, D, E and F, including step navigation, the
branch conditions, and that values survive moving between steps; a browser check that no
retired `--ve-*` or `--admin-*` token is reintroduced. Packages that change a list or card
surface must show that operation count does not grow with the number of rows.

No package is complete while any control named in the evidence table above has lost its home.

## Approved design corrections

The [refined design review](evidence/reward-economy/design-review-2026-09-12.md) is the
current visual reference. Fallback XP/boost is conditional, never a permanently
weighted no-prize slice. The current RPC clamps enabled weights to at least one;
disabling a prize is distinct from setting its weight. Configured shares do not
promise live win rates. Proof review has no atomic undo. Intentional distribution
restrictions are neutral states. Moving stock does not extend provider validity.
