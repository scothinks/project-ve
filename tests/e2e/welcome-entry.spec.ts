import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

test('sample XP retries in the background without interrupting signup, assessment or existing users', async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if(!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw new Error('Welcome fixtures require local Supabase.');
  const service=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
  const email=`welcome-${randomUUID()}@example.test`;const password=randomUUID()+randomUUID();
  const context=await browser.newContext({baseURL,viewport:{width:390,height:844},reducedMotion:'reduce'});const page=await context.newPage();let userId:string|undefined;
  try {
    const html=await page.request.get('/');expect(await html.text()).toContain('Live what');
    await page.addInitScript(()=>localStorage.setItem('ve_welcome_seen_v1','1'));
    await page.goto('/');await expect(page.getByRole('heading',{name:'Live what you learn.'})).toBeVisible();
    await page.locator('[data-topic=think]').click();await expect(page.locator('#lesson-heading')).toBeFocused();
    await page.locator('#start-quiz').click();await expect(page.locator('#question-heading')).toBeFocused();
    await page.locator('[data-answer="0"]').click();await expect(page.locator('.xp-result')).toHaveCount(0);
    await page.locator('[data-answer="1"]').click();await expect(page.locator('#xp-heading')).toBeFocused();await expect(page.locator('#xp-award')).toHaveText('+10 XP earned');
    const receipt=(await context.cookies()).find(c=>c.name==='ve-welcome-progress')!;expect(receipt.httpOnly).toBe(true);
    const unauthenticated=await page.request.post('/api/welcome/progress',{headers:{Origin:baseURL!},data:{action:'claim',xp:100000}});expect(unauthenticated.status()).toBe(401);
    await page.locator('#save-xp').click();await expect(page.locator('#auth-title')).toHaveText('Keep what you’ve started');
    await page.getByLabel('Full name',{exact:true}).fill('Welcome learner');await page.getByLabel('Email address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('checkbox').check();
    let allowClaim = false;
    let backgroundAttempts = 0;
    await page.route('**/api/welcome/progress', async route => {
      if (route.request().postDataJSON()?.action === 'claim') {
        backgroundAttempts++;
        if (!allowClaim) return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporarily unavailable'})});
      }
      await route.continue();
    });
    await page.getByRole('button',{name:'Create account & save progress',exact:true}).click();
    await expect(page).toHaveURL(/\/onboarding\/assessment$/);
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect.poll(() => backgroundAttempts).toBeGreaterThan(0);
    await expect(page.getByText('Saving your progress…')).toHaveCount(0);
    await expect(page.getByText('Temporarily unavailable')).toHaveCount(0);
    const users=await service.auth.admin.listUsers({page:1,perPage:1000});userId=users.data.users.find(u=>u.email===email)?.id;expect(userId).toBeTruthy();
    const before=await service.from('profiles').select('xp_balance_cached').eq('id',userId!).single();expect(before.data?.xp_balance_cached).toBe(0);
    const headingBefore = await page.getByRole('heading').first().textContent();
    allowClaim = true;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(async () => (await service.from('profiles').select('xp_balance_cached').eq('id',userId!).single()).data?.xp_balance_cached).toBe(10);
    await expect(page).toHaveURL(/\/onboarding\/assessment$/);
    await expect(page.getByRole('heading').first()).toHaveText(headingBefore!);
    await expect.poll(async () => (await service.from('user_notifications').select('id').eq('user_id',userId!).eq('event_type','welcome_xp_earned')).data?.length).toBe(1);
    await context.addCookies([receipt]);
    const replay=await page.evaluate(async()=>{const response=await fetch('/api/welcome/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'claim'})});return {ok:response.ok,data:await response.json()};});expect(replay.ok).toBe(true);expect(replay.data.savedXp).toBe(10);
    const ledger=await service.from('xp_transactions').select('amount').eq('user_id',userId!).eq('award_scope','welcome:think');expect(ledger.data).toEqual([{amount:10}]);
    await page.goto('/xp-store');await expect(page).toHaveURL(/\/xp-store$/);
    await page.goto('/');await expect(page.getByRole('heading',{name:'Live what you learn.'})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Live what you learn.'})).toBeVisible();
    await page.locator('[data-topic=think]').click();
    await page.locator('#start-quiz').click();
    await page.locator('[data-answer="1"]').click();
    await expect(page.locator('#xp-award')).toHaveText('XP already earned');
    await expect(page.locator('#save-xp')).toHaveText(/Explore rewards/);
    // Already signed-in users receive the next sample without a save click.
    await page.locator('[data-topic=listen]').click();
    await page.locator('#start-quiz').click();
    await page.locator('[data-answer="1"]').click();
    await expect.poll(async () => (await service.from('profiles').select('xp_balance_cached').eq('id',userId!).single()).data?.xp_balance_cached).toBe(20);
    await expect(page).toHaveURL('/');
    await expect(page.locator('#xp-heading')).toBeFocused();
    await expect(page.locator('#save-xp')).toHaveText(/Explore rewards/);
    // Existing account sign-in also carries guest progress into normal assessment.
    await context.clearCookies();
    await page.goto('/');
    await page.locator('[data-topic=act]').click();
    await page.locator('#start-quiz').click();
    await page.locator('[data-answer="1"]').click();
    await page.locator('#save-xp').click();
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page.locator('.auth-form-wrap')).toHaveAttribute('aria-busy','false');
    await page.getByLabel('Email address',{exact:true}).fill(email);
    await page.getByLabel('Password',{exact:true}).fill(password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/onboarding\/assessment$/);
    await expect.poll(async () => (await service.from('profiles').select('xp_balance_cached').eq('id',userId!).single()).data?.xp_balance_cached).toBe(30);
    await expect.poll(async () => (await service.from('user_notifications').select('id').eq('user_id',userId!).eq('event_type','welcome_xp_earned')).data?.length).toBe(3);
    await page.goto('/welcome/save?next=%2Fxp-store');
    await expect(page).toHaveURL(/\/onboarding\/assessment$/);
    const csrf=await page.request.post('/api/welcome/progress',{headers:{Origin:'https://unrelated.example'},data:{action:'learn',topic:'listen'}});expect(csrf.status()).toBe(403);
  } finally {if(!userId){const users=await service.auth.admin.listUsers({page:1,perPage:1000});userId=users.data.users.find(u=>u.email===email)?.id;}await context.close();if(userId)await service.auth.admin.deleteUser(userId);}
});

for(const width of [1440,390,320])test(`account switch, recovery and organisation destination at ${width}px`,async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,viewport:{width,height:900}});const page=await context.newPage();
  try{await page.goto('/login?next=%2Forg%2Fcreate');await page.getByLabel('Email address',{exact:true}).fill('learner@example.test');
    await page.getByRole('button',{name:'Create an account',exact:true}).click();await expect(page.locator('.auth-form-wrap')).toHaveAttribute('aria-busy','false');await expect(page.locator('#auth-title')).toHaveText('First, create your account');await expect(page.getByLabel('Email address',{exact:true})).toHaveValue('learner@example.test');
    const panel=await page.locator('.auth-form-panel').boundingBox();const invitation=await page.locator('.auth-invitation:not([inert])').boundingBox();expect(panel&&invitation).toBeTruthy();if(width>870)expect(panel!.x+panel!.width).toBeLessThanOrEqual(invitation!.x+1);else expect(panel!.y+panel!.height).toBeLessThanOrEqual(invitation!.y+1);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('.auth-form-wrap')).toHaveAttribute('aria-busy','false');await expect(page.locator('#auth-title')).toBeFocused();
    await page.getByRole('button',{name:'Forgot password?',exact:true}).click();await expect(page.locator('#auth-title')).toHaveText('Reset your password');expect(new URL(page.url()).searchParams.get('next')).toBe('/org/create');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/login?mode=signup&next=%2Forg%2Fcreate');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#auth-title')).toHaveText('Welcome back');
  }finally{await context.close();}
});

test('session-only login and password recovery retain the organisation destination', async ({ browser, baseURL }) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Local fixtures only.');
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {auth: {persistSession: false}});
  const email = `entry-recovery-${randomUUID()}@example.test`;
  const password = randomUUID() + randomUUID();
  const newPassword = randomUUID() + randomUUID();
  const created = await service.auth.admin.createUser({email, password, email_confirm: true});
  expect(created.error).toBeNull();
  const context = await browser.newContext({baseURL, reducedMotion: 'reduce'});
  try {
    const page = await context.newPage();
    await page.goto('/login?next=%2Forg%2Fcreate');
    await page.getByLabel('Email address', {exact: true}).fill(email);
    await page.getByLabel('Password', {exact: true}).fill(password);
    await page.getByRole('checkbox').uncheck();
    await page.getByRole('button', {name: 'Sign in', exact: true}).click();
    await expect(page).toHaveURL(/\/org\/create$/);
    await page.reload();
    const authCookies = (await context.cookies()).filter(cookie => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'));
    expect(authCookies.length).toBeGreaterThan(0);
    expect(authCookies.every(cookie => cookie.expires === -1)).toBe(true);
    await page.goto('/login?next=%2Forg%2Fcreate');
    await page.getByRole('button', {name: 'Forgot password?', exact: true}).click();
    await page.getByLabel('Email address', {exact: true}).fill(email);
    await page.getByRole('button', {name: 'Send reset link', exact: true}).click();
    await expect(page.locator('#auth-title')).toHaveText('Check your inbox');
    // Exercise the recovery form with a real authenticated session; external email
    // delivery and provider allowlists remain environment qualification checks.
    await page.goto('/login?reset=1&next=%2Forg%2Fcreate');
    await page.getByLabel('New password', {exact: true}).fill(newPassword);
    await page.getByRole('button', {name: 'Save new password', exact: true}).click();
    await expect(page.getByRole('status')).toContainText('Password updated');
    expect(new URL(page.url()).searchParams.get('next')).toBe('/org/create');
    await page.getByRole('button', {name: 'Forgot password?', exact: true}).click();
    await expect(page.locator('#auth-title')).toHaveText('Reset your password');
    const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {auth: {persistSession: false}});
    const signedIn = await client.auth.signInWithPassword({email, password: newPassword});
    expect(signedIn.error).toBeNull();
    await client.auth.signOut();
  } finally {
    await context.close();
    if (created.data.user) await service.auth.admin.deleteUser(created.data.user.id);
  }
});
