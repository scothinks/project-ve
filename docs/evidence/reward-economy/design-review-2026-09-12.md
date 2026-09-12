# Reward Economy reference review — 12 September 2026

Reviewed the user-supplied `Main-html.zip`, the existing Reward Economy Project #4
and issues #116–#123, the clean `codex/admin-reward-economy-redesign` planning
branch, and the implemented admin surfaces on the merged identity revision.
Archive content is reference material, not implementation authorisation. In
particular, its README's instruction to replicate styling faithfully does not
supersede the user's request to improve the design.

## Assessment

Keep the operational focus: pending work first, readable mission rules, staged
creation, evidence beside reviewer instructions, reward availability explanations,
and stock operations reached from campaigns. The design needs clearer visual
hierarchy, a practical mobile layout, and stricter alignment with existing
behaviour before implementation.

The prototype is broader than a rewards store: it proposes a complete admin
operating area with 16 screen states and six creation flows. Production work is
already split into A–H; no additional initiative or replacement tickets are needed.

## Recommended refinement

| Surface | Keep | Improve |
| --- | --- | --- |
| Overview | Pending work and direct actions | Make one ordered attention list with count, age, cause and action. Reduce competing tinted panels. Move the explanatory “How it flows” guide below operating information or into optional help. |
| Rewards and missions | Readable rules, scope, stock and availability | Use compact list cards/rows with stable comparison columns. Lead with name, availability, XP cost and stock; show the principal blocking reason inline. Expand the full checklist on demand. Preserve scope/adaptation metadata and access to every existing control. |
| Creation | Step trail, Back and final review with edit links | State the consequence of each field close to it. Show advanced terms progressively. Preserve values across steps; validate the current step without losing later values. Distinguish actual saved drafts from unsaved local state. |
| Proof review | Queue plus focused evidence and reviewer instructions | Let the evidence dominate, with a stable decision bar. Use “Approve proof”, “Decline proof” and “Skip for now”. Keep rejection reason editable and explicit. Show award success only when the real response confirms it. |
| Prize pools | Weights explained in understandable terms | Describe configured selection shares separately from live eligibility. Show disabled, depleted, capped and outside-window states. Present fallback as a separate conditional outcome. |
| Campaigns and stock | Budget label, stock positions and movement history | Keep summary stock rows compact. Make upload validation, affected quantity and final confirmation prominent. Campaign dates and stock/batch expiry need distinct language. |
| Redemptions | Work requiring a person first | Keep automatic and completed records findable. Make the fulfilment requirement and next action clear before expanding transaction details. |
| Navigation | Group the related operating surfaces | Reuse the existing AdminShell and workspace selector. Preserve the rest of the admin navigation instead of replacing it with this area's menu. |

Typography: preserve Source Sans 3, Source Serif 4 where established, Aperture and
semantic `--ui-*` roles. Use regular body text, semibold labels and stronger page
headings; the prototype uses weight 900 widely enough that almost every sentence
competes for attention. Use mostly neutral surfaces. Amber signals an approaching
limit or pending attention; red signals a failure or genuine blocker. Intentionally
hidden/system-only rewards are not errors.

Responsive behaviour: collapse navigation into the established mobile admin
navigation, stack overview/list content, and make proof review a queue → detail
flow with a way back. Form steps need a compact current-step indicator on narrow
screens rather than a permanently visible horizontal trail. Decisions and primary
form actions must remain reachable without horizontal scrolling.

## Behaviour mismatches to correct

1. **Prize probabilities are not faithful to the current draw.** `poolData()` uses
   a hard-coded `NOTHING = 27` and treats it as another weighted outcome. The
   current `redeem_perk_bundle` filters eligible prizes, orders candidates by
   weighted sampling, and attempts to fulfil a candidate. Fallback is used only
   when no candidate is selected. It is not a permanently weighted “no prize”
   slice. Eligibility includes dates, release windows, win caps, source-reward
   availability and stock. Zero weight is also clamped to at least one by the
   current draw expression; it must not be presented as “off”. Correct the A/E
   acceptance wording before implementing the probability display.
2. **Fallback choices add behaviour.** The mock offers “Give nothing back” and
   “Let them try again free”. The implemented fallback awards native XP or an XP
   boost. These new choices must not silently become part of this presentation-only
   project. Show the existing supported choices.
3. **Forecasts are invented.** “Empties Thursday”, “about two weeks left” and the
   pool's “sustainable” assessment come from static sample data or a fixed
   threshold. Current inventory facts can be shown immediately; depletion
   predictions require defined input data and a method. Remove predictive claims
   from the production design until those exist.
4. **Approval is not a reversible browser toggle.** The mock's Undo resets local
   state only. The current proof action accepts approved/rejected, writes an audit
   event, and approval can grant XP/rewards. It also has an
   `approved_pending_required_fields` result. Do not promise that Undo reverses an
   award, or that every approval immediately completes the reward.
5. **Intentional distribution is not a storefront failure.** System-only,
   campaign-only and hidden visibility modes are legitimate configurations. The
   mock sometimes renders these as red failures and offers to put them in the
   store. Keep configured distribution separate from actual operational blockers.
6. **Campaign expiry and stock expiry are distinct.** Moving stock does not by
   itself establish that an externally supplied code remains valid. Show the
   actual availability/expiry fields and the scope of the selected stock move;
   avoid blanket promises that a move prevents expiry.
7. **Mock interactions do not establish production support.** Save-draft,
   publish, file uploads, previews, filters and review counters include local-only
   or fixed example behaviour. Implement real pending, error, validation, empty
   and success states over the existing actions, rather than porting these handlers.

## Implementation sequence and boundaries

The existing order is appropriate: A (vocabulary/primitives), B–G by surface with
E following D, then H (integrated overview/navigation). Refine the overview,
reward list/detail and one creation flow together to establish the visual pattern;
reuse that pattern across the remaining packages. Keep existing fields, server
contracts, roles, tenant boundaries and editorial publication behaviour.

The prior identity dependency is resolved: GitHub PR #111 merged to `main` on
12 September 2026 at `fcb375f484e1f1419d337b656170d3c3b73468eb`. The Reward Economy
planning branch remains at `2052df2`; implementation should bring it onto a base
with the merged identity before adding visual code. Uncommitted welcome changes
in the separate identity worktree and AI changes in the root workspace are unrelated.

The hub's read-path acceptance also needs a concrete operation budget: its issues
currently request focused existing repositories, no new aggregate RPC and no
per-surface round-trip growth. Inspect the available read contracts before choosing
the implementation; do not quietly add an N+1 or broad workspace query to meet the
mock's counts.

## Evidence and current scope

The supplied prototype was rendered in an isolated browser. Reviewed desktop
captures at 1440px for overview, rewards and proof review. At 390px the overview's
document width was 608px; its fixed 248px sidebar squeezed the main content and
caused horizontal overflow. Captures are in
`output/playwright/reward-economy-review/` (local review evidence).

The user selected **“Improve the interactive design first”**. This pass delivers
that standalone review prototype at `output/reward-economy-design/index.html`.
Its README documents review paths and simulation limits. Serve that directory
locally on port 3345; bundled fonts and runtime avoid external dependencies.

The improved design includes the overview, four catalogues, proof review, prize
pool, two detail examples, redemptions and six setup flows. Search and filters,
expandable terms, field retention, conditional steps, proof decisions, relative
weights, enable/disable and sample fulfilment are interactive. Draft/publish,
refund, upload and stock operations remain simulated; no live state is changed.

Validation used a standalone Playwright walkthrough, not application E2E tests:

- Main screens, six setup flows and their review steps fit at 1440, 768, 390 and
  320 pixels with no document-width overflow after fixes.
- Search, empty state, available/needs-attention filters and disclosure checked.
- Decline requires an editable reason; approve/decline update the sample queue;
  no undo is presented. Fulfilment moves a sample record into Done.
- Prize weights update shares; all-off and one-enabled states were exercised.
- Conditional proof and code-batch flows, field retention, draft feedback,
  reduced motion and mobile menu were checked separately.
- The browser reported no uncaught page errors. Resources load from the local
  preview server. Screenshots and validation notes are in
  `output/playwright/reward-economy-design/`.
- `git diff --check` passed. Application typecheck, lint, database and guardrail
  suites were not needed: production source and contracts were not modified.

No application source, ledger logic, database schema or external Project status
was changed. A–H remains planning work; production implementation is a separate
scope. The reference HTML/runtime is review material and must not be copied into
production in place of the existing component and domain architecture.
