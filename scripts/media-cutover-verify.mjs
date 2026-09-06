import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Read-only operational smoke check. No fixtures, impersonation or bucket writes.
const args = process.argv.slice(2);
const app = args[args.indexOf('--app-url') + 1];
const out = args[args.indexOf('--out') + 1];
if (!args.includes('--app-url') || !args.includes('--out') || !app || !out) {
  throw new Error('Usage: node --env-file=<target-env> scripts/media-cutover-verify.mjs --app-url <url> --out <file>');
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publishableKey || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY are required.');
}
const options = { auth: { persistSession: false } };
const service = createClient(url, serviceRoleKey, options);
const anonymous = createClient(url, publishableKey, options);
const appHeaders = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
  : {};
const checked = result => { if (result.error) throw new Error(result.error.message); return result.data; };
const hash = value => createHash('sha256').update(value).digest('hex');
const inventory = checked(await service.rpc('service_media_inventory'));
const references = checked(await service.from('learning_media_assets').select('url').not('url', 'is', null));
const versions = [...new Set(references.map(row => row.url).filter(value => /^\/api\/media\/[a-f0-9-]{36}$/.test(value)))];
const delivery = [];
for (const reference of versions) {
  const decision = checked(await anonymous.rpc('media_delivery', { p_version_id: reference.split('/').at(-1) }));
  const response = await fetch(new URL(reference, app), { headers: { ...appHeaders, Range: 'bytes=0-63' }, signal: AbortSignal.timeout(60000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  let matchesStorage = null;
  if (decision) {
    const signed = checked(await service.storage.from(decision.bucket).createSignedUrl(decision.storagePath, 60));
    const original = await fetch(signed.signedUrl, { headers: { Range: 'bytes=0-63' }, signal: AbortSignal.timeout(30000) });
    matchesStorage = original.status === 206 && hash(Buffer.from(await original.arrayBuffer())) === hash(bytes);
  }
  delivery.push({ versionId: reference.split('/').at(-1), expectedAnonymousAccess: Boolean(decision), status: response.status,
    bytes: bytes.length, matchesStorage, contentRange: response.headers.get('content-range'), cacheControl: response.headers.get('cache-control'),
    csp: response.headers.get('content-security-policy'), passed: decision ? response.status === 206 && matchesStorage : response.status === 404 && bytes.length === 0 });
}
const objects = [];
async function list(prefix = '') {
  for (let offset = 0; ; offset += 100) {
    const entries = checked(await service.storage.from('learning-media').list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }));
    for (const entry of entries) {
      const objectPath = [prefix, entry.name].filter(Boolean).join('/');
      if (!entry.id) { await list(objectPath); continue; }
      const signed = checked(await service.storage.from('learning-media').createSignedUrl(objectPath, 60));
      const privateResponse = await fetch(signed.signedUrl, { method: 'HEAD', signal: AbortSignal.timeout(30000) });
      const publicUrl = service.storage.from('learning-media').getPublicUrl(objectPath).data.publicUrl;
      const publicResponse = await fetch(publicUrl, { method: 'HEAD', signal: AbortSignal.timeout(30000) });
      objects.push({ pathSha256: hash(objectPath), signedStatus: privateResponse.status, byteLength: Number(privateResponse.headers.get('content-length')),
        publicStatus: publicResponse.status, publicCacheControl: publicResponse.headers.get('cache-control'), cacheStatus: publicResponse.headers.get('cf-cache-status') });
    }
    if (entries.length < 100) break;
  }
}
await list();
const report = { capturedAt: new Date().toISOString(), target: new URL(url).host, appUrl: app, inventory,
  delivery, objects, allDeliveryChecksPassed: delivery.length > 0 && delivery.every(row => row.passed),
  allListedObjectsExist: objects.length > 0 && objects.every(row => row.signedStatus === 200 && row.byteLength > 0),
  allListedPublicUrlsDenied: objects.length > 0 && objects.every(row => row.publicStatus >= 400 && row.publicStatus < 500),
  limitations: ['Anonymous delivery checks do not exercise editor sessions or org membership.', 'Listed storage objects are not a private-registry-to-object join.', 'One location and time do not establish expiry at every CDN edge or browser cache.', 'RPC availability is not migration-ledger parity.'] };
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ out, versions: delivery.length, storageObjects: objects.length, allDeliveryChecksPassed: report.allDeliveryChecksPassed,
  allListedObjectsExist: report.allListedObjectsExist, allListedPublicUrlsDenied: report.allListedPublicUrlsDenied }, null, 2));
if (!report.allDeliveryChecksPassed || !report.allListedObjectsExist || !report.allListedPublicUrlsDenied) process.exitCode = 1;
