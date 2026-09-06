import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';
// Execute the real handlers. Only their network/auth dependencies are replaced;
// no production failure switches or privileged test endpoints are installed.
const state = {};
globalThis.__mediaRouteTest = state;
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') return { shortCircuit:true, url:'data:text/javascript,export {}' };
  if (specifier === '@/features/media/server/context' || (specifier === './context' && context.parentURL.includes('/features/media/server/upload.ts'))) return {shortCircuit:true,url:'data:text/javascript,export const requireMediaEditor=async()=>globalThis.__mediaRouteTest.editor;export const mediaRequestContext=requireMediaEditor;'};
  if (specifier === '@/lib/supabase-admin') return {shortCircuit:true,url:'data:text/javascript,export const createSupabaseAdminClient=()=>globalThis.__mediaRouteTest.admin;'};
  if (specifier.startsWith('@/')) {
    const base=path.resolve(specifier.slice(2));const file=['','.ts','.tsx','.mjs'].map(e=>base+e).find(existsSync);
    if(file)return {shortCircuit:true,url:pathToFileURL(file).href};
  }
  if(specifier==='next/server')return nextResolve('next/server.js',context);
  return nextResolve(specifier,context);
}});
const { POST }=await import('../../app/api/admin/media/assets/route.ts');
const { uploadMedia }=await import('../../features/media/server/upload.ts');
const { GET }=await import('../../app/api/media/[versionId]/route.ts');
hooks.deregister();
const version='90500000-0000-4000-8000-000000000301';
const request=action=>new Request('http://localhost/api/admin/media/assets',{method:'POST',body:JSON.stringify({versionId:version,action})});
function setup({storageFailure=false,notificationFailure=false}={}) {
  const calls=[];let fail=storageFailure;
  state.editor={organizationId:null,canManage:true,supabase:{rpc:async name=>{
    calls.push(name);
    if(name==='admin_dispatch_media_notifications')return {data:1,error:notificationFailure?{message:'injected dispatch failure'}:null};
    return {data:{bucket:'learning-media-private',storagePath:'registry/fixture.png'},error:null};
  }}};
  state.admin={rpc:async name=>{calls.push(name);return {data:null,error:name==='service_register_media'?{message:'Registration quota rejected'}:null};},storage:{from:()=>({
    upload:async storagePath=>{calls.push(['upload',storagePath]);return {error:null};},
    remove:async paths=>{calls.push(['remove',paths]);const error=fail?{message:'Storage offline'}:null;fail=false;return {error};},
  })}};
  return calls;
}
test('storage deletion failure keeps tombstone and retry completes registry cleanup',async()=>{
  const calls=setup({storageFailure:true});
  const failed=await POST(request('delete'));assert.equal(failed.status,403);assert.match((await failed.json()).error,/Retry deletion/);
  assert.ok(!calls.includes('service_finish_media_deletion'));
  const retried=await POST(request('delete'));assert.equal(retried.status,200);
  assert.equal(calls.filter(c=>c==='service_finish_media_deletion').length,1);
  assert.equal(calls.filter(c=>Array.isArray(c)&&c[0]==='remove').length,2);
});
test('notification outage reports pending retry after successful revocation',async()=>{
  const calls=setup({notificationFailure:true});
  const response=await POST(request('revoke'));assert.equal(response.status,200);
  assert.match((await response.json()).notice,/pending retry/);
  assert.deepEqual(calls,['admin_manage_media','admin_dispatch_media_notifications']);
});
test('failed registry registration removes only the newly uploaded object',async()=>{
  const calls=setup();const form=new FormData();
  form.set('file',new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7l8AAAAASUVORK5CYII=','base64')],'fixture.png',{type:'image/png'}));
  form.set('altText','Fixture');form.set('rightsConfirmed','true');
  await assert.rejects(uploadMedia(new Request('http://localhost/upload',{method:'POST',body:form})),/Registration quota rejected/);
  const upload=calls.find(c=>Array.isArray(c)&&c[0]==='upload');const remove=calls.find(c=>Array.isArray(c)&&c[0]==='remove');
  assert.match(upload[1],/^registry\/[a-f0-9-]+\.png$/);assert.deepEqual(remove[1],[upload[1]]);
});

test('byte-range classification covers bounds and suffixes without guessing object size', async()=>{
  const { isUnsatisfiableByteRange: invalid }=await import('../../features/media/domain/byte-range.ts');
  for(const range of ['bytes=100-','bytes=101-200','bytes=10-9','bytes=-0','bytes=-'])assert.equal(invalid(range,'100'),true,range);
  for(const range of ['bytes=0-','bytes=99-999','bytes=-200','bytes=-1'])assert.equal(invalid(range,'100'),false,range);
  assert.equal(invalid('bytes=100-',null),false);assert.equal(invalid('bytes=0-','0'),true);
});

test('storage 500 becomes 416 only when authorised object metadata proves an invalid range',{timeout:2000},async()=>{
  const original=globalThis.fetch;
  try {
    for(const [range,headStatus,expected] of [['bytes=1000-',200,416],['bytes=0-9',200,500],['bytes=1000-',503,500]]){
      setup();state.admin.storage.from=()=>({createSignedUrl:async()=>({data:{signedUrl:'https://storage.example.test/fixture'},error:null})});
      const requests=[];
      globalThis.fetch=async(_url,options)=>{requests.push(options);return options.method==='HEAD'?new Response(null,{status:headStatus,headers:{'content-length':'100'}}):new Response(new Response('Storage error').body.tee()[0],{status:500});};
      const r=await GET(new Request('http://localhost/api/media/'+version,{headers:{Range:range}}),{params:Promise.resolve({versionId:version})});
      assert.equal(r.status,expected);assert.equal(requests.length,2);
      if(expected===416){assert.equal(r.headers.get('content-range'),'bytes */100');assert.equal(r.headers.get('content-length'),null);}
    }
  } finally {globalThis.fetch=original;}
});
