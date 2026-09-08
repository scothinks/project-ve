export const isLegacy = name => /^(?:--(?:ve|learner|admin)-|--(?:background|foreground|font-geist)$)/.test(name);
const gateNumber = gate => Number(String(gate).match(/\d+/)?.[0]);

export function checkContract(scan, registry, { generated = false } = {}) {
  const errors = scan.hazards.filter(h => !registry.dynamicUses?.some(d => d.file === h.file && d.source === h.source && d.sourceHash === scan.files?.[h.file] && d.owner && d.values?.length)).map(h => `${h.file}: ${h.reason}: ${h.source}`);
  const definitions = scan.entries.filter(e => e.kind === 'definition');
  const references = scan.entries.filter(e => e.kind === 'reference');
  const names = new Set(definitions.map(e => e.value));
  const accepted = new Map(registry.occurrences.map(e => [e.id, e]));
  const dispositions = new Map(registry.tokens.map(t => [t.token, t]));
  const gate = gateNumber(registry.gate);
  const external = new Set(registry.externalDefinitions ?? []);
  const retired = new Set(registry.retired ?? []);
  for (const e of scan.entries) {
    if (retired.has(e.value)) errors.push(`${e.id}: retired token ${e.value}`);
    if (isLegacy(e.value) && !dispositions.has(e.value)) errors.push(`${e.id}: no token disposition`);
    if (!generated && (isLegacy(e.value) || e.kind === 'colour' || (e.kind === 'reference' && !e.value.startsWith('--ui-')))) {
      const approved = accepted.get(e.id);
      if (!approved) errors.push(`${e.id}: new unclassified ${e.kind} ${e.value}`);
      else if (!approved.owner || !approved.disposition || !approved.reason) errors.push(`${e.id}: incomplete ownership/disposition`);
      else if (gate >= 2 && approved.disposition === 'classify-before-G2') errors.push(`${e.id}: unresolved semantic role`);
      else if (gate >= 4 && approved.owner === 'B4' && isLegacy(e.value)) errors.push(`${e.id}: expired B4 consumer`);
    }
    if (isLegacy(e.value)) {
      const plan = dispositions.get(e.value);
      const deadline = plan && gateNumber(plan.removal_gate);
      if (gate >= deadline) errors.push(`${e.id}: expired legacy token at G${deadline}`);
      if (gate >= 5) errors.push(`${e.id}: zero-legacy gate`);
    }
  }
  for (const e of references) {
    if (!names.has(e.value) && !external.has(e.value) && !(generated && /^--(?:tw-|color-|font-|spacing$|radius-|ease-|animate-|default-)/.test(e.value))) {
      const defect = registry.undefinedDefects?.find(d => d.token === e.value && d.occurrences.includes(e.id));
      if (!defect || gate >= gateNumber(defect.resolveBy)) errors.push(`${e.id}: missing token ${e.value}`);
    }
  }
  // Conservative dependency graph over every possible declaration. It cannot prove
  // CSS cascade; the browser gate independently checks root/scoped/portal resolution.
  const edges = new Map();
  for (const d of definitions) {
    const dependencies = [...(d.expression ?? '').matchAll(/var\(\s*(--[\w-]+)/g)].map(m => m[1]);
    edges.set(d.value, new Set([...(edges.get(d.value) ?? []), ...dependencies]));
    if (d.value.startsWith('--ui-') && dependencies.length) errors.push(`${d.id}: semantic role must be terminal`);
    if (/^--(?:brand|identity)-/.test(d.value)) errors.push(`${d.id}: forbidden namespace`);
    if (gate >= 2 && isLegacy(d.value) && !['--font-geist', '--learner-body-font'].includes(d.value)) {
      const adapter = registry.adapters.find(a => a.token === d.value);
      if (!adapter || d.expression !== `var(${adapter.target})`) errors.push(`${d.id}: adapter must be one exact terminal reference`);
      if (d.file !== 'app/styles/theme-compat.css' || d.scope !== ':root') errors.push(`${d.id}: adapter outside root compatibility file`);
      if (definitions.filter(other => other.value === d.value).length !== 1) errors.push(`${d.id}: duplicate/scoped adapter`);
      if (!references.some(ref => ref.value === d.value)) errors.push(`${d.id}: adapter with no consumers must be deleted`);
    }
  }
  const done = new Set();
  function walk(name, visiting = new Set()) {
    if (visiting.has(name)) { errors.push(`token cycle: ${[...visiting, name].join(' → ')}`); return; }
    if (done.has(name)) return;
    for (const dep of edges.get(name) ?? []) walk(dep, new Set([...visiting, name]));
    done.add(name);
  }
  names.forEach(name => walk(name));
  if (gate >= 2) {
    if (registry.adapters.length > 22) errors.push('adapter budget exceeds 22');
    for (const a of registry.adapters) {
      if (gate >= gateNumber(a.removeBy) && names.has(a.token)) errors.push(`expired adapter: ${a.token}`);
      if (names.has(a.token) && (!names.has(a.target) || !a.target.startsWith('--ui-') || edges.get(a.target)?.size)) errors.push(`missing/chained adapter terminal: ${a.token}`);
    }
    for (const role of registry.roles) {
      for (const mode of ['light', 'dark']) {
        if (!role[mode] || !role.meaning) errors.push(`${role.token}: missing documented mode value`);
        if (!definitions.some(d => d.value === role.token && d.expression === role[mode] && (mode === 'dark' ? d.scope.includes('prefers-color-scheme: dark') : d.scope === ':root'))) errors.push(`${role.token}: missing ${mode} definition`);
      }
    }
    for (const name of names) if (name.startsWith('--ui-') && !registry.roles.some(r => r.token === name) && !['--ui-font-body', '--ui-font-display'].includes(name)) errors.push(`${name}: missing role dictionary entry`);
  }
  return [...new Set(errors)];
}
