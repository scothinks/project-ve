import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Read-only evidence capture. Never closes buckets, applies migrations or writes
// fixtures. Credentials stay in the environment and are excluded from artifacts.
const args=process.argv.slice(2);const local=args.includes('--local');
const out=args[args.indexOf('--out')+1];
if(!args.includes('--out')||!out)throw new Error('Usage: node scripts/media-release-evidence.mjs [--local] --out <directory>');
const sha=value=>createHash('sha256').update(value).digest('hex');
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const paths=git('ls-files','--cached','--others','--exclude-standard','-z').split('\0').filter(Boolean);
const sourceRoots=['app/','components/','features/','lib/','public/','types/'];
const config=['package.json','package-lock.json','next.config.ts','tsconfig.json','postcss.config.mjs','middleware.ts','vercel.json'];
const files=[...new Set(paths)].filter(p=>existsSync(p)&&(sourceRoots.some(r=>p.startsWith(r))||config.includes(p))).sort().map(p=>({path:p,sha256:sha(readFileSync(p))}));
const validationFiles=[...new Set(paths)].filter(p=>existsSync(p)&&(p.startsWith('tests/')||p.startsWith('scripts/')||p.startsWith('supabase/migrations/')||p.startsWith('supabase/tests/')||['playwright.config.ts','eslint.config.mjs'].includes(p))).sort().map(p=>({path:p,sha256:sha(readFileSync(p))}));
const localBuildId=existsSync('.next-e2e/BUILD_ID')?readFileSync('.next-e2e/BUILD_ID','utf8').trim():null;
const revision={localBuildId,validationSha256:sha(JSON.stringify(validationFiles)),head:git('rev-parse','HEAD'),branch:git('branch','--show-current'),sourceSha256:sha(JSON.stringify(files)),files};
const migrations=[...new Set(paths)].filter(p=>/^supabase\/migrations\/2026090[45].*\.sql$/.test(p)&&existsSync(p)).sort().map(p=>({version:path.basename(p).split('_')[0],name:path.basename(p),sha256:sha(readFileSync(p))}));
let url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,db=process.env.MEDIA_EVIDENCE_DB_URL;
if(local){
 const r=spawnSync(process.execPath,['scripts/supabase-cli.mjs','status','-o','env'],{encoding:'utf8'});
 if(r.status!==0)throw new Error('Local Supabase unavailable.');
 const env=Object.fromEntries(r.stdout.split('\n').map(l=>l.match(/^([A-Z0-9_]+)="?([^"]*)"?$/)).filter(Boolean).map(m=>[m[1],m[2]]));
 url=env.API_URL;key=env.SERVICE_ROLE_KEY;db=env.DB_URL;
}
if(!url||!key)throw new Error('Target Supabase URL/service credential required in environment.');
const report={capturedAt:new Date().toISOString(),target:new URL(url).host,environment:local?'local':'hosted (designation requires operator confirmation)',revision:{...revision,files:undefined},migrations,checks:{}};
const client=createClient(url,key,{auth:{persistSession:false}});
const inventory=await client.rpc('service_media_inventory');
if(inventory.error)throw new Error('Media inventory request failed; check target access.');
const data=inventory.data;
report.checks.inventory={versions:data.versions,unverifiedVersions:data.unverifiedVersions,publicBuckets:data.publicBuckets,issueCount:data.issues.length,issuesByReason:Object.fromEntries([...new Set(data.issues.map(i=>i.reason))].map(reason=>[reason,data.issues.filter(i=>i.reason===reason).length]))};
const buckets=await client.storage.listBuckets();
if(buckets.error)throw new Error('Storage bucket inventory failed.');
report.checks.buckets=buckets.data.filter(b=>b.id==='learning-media'||b.id==='learning-media-private'||data.publicBuckets.includes(b.id)).map(b=>({id:b.id,public:b.public,fileSizeLimit:b.file_size_limit,allowedMimeTypes:b.allowed_mime_types}));
if(db){
 const query=`begin read only; select json_build_object(
 'ledger',(select coalesce(json_agg(json_build_object('version',version,'name',name) order by version),'[]') from supabase_migrations.schema_migrations where version >= '20260904000000'),
 'registeredObjects',(select count(*) from private.media_versions),
 'missingObjects',(select count(*) from private.media_versions v where not exists(select 1 from storage.objects o where o.bucket_id=v.bucket and o.name=v.storage_path)),
 'draftPlacements',(select count(*) from private.media_placements where in_draft),
 'publishedPlacements',(select count(*) from private.media_placements where in_publication),
 'orphanPlacements',(select count(*) from private.media_placements p where not exists(select 1 from private.media_versions v where v.id=p.version_id)),
 'pendingNotifications',(select count(*) from private.media_notification_outbox where delivered_at is null)); rollback;`;
 const connection=new URL(db);
 const r=spawnSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1'],{input:query,env:{...process.env,PGHOST:connection.hostname,PGPORT:connection.port||'5432',PGDATABASE:decodeURIComponent(connection.pathname.slice(1)),PGUSER:decodeURIComponent(connection.username),PGPASSWORD:decodeURIComponent(connection.password),PGSSLMODE:connection.searchParams.get('sslmode')||(local?'disable':'require'),PGCONNECT_TIMEOUT:'10',PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=60000'},encoding:'utf8'});
 if(r.status===0){report.checks.database=JSON.parse(r.stdout.trim());const deployed=new Set(report.checks.database.ledger.map(m=>m.version));report.checks.migrationsAbsentFromLedger=migrations.filter(m=>!deployed.has(m.version)).map(m=>m.version);}
 else report.checks.database={status:'blocked',reason:'Read-only database connection failed. No database mutations attempted.',detail:r.stderr.split('\n').filter(l=>/^ERROR:|^LINE [0-9]+:/.test(l)).join('\n')};
}else report.checks.database={status:'blocked',reason:'MEDIA_EVIDENCE_DB_URL not configured; migration ledger and object/reference reconciliation not verified.'};
report.limitations=['Source fingerprint identifies this local checkout, not a verified hosted app deployment.','Migration presence does not prove replay against a pre-migration copy of target data.','Storage metadata does not prove byte availability or CDN cache expiry.','This capture is read-only; separate operational evidence records any bucket cutover or data repairs.'];
mkdirSync(out,{recursive:true});writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify({...revision,validationFiles},null,2)+'\n');writeFileSync(path.join(out,'inventory.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({target:report.target,sourceSha256:revision.sourceSha256,inventory:report.checks.inventory,database:report.checks.database?.status??'read',out},null,2));
