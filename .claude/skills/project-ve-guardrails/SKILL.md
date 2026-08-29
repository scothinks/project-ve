---
name: project-ve-guardrails
description: MANDATORY for every task in this repository, not a discretionary trigger. Binding Project VE guardrails covering focused architecture, performance/read-path invariants, RLS/RPC/auth/notification/XP boundaries, secret handling, tests/CI, the accepted CMS/Org Mode foundation, P2 gating, and remediation documentation. Apply regardless of task size or framing.
---

# Project VE Guardrails (Mandatory, Not Optional)

This repository's binding guardrails live in `docs/codex/skills/project-ve-guardrails/SKILL.md`. That file is the single source of truth — this skill does not duplicate it, to avoid the two drifting apart.

**This is not a suggestion to weigh against convenience.** Every task in this
repository is bound by the canonical file's architecture, performance/read-path,
security, test/CI, CMS/Org Mode, P2-gating and documentation rules. In
particular, do not recreate full-graph summary reads, N+1 database operations,
repeated request auth, mutation-on-render, unsafe shared caches or an awaited
dashboard secondary-data waterfall.

Enforcement is automatic, not left to recall: Claude and Codex project hooks
inject the full contents of `docs/codex/skills/project-ve-guardrails/SKILL.md`
at session start and after compaction. `npm run test:guardrails` provides the
fast deterministic regression gate; CI remains authoritative.

## What to actually do

1. Before touching any file, read `docs/codex/skills/project-ve-guardrails/SKILL.md` in full if it is not already visible in context.
2. Run its Start Checklist for the current task.
3. Apply every relevant section, including Performance And Read-Path Boundaries.
4. Run its "Before Closing" validation commands (`npm run typecheck`, `npm run lint`, `git diff --check` at minimum) before reporting work as done.
5. If a guardrail seems like it shouldn't apply to the current task, stop and say so explicitly to the user rather than silently deviating. Do not rationalize an exception on your own.

See `AGENTS.md` for the standing project directive this skill implements.
