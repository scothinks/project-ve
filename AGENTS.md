# Project VE Agent Instructions

Before beginning any task in this repository, load and follow the Project VE guardrails skill:

```text
docs/codex/skills/project-ve-guardrails/SKILL.md
```

These guardrails are standing project policy. They are intended to prevent future work from reintroducing the problems addressed by the remediation effort: god modules, weakened security boundaries, hardcoded secrets, missing tests, stale CI gates, and stale remediation status docs.

For admin, CMS, LMS, or product-remediation work, also use `docs/project-ve-cms-lms-product-remediation-plan.md` as the authoritative product reference. Its P0 CMS component foundation is mandatory: shadcn/ui with Radix primitives, dnd-kit, Tiptap, and TanStack Table.

At minimum, every task should respect:

- keep modules focused and avoid new god modules;
- preserve RLS/RPC/auth/notification/XP boundaries;
- never use broad grants or policies just to make tests pass;
- avoid hardcoded secret-shaped values, including in tests;
- update tests, CI, and remediation docs when behavior or gates change;
- validate with the smallest sufficient command set and report gaps.
