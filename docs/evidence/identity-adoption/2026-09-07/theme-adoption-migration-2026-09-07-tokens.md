# Legacy token disposition ledger — 7 September 2026

Planning baseline only. No tokens have been changed. Reference counts include uses in alias definitions and source strings. Declarations are separate. The JSON companion records every file and line; it must be refreshed at G0.

**108 tokens: 12 unused deletions at G0; 22 maximum temporary adapters; 72 direct colour/role rewrites at G2; 2 font rewrites at G3.** All adapters expire by G5.

“Retire immediately” means delete unused definitions in B0, or rewrite active consumers and remove their definitions atomically in B2. It never means deleting a live definition before its consumers are migrated.

A target containing alternatives requires consumer-by-consumer classification before G2. It is expressly not an allowed global substitution. Direct targets are default roles; incorrect uses must be split at the call site rather than preserved by adding another alias.

| Legacy token | Disposition | Replacement / classification | Removal gate | References / files |
|---|---|---|---|---|
| `--admin-accent-sky` | direct rewrite no adapter | information / learning category / action / editorial support: classify each use | G2 | 4 / 3 |
| `--admin-accent-violet` | direct rewrite no adapter | information / learning category / action / editorial support: classify each use | G2 | 9 / 6 |
| `--admin-border-warm` | temporary direct adapter | --ui-border-subtle | G5 (earlier at zero uses) | 296 / 59 |
| `--admin-brand-hero` | direct rewrite no adapter | brand action or ordinary heading ink: classify each use | G2 | 17 / 17 |
| `--admin-error` | direct rewrite no adapter | --ui-danger | G2 | 42 / 20 |
| `--admin-error-container` | direct rewrite no adapter | --ui-danger-soft | G2 | 17 / 12 |
| `--admin-ink-charcoal` | temporary direct adapter | --ui-text | G5 (earlier at zero uses) | 19 / 10 |
| `--admin-on-error-container` | direct rewrite no adapter | --ui-on-danger-soft | G2 | 10 / 8 |
| `--admin-on-primary` | direct rewrite no adapter | action / on-action / current / focus / success / reward / text: classify each use | G2 | 40 / 22 |
| `--admin-on-primary-container` | delete unused | none; delete definitions and dead alias edge | G0 | 0 / 0 |
| `--admin-on-secondary-container` | direct rewrite no adapter | warning / danger / editorial support / reward: classify each use and pair | G2 | 1 / 1 |
| `--admin-on-secondary-fixed` | delete unused | none; delete definitions and dead alias edge | G0 | 0 / 0 |
| `--admin-on-surface` | temporary direct adapter | --ui-text | G5 (earlier at zero uses) | 134 / 43 |
| `--admin-on-surface-variant` | temporary direct adapter | --ui-text-muted | G5 (earlier at zero uses) | 290 / 57 |
| `--admin-on-tertiary-fixed-variant` | direct rewrite no adapter | reward category / reward progress / warning: classify each use and pair | G2 | 7 / 6 |
| `--admin-outline` | direct rewrite no adapter | border / secondary icon-text: classify each use | G2 | 27 / 14 |
| `--admin-primary` | direct rewrite no adapter | action / on-action / current / focus / success / reward / text: classify each use | G2 | 191 / 49 |
| `--admin-primary-container` | direct rewrite no adapter | action / on-action / current / focus / success / reward / text: classify each use | G2 | 74 / 20 |
| `--admin-primary-fixed` | direct rewrite no adapter | action / on-action / current / focus / success / reward / text: classify each use | G2 | 5 / 3 |
| `--admin-secondary` | direct rewrite no adapter | warning / danger / editorial support / reward: classify each use and pair | G2 | 35 / 15 |
| `--admin-secondary-container` | delete unused | none; delete definitions and dead alias edge | G0 | 0 / 0 |
| `--admin-secondary-fixed` | direct rewrite no adapter | warning / danger / editorial support / reward: classify each use and pair | G2 | 3 / 1 |
| `--admin-surface` | temporary direct adapter | --ui-surface-inset | G5 (earlier at zero uses) | 24 / 12 |
| `--admin-surface-container` | temporary direct adapter | --ui-surface-muted | G5 (earlier at zero uses) | 5 / 3 |
| `--admin-surface-container-high` | temporary direct adapter | --ui-surface-raised | G5 (earlier at zero uses) | 13 / 9 |
| `--admin-surface-container-highest` | delete unused | none; delete definitions and dead alias edge | G0 | 0 / 0 |
| `--admin-surface-container-low` | temporary direct adapter | --ui-surface-soft | G5 (earlier at zero uses) | 117 / 46 |
| `--admin-surface-milk` | temporary direct adapter | --ui-surface | G5 (earlier at zero uses) | 158 / 48 |
| `--admin-tertiary` | direct rewrite no adapter | reward category / reward progress / warning: classify each use and pair | G2 | 5 / 2 |
| `--admin-tertiary-container` | delete unused | none; delete definitions and dead alias edge | G0 | 0 / 0 |
| `--admin-tertiary-fixed` | direct rewrite no adapter | reward category / reward progress / warning: classify each use and pair | G2 | 7 / 6 |
| `--background` | direct rewrite no adapter | --ui-canvas | G2 | 5 / 3 |
| `--font-geist` | direct rewrite no adapter | --ui-font-body; next/font definition is the terminal font-family source | G3 | 3 / 2 |
| `--foreground` | temporary direct adapter | --ui-text | G5 (earlier at zero uses) | 181 / 64 |
| `--learner-atmosphere-mint` | delete unused | none; delete definitions and dead alias edge | G0 | 0 / 0 |
| `--learner-atmosphere-warm` | delete unused | none; delete definitions and dead alias edge | G0 | 0 / 0 |
| `--learner-attention` | direct rewrite no adapter | warning / danger / editorial support / reward: classify each use and pair | G2 | 8 / 4 |
| `--learner-attention-soft` | direct rewrite no adapter | warning / danger / editorial support / reward: classify each use and pair | G2 | 6 / 3 |
| `--learner-background-base` | direct rewrite no adapter | --ui-canvas | G2 | 8 / 1 |
| `--learner-background-cream` | direct rewrite no adapter | --ui-surface-soft | G2 | 10 / 4 |
| `--learner-background-desktop` | direct rewrite no adapter | --ui-canvas | G2 | 2 / 1 |
| `--learner-body-font` | direct rewrite no adapter | --ui-font-body; next/font definition is the terminal font-family source | G3 | 12 / 1 |
| `--learner-border` | direct rewrite no adapter | --ui-border | G2 | 57 / 7 |
| `--learner-border-soft` | direct rewrite no adapter | --ui-border-subtle | G2 | 9 / 5 |
| `--learner-green` | direct rewrite no adapter | action / on-action / current / focus / success / reward / text: classify each use | G2 | 54 / 7 |
| `--learner-green-deep` | direct rewrite no adapter | action / on-action / current / focus / success / reward / text: classify each use | G2 | 54 / 6 |
| `--learner-green-rgb` | direct rewrite no adapter | action / on-action / current / focus / success / reward / text: classify each use | G2 | 3 / 1 |
| `--learner-green-soft` | direct rewrite no adapter | action / on-action / current / focus / success / reward / text: classify each use | G2 | 10 / 5 |
| `--learner-mission` | direct rewrite no adapter | mission category / progress / current / editorial support: classify each use | G2 | 4 / 2 |
| `--learner-mission-soft` | direct rewrite no adapter | mission category / progress / current / editorial support: classify each use | G2 | 3 / 2 |
| `--learner-mission-text` | direct rewrite no adapter | mission category / progress / current / editorial support: classify each use | G2 | 2 / 1 |
| `--learner-reward` | direct rewrite no adapter | reward category / reward progress / warning: classify each use and pair | G2 | 20 / 4 |
| `--learner-reward-rgb` | delete unused | none; delete definitions and dead alias edge | G0 | 1 / 1 |
| `--learner-reward-soft` | direct rewrite no adapter | reward category / reward progress / warning: classify each use and pair | G2 | 6 / 3 |
| `--learner-shadow-rgb` | direct rewrite no adapter | --ui-shadow-rgb | G2 | 4 / 1 |
| `--learner-success` | delete unused | none; delete definitions and dead alias edge | G0 | 0 / 0 |
| `--learner-surface` | direct rewrite no adapter | --ui-surface | G2 | 29 / 6 |
| `--learner-surface-elevated` | direct rewrite no adapter | --ui-surface-raised | G2 | 17 / 1 |
| `--learner-surface-soft` | direct rewrite no adapter | --ui-surface-soft | G2 | 16 / 4 |
| `--learner-text` | direct rewrite no adapter | --ui-text | G2 | 66 / 6 |
| `--learner-text-muted` | direct rewrite no adapter | --ui-text-muted | G2 | 82 / 7 |
| `--learner-text-subtle` | direct rewrite no adapter | --ui-text-subtle | G2 | 2 / 1 |
| `--ve-card` | temporary direct adapter | --ui-surface | G5 (earlier at zero uses) | 266 / 84 |
| `--ve-card-muted` | temporary direct adapter | --ui-surface-muted | G5 (earlier at zero uses) | 48 / 16 |
| `--ve-card-subtle` | temporary direct adapter | --ui-surface-raised | G5 (earlier at zero uses) | 18 / 6 |
| `--ve-danger` | direct rewrite no adapter | --ui-danger | G2 | 35 / 19 |
| `--ve-danger-soft` | direct rewrite no adapter | --ui-danger-soft | G2 | 25 / 17 |
| `--ve-green` | direct rewrite no adapter | action / on-action / current / focus / success / reward / text: classify each use | G2 | 300 / 81 |
| `--ve-green-action` | direct rewrite no adapter | action / on-action / current / focus / success / reward / text: classify each use | G2 | 1 / 1 |
| `--ve-green-label` | direct rewrite no adapter | action / on-action / current / focus / success / reward / text: classify each use | G2 | 1 / 1 |
| `--ve-green-on-accent` | direct rewrite no adapter | action / on-action / current / focus / success / reward / text: classify each use | G2 | 1 / 1 |
| `--ve-green-rgb` | direct rewrite no adapter | action / on-action / current / focus / success / reward / text: classify each use | G2 | 3 / 3 |
| `--ve-green-soft` | direct rewrite no adapter | action / on-action / current / focus / success / reward / text: classify each use | G2 | 63 / 42 |
| `--ve-ink` | direct rewrite no adapter | --ui-text | G2 | 2 / 1 |
| `--ve-intro-card` | direct rewrite no adapter | --ui-surface | G2 | 1 / 1 |
| `--ve-intro-control` | delete unused | none; delete definitions and dead alias edge | G0 | 0 / 0 |
| `--ve-intro-dot` | direct rewrite no adapter | --ui-text-subtle | G2 | 1 / 1 |
| `--ve-intro-line` | direct rewrite no adapter | --ui-border | G2 | 1 / 1 |
| `--ve-intro-panel` | delete unused | none; delete definitions and dead alias edge | G0 | 0 / 0 |
| `--ve-intro-shadow-alpha` | direct rewrite no adapter | component-local shadow opacity | G2 | 1 / 1 |
| `--ve-intro-shadow-rgb` | direct rewrite no adapter | --ui-shadow-rgb | G2 | 1 / 1 |
| `--ve-line` | temporary direct adapter | --ui-border | G5 (earlier at zero uses) | 105 / 45 |
| `--ve-line-soft` | temporary direct adapter | --ui-border-subtle | G5 (earlier at zero uses) | 255 / 56 |
| `--ve-mission` | direct rewrite no adapter | mission category / progress / current / editorial support: classify each use | G2 | 24 / 10 |
| `--ve-mission-soft` | direct rewrite no adapter | mission category / progress / current / editorial support: classify each use | G2 | 6 / 6 |
| `--ve-muted` | temporary direct adapter | --ui-text-muted | G5 (earlier at zero uses) | 444 / 95 |
| `--ve-muted-soft` | temporary direct adapter | --ui-text-subtle | G5 (earlier at zero uses) | 7 / 4 |
| `--ve-muted-strong` | temporary direct adapter | --ui-text-muted | G5 (earlier at zero uses) | 218 / 75 |
| `--ve-panel` | temporary direct adapter | --ui-surface-inset | G5 (earlier at zero uses) | 83 / 39 |
| `--ve-panel-soft` | temporary direct adapter | --ui-surface-soft | G5 (earlier at zero uses) | 6 / 4 |
| `--ve-shadow-rgb` | temporary direct adapter | --ui-shadow-rgb | G5 (earlier at zero uses) | 25 / 11 |
| `--ve-shell` | temporary direct adapter | --ui-chrome | G5 (earlier at zero uses) | 102 / 29 |
| `--ve-sky` | direct rewrite no adapter | information / learning category / action / editorial support: classify each use | G2 | 3 / 2 |
| `--ve-sky-action` | direct rewrite no adapter | information / learning category / action / editorial support: classify each use | G2 | 1 / 1 |
| `--ve-sky-label` | direct rewrite no adapter | information / learning category / action / editorial support: classify each use | G2 | 1 / 1 |
| `--ve-sky-on-accent` | direct rewrite no adapter | information / learning category / action / editorial support: classify each use | G2 | 1 / 1 |
| `--ve-sky-rgb` | direct rewrite no adapter | information / learning category / action / editorial support: classify each use | G2 | 1 / 1 |
| `--ve-sky-soft` | direct rewrite no adapter | information / learning category / action / editorial support: classify each use | G2 | 1 / 1 |
| `--ve-soft` | direct rewrite no adapter | --ui-surface-soft; currently undefined, replace both admin organization backgrounds directly | G2 | 2 / 1 |
| `--ve-store` | direct rewrite no adapter | reward category / reward progress / warning: classify each use and pair | G2 | 26 / 19 |
| `--ve-store-rgb` | delete unused | none; delete definitions and dead alias edge | G0 | 0 / 0 |
| `--ve-store-soft` | direct rewrite no adapter | reward category / reward progress / warning: classify each use and pair | G2 | 18 / 15 |
| `--ve-violet` | direct rewrite no adapter | information / learning category / action / editorial support: classify each use | G2 | 24 / 10 |
| `--ve-violet-action` | direct rewrite no adapter | information / learning category / action / editorial support: classify each use | G2 | 1 / 1 |
| `--ve-violet-label` | direct rewrite no adapter | information / learning category / action / editorial support: classify each use | G2 | 1 / 1 |
| `--ve-violet-on-accent` | direct rewrite no adapter | information / learning category / action / editorial support: classify each use | G2 | 1 / 1 |
| `--ve-violet-rgb` | direct rewrite no adapter | information / learning category / action / editorial support: classify each use | G2 | 1 / 1 |
| `--ve-violet-soft` | direct rewrite no adapter | information / learning category / action / editorial support: classify each use | G2 | 15 / 11 |

Ownership: B0 owns unused deletion; B2 owns direct colour/role rewriting; B3 owns fonts. B4 owns remaining learner/organisation references to adapters; B5 owns admin/public/other references and deletion of every adapter definition. Each implementing PR must name its responsible implementer. No token has an owner of “later cleanup”.

The unused `--learner-reward-rgb` has one reference, from the unused `--ve-store-rgb` alias. Remove both together. All other proposed unused tokens have zero static references in this baseline. Whole-production and dynamic-style checks at G0 must confirm this before deletion.

[Full consumer manifest](theme-adoption-migration-2026-09-07-tokens.json) · [CSV ledger](theme-adoption-migration-2026-09-07-tokens.csv)
