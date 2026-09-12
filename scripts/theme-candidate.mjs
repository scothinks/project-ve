import { readFileSync, writeFileSync, readdirSync, existsSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import { scanProduction, hash } from './theme-contract/source.mjs';

const file = process.env.THEME_CANDIDATE_MANIFEST;
if (!file) throw new Error('THEME_CANDIDATE_MANIFEST must name an external candidate manifest.');
const scan = scanProduction(process.cwd());
const sourceFiles = Object.entries(scan.files).map(([path, sha256]) => ({ path, sha256 }));
const sourceSha256 = hash(JSON.stringify(sourceFiles));
const mode = process.argv[2];
const directory = '.next-e2e';
function buildFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(item => {
    const file = path.join(dir, item.name);
    if (['cache', 'trace', 'diagnostics'].includes(item.name)) return [];
    return item.isDirectory() ? buildFiles(file) : [{ path: file, sha256: hash(readFileSync(file)) }];
  });
}
if (mode === 'freeze') {
  writeFileSync(file, JSON.stringify({ baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), status: 'uncommitted exact production source', sourceSha256, sourceFiles }, null, 2) + '\n');
} else {
  const record = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(sourceSha256, record.sourceSha256, 'Production source changed after freeze; requalify the changed build.');
  const buildId = readFileSync(`${directory}/BUILD_ID`, 'utf8').trim();
  if (mode === 'seal') {
    writeFileSync(file, JSON.stringify({ ...record, buildId, buildFiles: buildFiles(directory) }, null, 2) + '\n');
  } else if (mode === 'verify' || mode === 'prepare') {
    assert.equal(buildId, record.buildId, 'Candidate build ID changed.');
    for (const artifact of record.buildFiles) assert.equal(hash(readFileSync(artifact.path)), artifact.sha256, artifact.path);
    if (mode === 'prepare') {
      // Direct fixture seeding cannot invalidate Next's persisted public reads.
      // Preserve that disposable cache separately; never alter compiled assets or DB data.
      const cache = `${directory}/cache/fetch-cache`;
      if (existsSync(cache)) renameSync(cache, `${cache}-qualification-${Date.now()}`);
    }
  } else throw new Error('Expected freeze, seal, verify or prepare.');
}
console.log(`Candidate ${mode}: ${sourceSha256}`);
