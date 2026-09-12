# Reward Economy implementation evidence

The approved A–H design is implemented locally in the canonical
`/Users/scoteritemu/Nu-Project-VE` checkout on `codex/staging`. The prior production
identity foundation, AI authoring follow-up and background welcome XP changes
were consolidated first; see [local consolidation](../local-staging/consolidation-2026-09-12.md).
No deployment or remote branch update is part of this evidence.

## Integrated behaviour

- Shared step navigation keeps panels mounted, validates required fields before
  advancing/saving, focuses invalid fields, and preserves values after recoverable
  action responses and dry runs. Final review links back to each owning step and
  precedes the existing save action. Mobile uses a compact expandable step control.
- Mission cards describe completion, reward, repetition, timing and adaptation.
  Create/edit branches to proof requirements only for proof-upload missions.
- Proof queues resolve organisation/programme names in batches, display supported
  evidence media, show instructions, and collect a learner-facing decline reason.
  One submission stays in focus; skipping retains drafted reasons. Mobile has a
  queue/detail view, and decisions retain the queue's page and status.
- Reward cards expose terms and the ordered store-visibility checklist. Direct
  and perk distribution are available in the reward editor; the existing create
  action routes a perk to its pool. Intentional distribution restrictions remain neutral.
- Perk pool cards show configured selection shares, caps, assigned stock, release
  windows and draw history. Disabled prizes do not compete; enabled weights retain
  the RPC minimum of one. Fallback remains conditional, not a weighted outcome.
- Campaign and reward detail share stock allocation/batch summaries and a movement
  ledger. Contextual add/move links carry campaign and reward choices into staged forms.
- Batch upload ends with the existing server dry run. Entry diagnostics expose
  duplicate positions. Keeping unique new entries changes only the proposed input
  and requires another dry run; the import action revalidates it again. Import
  buttons name the checked count. Duplicate/invalid inputs are never silently accepted.
- Redemptions default to manual claims with submitted details and no fulfilment.
  All states, reward/campaign/date filters, CSV export, fulfilment and refund
  actions remain available. Campaign filtering occurs before the row limit.
- The economy hub and grouped desktop/mobile navigation connect all surfaces.
  Successful existing mutations invalidate the new hub along with their original paths.

No migrations, grants, policies, award algorithms or financial RPCs changed.
The canonical Radix/shadcn foundation and existing actions are retained.

## Read budgets and scope

| Surface | Query shape |
| --- | --- |
| Economy hub | At most five operations. Scoped published-mission and proof-item counts, owned reward summary projection, up to four enabled campaigns, and an exact manual-claim count. No auth calls inside the loader. |
| Claim ownership count | Two empty reward FK embeds and an OR over non-null matches, within one head/count request. No transferred reward ID list, per-reward reads or truncated counts. |
| Stock context | Four projections limited to 25 rows each, followed by at most two set-wise name lookups. No code payloads loaded. |
| Proof review | One bounded proof read, then batched profiles, only referenced missions, organisations and programmes. No per-proof queries. |
| Catalogue cards | Existing list projections and set-wise enrichments; no new per-card operations or lesson/content graphs. |
| Redemption filters | Action/campaign conditions applied before the result limit; campaign matching uses one FK embed instead of a capped reward-ID list. Existing scoped/RLS reads are preserved. |

Hub stock attention considers the latest 1,000 owned rewards and says when this
window is incomplete. Campaigns are platform/catalogue-only. Proof counts describe
evidence items, not distinct multi-field submissions. Stock summaries distinguish
imported rows from available stock. Moving stock does not extend provider validity.

The empty-embed count follows the documented [PostgREST embedded OR filter](https://docs.postgrest.org/en/stable/references/api/resource_embedding.html#or-filtering-across-embedded-resources).

## Validation

Validation is batched after implementation, per the user's instruction.
Checks use Node 22 and the local Supabase stack, with generated user identities.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed. |
| `npm run test:unit` | 314 passed. |
| `npm run test:guardrails` | 57 passed. |
| `npm run test:theme-contract` | Passed; 611 production files/assets checked. |
| `npm run test:economic-integrity:local` | Passed; existing concurrency and award/stock regression. |
| Production build and integrated browser acceptance | Passed. Five Reward Economy cases and the corrected organisation journey passed against the production build. |

The browser command is `npm run test:e2e -- tests/e2e/reward-economy.spec.ts tests/e2e/organization-missions.spec.ts`.
It builds the real application, then checks staged mission/reward/perk/campaign
creation, field retention and review links, optional date clearing, proof review
and drafted decline reasons, quantity/batch switching, duplicate repair and
repeated dry runs, campaign filtering, and seven surfaces at 1440px and 390px.
The organisation case also exercises the learner journey and actual mission
save/approval/award boundaries.

The batch regression exposed native fields resetting after a successful React
action; the shared form now cancels the native reset synchronously. The focused
stock regression passed after this fix. No financial rule was changed to pass it.

The new fast read contracts are included in `npm run test:guardrails`, already
part of CI. Browser coverage is in `tests/e2e/reward-economy.spec.ts`; the existing
organisation mission acceptance now navigates the staged availability/review steps.

Generated design and screenshot/recovery output is ignored by Git and ESLint.
Production source remains linted. The theme parser distinguishes the `font-black`
weight utility from actual black colour literals, with a regression test for both.

Screenshots are local ignored evidence under
`output/playwright/reward-economy-production/`. These checks do not establish hosted
rollout, provider fulfilment or the full unrelated application E2E suite. No database
migration or security-policy change was needed for this implementation.
