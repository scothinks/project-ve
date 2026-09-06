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

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;
if (!apiUrl || !publishableKey || !accessToken || !projectRef) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required.');
}

const options = { auth: { persistSession: false } };
const anonymous = createClient(apiUrl, publishableKey, options);
const appHeaders = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
  : {};
const checked = (result) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};
const hash = (value) => createHash('sha256').update(value).digest('hex');

async function managementRequest(path, init = {}) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Supabase Management API returned HTTP ${response.status} for ${path}.`);
  }
  return response.json();
}

async function managementQuery(query) {
  const rows = await managementRequest('/database/query', {
    method: 'POST',
    body: JSON.stringify({
      read_only: true,
      query,
    }),
  });
  if (!Array.isArray(rows)) {
    throw new Error('Supabase Management API returned an invalid query response.');
  }
  return rows;
}

const inventoryRows = await managementQuery('select public.service_media_inventory() as inventory');
const inventory = inventoryRows?.[0]?.inventory;
if (!inventory) {
  throw new Error('The hosted service_media_inventory query did not return an expected row.');
}

const references = (await managementQuery('select url from public.learning_media_assets where url is not null'))
  .map((row) => row.url)
  .filter((value) => typeof value === 'string');
const versions = [...new Set(references.filter((value) => /^\/api\/media\/[a-f0-9-]{36}$/.test(value)))];

const mediaObjects = await managementQuery(
  "select bucket_id, name, coalesce(size,0) as size from storage.objects where bucket_id in ('learning-media','learning-media-private') order by bucket_id, name",
);
const objectsByLocation = new Map(mediaObjects.map((row) => [`${row.bucket_id}/${row.name}`, Number(row.size)]));
const bucketRows = await managementQuery("select id, public from storage.buckets where id in ('learning-media','learning-media-private')");
const bucketPublicById = bucketRows.reduce((acc, row) => {
  acc[row.id] = Boolean(row.public);
  return acc;
}, {});

const delivery = [];
for (const reference of versions) {
  const versionId = reference.split('/').at(-1);
  const decision = checked(await anonymous.rpc('media_delivery', { p_version_id: versionId }));
  const response = await fetch(new URL(reference, app), {
    headers: { ...appHeaders, Range: 'bytes=0-63' },
    signal: AbortSignal.timeout(60000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  let matchesStorage = null;
  if (decision) {
    const objectKey = `${decision.bucket}/${decision.storagePath}`;
    const objectSize = objectsByLocation.get(objectKey);
    matchesStorage = typeof objectSize === 'number' && objectSize > 0 && objectSize >= bytes.length;
  }
  delivery.push({
    versionId,
    expectedAnonymousAccess: Boolean(decision),
    status: response.status,
    bytes: bytes.length,
    matchesStorage,
    contentRange: response.headers.get('content-range'),
    cacheControl: response.headers.get('cache-control'),
    csp: response.headers.get('content-security-policy'),
    passed: decision ? response.status === 206 && matchesStorage : response.status === 404 && bytes.length === 0,
  });
}

const objects = [];
for (const row of mediaObjects) {
  const objectPath = row.name;
  const publicUrl = new URL(`\/storage\/v1\/object\/public\/${row.bucket_id}/${objectPath.split('/').map((segment) => encodeURIComponent(segment)).join('/')}`, apiUrl);
  const publicResponse = await fetch(publicUrl, { method: 'HEAD', signal: AbortSignal.timeout(30000) });
  objects.push({
    name: objectPath,
    bucket: row.bucket_id,
    pathSha256: hash(objectPath),
    signedStatus: Number(row.size) > 0 ? 200 : 0,
    byteLength: Number(row.size),
    publicStatus: publicResponse.status,
    publicCacheControl: publicResponse.headers.get('cache-control'),
    cacheStatus: publicResponse.headers.get('cf-cache-status'),
    bucketPublic: bucketPublicById[row.bucket_id] === true,
  });
}

const report = {
  capturedAt: new Date().toISOString(),
  target: new URL(apiUrl).host,
  appUrl: app,
  inventory,
  delivery,
  objects,
  allDeliveryChecksPassed: delivery.length > 0 && delivery.every((row) => row.passed),
  allListedObjectsExist: objects.length > 0 && objects.every((row) => row.signedStatus === 200 && row.byteLength > 0),
  allListedPublicUrlsDenied: objects.length > 0 && objects.every((row) => row.publicStatus >= 400 && row.publicStatus < 500),
  limitations: [
    'Anonymous delivery checks do not exercise editor sessions or org membership.',
    'Storage object checks are metadata-driven and do not prove private-object readability by itself.',
    'One location and time do not establish expiry at every CDN edge or browser cache.',
    'RPC availability is not migration-ledger parity.',
  ],
};

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  out,
  versions: delivery.length,
  storageObjects: objects.length,
  allDeliveryChecksPassed: report.allDeliveryChecksPassed,
  allListedObjectsExist: report.allListedObjectsExist,
  allListedPublicUrlsDenied: report.allListedPublicUrlsDenied,
}, null, 2));

if (!report.allDeliveryChecksPassed || !report.allListedObjectsExist || !report.allListedPublicUrlsDenied) process.exitCode = 1;
