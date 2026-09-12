# Project VE theme adoption — implementation plan and migration gates

Prepared 7 September 2026. **Plan only; implementation and deployment have not begun.**

The foundation must migrate by meaning before it migrates by appearance. Introduce one final semantic namespace, rewrite mixed colour consumers in the same cutover that activates aubergine, and allow only a small, enumerated neutral compatibility layer. That layer must disappear before the adoption release. Do not ship a sequence of brand aliases.

This plan follows the [read-only audit](theme-adoption-audit-2026-09-07.md) and [Project VE guardrails](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/docs/codex/skills/project-ve-guardrails/SKILL.md). The frozen direction is `project v/e`, Aperture A.2, Open signature, aubergine, Source Sans 3 + Source Serif 4, Aperture product grammar, tenant-owned identity and the subordinate “Learning on project v/e” endorsement. Conceptual relationships remain rationale. None of these creative decisions is reopened.

**Baseline:** commit `292e65a8f7784df31591e94abe65fec47ddd23b6`; [globals.css](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/app/globals.css) has 4,973 lines. The audit found 116 production files with `--ve-*`. This additional token scan covers 515 tracked TS/TSX/CSS/JS files in `app`, `components`, `features` and `lib`, including definitions, aliases and font plumbing. Counts from these two scopes are not interchangeable.

**Companion artifacts:** the [108-token disposition ledger](theme-adoption-migration-2026-09-07-tokens.md), [CSV](theme-adoption-migration-2026-09-07-tokens.csv), and [JSON consumer manifest](theme-adoption-migration-2026-09-07-tokens.json) enumerate every legacy token found, its disposition, owner batch, deletion gate and current file/line references. The manifest is a static baseline, not a claim that each colour use has already been semantically adjudicated. Refresh it at G0; any unclassified occurrence blocks G2.

**The deletion budget is explicit:** 12 unused tokens deleted in B0; 72 active colour/role tokens rewritten directly and retired in B2; 2 font tokens rewritten directly and retired in B3; at most 22 neutral adapters introduced in B2 and all deleted by B5. A newly found undefined token, `--ve-soft`, is used for two admin organisation backgrounds; it belongs to the direct B2 rewrite, not a new compatibility definition.

**The final token contract**

Use `--ui-*` as the single final CSS role vocabulary. Runtime colour definitions live in proposed `app/styles/theme.css`, with explicit literal values for light and OS-preferred dark. Do not add `--brand-*`, `--identity-*`, palette-number indirection or another admin/learner colour namespace. The frozen study JSON contains historical alternatives and must not become the runtime token source.

| Final role | Light | Dark | Meaning |
|---|---|---|---|
| `--ui-canvas` | `#f6f3ed` | `#201c23` | Page backdrop |
| `--ui-surface` | `#fffdf9` | `#2b2530` | Main content surface |
| `--ui-text` | `#252327` | `#f6f3ed` | Ordinary readable foreground |
| `--ui-text-muted` | `#625968` | `#c4b9ca` | Secondary readable foreground |
| `--ui-action` / `--ui-on-action` | `#583c63` / `#fffdf9` | `#d6bce2` / `#281b2e` | Primary action and paired foreground |
| `--ui-current-bg` | `#e8e0ec` | `#43344b` | Field behind the current region |
| `--ui-support-bg` | `#f0d2b8` | `#624737` | Editorial supporting field |
| `--ui-border` | `#918794` | `#95889f` | Meaningful boundary |

Additional functional roles require both literal mode values and a documented use before G2: chrome; inset, quiet, muted and raised surfaces; subtle text/border; action hover/pressed/soft pairs; current rail/text; focus; success, warning, danger and information with foreground/container pairs; category learning/mission/reward pairs where existing recognition requires them; shadow channels/opacity. These are operational derivatives and status colours, not permission for a new palette study. Add a role only for a distinct use, not to give every old token a renamed equivalent. Equal values may appear in two genuinely different roles; express both as literals rather than an alias chain.

`surface-inset` serves recessed controls/panels; `surface-soft` quiet sections; `surface-muted` subdued regions; `surface-raised` elevated cards/overlays; `chrome` persistent navigation. G2 must prove these distinctions remain useful. If a proposed role has no distinct use, collapse its consumers into an existing role and reduce the adapter budget. Never create an extra alias to preserve the distinction in name alone.

Semantic colour tokens must not reference legacy tokens **or other semantic colour tokens**. A component recipe may mix terminal roles, for example an overlay or border treatment; that does not authorise a second token tier. `--ui-shadow-rgb` is a terminal numeric channel value for existing alpha recipes, not a duplicate brand RGB palette. Remove hue RGB tokens at B2. Font variables are terminal outputs of `next/font/local`; use `--ui-font-body` and `--ui-font-display`, with fallbacks at consumption, without a second font alias layer.

Example of the only permitted temporary relationship, introduced in B2:

```css
/* theme.css — terminal, mode-specific value */
:root { --ui-surface: #fffdf9; }
@media (prefers-color-scheme: dark) {
  :root { --ui-surface: #2b2530; }
}

/* theme-compat.css — temporary; deleted by G5 */
:root { --ve-card: var(--ui-surface); }
```

No `--ve-green` adapter is allowed. A primary action becomes `--ui-action` plus `--ui-on-action`; a successful result becomes the success pair; a selected item becomes a current/selection recipe; a reward badge retains reward meaning; ordinary green heading text may become `--ui-text`. One legacy name can therefore produce several direct replacements. A colour-replacement script cannot make that decision.

**Exact compatibility policy**

The 22 permitted adapters are fully mapped in the ledger. They comprise `--foreground`; the VE shell, panel, card, muted-text, line and shadow families; and the admin neutral surface, border and text families. They are a maximum, not a quota. Even these mappings require checking their consumers in root, learner, dashboard and admin contexts before activation: old scoped overrides do not survive implicitly.

All compatibility declarations live in proposed `app/styles/theme-compat.css`, with values exactly `var(--ui-<terminal-role>)`. No fallback to another legacy name, no scoped redefinitions, no reverse references, no compatibility declarations inside components. Remove the old root, learner and dashboard definitions in B2. Do not retain `--admin-surface-milk → --ve-shell`, or any `--ve-* → --learner-*` relationship.

Every adapter carries its exact existing consumer set, responsible batch, last-use gate and deletion condition. B4 owns learner/organisation consumers; B5 owns remaining admin/public/other consumers and deletion of the file. Each implementing PR names its implementer. Remove an adapter in the same change that removes its last consumer; G5 is the hard latest deadline. No release with “cleanup later,” no growing the allowlist to make CI green, no moving adapters into a component to hide them.

Immediately unused, subject to G0 confirmation:

```text
--admin-on-primary-container    --admin-on-secondary-fixed
--admin-secondary-container     --admin-surface-container-highest
--admin-tertiary-container      --learner-atmosphere-mint
--learner-atmosphere-warm       --learner-success
--ve-intro-control              --ve-intro-panel
--ve-store-rgb                  --learner-reward-rgb
```

The last two form an unused chain: only the unused store alias refers to learner reward RGB. Delete them together. “Immediate retirement” for active tokens means consumer rewrite and definition deletion in the **same B2 cutover**, never an earlier deletion that breaks live consumers. All other `--learner-*` colour names, all hue/action/status legacy families, `--admin-outline`, `--admin-brand-hero`, `--background`, `--ve-ink`, remaining intro tokens and undefined `--ve-soft` take that direct path. Only `--font-geist` and `--learner-body-font` survive to B3 without adapters.

**Migration gates and execution order**

G0 → G1 → G2 → G3 → G4 → G5 → G6. Each batch starts from the previous accepted source/build. Review lanes inside B2 may be separate commits, but activation, shared recipes and direct consumer rewrites integrate and roll back together. Intermediate gates are local/preview evidence, not permission to deploy intermediate mixed states to production. Implementation approval and eventual hosted release approval remain separate from this plan.

**B0 — establish the migration contract and remove verified dead definitions**

**Files/components →** [globals.css](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/app/globals.css), all production style consumers recorded in the manifest; proposed `scripts/check-theme-contract.mjs`, `tests/unit/theme-contract.test.mjs`, `tests/e2e/theme-adoption.spec.ts`, a migration registry under `docs/evidence/theme-adoption/`, and [package.json](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/package.json). Keep documentation/checking separate from rendering code.

**Semantic changes →** Inventory only; delete the 12 verified unused definitions and the dead alias edge. Write the final role dictionary, per-occurrence ownership, literal-colour exceptions and evidence matrix. The contract initially accepts the current legacy baseline and ratchets forward by gate. Add proposed `npm run test:theme-contract` to the existing `ci` command; do not weaken existing CI jobs.

**Explicitly excluded behaviour →** No visible theme, type, geometry, route, tenant-data or component-state changes. No dependency refresh, CSS-wide formatting, database reset or new fixture writes outside disposable local test data.

**Tests/evidence →** Capture baseline screenshots and computed colour/font/focus styles **before deletion**, then show parity after it. Scan all production source including new/untracked source, imports, inline styles and CSSOM/string construction; confirm the 12 tokens have no live consumers. Every token and colour literal has an owner/disposition. Check the scanner with meaningful negative fixtures: cycle, chained adapter, missing token, new legacy consumer and expired adapter must fail. Run its focused test with `node --experimental-strip-types --test tests/unit/theme-contract.test.mjs`. Record source SHA, scope, paths and hashes. Run the contract and `git diff --check`.

**Rollback boundary →** Revert the B0 commit as a unit; no data rollback. Baseline evidence remains an archived record, not runtime state.

**G0 exit →** No unknown production token references or unresolved dynamic use; baseline captures available; 12 removals proven dead; registry coverage complete. The currently undefined `--ve-soft` is an explicitly recorded defect scheduled for G2, not silently accepted as a defined variable.

**B1 — create a small stylesheet seam with visual parity**

**Files/components →** [globals.css root/admin light and dark blocks](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/app/globals.css#L3); proposed temporary `app/styles/theme-legacy.css`. Keep learner/dashboard overrides in their original positions until B2.

**Semantic changes →** None. Extract only root light/dark token blocks verbatim after B0 cleanup. Preserve Tailwind import ordering, unlayered precedence and mode selectors. Leave layout rules in place. This is a controlled entry point for replacement, not a 5,000-line stylesheet reorganisation.

**Explicitly excluded behaviour →** No renamed live tokens, palette activation, new theme provider, altered selectors, layer-precedence redesign or component refactor.

**Tests/evidence →** Production build, theme contract, computed-style comparison and same-browser screenshot comparison against G0 for the matrix below. Root, learner override, dashboard override and body-portalled dialog/select must match before and after extraction. Any difference requires explanation and correction in B1, not a deferred expectation update.

**Rollback boundary →** Restore the G0 build or revert the extraction and import together. Do not roll back only one file.

**G1 exit →** No intended visual differences and no changed resolved token values; stylesheet import/build parity demonstrated. `theme-legacy.css` has an expiry of B2.

**B2 — atomic foundational colour and role cutover**

**Files/components →** Replace temporary `theme-legacy.css` with proposed `theme.css` and `theme-compat.css`; [globals.css learner/dashboard blocks and route backgrounds](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/app/globals.css#L370); [WelcomeCarousel CSS](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/components/welcome/WelcomeCarousel.module.css); every G2 occurrence in the JSON manifest. Critical shared files: [Button](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/components/ui/Button.tsx), [Card](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/components/ui/Card.tsx), [StatusBadge](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/components/ui/StatusBadge.tsx), [XPBadge](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/components/ui/XPBadge.tsx), [AdminPrimitives](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/components/admin/AdminPrimitives.tsx), [AdminDialog](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/components/admin/AdminDialog.tsx), [AdminSelect](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/components/admin/AdminSelect.tsx), and [organisation admin backgrounds](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/app/admin/organizations/page.tsx#L233). Page-level hue consumers are in scope now, even when their layout/identity treatment belongs to a later batch.

**Semantic changes →** Activate terminal aubergine roles in both modes only when all mixed-role consumers have direct replacements. Separate action, success, selected/current, category, warning, danger and reward. Pair foreground/background for normal, hover, pressed and soft variants; remove forced white action text and hue-specific shadows where incompatible. Replace weak mixed focus treatments with a visible focus role. Resolve learner/dashboard token overrides and literal gradients together; remove forced light colour scheme so OS dark works throughout. Preserve portal inheritance using root operational roles. Install only the approved neutral adapters; directly rewrite all learner colour consumers to remove the scoped alias system. Remove the 72 G2 legacy names and all their definitions, including the formerly undefined `--ve-soft` references.

**Explicitly excluded behaviour →** No font/signature change yet; no layout/radius overhaul; no manual mode toggle or preference persistence; no tenant-wide colour override; no status, eligibility, grading, XP, redemption, progress or “current item” algorithm changes. No read-model, query, authentication, invitation or server-action edits. No new library or global `!important` overrides to conceal broken recipes.

**Tests/evidence →** Every occurrence gets a final role, component/state, mode pair and reason in the registry; no unresolved “green means…” rows. Audit hardcoded literals and forced foreground classes beside the token references. Run typecheck, lint, theme contract and guardrails, then one production build and the targeted browser group. Capture actual rendered pairs on mixed surfaces, not just the raw token table. Project acceptance thresholds: normal text at least 4.5:1; large text at least 3:1; meaningful control/state boundaries and focus indicators at least 3:1 against adjacent colours. Keep a text/icon cue for status; disabled states remain identifiable without implying actionability. Check placeholder/link/selected/wrong/correct/danger/hover/focus-visible states, portalled content and learner OS dark. The known white-on-dark-primary and 14% focus-ring substitution failures must be explicitly closed.

**Rollback boundary →** Restore the entire G1 application artifact, including old consumer classes, shared recipes, imports and tokens. Never revert only `theme.css`: the old foreground/status assumptions and new palette are incompatible. No compatibility feature flag or parallel old/new palette is retained as a rollback mechanism.

**G2 exit →** All terminal role values and pairs specified; zero G2-token definitions/references; no legacy scope overrides; at most 22 permitted neutral adapters; only the two scheduled font names remain outside that set. Zero new undefined references or chained adapters. Full matrix has intentional colour changes only; workflow and layout checks pass. **A failure on one shared primitive blocks this entire cutover.**

**B3 — adopt frozen typography and shared brand signatures**

**Files/components →** [app/layout.tsx](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/app/layout.tsx#L8), typography rules in globals, production font assets/licences; proposed focused `components/brand/BrandSignature.tsx`, `PlatformEndorsement.tsx` and frozen A.2 vector asset. Consumers include [LearnerTopChrome](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/components/navigation/LearnerTopChrome.tsx), [PublicInfoShell](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/components/navigation/PublicInfoShell.tsx), [LearnerWorkspaceSwitcher](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/components/navigation/LearnerWorkspaceSwitcher.tsx), [OrgLearnerMobile](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/components/organizations/OrgLearnerMobile.tsx), [AdminShell](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/components/admin/AdminShell.tsx), login and welcome signage. Inventory all remaining brand placements rather than stopping at this list.

**Semantic changes →** Load Source Sans 3 for product/signature and Source Serif 4 selectively for expressive text. Preserve italics and language coverage. Apply the frozen Open signature: letters weight 600, native U+002F slash weight 500, `.035em` slash side spacing, `.22em` word gap and `-.018em` tracking; use the existing horizontal and compact arrangements. Isolate signature children from old circular-span and uppercase rules. Use canonical accessible name “Project VE”; decorative internal mark/letter fragments must not create repeated screen-reader speech. Define the neutral endorsement component; tenant placement follows in B4. Retire `--font-geist` and `--learner-body-font` directly.

**Explicitly excluded behaviour →** No geometry, slash, font-family or palette exploration; no global string replacement; no metadata/machine-identifier rename; no route/hydration changes to show the mark. No serif conversion of every heading, uncontrolled synthetic weights, new typography framework or loss of native controls' labels.

**Tests/evidence →** Theme/font contract, typecheck/lint, production build and visual matrix. Compare wordmark at 16/20/24/32px mark sizes, compact/mobile/collapsed use, light/dark and neutral endorsement. Verify accessible names, long organisation names, 200% text zoom, fallback fonts, numbers, table density, button wrapping and editor italics. Record actual shipped compressed font bytes and per-route requests, not study TTF size; gate on a reviewed payload budget fixed before integration. Serif must not be globally preloaded where unused. Compare A.2 path data to the frozen source; inspect favicon-scale geometry without redesigning it.

**Rollback boundary →** Restore the G2 application artifact including fonts, markup and dependent selectors. Keep immutable prior font assets available to already-open older builds until ordinary asset retention allows cleanup.

**G3 exit →** Both legacy font names absent; all platform signature placements use the approved component or an explicitly recorded icon-only placement; no clipped controls, missing glyphs or unexpected font loads. Typography evidence covers dense admin as well as learner screens.

**B4 — apply learning grammar and tenant ownership**

**Files/components →** [dashboard continuation](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/app/dashboard/page.tsx#L63), [CourseLibrary](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/components/course/CourseLibrary.tsx), shared course/lesson/quiz/mission components, learner navigation/profile/notifications/transcript routes, `app/o/` presentation, organisation chrome, workspace switcher and the tenant identity slots in AdminShell. The B4 consumer set is every remaining adapter use in these paths, including learner rules in globals; admin/public shared owners finish in B5.

**Semantic changes →** Use the supported core, released background corner and explicit leading current-state emphasis where the existing product already identifies the current region. Preserve separate selected, completed, correct/wrong and progress treatments. Tenant name/logo lead on mobile and desktop; the neutral “Learning on project v/e” endorsement remains subordinate and separate from Points, verification and workspace switching. Use a contain-style logo slot without cropping or wrapping tenant artwork in Aperture. Consume only already-authorised tenant name/short-name/logo fields. Move all B4 neutral consumers directly to terminal roles; delete adapters whose last consumer disappears.

**Explicitly excluded behaviour →** No inferred current selection, programme/delivery merging, renamed Points, grading/XP/redemption changes, new tenant lookups or public organisation exposure. No arbitrary tenant colour/font capability or reinterpretation of persisted `green`, `mission`, `store`, `violet`, `slate` presets. No crop/mask over question text, media, controls, tables or focus outlines. No change to the structured learning model, publication snapshots or permission logic.

**Tests/evidence →** Contract, typecheck/lint/guardrails and focused browser coverage for dashboard continuation, course delivery identity, lesson preview/publication and organisation missions. Exercise the same course in two programme deliveries, long/missing/transparent/wide tenant logos, tenant A then B then personal workspace, mobile and desktop and both modes. Confirm no tenant styling/identity leaks into shared root or portals. Compare visible progress, resume URLs, unit labels and first-useful HTML to the baseline. Preserve the existing 24px lesson-preview assertion unless a specifically reviewed background-only geometry change justifies an equally precise replacement; never weaken it to “is visible.”

**Rollback boundary →** Restore G3 including consumer code and any adapter definitions deleted in B4. No data rollback; organisation identity and progression records are unchanged.

**G4 exit →** B4-owned production paths contain zero legacy references; remaining adapter consumer lists have shrunk and identify exact B5 owners. Tenant ownership and current/completed distinctions proven without new reads or behaviour.

**B5 — finish operational/public surfaces and delete compatibility**

**Files/components →** All remaining registry consumers: admin shells, primitives, tables, dialogs/selects, Tiptap/dnd-kit/AI/media controls; public/auth/onboarding/support/ad host presentation; remaining globals rules and welcome module. Browser identity files: [icon.tsx](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/app/icon.tsx), [apple-icon.tsx](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/app/apple-icon.tsx), [manifest.ts](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/app/manifest.ts), viewport metadata in layout and existing push icon references. Delete `theme-compat.css`, its import and the temporary registry allowances.

**Semantic changes →** Finish direct neutral-role consumption and consistent operational hierarchy without changing workflow. Export A.2 browser/install assets with real dimensions matching declarations. Align browser colours. Bounded generic brand-copy adjustments may remove compulsory “Values Education” decoding in login/manifest, preserving the canonical name and actual product promises. Keep third-party sponsor/logo colours intact. Delete every remaining legacy token definition/reference; no renamed compatibility file survives.

**Explicitly excluded behaviour →** No new tables/editor architecture, disclosure/cost/approval flow, publication lifecycle, AI prompts, legal/course content or stored notification rename. No welcome journey replacement: equal “Start learning” / “Create an organisation” entry, localStorage readiness removal and the reset-password destination gap remain separate #91 behaviour work. Do not claim #91 complete through theming. No support-widget internals, sponsor artwork recolouring, new service-worker cache strategy, schema migration or tenant provisioning change.

**Tests/evidence →** Theme contract must pass with an empty legacy allowlist. Typecheck/lint/guardrails; targeted admin release, authoring/media/lesson browser coverage selected for touched controls; auth-route boundary smoke preserving safe destinations, recovery, invitation and organisation context. Check keyboard selection, focus trapping/return, drag handles, editor formatting and pending/destructive/AI-cost states. Inspect actual icon responses, dimensions, MIME types, manifest/viewport colours and notification icon URLs on a production build. The audit observed a fixed 512px response behind a size query; demonstrate correct output rather than only changing the manifest string. Record final brand-copy diff and untouched machine identifiers.

**Rollback boundary →** Restore the entire G4 artifact, which includes the compatibility definitions required by G4 consumers. Retain previous immutable assets for old open pages. Do not redeploy old JS against only the new stylesheet.

**G5 exit →** Zero `--ve-*`, `--learner-*`, `--admin-*`, `--background`, `--foreground` and `--font-geist` declarations/references in production source, including generated CSS and inline/CSSOM usage. Temporary legacy and compatibility files/imports are absent. The contract permanently forbids reintroduction. Historical study files and scanner test fixtures are explicit non-production exclusions; they are not runtime escape hatches.

**B6 — qualify the integrated release and rehearse rollback**

**Files/components →** Integrated application build, final test evidence/CI, migration registry closure, authoritative product/remediation gate documentation and an immutable rollback artifact. No new design or product scope.

**Semantic changes →** None beyond B2–B5. Make completed local adoption and remaining hosted rollout status explicit. When implementation is authorised, reuse the existing identity/entry initiative and relevant issues; record real evidence before Done. Do not activate unrelated backlog or duplicate the Task Log.

**Explicitly excluded behaviour →** No hosted deployment without release authorisation; no hosted-data reset, paid provider calls, P2 query tuning or broad security changes to make checks pass. Existing release requirements remain in force.

**Tests/evidence →** Run `npm run ci` on the integrated SHA, including the new theme contract. Required existing CI jobs still pass; run broader browser coverage once after integration, reusing valid focused results where unchanged. Repeat the full visual/state matrix on the production build. Rehearse previous-build → candidate → previous-build locally/preview, verifying fonts, CSS, icons, navigation and no missing assets. Record exact source/build IDs, environment, commands/results, screenshots, computed pairs, exceptions and rollback procedure. Existing CI database gates are not removed; no manual database suite is added merely because colours changed. Hosted acceptance, once separately authorised, verifies the exact deployed SHA and browser/asset behaviour before promotion.

**Rollback boundary →** Whole immutable application deployment to the last accepted pre-adoption release. There are no schema/data migrations in this plan. Retain prior assets through the hosting cache-retention window and verify an already-open prior page still resolves its assets. If asset retention is unsupported, solve that release dependency before promotion.

**G6 exit →** All B0–B5 gates evidenced, no legacy adapters, existing CI green, integrated visual acceptance and rollback rehearsal complete. Local completion is recorded separately from deployment. No statement of hosted success without hosted evidence.

**Cross-batch evidence matrix**

Use deterministic local fixtures and the same browser/build environment for comparisons. Every batch's browser evidence must use a production build of that batch's exact source; rebuild after code changes, never validate B4 against a stale B3 server. This matrix is a test plan; no new runtime captures were made while preparing it.

| Surface | Required contexts and states |
|---|---|
| Welcome, login, public information, organisation offer | Anonymous; existing next/reset/invite routes; readiness/loading; error/focus; ordinary CTA behaviour |
| Dashboard/library/course/lesson | Personal learner; resume/current/completed; loading/empty/error; long text; media and structured tables |
| Quiz/missions/rewards/profile/transcript | Selected/correct/wrong/disabled; success/warning/danger; tenant unit label; progress and history |
| Organisation learning and workspace chrome | Two tenants plus personal context; long/missing/wide logo; two deliveries of one course; endorsement; programme/cohort labels |
| Admin/CMS/AI/media | Platform and organisation roles; dense tables; drawer/select/confirmation portals; focus return; editor/drag interaction; pending/cost/publication states |
| Browser/hosted integrations | Icon/install metadata; light/dark browser chrome; host support/ad cards; unchanged third-party artwork |

Capture 390px mobile and 1440px desktop in both OS modes for representative surfaces; add 320px narrow layout, 200% text zoom and reduced motion for shared chrome/content. Include keyboard navigation and fallback-font rendering. B1 requires parity. B2 permits only documented colour/state-presentation changes; B3 adds type/signature; B4–B5 add documented grammar/placement. Do not accept blanket snapshot updates. New functional regressions block their batch even if the screenshots look better.

Existing useful suites: [admin workspace release](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/tests/e2e/admin-workspace-release.spec.ts), [learning card read models](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/tests/e2e/learning-card-read-models.spec.ts), [lesson preview](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/tests/e2e/lesson-preview.spec.ts), [lesson publication](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/tests/e2e/lesson-publication.spec.ts), [organisation missions](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/tests/e2e/organization-missions.spec.ts), [auth route boundary](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/tests/e2e/auth-route-boundary.spec.ts), [media picker navigation](https://github.com/scothinks/project-ve/blob/292e65a8f7784df31591e94abe65fec47ddd23b6/tests/e2e/media-picker-navigation.spec.ts) and relevant `ai-*-authoring`/release specs. Extend them only where they protect a real affected interaction; add focused visual/token coverage in the proposed theme spec. Existing workflow tests do not by themselves prove theme accessibility.

Planned commands, selected per batch as above:

```text
npm run test:theme-contract                      # new command, introduced in B0
npm run typecheck
npm run lint
npm run test:guardrails
npm run build
npm run test:e2e -- tests/e2e/theme-adoption.spec.ts
npm run test:e2e -- tests/e2e/admin-workspace-release.spec.ts tests/e2e/lesson-preview.spec.ts tests/e2e/learning-card-read-models.spec.ts
npm run ci                                      # integrated G6
git diff --check
```

Browser suites use the existing local runner and disposable local database fixtures where needed; never substitute hosted credentials. Follow the guardrails' smallest-sufficient cadence rather than repeating full remediation/reset commands per CSS edit.

**How the migration contract prevents permanent archaeology**

The checker must parse declarations and references across CSS, source strings/Tailwind arbitrary values and generated CSS. Regex inventory alone cannot prove cascade or runtime correctness. Track full consumer identities and ownership, not just counts: moving one old reference elsewhere while deleting another must not evade the ratchet. Import reachability and dynamic-style checks must expose any additional production sources. No wildcard legacy exceptions.

Before G2, reject newly introduced legacy uses, missing disposition rows and unresolved role decisions; validate that planned direct deletions land with consumers. From G2, accept only the exact neutral adapters and the two fonts until G3. Every adapter value must be exactly one reference to a defined terminal token. Check cycles, chain depth, duplicate/scoped legacy definitions, canonical-to-legacy references, missing mode values and undefined terminal roles. From G4, reject any B4-owned legacy use. From G5 onward, the allowed production legacy set is empty. The checker also flags new unclassified colour literals; intentional tenant/sponsor artwork and functional/category exceptions need exact path/property/purpose records, not a blanket directory exemption.

The migration registry is evidence, not a runtime token generator. On completion retain the historical ledger for audit, remove its allowances from enforcement, and keep the zero-legacy and terminal-role checks in CI. No extra compatibility namespace, fallback chain or “temporary” export remains to frighten a future maintainer.

**Preparation validation:** only this plan and companion output artifacts were created in the repository. Checked 108 ledger rows, 4,364 static reference occurrences and 39 local file links against source; confirmed the unused alias chain and zero tracked changes. `git diff --check` passed. Product source, theme values, dependencies, database, GitHub and Wiki remain unchanged. All implementation tests and migration gates above are planned, not passed results.
