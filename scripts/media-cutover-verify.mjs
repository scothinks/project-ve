import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Read-only operational smoke check. No fixtures, impersonation or bucket writes.
const args = process.argv.slice(2);
const requestedApp = args[args.indexOf('--app-url') + 1];
const qualificationReportPath = args.includes('--qualification-report')
  ? args[args.indexOf('--qualification-report') + 1]
  : null;
const out = args[args.indexOf('--out') + 1];
if (!args.includes('--app-url') || !args.includes('--out') || !requestedApp || !out) {
  throw new Error('Usage: node --env-file=<target-env> scripts/media-cutover-verify.mjs --app-url <url> [--qualification-report <file>] --out <file>');
}
const qualificationReport = qualificationReportPath
  ? JSON.parse(readFileSync(qualificationReportPath, 'utf8'))
  : null;
const app = qualificationReport?.qualifiedAppUrl ?? requestedApp;
if (new URL(app).protocol !== 'https:') throw new Error('The qualified app URL must use HTTPS.');

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
    const body = await response.text();
    let detail = body;
    try {
      const parsed = JSON.parse(body);
      detail = parsed.message ?? parsed.error ?? body;
    } catch {}
    throw new Error(`Supabase Management API returned HTTP ${response.status} for ${path}: ${String(detail).slice(0, 500)}`);
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

try {
const inventoryRows = await managementQuery(`select jsonb_build_object(
  'issues',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from private.media_migration_issues i),
  'publicBuckets',(select coalesce(jsonb_agg(b.id),'[]') from storage.buckets b where b.public and (b.id='learning-media' or exists(select 1 from private.media_versions v where v.bucket=b.id))),
  'unverifiedVersions',(select count(*) from private.media_versions where rights_profile='unverified'),
  'versions',(select count(*) from private.media_versions)
) as inventory`);
const inventory = inventoryRows?.[0]?.inventory;
if (!inventory) {
  throw new Error('The hosted service_media_inventory query did not return an expected row.');
}

const references = (await managementQuery('select url from public.learning_media_assets where url is not null'))
  .map((row) => row.url)
  .filter((value) => typeof value === 'string');
const versions = [...new Set(references.filter((value) => /^\/api\/media\/[a-f0-9-]{36}$/.test(value)))];

const mediaObjects = await managementQuery(
  `select bucket_id, name,
    case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint else 0 end as byte_size
   from storage.objects where bucket_id in ('learning-media','learning-media-private') order by bucket_id, name`,
);
const registryVersions = await managementQuery(
  `select id::text, bucket, storage_path, revoked_at is not null as revoked,
    exists(select 1 from storage.objects o where o.bucket_id=v.bucket and o.name=v.storage_path
      and case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint else 0 end > 0) as object_exists
   from private.media_versions v order by id`,
);
const objectsByLocation = new Map(mediaObjects.map((row) => [`${row.bucket_id}/${row.name}`, Number(row.byte_size)]));
const registryById = new Map(registryVersions.map((row) => [row.id, row]));
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
    metadataPresent: true,
    byteLength: Number(row.byte_size),
    publicStatus: publicResponse.status,
    publicCacheControl: publicResponse.headers.get('cache-control'),
    cacheStatus: publicResponse.headers.get('cf-cache-status'),
    bucketPublic: bucketPublicById[row.bucket_id] === true,
  });
}

const referencedVersions = versions.map((reference) => {
  const versionId = reference.split('/').at(-1);
  const version = registryById.get(versionId);
  return {
    versionId,
    registered: Boolean(version),
    revoked: version?.revoked === true,
    objectExists: version?.object_exists === true,
  };
});
const inventoryResolved = Array.isArray(inventory.issues)
  && inventory.issues.length === 0
  && Array.isArray(inventory.publicBuckets)
  && inventory.publicBuckets.length === 0
  && Number(inventory.unverifiedVersions) === 0;
const referencesReconciled = referencedVersions.length > 0
  && referencedVersions.every((row) => row.registered && !row.revoked && row.objectExists);
const activeRegistryReconciled = registryVersions.length > 0
  && registryVersions.filter((row) => !row.revoked).every((row) => row.object_exists === true);
const privateBucketsConfirmed = bucketRows.length > 0
  && bucketRows.every((row) => row.public === false);
const allDeliveryChecksPassed = delivery.length > 0 && delivery.every((row) => row.passed);
const allListedObjectsNonEmpty = objects.length > 0
  && objects.every((row) => row.byteLength > 0);
const allListedPublicUrlsDenied = objects.length > 0
  && objects.every((row) => row.publicStatus >= 400 && row.publicStatus < 500);
const fixtureReady = versions.length > 0 && registryVersions.length > 0 && objects.length > 0;
const assertionsPassed = inventoryResolved
  && referencesReconciled
  && activeRegistryReconciled
  && privateBucketsConfirmed
  && allDeliveryChecksPassed
  && allListedObjectsNonEmpty
  && allListedPublicUrlsDenied;

const report = {
  capturedAt: new Date().toISOString(),
  status: !fixtureReady ? 'blocked' : assertionsPassed ? 'pass' : 'fail',
  target: new URL(apiUrl).host,
  appUrl: app,
  inventory,
  delivery,
  objects,
  referencedVersions,
  checks: {
    fixtureReady,
    inventoryResolved,
    referencesReconciled,
    activeRegistryReconciled,
    privateBucketsConfirmed,
    allDeliveryChecksPassed,
    allListedObjectsNonEmpty,
    allListedPublicUrlsDenied,
  },
  limitations: [
    'Anonymous delivery checks do not exercise editor sessions or org membership.',
    'Storage reconciliation uses registry and object metadata; the delivery probe separately reads only references available to the anonymous caller.',
    'One location and time do not establish expiry at every CDN edge or browser cache.',
    'RPC availability is not migration-ledger parity.',
  ],
};

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  out,
  status: report.status,
  versions: delivery.length,
  storageObjects: objects.length,
  checks: report.checks,
}, null, 2));

if (report.status !== 'pass') process.exitCode = 1;
} catch (error) {
  const report = {
    capturedAt: new Date().toISOString(),
    status: 'blocked',
    target: new URL(apiUrl).host,
    appUrl: app,
    error: error instanceof Error ? error.message : String(error),
  };
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.error(report.error);
  process.exitCode = 1;
}
