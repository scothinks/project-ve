---
name: project-ve-guardrails
description: Use before starting any task in the Project VE repository. Applies remediation-era architecture, security, testing, CI, and documentation guardrails so new work does not recreate god modules, weakened RLS/RPC boundaries, missing gates, or stale remediation status.
---

# Project VE Guardrails

Use this skill before beginning any Project VE task. Keep it active while planning, editing, validating, and summarizing.

## Start Checklist

1. Read the current task against `docs/project-ve-engineering-remediation-plan.md`.
2. For admin/CMS/LMS/product work, also read `docs/project-ve-cms-lms-product-remediation-plan.md`.
3. Check `git status -sb` and avoid reverting user changes.
4. Identify whether the task touches architecture, DB/RLS/RPCs, auth, notifications, XP, AI generation, CMS workflows, tests, CI, or remediation docs.
5. Pick the narrowest implementation that matches existing repo patterns.

## Architecture

- Do not create or grow god modules. Keep pages, routes, and server actions thin.
- Put domain logic in focused feature/domain/application/data modules.
- Extract only when it reduces real complexity or matches the local architecture.
- Avoid unrelated refactors while fixing scoped behavior.

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
- Keep `npm run test:remediation:local` and the remediation docs aligned with current gates.

## CMS Product Work

- Implement only P0 CMS remediation work unless P1/P2 scope has been explicitly approved.
- Treat the CMS component foundation as mandatory: `shadcn/ui` with Radix primitives, `dnd-kit`, Tiptap, and TanStack Table.
- Install, configure, and use the mandatory libraries when missing and relevant to the CMS workflow being remediated.
- Do not introduce competing component, rich-text, drag-and-drop, or data-grid libraries without explicit approval.
- Preserve the structured content model: course -> lesson -> page -> structured content block.
- Keep manual and AI-generated content in one editorial lifecycle, with AI provenance/status as secondary metadata.
- Replace native `window.alert()` and `window.confirm()` in P0 CMS workflows with accessible dialogs, toasts, inline validation, and recoverable error states.
- Preserve learner-facing rendering compatibility when adding CMS authoring capability.

## Documentation

- Update remediation/status docs in the same change when a task closes or a gate changes.
- Update `docs/project-ve-cms-lms-product-remediation-plan.md` when CMS/LMS product scope, gates, or completion status changes.
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
