---
name: project-ve-guardrails
description: Use before starting any task in the Project VE repository. Applies remediation-era architecture, performance/read-path, security, testing, CI, and documentation guardrails so new work does not recreate god modules, query waterfalls, N+1 reads, unsafe caches, weakened RLS/RPC boundaries, missing gates, or stale remediation status.
---

# Project VE Guardrails

Use this skill before beginning any Project VE task. Keep it active while planning, editing, validating, and summarizing.

## Start Checklist

1. Read the current task against `docs/project-ve-engineering-remediation-plan.md`.
2. For admin/CMS/LMS/product work, also read `docs/project-ve-cms-lms-product-remediation-plan.md`.
3. For P1.5 Org Mode or institutional pilot readiness work, also read `docs/project-ve-cms-lms-phase-1-5-org-mode-institutional-pilot-readiness.md`; it takes precedence over earlier assumptions where it conflicts.
4. Check `git status -sb` and avoid reverting user changes.
5. Identify whether the task touches architecture, server-rendered read paths, repositories, caching, DB/RLS/RPCs, auth, notifications, XP, AI generation, CMS workflows, tests, CI, or remediation docs.
6. Pick the narrowest implementation that matches existing repo patterns.

## Architecture

- Do not create or grow god modules. Keep pages, routes, and server actions thin.
- Put domain logic in focused feature/domain/application/data modules.
- Extract only when it reduces real complexity or matches the local architecture.
- Avoid unrelated refactors while fixing scoped behavior.

## Performance And Read-Path Boundaries

Apply these rules when adding or changing a server-rendered page, route context,
repository, data loader, RPC, list/card surface, dashboard, or cache:

- Use a screen-specific read model and projection. Cards, lists, navigation and
  dashboards must not load full course/lesson/quiz/content graphs when they only
  render summary fields.
- Keep network operation count constant as result sets grow. Replace per-row or
  per-entity database calls with set-wise RPCs, batched `in` queries or another
  bounded read operation. `Promise.all` reduces elapsed time but does not fix an
  N+1 operation shape.
- Reuse request-scoped identity/profile resolution. Do not repeat auth/profile
  network calls inside layouts, pages and shared server loaders for one render.
- Establish organisation route context through the focused context operation.
  Keep course, mission, assessment, reward and reporting data in their focused
  repositories instead of growing a workspace god RPC.
- Keep rendering read-only. Server renders and GET handlers must not create
  referral tokens, award XP, reconcile balances or perform other mutations.
- Share caches only for public/editorial data with explicit invalidation.
  User-, organisation-, entitlement- or RLS-dependent results must remain
  request-scoped or use a proven tenant-safe key; never place them in a
  cross-user cache.
- Keep identity, XP, progress, continue-learning state and basic navigation in
  the first-useful-HTML path. Optional recommendations, missions, rewards, ads,
  organisation-switcher extras and notification decoration should stream or
  fail soft when product behavior allows.
- Do not trade away RLS/RPC/auth boundaries for speed. Service-role shortcuts,
  broadened grants and hidden client-side refetches are not performance fixes.
- Diagnose operation shape before adding indexes. P2 query/index tuning requires
  hosted query statistics and plans; local Docker timings alone are insufficient.
- Protect every repaired boundary with a focused contract. Extend
  `npm run test:guardrails` when a new invariant becomes part of the durable
  read-path architecture, and add pgTAP/repository/browser coverage when the
  boundary crosses those layers.

## Security Boundaries

- Never add broad grants, ownership changes, BYPASSRLS, disabled RLS, or blanket policies to make tests pass.
- For pgTAP or CI roles, grant only enough to reach the intended security check, never enough to skip it.
- Browser/learner paths must use supported public RPCs, API routes, or server actions. Do not raw-write privileged tables from tests or app code.
- Private RPCs and service-role-only primitives stay private unless the remediation plan explicitly says otherwise.
- Do not hardcode secrets, tokens, passwords, JWTs, service keys, or secret-shaped literals in tests, docs, fixtures, or CI.

## Tests And CI

- New security-sensitive behavior needs the right gate:
  - pgTAP for DB/RLS/RPC boundaries.
  - unit tests for pure domain/application rules.
  - Playwright for critical browser workflows.
  - local integration scripts for concurrency or repository contracts.
- If a new required validation command is added, wire it into CI or document why it remains manual.
- Keep `npm run test:guardrails` fast and aligned with the durable auth,
  projection, operation-shape, cache and first-useful-HTML contracts.
- Keep `npm run test:remediation:local` and the remediation docs aligned with current gates.

## CMS Product Work

- P0, P1 and P1.5A-P1.5F architecture is closed. Preserve it unless the user
  explicitly authorises a narrow extension; do not infer P2 authorisation.
- Treat the CMS component foundation as mandatory: `shadcn/ui` with Radix primitives, `dnd-kit`, Tiptap, and TanStack Table.
- Install, configure, and use the mandatory libraries when missing and relevant to the CMS workflow being remediated.
- Do not introduce competing component, rich-text, drag-and-drop, or data-grid libraries without explicit approval.
- Preserve the structured content model: course -> lesson -> page -> structured content block.
- Keep manual and AI-generated content in one editorial lifecycle, with AI provenance/status as secondary metadata.
- Replace native `window.alert()` and `window.confirm()` in CMS workflows with accessible dialogs, toasts, inline validation, and recoverable error states.
- Preserve learner-facing rendering compatibility when adding CMS authoring capability.

## P1.5 Product Work

- Treat `docs/project-ve-cms-lms-phase-1-5-org-mode-institutional-pilot-readiness.md` as authoritative for Org Mode and institutional pilot readiness.
- P1.5A through P1.5F are implemented and locally closed. Treat their accepted
  models and boundaries as the baseline, not as pending implementation tickets.
- Do not begin P2 until hosted query evidence has been captured and reviewed and
  the user explicitly authorises P2.
- Generalise existing missions, XP, learner, organisation, assessment and reward systems; do not create parallel systems for capabilities Project Ve already has.

## Documentation

- Update remediation/status docs in the same change when a task closes or a gate changes.
- Update `docs/project-ve-cms-lms-product-remediation-plan.md` when CMS/LMS product scope, gates, or completion status changes.
- Update `docs/project-ve-cms-lms-phase-1-5-org-mode-institutional-pilot-readiness.md` when P1.5 scope, gates, or completion status changes.
- Do not leave "next action" or "partial" notes stale after validation proves completion.
- Prefer exact command/results summaries over vague status language.

## Before Closing

Run the smallest sufficient validation, then broaden when the blast radius requires it. For remediation-affecting work, prefer:

```bash
npm run typecheck
npm run lint
git diff --check
```

Add DB, E2E, build, or full remediation gates when touched areas require them. Report any command you could not run.

For read-path, repository, auth, cache, dashboard or Org Mode changes, also run:

```bash
npm run test:guardrails
```
