import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';
const state={};globalThis.__authoringRouteTest=state;
const stub=source=>({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(source)});
const hooks=registerHooks({resolve(specifier,context,next){
 if(specifier==='server-only')return stub('export {};');
 if(specifier==='next/server')return stub(`export {NextResponse} from ${JSON.stringify(pathToFileURL(path.resolve('node_modules/next/server.js')).href)};export const after=fn=>globalThis.__authoringRouteTest.after.push(fn);`);
 if(specifier==='@/lib/admin')return stub('export const requireAdmin=async()=>globalThis.__authoringRouteTest.context;');
 if(specifier==='@/lib/supabase-admin')return stub('export const createSupabaseAdminClient=()=>globalThis.__authoringRouteTest.context.supabase;');
 if(specifier==='@/features/ai-generation/authoring/worker')return stub('export const dispatchAuthoringPage=async(_client,id)=>globalThis.__authoringRouteTest.dispatch.push(id);');
 if(specifier==='@/app/admin/courses/learning-cache')return stub('export const revalidateLearningPaths=()=>{if(globalThis.__authoringRouteTest.cacheError)throw new Error("cache unavailable");};');
 if(specifier==='@/lib/app-errors')return stub('export const logAppError=()=>{};');
 if(specifier.startsWith('@/')){const p=path.resolve(specifier.slice(2));const f=['','.ts'].map(e=>p+e).find(existsSync);if(f)return {shortCircuit:true,url:pathToFileURL(f).href};}
 return next(specifier,context);
}});
const {GET,POST}=await import('../../app/api/admin/ai/authoring/route.ts');
const {GET:legacyGET,POST:legacyPOST}=await import('../../app/api/admin/ai/legacy-media/route.ts');
hooks.deregister();
const request=action=>new Request('http://localhost/api/admin/ai/authoring',{method:'POST',body:JSON.stringify({action,id:'result'})});
function setup(failure){
 state.after=[];state.dispatch=[];state.calls=[];state.cacheError=false;
 state.context={workspace:{type:'organization',id:'org'},supabase:{rpc:async(name,args)=>{
 state.calls.push([name,args]);return {data:name==='admin_apply_ai_page'?{status:'saved',pageId:'page'}:{id:'result',courseId:'course',lessonId:'lesson'},error:failure?.(name)};
 }}};
}
test('start acknowledges before trusted dispatch; read paths never generate',async()=>{
 setup();const previous=process.env.AI_AUTHORING_PAGE_PILOT_ENABLED;const key=process.env.OPENAI_API_KEY;
 process.env.AI_AUTHORING_PAGE_PILOT_ENABLED='true';process.env.OPENAI_API_KEY=crypto.randomUUID();
 try{
 assert.equal((await POST(request('start'))).status,200);assert.deepEqual(state.dispatch,[]);assert.equal(state.after.length,1);
 await state.after[0]();assert.deepEqual(state.dispatch,['result']);
 state.calls=[];await GET(new Request('http://localhost/api/admin/ai/authoring?lessonId=lesson'));
 assert.deepEqual(state.calls.map(c=>c[0]),['admin_read_ai_results']);assert.equal(state.calls[0][1].p_organization_id,'org');assert.equal(state.after.length,1);
 }finally{if(previous===undefined)delete process.env.AI_AUTHORING_PAGE_PILOT_ENABLED;else process.env.AI_AUTHORING_PAGE_PILOT_ENABLED=previous;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;}
});
test('unknown save response stays uncertain; cache failure after commit still returns saved',async()=>{
 setup(name=>name==='admin_apply_ai_page'?{message:'Network connection lost'}:null);
 const uncertain=await POST(request('apply'));assert.equal(uncertain.status,503);assert.match((await uncertain.json()).error,/could not confirm/);
 setup();state.cacheError=true;const saved=await POST(request('apply'));assert.equal(saved.status,200);assert.equal((await saved.json()).status,'saved');
 assert.deepEqual(state.calls.map(c=>c[0]),['admin_read_ai_results','admin_prepare_ai_page_apply','admin_apply_ai_page']);
});
test('rollout off rejects new starts while reads and application remain available',async()=>{
 setup();const previous=process.env.AI_AUTHORING_PAGE_PILOT_ENABLED;delete process.env.AI_AUTHORING_PAGE_PILOT_ENABLED;
 try{assert.equal((await POST(request('start'))).status,409);assert.equal(state.calls.length,0);assert.equal((await POST(request('apply'))).status,200);}
 finally{if(previous!==undefined)process.env.AI_AUTHORING_PAGE_PILOT_ENABLED=previous;}
});
test('platform catalogue pseudo-workspace maps to unowned results, never an organisation UUID',async()=>{
 setup();state.context.workspace={type:'organization',id:'platform-catalog'};
 const response=await GET(new Request('http://localhost/api/admin/ai/authoring'));
 assert.equal(response.status,200);assert.equal(state.calls[0][1].p_organization_id,undefined);
});
test('result stream has no worker or write capability and no shared cache',()=>{
 const source=readFileSync(new URL('../../app/api/admin/ai/authoring/events/route.ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/createSupabaseAdminClient|dispatchAuthoringPage|\.insert\(|\.update\(|unstable_cache/);
 assert.match(source,/requireAdmin/);assert.match(source,/readAuthoringResult/);assert.match(source,/private, no-store/);
});
test('assistant quote needs only a lesson revision, with no provider dispatch or mandatory instructions',async()=>{
 setup();const previous=process.env.AI_AUTHORING_PAGE_PILOT_ENABLED;process.env.AI_AUTHORING_PAGE_PILOT_ENABLED='true';
 try{
 const response=await POST(new Request('http://localhost/api/admin/ai/authoring',{method:'POST',body:JSON.stringify({action:'quote',lessonId:'lesson',revision:2})}));
 assert.equal(response.status,200);assert.equal(state.calls[0][1].p_page_type,'auto');assert.equal(state.calls[0][1].p_focus,'');assert.deepEqual(state.dispatch,[]);assert.deepEqual(state.after,[]);
 }finally{if(previous===undefined)delete process.env.AI_AUTHORING_PAGE_PILOT_ENABLED;else process.env.AI_AUTHORING_PAGE_PILOT_ENABLED=previous;}
});

test('assistance quotes validate bounds and use the scoped operation RPC',async()=>{
 setup();const previous=process.env.AI_AUTHORING_PAGE_PILOT_ENABLED;process.env.AI_AUTHORING_PAGE_PILOT_ENABLED='true';
 const req=fields=>new Request('http://localhost/api/admin/ai/authoring',{method:'POST',body:JSON.stringify({action:'quote',kind:'quiz',courseId:'course',lessonId:'lesson',...fields})});
 try{assert.equal((await POST(req({count:4}))).status,400);assert.equal(state.calls.length,0);
 const r=await POST(req({count:2}));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(state.calls[0][0],'admin_quote_ai_assistance');assert.equal(state.calls[0][1].p_count,2);assert.deepEqual(state.after,[]);
 }finally{if(previous===undefined)delete process.env.AI_AUTHORING_PAGE_PILOT_ENABLED;else process.env.AI_AUTHORING_PAGE_PILOT_ENABLED=previous;}
});
test('assistance application recovery replays persisted selection before client values',async()=>{
 setup();state.context.supabase.rpc=async(name,args)=>{state.calls.push([name,args]);return {data:name==='admin_read_ai_results'?{id:'result',kind:'quiz',selection:[1],courseId:'course',lessonId:'lesson'}:name==='admin_apply_ai_assistance'?{status:'saved',lessonId:'lesson',ids:['q']}:null,error:null};};
 const r=await POST(new Request('http://localhost/api/admin/ai/authoring',{method:'POST',body:JSON.stringify({action:'apply',id:'result',selection:[0]})}));
 assert.equal(r.status,200);assert.deepEqual(state.calls.map(c=>c[0]),['admin_read_ai_results','admin_prepare_ai_assistance_apply','admin_apply_ai_assistance']);assert.deepEqual(state.calls[1][1].p_selection,[1]);
});


test('course quote keeps explicit quiz scope and workspace; course application uses atomic receipt boundary',async()=>{
 setup();const previous=process.env.AI_AUTHORING_PAGE_PILOT_ENABLED;process.env.AI_AUTHORING_PAGE_PILOT_ENABLED='true';
 try {
 const r=await POST(new Request('http://localhost/api/admin/ai/authoring',{method:'POST',body:JSON.stringify({action:'quote',kind:'course_draft',parentId:'outline',revision:2,questionsPerLesson:0})}));
 assert.equal(r.status,200);assert.equal(state.calls[0][0],'admin_quote_ai_course');assert.equal(state.calls[0][1].p_questions,0);assert.equal(state.calls[0][1].p_organization_id,'org');assert.deepEqual(state.after,[]);
 state.calls=[];state.context.supabase.rpc=async(name,args)=>{state.calls.push([name,args]);return {data:name==='admin_read_ai_results'?{kind:'course_draft'}:name==='admin_apply_ai_course'?{status:'saved',courseId:'course',lessonIds:['lesson']}:null,error:null};};
 const saved=await POST(request('apply'));assert.equal(saved.status,200);assert.deepEqual(state.calls.map(c=>c[0]),['admin_read_ai_results','admin_prepare_ai_course_apply','admin_apply_ai_course']);
 }finally{if(previous===undefined)delete process.env.AI_AUTHORING_PAGE_PILOT_ENABLED;else process.env.AI_AUTHORING_PAGE_PILOT_ENABLED=previous;}
});

test('image setup recovers its exact target in one read without dispatch or reservations',async()=>{
 setup();
 const r=await POST(new Request('http://localhost/api/admin/ai/authoring',{method:'POST',body:JSON.stringify({action:'imageSetup',target:'block',targetId:'block'})}));
 assert.equal(r.status,200);assert.deepEqual(state.calls.map(c=>c[0]),['admin_ai_image_setup']);assert.deepEqual(state.after,[]);
 const chooser=readFileSync('components/admin/ai/AiImageAuthoring.tsx','utf8');
 assert.doesNotMatch(chooser,/list\.items|for \(const item|localStorage/);
});
test('image application returns committed receipt even when cache invalidation fails',async()=>{
 setup();state.cacheError=true;
 state.context.supabase.rpc=async(name,args)=>{state.calls.push([name,args]);return {data:name==='admin_read_ai_results'?{kind:'image',courseId:'course',lessonId:'lesson'}:name==='admin_apply_ai_image'?{status:'saved',versionId:'version'}:null,error:null};};
 const r=await POST(request('apply'));assert.equal(r.status,200);assert.equal((await r.json()).status,'saved');
 assert.deepEqual(state.calls.map(c=>c[0]),['admin_read_ai_results','admin_prepare_ai_image_apply','admin_apply_ai_image']);
});

test('legacy workspace reads one authorized projection without dispatch or mutation',async()=>{
 setup();const response=await legacyGET(new Request('http://localhost/api/admin/ai/legacy-media?course=course'));
 assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 assert.deepEqual(state.calls.map(c=>c[0]),['admin_legacy_ai_media_workspace']);assert.equal(state.after.length,0);assert.equal(state.dispatch.length,0);
 const source=readFileSync('components/admin/ai/LegacyMediaReview.tsx','utf8');assert.doesNotMatch(source,/Promise\.all|createSupabaseAdminClient|localStorage/);
});
test('legacy continuation reuses the pending request during rollback; denied reads expose no data',async()=>{
 setup();const previous=process.env.AI_AUTHORING_PAGE_PILOT_ENABLED;delete process.env.AI_AUTHORING_PAGE_PILOT_ENABLED;
 try{const response=await legacyPOST(new Request('http://localhost/api/admin/ai/legacy-media',{method:'POST',body:JSON.stringify({action:'decide',courseId:'course',jobId:'accepted',decision:'continue'})}));
 assert.equal(response.status,200);assert.deepEqual(state.calls.map(c=>c[0]),['admin_decide_legacy_ai_job']);assert.equal(state.dispatch.length,0);
 setup(()=>({message:'denied'}));assert.equal((await legacyGET(new Request('http://localhost/api/admin/ai/legacy-media?course=other'))).status,403);
 }finally{if(previous!==undefined)process.env.AI_AUTHORING_PAGE_PILOT_ENABLED=previous;}
});
