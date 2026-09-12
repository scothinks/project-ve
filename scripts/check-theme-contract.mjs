import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { scanProduction, parseSource } from './theme-contract/source.mjs';
import { checkContract } from './theme-contract/policy.mjs';
import { roleContrastResults } from './theme-contract/contrast.mjs';

const root = process.cwd();
const registry = JSON.parse(readFileSync(path.join(root, 'docs/evidence/theme-adoption/registry.json'), 'utf8'));
const scan = scanProduction(root);
let errors = checkContract(scan, registry);
if (Number(registry.gate.replace(/\D/g, '')) >= 2) {
  errors.push(...roleContrastResults(registry.roles).filter(pair => !pair.passes)
    .map(pair => `${pair.mode} ${pair.foreground}/${pair.background}: ${pair.ratio ?? 'missing'} contrast; requires ${pair.minimum}:1`));
}
const generatedIndex = process.argv.indexOf('--generated');
if (generatedIndex !== -1) {
  const directory = process.argv[generatedIndex + 1];
  if (!directory) throw new Error('--generated requires the production CSS directory');
  const compiled = { entries: [], hazards: [] };
  function walk(dir) {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) walk(file);
      else if (file.endsWith('.css')) compiled.entries.push(...parseSource(file, readFileSync(file, 'utf8')).entries);
    }
  }
  walk(directory);
  if (!compiled.entries.length) throw new Error('No generated CSS found');
  errors = [...errors, ...checkContract(compiled, registry, { generated: true })];
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Theme contract ${registry.gate}: ${Object.keys(scan.files).length} production files/assets, ${scan.entries.length} occurrences; no unclassified additions or unresolved dynamic theme use.`);
