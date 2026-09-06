import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Explicit release repair for historical generator metadata. Keep the original
// object identity without retaining a public URL. Do not grant a new placement,
// guess a version ID, change active media, or weaken the closure guard.
const args = process.argv.slice(2);
const out = args[args.indexOf('--out') + 1];
if (!args.includes('--out') || !out) throw new Error('Usage: node --env-file=<target-env> scripts/media-repair-legacy-provenance.mjs [--apply] --out <file>');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const client = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const checked = result => { if (result.error) throw new Error(result.error.message); return result.data; };
const rows = checked(await client.from('learning_media_assets').select('id,url,metadata').not('metadata->>previousUrl', 'is', null));
const changes = [];
for (const row of rows) {
  if (typeof row.metadata?.previousUrl !== 'string') continue;
  let previous;
  try { previous = new URL(row.metadata.previousUrl); } catch { continue; }
  const prefix = '/storage/v1/object/public/learning-media/';
  if (previous.origin !== new URL(url).origin || !previous.pathname.startsWith(prefix)) continue;
  if (row.metadata.previousStorageObject) throw new Error('Existing provenance needs manual reconciliation.');
  const { previousUrl, ...metadata } = row.metadata;
  metadata.previousStorageObject = { bucket: 'learning-media', storagePath: decodeURIComponent(previous.pathname.slice(prefix.length)) };
  if (args.includes('--apply')) {
    // Compare-and-swap protects metadata changed by a concurrent editor/worker.
    const updated = checked(await client.from('learning_media_assets').update({ metadata }).eq('id', row.id).eq('metadata', JSON.stringify(row.metadata)).select('id'));
    if (updated.length !== 1) throw new Error('Metadata changed concurrently; rerun the inventory.');
  }
  changes.push({ id: row.id, oldUrlSha256: createHash('sha256').update(previousUrl).digest('hex'), preservedAs: 'metadata.previousStorageObject' });
}
const report = { capturedAt: new Date().toISOString(), target: new URL(url).host, applied: args.includes('--apply'), changes };
mkdirSync(path.dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ out, applied: report.applied, rows: changes.length }));
