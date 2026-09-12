# One trusted local staging branch

Approved by the user on 12 September 2026. Canonical working directory:
`/Users/scoteritemu/Nu-Project-VE`. Canonical branch: `codex/staging` (rename the
existing working branch, rather than creating another task branch).

## Inspection

| Worktree | Starting revision | Disposition |
| --- | --- | --- |
| Main repository | `f8ed2d2`, AI guided journey | Keep uncommitted pricing/refinement follow-up and its tests/docs. Becomes staging. |
| Identity B0 | `ac04518` | Base is already in `origin/main`. Keep uncommitted welcome animation/reward copy, background XP, notifications, migration and tests/docs. |
| Reward economy | `2052df2` | Merge the planning commit; retain the approved refined prototype and review evidence. Production implementation has not started. |
| Identity B1 qualification | `59ea597` | Preserve the temporary parity harness; do not merge frozen-content comparison scaffolding into production tests. |
| Identity G0 reference | `9538a5b` | Two commits are patch-equivalent to commits already in main. Preserve the temporary parity harness as reference. |
| Codex worktree `b570` | `09d0584` | Older assembled working copy. Of 362 existing changed/untracked non-output files, 245 match current main and 94 occur in main history. Remaining 23 are older variants, generated files, docs or evidence; preserve all in the recovery snapshot, do not replace later hardening/identity work. |
| Missing PR109 and authoring-before directories | detached | Stale worktree registrations only; eligible for pruning after snapshots. |

Fetched `origin/main` is `fcb375f`: PR #111 includes the identity foundation and
PR #110 includes the committed guided journey. Local `main` is stale and will not
be used as the integration base. Existing remote branches will not be pushed,
deleted, reset or force-updated as part of this local consolidation.

## Merge sequence

1. Capture the HEAD, status, binary tracked patch, untracked files and a checksum
   manifest for every existing worktree into ignored local recovery storage.
   Keep environment files private and preserve them separately from Git.
2. Commit the root AI follow-up and the identity welcome follow-up on their
   existing branches, retaining their work and clear provenance.
3. Rename the root branch to `codex/staging`; merge fetched `origin/main`, the
   welcome checkpoint and the Reward Economy planning commit locally.
4. Resolve overlapping docs additively, preserve the new `--ui-*` identity roles
   when integrating older AI edits, and keep auth/XP behaviour from the welcome
   follow-up. Do not wholesale import the old `b570` working copy.
5. Bring the approved Reward Economy reference into the canonical folder. Keep
   generated screenshots/prototypes/recovery files outside the source diff via
   explicit local-artifact ignore rules. Preserve older reference worktrees;
   they are no longer working locations.
6. Confirm the Git integration has no conflicts or accidentally tracked secrets.
   Implement Reward Economy A–H on `codex/staging` in the canonical folder.
7. Per the user's instruction, defer test execution until the full implementation
   is complete, then batch typecheck, lint, guardrails, relevant unit/integration
   and browser checks. Follow-up fixes rerun affected checks. Do not describe the
   staging branch as validated before that batch passes.

## Standing workflow

All subsequent Project VE work uses this staging branch and directory. New task
branches or additional worktrees require an explicit user request. Remote release,
production deployment and branch cleanup remain separate from local integration.

## Consolidation progress

- Recovery archives captured and their saved-file checksums verified: 530 root
  files, 62 identity files, 101 Reward Economy files, 3 files in each parity
  worktree and 362 files from `b570`. Stored locally under
  `output/local-staging-recovery/2026-09-12/`; private environment archives are
  mode 0600 and excluded from Git. Root and identity `.env.local` files are identical.
- Root checkpoint `2fa9721` preserves AI edits and the standing workflow.
- Identity checkpoint `3e1d350` preserves welcome/background-XP work.
- Existing root branch renamed to `codex/staging`. Merge `a193ee9` integrates
  fetched main, and `4c76e04` integrates the welcome checkpoint.
- Conflicts were additive documentation insertions. Both histories were retained.
  One older AI border token was mapped to `--ui-border-subtle`.
- The Reward Economy plan and refined reference are now in the canonical folder.
  No tests have run as part of consolidation; the integrated batch remains due.
