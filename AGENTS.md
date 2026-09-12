# Project VE Agent Instructions

Before beginning any task in this repository, load and follow the Project VE guardrails skill:

```text
docs/codex/skills/project-ve-guardrails/SKILL.md
```

These guardrails are standing project policy. They are intended to prevent future work from reintroducing the problems addressed by the remediation effort: god modules, query waterfalls, N+1 reads, unsafe shared caches, weakened security boundaries, hardcoded secrets, missing tests, stale CI gates, and stale remediation status docs.

For admin, CMS, LMS, or product-remediation work, also use `docs/project-ve-cms-lms-product-remediation-plan.md` as the authoritative product reference. For P1.5 Org Mode or institutional pilot readiness work, also use `docs/project-ve-cms-lms-phase-1-5-org-mode-institutional-pilot-readiness.md`; where it conflicts with earlier assumptions, the P1.5 addendum takes precedence. Its P0/P1.5 CMS component foundation is mandatory: shadcn/ui with Radix primitives, dnd-kit, Tiptap, and TanStack Table.

At minimum, every task should respect:

- keep modules focused and avoid new god modules;
- use screen-specific read models, set-wise/batched operations, request-scoped
  identity and tenant-safe caches for server read paths;
- keep rendering read-only and preserve the first-useful-HTML boundary;
- preserve RLS/RPC/auth/notification/XP boundaries;
- never use broad grants or policies just to make tests pass;
- avoid hardcoded secret-shaped values, including in tests;
- update tests, CI, and remediation docs when behavior or gates change;
- validate with the smallest sufficient command set and report gaps.

P0, P1 and P1.5A-P1.5F architecture is closed. Do not begin P2 until hosted
query evidence has been reviewed and the user explicitly authorises it.

## Trusted local staging workflow

The user chose one shared local staging branch on 12 September 2026.
Use `codex/staging` in `/Users/scoteritemu/Nu-Project-VE` for subsequent work.
Do not create a new branch or worktree for a task unless the user explicitly asks.
Inspect and preserve existing changes, commit coherent completed work, and keep
unrelated historical worktrees as references rather than alternate working copies.
Do not switch to or update another branch, push, deploy, or delete old branches as
an automatic consequence of finishing a task. Local staging and production release
are separate. The consolidation evidence is in
`docs/evidence/local-staging/consolidation-2026-09-12.md`.

## Approval and work tracking

Treat “proceed with the plan” or “proceed with phase X” of a shared plan as
approval for that stated scope and its routine GitHub tracking: create/update
relevant Projects and issues, record evidence, and update or close completed work.
Do not ask for the same approval again. A phase approval covers that phase only;
later phases remain backlog. Discussion alone is not approval: when scope is
genuinely ambiguous, ask one concise scope question before executing, without
pressuring or repeatedly prompting the user. Existing security, release and
explicit authorisation boundaries still apply.

Idea capture is separate from implementation approval. When asked to record a
future feature or task, search existing issues first, then create or reuse a
concise repository issue with `status:backlog` in
[Task Log](https://github.com/users/scothinks/projects/2),
without a phase. This visible intake board is the exception to initiative
Projects. No approved implementation plan is needed just to capture an idea.
Mark scope as needing refinement and do not start implementation. When selected,
attach the same issue to its initiative and remove it from intake, avoiding stale
duplication. Keep the intake link prominent in the Wiki Home and README; add no
extra process.

1. Identify the repository, approved scope and existing initiative. Search
   Projects and issues before creating anything, including after retry/reconnect;
   reuse matching work and check completed evidence to avoid duplicates.
2. Use one Project per body of work; phases are stages within it. Reuse the
   relevant Project for related work and create one only for a separate
   initiative. Small fixes need no extra epic or process. Project VE is the
   product/repository; [AI Authoring](https://github.com/users/scothinks/projects/1)
   includes all its phases, with only approved work active.
3. Create or update the initiative and actionable issues as needed. Keep the
   outcome, scope, owner, acceptance checks and real dependencies concise. Link
   shared dependencies instead of copying tickets; do not invent blockers from
   unrelated planned work. Verify actual URLs, membership and statuses.
4. Execute the approved work and update tracking when scope or status changes
   meaningfully. Use Backlog → Ready → In progress → Review → Done; keep one
   `status:*` issue label aligned with its Project column. Record implementation
   and validation evidence before marking Done/closing. Follow the canonical
   guardrails' testing cadence; distinguish local completion from hosted rollout.
5. Keep durable product decisions and working guidance in the
   [Wiki](https://github.com/scothinks/project-ve/wiki); keep agent policy,
   tests, migrations and technical evidence in the repository. Issues hold live
   progress and Projects group initiatives; do not duplicate status narratives.
6. If access or approval review blocks tracking, report the failed action and
   smallest required user action, preserve a concrete draft, and continue
   unaffected authorised work. Never bypass review or claim an update succeeded.

This is agent behaviour during active work, not a daemon, webhook, scheduled task
or guaranteed background sync. The convention is reusable, but other repositories
must adopt it in their own loaded instructions; do not edit global instructions
or other repositories without authorisation.
