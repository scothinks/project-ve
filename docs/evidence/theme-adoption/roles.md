# Terminal role dictionary

These roles implement the frozen direction. The nine core role values come from the approved plan; additional operational pairs are proposed derivatives with distinct uses. None is active in G0. G2 must validate rendered foreground/background and focus contrast and remove any role without a distinct use.

| Role | Light | Dark | Use |
|---|---|---|---|
| `--ui-canvas` | `#f6f3ed` | `#201c23` | Page backdrop |
| `--ui-surface` | `#fffdf9` | `#2b2530` | Main content surface |
| `--ui-text` | `#252327` | `#f6f3ed` | Ordinary readable foreground |
| `--ui-text-muted` | `#625968` | `#c4b9ca` | Secondary readable foreground |
| `--ui-action` | `#583c63` | `#d6bce2` | Primary action |
| `--ui-on-action` | `#fffdf9` | `#281b2e` | Primary action foreground |
| `--ui-current-bg` | `#e8e0ec` | `#43344b` | Current region field |
| `--ui-support-bg` | `#f0d2b8` | `#624737` | Editorial supporting field |
| `--ui-border` | `#918794` | `#95889f` | Meaningful boundary |
| `--ui-chrome` | `#f0ebef` | `#251f29` | Persistent navigation |
| `--ui-surface-inset` | `#eee9ef` | `#241e29` | Recessed controls and panels |
| `--ui-surface-soft` | `#f5f0f6` | `#302836` | Quiet sections |
| `--ui-surface-muted` | `#e9e3eb` | `#382f3e` | Subdued regions |
| `--ui-surface-raised` | `#ffffff` | `#342c3b` | Elevated cards and overlays |
| `--ui-text-subtle` | `#716778` | `#b8adbf` | Tertiary text; rendered contrast required |
| `--ui-border-subtle` | `#ded5e2` | `#514658` | Decorative separators only |
| `--ui-action-hover` | `#493052` | `#e2cdef` | Action hover |
| `--ui-action-pressed` | `#3b2444` | `#c7a8d6` | Action pressed |
| `--ui-action-soft` | `#ede4f1` | `#43314e` | Quiet action background |
| `--ui-on-action-soft` | `#583c63` | `#e5ccf0` | Quiet action foreground |
| `--ui-current-rail` | `#583c63` | `#d6bce2` | Current item leading emphasis |
| `--ui-current-text` | `#493052` | `#e5ccf0` | Current region foreground |
| `--ui-focus` | `#78458e` | `#edbdff` | Focus indicator; adjacent-pair verification required |
| `--ui-success` | `#21623e` | `#9dd8af` | Successful outcome |
| `--ui-success-bg` | `#e4f2e8` | `#203d2a` | Success field |
| `--ui-on-success` | `#ffffff` | `#15311e` | Foreground on solid success |
| `--ui-warning` | `#7c5206` | `#edc36a` | Warning |
| `--ui-warning-bg` | `#fff1ce` | `#443614` | Warning field |
| `--ui-on-warning` | `#ffffff` | `#322509` | Foreground on solid warning |
| `--ui-danger` | `#a22d38` | `#ffb0b6` | Danger or destructive outcome |
| `--ui-danger-bg` | `#fbe9eb` | `#4b252e` | Danger field |
| `--ui-on-danger` | `#ffffff` | `#40141b` | Foreground on solid danger |
| `--ui-info` | `#265d87` | `#abd4f5` | Information |
| `--ui-info-bg` | `#e5eff8` | `#203b50` | Information field |
| `--ui-on-info` | `#ffffff` | `#173145` | Foreground on solid information |
| `--ui-learning` | `#315f83` | `#b8d6ef` | Learning category |
| `--ui-learning-bg` | `#e6eff6` | `#253b4d` | Learning category field |
| `--ui-mission` | `#83462a` | `#edc0a5` | Mission category |
| `--ui-mission-bg` | `#f5e6dc` | `#493328` | Mission category field |
| `--ui-reward` | `#77550e` | `#e6c779` | Reward category |
| `--ui-reward-bg` | `#f8efcf` | `#43391f` | Reward category field |
| `--ui-shadow-rgb` | `37, 35, 39` | `0, 0, 0` | Terminal shadow channels for existing alpha recipes |

Font outputs are reserved as `--ui-font-body` and `--ui-font-display` for B3; they are terminal next/font/local outputs, with fallbacks at the point of consumption. No semantic-to-semantic or semantic-to-legacy aliases are permitted.
