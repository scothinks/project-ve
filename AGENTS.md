# Project VE Agent Instructions

Before beginning any task in this repository, load and follow the Project VE guardrails skill:

```text
docs/codex/skills/project-ve-guardrails/SKILL.md
```

These guardrails are standing project policy. They are intended to prevent future work from reintroducing the problems addressed by the remediation effort: god modules, weakened security boundaries, hardcoded secrets, missing tests, stale CI gates, and stale remediation status docs.

For admin, CMS, LMS, or product-remediation work, also use `docs/project-ve-cms-lms-product-remediation-plan.md` as the authoritative product reference. For P1.5 Org Mode or institutional pilot readiness work, also use `docs/project-ve-cms-lms-phase-1-5-org-mode-institutional-pilot-readiness.md`; where it conflicts with earlier assumptions, the P1.5 addendum takes precedence. Its P0/P1.5 CMS component foundation is mandatory: shadcn/ui with Radix primitives, dnd-kit, Tiptap, and TanStack Table.

At minimum, every task should respect:

- keep modules focused and avoid new god modules;
- preserve RLS/RPC/auth/notification/XP boundaries;
- never use broad grants or policies just to make tests pass;
- avoid hardcoded secret-shaped values, including in tests;
- update tests, CI, and remediation docs when behavior or gates change;
- validate with the smallest sufficient command set and report gaps.
