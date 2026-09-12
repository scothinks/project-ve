# Dashboard visual correction — 9 September 2026

Status: this dated pilot record is superseded by the final design approval and
[current integrated qualification](entry-integration.md) on 12 September. The
historical captures below remain evidence of the correction, not a hosted release.

The user rejected the first integrated dashboard composition. The earlier B6
technical checks and captures remain historical evidence for that exact source;
they do not establish user acceptance or qualify this subsequent revision.

## Dashboard changes

- Neutral category and reward labels, ordinary aubergine progress; feedback is no
  longer presented as danger. All mission categories retain their text and icons.
- Charcoal XP, neutral mission borders/icons and dashboard navigation background.
- Neutral card surfaces with quieter elevation; reward cost badges and empty
  recommendation states follow the same treatment.
- Card-level container queries stack continuation controls and mission content
  when enlarged text makes the desktop arrangement too narrow. Visual inspection
  found clipped content despite zero root overflow; the corrected 200% view was
  inspected separately.
- Following further user review, the dashboard replaces the warm canvas with a
  neutral surface derived from existing ink/raised-surface roles, with the
  user-approved soft aubergine radial glow across the upper canvas. The glow
  fades out above the lower content and cards remain solid. Desktop chrome
  reveals the continuous background; translucent mobile chrome preserves
  sticky-header legibility. The progress
  panel no longer has the redundant current-learning rail, clipped corner or
  lavender fill. Fonts, signature and artwork are preserved; data loaders,
  permissions, progress, XP and links are unchanged. No production fixture or
  demo behavior was changed. The dashboard-specific composition stays scoped; other surfaces use the shared
  semantic identity roles.

## Review and verification

Before/after captures live in `output/playwright/identity-correction/`.
They use an isolated copy in demo mode on port 3327, with a demo-only current
learning record and feedback category to exercise the screenshot's states.
They are representative fixtures, not the user's account or hosted evidence.
The user's normal application remains on localhost:3000 with its existing data.

Validation: typecheck, focused dashboard ESLint, theme contract including role
contrast pairs, all 40 read-path guardrails, and `git diff --check`. Browser checks
cover desktop/mobile light and dark, 320px width, visible keyboard focus and
200% root text size. No page overflow was observed. The final direction was subsequently approved on 12 September.
No new full CI/E2E suite, commit, push or deployment was performed for this pilot.

Current follow-through: the final integrated checks, commit and PR evidence are
recorded in [connected entry qualification](entry-integration.md). Historical B6
captures have not been overwritten or presented as checks of the new source.
