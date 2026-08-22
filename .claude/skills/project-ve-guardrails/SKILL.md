---
name: project-ve-guardrails
description: MANDATORY for every task in this repository, not a discretionary trigger. Binding Project VE engineering guardrails covering architecture (no god modules), RLS/RPC/auth/notification/XP security boundaries, secret handling, test/CI gates, CMS product scope (P0-only, mandatory component stack), P1.5 Org Mode rollout gating, and remediation documentation. Apply regardless of task size, framing, or whether it seems relevant - never skipped by judgment call.
---

# Project VE Guardrails (Mandatory, Not Optional)

This repository's binding guardrails live in `docs/codex/skills/project-ve-guardrails/SKILL.md`. That file is the single source of truth — this skill does not duplicate it, to avoid the two drifting apart.

**This is not a suggestion to weigh against convenience.** Every task in this repository — no matter how small, how unrelated it looks, or how much a shortcut would save time — is bound by that file's checklist: architecture (no god modules, thin routes/actions), security boundaries (no broad grants/BYPASSRLS to make tests pass, no hardcoded secrets, learner paths stay on supported public RPCs), tests/CI gates matched to risk, CMS product scope (P0-only, mandatory shadcn/ui + Radix + dnd-kit + Tiptap + TanStack Table stack), P1.5 rollout discipline (one authorized batch at a time), and documentation updates in the same change as the behavior/gate change.

Enforcement is automatic, not left to recall: a `SessionStart` hook and a `PostCompact` hook in `.claude/settings.json` inject the full contents of `docs/codex/skills/project-ve-guardrails/SKILL.md` into context at the start of every session and again after every compaction, so it cannot silently drop out of view over a long conversation.

## What to actually do

1. Before touching any file, read `docs/codex/skills/project-ve-guardrails/SKILL.md` in full if it is not already visible in context.
2. Run its Start Checklist for the current task.
3. Apply every relevant section (Architecture, Security Boundaries, Tests And CI, CMS Product Work, P1.5 Product Work, Documentation) — do not selectively apply the ones that feel relevant and skip the rest.
4. Run its "Before Closing" validation commands (`npm run typecheck`, `npm run lint`, `git diff --check` at minimum) before reporting work as done.
5. If a guardrail seems like it shouldn't apply to the current task, stop and say so explicitly to the user rather than silently deviating. Do not rationalize an exception on your own.

See `AGENTS.md` for the standing project directive this skill implements.
