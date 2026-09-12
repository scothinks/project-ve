// Source-pair validation supplements, but cannot replace, rendered contrast evidence.
export function contrastRatio(foreground, background) {
  function luminance(hex) {
    if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error(`Expected terminal RGB hex: ${hex}`);
    const channels = hex.slice(1).match(/../g).map(c => parseInt(c, 16) / 255)
      .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function roleContrastResults(roles) {
  const values = new Map(roles.map(role => [role.token, role]));
  const pairs = [];
  for (const surface of ['canvas', 'surface', 'surface-inset', 'surface-soft', 'surface-muted', 'surface-raised', 'chrome']) {
    for (const text of ['text', 'text-muted', 'text-subtle', 'action']) pairs.push([text, surface, 4.5]);
    for (const boundary of ['control-border', 'focus']) pairs.push([boundary, surface, 3]);
  }
  for (const text of ['text', 'text-muted', 'text-subtle', 'action']) pairs.push([text, 'current-bg', 4.5]);
  pairs.push(['focus', 'current-bg', 3]);
  for (const state of ['action', 'action-hover', 'action-pressed']) pairs.push(['on-action', state, 4.5]);
  pairs.push(['on-action-soft', 'action-soft', 4.5], ['current-text', 'current-bg', 4.5], ['current-rail', 'current-bg', 3], ['text', 'support-bg', 4.5]);
  for (const status of ['success', 'warning', 'danger', 'info', 'learning', 'mission', 'reward']) {
    pairs.push([status, `${status}-bg`, 4.5], [`on-${status}`, status, 4.5]);
  }
  if (values.has('--ui-entry-hero')) {
    for (const text of ['entry-hero-text', 'entry-hero-muted', 'entry-highlight']) pairs.push([text, 'entry-hero', 4.5]);
    pairs.push(['entry-panel-text', 'entry-panel', 4.5]);
    for (const surface of ['entry-canvas', 'entry-glow', 'entry-shared']) for (const text of ['text', 'text-muted']) pairs.push([text, surface, 4.5]);
  }
  return ['light', 'dark'].flatMap(mode => pairs.map(([fg, bg, minimum]) => {
    const foreground = `--ui-${fg}`, background = `--ui-${bg}`;
    const a = values.get(foreground)?.[mode], b = values.get(background)?.[mode];
    const ratio = a && b ? contrastRatio(a, b) : null;
    return { mode, foreground, background, minimum, ratio, passes: ratio !== null && ratio >= minimum };
  }));
}
