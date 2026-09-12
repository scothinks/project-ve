import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { newReceipt,encodeReceipt,decodeReceipt,receiptLifetime } from '../../features/entry/receipt.ts';
import { getSafeAuthNextPath,shouldRouteAuthNextToPublicAssessment } from '../../lib/auth-redirect.ts';
const key=randomBytes(32).toString('hex');
test('welcome receipts reject tampering, foreign signatures, malformed lists and expiry',()=>{
 const r=newReceipt();r.learned=['listen'];r.completed=['listen'];const token=encodeReceipt(r,key);
 assert.deepEqual(decodeReceipt(token,key),r);
 assert.equal(decodeReceipt(token,randomBytes(32).toString('hex')),null);
 assert.equal(decodeReceipt(token+'x',key),null);assert.equal(decodeReceipt(token+'.extra',key),null);
 assert.equal(decodeReceipt(token,key,Date.now()+receiptLifetime*1000+1000),null);
 for(const completed of [['fake'],['listen','listen'],['think']]) assert.equal(decodeReceipt(encodeReceipt({...r,completed},key),key),null);
});
test('welcome XP cannot be awarded from rendering, client totals or an unverified identity',()=>{
 const route=readFileSync('app/api/welcome/progress/route.ts','utf8');
 assert.doesNotMatch(route,/export (?:async )?function GET/);
 assert.match(route,/request.headers.get\("origin"\)/);assert.match(route,/decodeReceipt/);
 assert.match(route,/getCurrentUserProfile\(\)/);assert.match(route,/p_user_id: user.id/);
 assert.doesNotMatch(route,/p_amount|body\.xp|data\.xp|increment_profile_xp/);
 for(const page of ['app/page.tsx','app/login/page.tsx','app/welcome/save/page.tsx'])assert.doesNotMatch(readFileSync(page,'utf8'),/\.rpc\(|action:.*claim|setCookie/);
});
test('auth handoffs reject scheme-relative, encoded and backslash redirects and preserve recovery',()=>{
 for(const next of ['//evil.example','/\\evil.example','/%5Cevil.example','/%2fexample.test','/\n/example.test']) assert.equal(getSafeAuthNextPath(next),'/dashboard');
 assert.equal(getSafeAuthNextPath('/o/team/learn?course=abc'),'/o/team/learn?course=abc');
 assert.equal(shouldRouteAuthNextToPublicAssessment('/login?reset=1&next=%2Forg%2Fcreate'),false);
 assert.equal(shouldRouteAuthNextToPublicAssessment('/welcome/save?next=%2Fxp-store'),false);
});

import { isSameOrigin } from '../../features/entry/request-origin.ts';
test('welcome origin uses the public host while rejecting foreign or malformed origins', () => {
 assert.equal(isSameOrigin('http://127.0.0.1:3100', '127.0.0.1:3100', 'http:'), true);
 assert.equal(isSameOrigin('https://project-ve.example', 'project-ve.example', 'https:'), true);
 for (const origin of [null, 'null', 'https://evil.example', 'https://project-ve.example/path', 'http://project-ve.example'])
  assert.equal(isSameOrigin(origin, 'project-ve.example', 'https:'), false);
});

import { authCookieOptions } from '../../lib/auth-session-persistence.ts';
test('session-only auth cookies remain nonpersistent on browser/server refresh without changing deletion', () => {
 const options = {path:'/', maxAge:1000, expires:new Date(2000000000000), sameSite:'lax'};
 assert.equal(authCookieOptions(options, 'value', 'session').maxAge, undefined);
 assert.equal(authCookieOptions(options, 'value', 'session').expires, undefined);
 assert.equal(authCookieOptions(options, '', 'session'), options);
 assert.equal(authCookieOptions(options, 'value', 'persistent'), options);
});
