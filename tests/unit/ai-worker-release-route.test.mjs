import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const state={calls:[],clock:0,workMs:0};globalThis.__releaseRoute=state;
const stub=source=>({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(source)});
const hook=registerHooks({resolve(specifier,context,next){
 if(specifier==='next/server')return {shortCircuit:true,url:pathToFileURL(path.resolve('node_modules/next/server.js')).href};
 if(specifier==='@/lib/supabase-admin')return stub('export const createSupabaseAdminClient=()=>({rpc:async name=>{globalThis.__releaseRoute.calls.push(name);return {data:{recoveredImages:1,settledIncomplete:2,deferred:0},error:null};}});');
 if(specifier==='@/app/admin/courses/learning-cache')return stub('export const revalidateLearningPaths=()=>{};');
 if(specifier==='@/features/ai-generation/application/job-orchestration')return stub('export const processNextAiGenerationJob=async()=>{const s=globalThis.__releaseRoute;s.calls.push("claim/process");s.clock+=s.workMs;return {processed:true,status:"completed"};};');
 return next(specifier,context);
}});
const {NextRequest}=await import('next/server');
const {POST,maxDuration}=await import('../../app/api/admin/ai/jobs/process/route.ts');hook.deregister();
test('trusted worker recovers once, reports outcomes and does not claim work beyond runtime budget',async()=>{
 const oldSecret=process.env.AI_GENERATION_WORKER_SECRET,oldCron=process.env.CRON_SECRET,oldNow=Date.now;
 process.env.AI_GENERATION_WORKER_SECRET=crypto.randomUUID();delete process.env.CRON_SECRET;Date.now=()=>state.clock;
 try {
  state.calls=[];state.clock=0;state.workMs=25_000;
  const denied=await POST(new NextRequest('http://localhost/api/admin/ai/jobs/process?limit=3',{method:'POST'}));
  assert.equal(denied.status,401);assert.deepEqual(state.calls,[]);
  const response=await POST(new NextRequest('http://localhost/api/admin/ai/jobs/process?limit=3',{method:'POST',headers:{authorization:`Bearer ${process.env.AI_GENERATION_WORKER_SECRET}`}}));
  assert.equal(maxDuration,300);
  const body=await response.json();assert.equal(body.processedCount,1);assert.deepEqual(body.recovery,{recoveredImages:1,settledIncomplete:2,deferred:0});
  assert.deepEqual(state.calls,['service_recover_ai_authoring_jobs','claim/process']);
 }finally {
  Date.now=oldNow;
  if(oldSecret===undefined)delete process.env.AI_GENERATION_WORKER_SECRET;else process.env.AI_GENERATION_WORKER_SECRET=oldSecret;
  if(oldCron===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=oldCron;
 }
});
