import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '..');
const committedPath = join(repoRoot, 'types', 'database.ts');
const generatedPath = '/tmp/project-ve-generated-database.normalized.ts';
const committedNormalizedPath = '/tmp/project-ve-committed-database.normalized.ts';

const generatedChunks = [];
for await (const chunk of process.stdin) {
  generatedChunks.push(chunk);
}

const generated = Buffer.concat(generatedChunks).toString('utf8');
const committed = readFileSync(committedPath, 'utf8');

if (!generated.includes('export type Database')) {
  console.error(
    'No Supabase Database type was received on stdin. Ensure Supabase CLI authentication, network access, and project configuration are available.',
  );
  process.exit(1);
}

function normalizeDatabaseTypes(input) {
  return (
    input
      .replace(
        /(export type Database = \{\n)(?:  \/\/ Allows[^\n]*\n  \/\/ instead[^\n]*\n  __InternalSupabase: \{\n    PostgrestVersion: "[^"]+"\n  \}\n)?  public: \{/,
        '$1  public: {',
      )
      .trimEnd() + '\n'
  );
}

const normalizedGenerated = normalizeDatabaseTypes(generated);
const normalizedCommitted = normalizeDatabaseTypes(committed);

if (normalizedGenerated === normalizedCommitted) {
  process.exit(0);
}

writeFileSync(generatedPath, normalizedGenerated);
writeFileSync(committedNormalizedPath, normalizedCommitted);

const diff = spawnSync('diff', ['-u', committedNormalizedPath, generatedPath], {
  encoding: 'utf8',
});

const output = diff.stdout.split('\n').slice(0, 220).join('\n');
console.error(output);
process.exit(1);
