import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import { NextRequest } from 'next/server.js';
import { newReceipt, encodeReceipt, decodeReceipt, receiptCookie } from '../../features/entry/receipt.ts';
import { progressRevision, progressPendingCookie, progressAckCookie } from '../../features/entry/progress-sync.ts';
const state = {key:randomBytes(32).toString('hex')};
globalThis.__welcomeRouteTest = state;
const stub = source => ({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(source)});
const hooks = registerHooks({resolve(specifier,context,next) {
 if (specifier === 'next/headers') return stub('export const cookies=async()=>({get:name=>globalThis.__welcomeRouteTest.cookieJar?.[name]});');
 if (specifier === 'server-only') return stub('export {};');
 if (specifier === 'next/server') return {shortCircuit:true,url:pathToFileURL(path.resolve('node_modules/next/server.js')).href};
 if (specifier === '@/lib/app-mode') return stub('export const isDemoMode=false;');
 if (specifier === '@/lib/app-errors') return stub('export const logAppError=()=>{};');
 if (specifier === '@/lib/security-env') return stub('export const getOAuthSignupProofSecret=()=>{if(globalThis.__welcomeRouteTest.noKey)throw Error("Missing signing config");return globalThis.__welcomeRouteTest.key;};');
 if (specifier === '@/lib/supabase-server') return stub('export const getCurrentUserProfile=async()=>({user:globalThis.__welcomeRouteTest.user});export const getCurrentUserContext=getCurrentUserProfile;');
 if (specifier === '@/lib/supabase-admin') return stub('export const createSupabaseAdminClient=()=>({rpc:async(name,args)=>{globalThis.__welcomeRouteTest.calls.push({name,args});return globalThis.__welcomeRouteTest.result;}});');
 if (specifier.startsWith('@/')) {const p=path.resolve(specifier.slice(2));const f=['','.ts'].map(e=>p+e).find(existsSync);if(f)return {shortCircuit:true,url:pathToFileURL(f).href};}
 if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {const url=new URL(specifier+".ts",context.parentURL);if(existsSync(url))return {shortCircuit:true,url:url.href};}
 return next(specifier,context);
}});
const {POST} = await import('../../app/api/welcome/progress/route.ts');
const {readWelcomeReceipt} = await import('../../features/entry/progress-server.ts');
hooks.deregister();
function setup() {
 state.user={id:randomUUID()};state.calls=[];state.noKey=false;
 state.result={data:{savedXp:10,awardedXp:10},error:null};
 const receipt={...newReceipt(),learned:['listen'],completed:['listen']};
 return receipt;
}
function request(receipt, extra = {}, origin = 'http://localhost') {
 return new NextRequest('http://localhost/api/welcome/progress', {method:'POST',headers:{origin,host:'localhost',cookie:`${receiptCookie}=${encodeReceipt(receipt,state.key)}; ${progressPendingCookie}=${progressRevision(receipt)}`,'content-type':'application/json'},body:JSON.stringify({action:'claim',xp:999999,userId:randomUUID(),...extra})});
}
test('claim uses verified session and signed topics, acknowledges its snapshot without erasing a newer receipt', async () => {
 const receipt=setup();const response=await POST(request(receipt));
 assert.equal(response.status,200);
 assert.deepEqual(state.calls,[{name:'service_claim_welcome_progress',args:{p_user_id:state.user.id,p_receipt_id:receipt.id,p_topics:['listen']}}]);
 assert.equal(response.cookies.get(progressAckCookie).value,progressRevision(receipt));
 assert.equal(response.cookies.get(receiptCookie),undefined);
 assert.equal(response.cookies.get(progressPendingCookie),undefined);
 assert.deepEqual((await response.json()).completed,['listen']);
 const next={...receipt,completed:['listen','think']};
 assert.notEqual(response.cookies.get(progressAckCookie).value,progressRevision(next));
});
test('unavailable dependencies retain pending receipt for retry and do not pretend XP was saved', async () => {
 const receipt=setup();state.result={data:null,error:{code:'PGRST202',message:'Missing function'}};
 const failed=await POST(request(receipt));assert.equal(failed.status,503);assert.equal(failed.cookies.getAll().length,0);
 state.result={data:{savedXp:10,awardedXp:0},error:null};
 const retry=await POST(request(receipt));assert.equal(retry.status,200);assert.equal((await retry.json()).awardedXp,0);
});
test('guest, foreign-origin and invalid signed receipts cannot award through readable hints', async () => {
 const receipt=setup();state.user=null;
 assert.equal((await POST(request(receipt))).status,401);assert.equal(state.calls.length,0);
 setup();assert.equal((await POST(request(receipt,{},'https://unrelated.example'))).status,403);assert.equal(state.calls.length,0);
 const forged=request(receipt);forged.cookies.set(receiptCookie,'invalid');
 const response=await POST(forged);assert.equal(response.status,200);assert.equal((await response.json()).savedXp,0);assert.equal(state.calls.length,0);
});
test('unconfirmed identity remains retryable; an already-owned receipt is retired without transfer', async () => {
 const receipt=setup();state.result={data:null,error:{code:'42501',message:'Confirmed account required.'}};
 const unconfirmed=await POST(request(receipt));assert.equal(unconfirmed.status,403);assert.equal(unconfirmed.cookies.getAll().length,0);
 state.result.error.message='Receipt already claimed.';
 const owned=await POST(request(receipt));assert.equal(owned.status,403);assert.equal(owned.cookies.get(progressAckCookie).value,progressRevision(receipt));assert.equal(owned.cookies.get(receiptCookie),undefined);
});

test('a background acknowledgement preserves the open lesson when answering again', async () => {
 const receipt=setup();state.user=null;
 const req=request(receipt,{action:'answer',topic:'listen',answer:1});
 req.cookies.set(progressAckCookie,progressRevision(receipt));
 const response=await POST(req);assert.equal(response.status,200);
 const next=decodeReceipt(response.cookies.get(receiptCookie).value,state.key);
 assert.notEqual(next.id,receipt.id);assert.deepEqual(next.learned,['listen']);
 assert.equal((await response.json()).correct,true);
});

test('optional XP context fails soft for auth and hides acknowledged receipts', async () => {
 const receipt=setup();state.cookieJar={[receiptCookie]:{value:encodeReceipt(receipt,state.key)}};
 assert.deepEqual(await readWelcomeReceipt(),receipt);
 state.noKey=true;assert.equal(await readWelcomeReceipt(),null);
 state.noKey=false;state.cookieJar[progressAckCookie]={value:progressRevision(receipt)};
 assert.equal(await readWelcomeReceipt(),null);
});
