import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const dbUrl =
  process.env.LOCAL_SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

if (
  process.env.ALLOW_NONLOCAL_DB_ECONOMIC_TESTS !== "1" &&
  !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):54322\//.test(dbUrl)
) {
  throw new Error(
    "Refusing to run destructive local economic fixtures against a non-local database. Set ALLOW_NONLOCAL_DB_ECONOMIC_TESTS=1 to override.",
  );
}

const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const redemptionUserAId = randomUUID();
const redemptionUserBId = randomUUID();
const missionXpUserId = randomUUID();
const missionRewardUserId = randomUUID();
const directRewardId = `reward-ve-test-003-direct-${suffix}`;
const missionRewardId = `reward-ve-test-003-mission-${suffix}`;
const missionXpId = `mission-ve-test-003-xp-${suffix}`;
const missionRewardAwardId = `mission-ve-test-003-reward-${suffix}`;
const sleepFunctionName = `ve_test_003_sleep_${suffix}`;
const sleepTriggerName = `ve_test_003_sleep_${suffix}`;

function literal(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseLastLine(stdout) {
  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.at(-1) ?? "";
}

function failureText(reason) {
  if (reason instanceof Error) {
    return "stderr" in reason && typeof reason.stderr === "string" && reason.stderr
      ? reason.stderr
      : reason.message;
  }

  return String(reason);
}

async function psql(sql, options = {}) {
  const result = await execFileAsync(
    "psql",
    [dbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", sql],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      ...options,
    },
  );

  return parseLastLine(result.stdout);
}

function asAuthenticated(userId, sql) {
  return `
    set role authenticated;
    select set_config('request.jwt.claim.sub', ${literal(userId)}, false);
    ${sql}
  `;
}

async function cleanup() {
  await psql(`
    drop trigger if exists ${sleepTriggerName} on public.reward_quantity_allocations;
    drop function if exists public.${sleepFunctionName}();
    delete from public.mission_awards
    where mission_id in (${literal(missionXpId)}, ${literal(missionRewardAwardId)});
    delete from public.reward_redemptions
    where reward_id in (${literal(directRewardId)}, ${literal(missionRewardId)});
    delete from public.xp_transactions
    where user_id in (
      ${literal(redemptionUserAId)}::uuid,
      ${literal(redemptionUserBId)}::uuid,
      ${literal(missionXpUserId)}::uuid,
      ${literal(missionRewardUserId)}::uuid
    );
    delete from public.reward_quantity_allocations
    where reward_id in (${literal(directRewardId)}, ${literal(missionRewardId)});
    delete from public.missions
    where id in (${literal(missionXpId)}, ${literal(missionRewardAwardId)});
    delete from public.rewards
    where id in (${literal(directRewardId)}, ${literal(missionRewardId)});
    delete from auth.users
    where id in (
      ${literal(redemptionUserAId)}::uuid,
      ${literal(redemptionUserBId)}::uuid,
      ${literal(missionXpUserId)}::uuid,
      ${literal(missionRewardUserId)}::uuid
    );
  `);
}

async function setupFixture() {
  await cleanup();

  await psql(`
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values
      (
        '00000000-0000-0000-0000-000000000000',
        ${literal(redemptionUserAId)}::uuid,
        'authenticated',
        'authenticated',
        ${literal(`ve-test-003-redemption-a-${suffix}@example.com`)},
        '',
        now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{}'::jsonb,
        now(),
        now()
      ),
      (
        '00000000-0000-0000-0000-000000000000',
        ${literal(redemptionUserBId)}::uuid,
        'authenticated',
        'authenticated',
        ${literal(`ve-test-003-redemption-b-${suffix}@example.com`)},
        '',
        now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{}'::jsonb,
        now(),
        now()
      ),
      (
        '00000000-0000-0000-0000-000000000000',
        ${literal(missionXpUserId)}::uuid,
        'authenticated',
        'authenticated',
        ${literal(`ve-test-003-mission-xp-${suffix}@example.com`)},
        '',
        now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{}'::jsonb,
        now(),
        now()
      ),
      (
        '00000000-0000-0000-0000-000000000000',
        ${literal(missionRewardUserId)}::uuid,
        'authenticated',
        'authenticated',
        ${literal(`ve-test-003-mission-reward-${suffix}@example.com`)},
        '',
        now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{}'::jsonb,
        now(),
        now()
      );

    insert into public.profiles (
      id,
      display_name,
      role,
      xp,
      xp_balance_cached,
      redemption_unlocked_at
    )
    values
      (${literal(redemptionUserAId)}::uuid, 'VE-TEST-003 redemption A', 'learner', 0, 0, now()),
      (${literal(redemptionUserBId)}::uuid, 'VE-TEST-003 redemption B', 'learner', 0, 0, now()),
      (${literal(missionXpUserId)}::uuid, 'VE-TEST-003 mission XP', 'learner', 0, 0, now()),
      (${literal(missionRewardUserId)}::uuid, 'VE-TEST-003 mission reward', 'learner', 0, 0, now())
    on conflict (id) do update
      set display_name = excluded.display_name,
          role = excluded.role,
          xp = excluded.xp,
          xp_balance_cached = excluded.xp_balance_cached,
          redemption_unlocked_at = excluded.redemption_unlocked_at,
          updated_at = now();

    insert into public.xp_transactions (
      user_id,
      amount,
      direction,
      source_type,
      source_id,
      award_scope,
      metadata
    )
    values
      (
        ${literal(redemptionUserAId)}::uuid,
        10,
        'earn',
        'adjustment',
        've-test-003-fixture',
        ${literal(`ve-test-003:${suffix}:redemption-a`)},
        '{"fixture": "VE-TEST-003"}'::jsonb
      ),
      (
        ${literal(redemptionUserBId)}::uuid,
        10,
        'earn',
        'adjustment',
        've-test-003-fixture',
        ${literal(`ve-test-003:${suffix}:redemption-b`)},
        '{"fixture": "VE-TEST-003"}'::jsonb
      );

    update public.profiles
    set xp = 10,
        xp_balance_cached = 10,
        updated_at = now()
    where id in (${literal(redemptionUserAId)}::uuid, ${literal(redemptionUserBId)}::uuid);

    insert into public.rewards (
      id,
      title,
      description,
      cost_xp,
      inventory_count,
      status,
      thumbnail,
      offer_expires_at,
      terms,
      claim_steps,
      fulfillment_type,
      fulfillment_config,
      per_user_limit,
      sort_order,
      is_enabled,
      total_uploaded,
      total_available,
      visibility_mode,
      distribution_mode,
      limit_period,
      redemption_window_days
    )
    values
      (
        ${literal(directRewardId)},
        'VE-TEST-003 direct reward',
        'Local economic integrity fixture.',
        5,
        1,
        'published',
        '{}'::jsonb,
        null,
        'Local test only.',
        '[]'::jsonb,
        'manual',
        '{}'::jsonb,
        1,
        -10000,
        true,
        1,
        1,
        'store',
        'direct',
        'none',
        null
      ),
      (
        ${literal(missionRewardId)},
        'VE-TEST-003 mission reward',
        'Local mission reward integrity fixture.',
        1,
        1,
        'published',
        '{}'::jsonb,
        null,
        'Local test only.',
        '[]'::jsonb,
        'manual',
        '{}'::jsonb,
        1,
        -9999,
        true,
        1,
        1,
        'store',
        'direct',
        'none',
        null
      );

    insert into public.reward_quantity_allocations (
      reward_id,
      quantity_total,
      quantity_available,
      available_from,
      expires_at,
      reason
    )
    values
      (${literal(directRewardId)}, 1, 1, null, null, 'VE-TEST-003 direct inventory'),
      (${literal(missionRewardId)}, 1, 1, null, null, 'VE-TEST-003 mission inventory');

    insert into public.missions (
      id,
      title,
      description,
      category,
      reward_xp,
      repeatability,
      validation_type,
      validation_config,
      status,
      reward_type,
      reward_id
    )
    values
      (
        ${literal(missionXpId)},
        'VE-TEST-003 XP mission',
        'Local duplicate XP mission award fixture.',
        'custom',
        15,
        'once',
        'manual_review',
        '{}'::jsonb,
        'published',
        'xp',
        null
      ),
      (
        ${literal(missionRewardAwardId)},
        'VE-TEST-003 reward mission',
        'Local duplicate reward mission award fixture.',
        'custom',
        null,
        'once',
        'manual_review',
        '{}'::jsonb,
        'published',
        'reward',
        ${literal(missionRewardId)}
      );

    create function public.${sleepFunctionName}()
    returns trigger
    language plpgsql
    as $$
    begin
      if new.reward_id = ${literal(directRewardId)} then
        perform pg_sleep(0.35);
      end if;

      return new;
    end;
    $$;

    create trigger ${sleepTriggerName}
    before update of quantity_available on public.reward_quantity_allocations
    for each row execute function public.${sleepFunctionName}();
  `);
}

async function redeemReward(userId, rewardId) {
  return psql(
    `
      set statement_timeout = '12s';
      ${asAuthenticated(
        userId,
        `select public.redeem_reward(${literal(rewardId)}) ->> 'rewardId';`,
      )}
    `,
    { timeout: 15_000 },
  );
}

async function grantMissionAwardStatus(userId, missionId, awardScope) {
  return psql(
    `
      set statement_timeout = '12s';
      select public.grant_mission_award(
        ${literal(userId)}::uuid,
        ${literal(missionId)},
        ${literal(awardScope)},
        '{"fixture": "VE-TEST-003"}'::jsonb
      ) ->> 'status';
    `,
    { timeout: 15_000 },
  );
}

async function ledgerBalance(userId) {
  const balance = await psql(`
    select coalesce(
      sum(case when direction = 'earn' then amount else -amount end),
      0
    )::integer
    from public.xp_transactions
    where user_id = ${literal(userId)}::uuid;
  `);

  return Number(balance);
}

async function profileBalance(userId) {
  const balance = await psql(`
    select xp_balance_cached
    from public.profiles
    where id = ${literal(userId)}::uuid;
  `);

  return Number(balance);
}

async function countRows(sql) {
  return Number(await psql(sql));
}

async function assertLedgerMatchesProfile(userId, context) {
  assert.equal(await profileBalance(userId), await ledgerBalance(userId), context);
}

try {
  await setupFixture();

  const redemptionResults = await Promise.allSettled([
    redeemReward(redemptionUserAId, directRewardId),
    redeemReward(redemptionUserBId, directRewardId),
  ]);
  const fulfilledRedemptions = redemptionResults.filter((result) => result.status === "fulfilled");
  const rejectedRedemptions = redemptionResults.filter((result) => result.status === "rejected");

  assert.equal(fulfilledRedemptions.length, 1, "exactly one concurrent reward redemption should succeed.");
  assert.equal(rejectedRedemptions.length, 1, "exactly one concurrent reward redemption should be rejected.");
  assert.match(
    failureText(rejectedRedemptions[0].reason),
    /This reward is currently sold out\./,
    "the rejected concurrent reward redemption should fail on inventory exhaustion.",
  );
  assert.equal(
    await countRows(
      `select count(*) from public.reward_redemptions where reward_id = ${literal(directRewardId)};`,
    ),
    1,
    "concurrent reward redemption must create only one redemption.",
  );
  assert.equal(
    await countRows(
      `select quantity_available from public.reward_quantity_allocations where reward_id = ${literal(directRewardId)};`,
    ),
    0,
    "concurrent reward redemption must not leave phantom inventory.",
  );
  await assertLedgerMatchesProfile(redemptionUserAId, "redemption user A cache must match ledger.");
  await assertLedgerMatchesProfile(redemptionUserBId, "redemption user B cache must match ledger.");

  const xpMissionStatuses = await Promise.all([
    grantMissionAwardStatus(missionXpUserId, missionXpId, "lifetime"),
    grantMissionAwardStatus(missionXpUserId, missionXpId, "lifetime"),
  ]);

  assert.deepEqual(
    xpMissionStatuses.sort(),
    ["already_awarded", "awarded"],
    "duplicate XP mission awards should collapse to one award.",
  );
  assert.equal(
    await countRows(
      `select count(*) from public.mission_awards where user_id = ${literal(missionXpUserId)}::uuid and mission_id = ${literal(missionXpId)};`,
    ),
    1,
    "duplicate XP mission awards must create one mission_awards row.",
  );
  assert.equal(await ledgerBalance(missionXpUserId), 15, "duplicate XP mission awards must credit XP once.");
  await assertLedgerMatchesProfile(missionXpUserId, "XP mission cache must match ledger.");

  const rewardMissionStatuses = await Promise.all([
    grantMissionAwardStatus(missionRewardUserId, missionRewardAwardId, "lifetime"),
    grantMissionAwardStatus(missionRewardUserId, missionRewardAwardId, "lifetime"),
  ]);

  assert.deepEqual(
    rewardMissionStatuses.sort(),
    ["already_awarded", "awarded"],
    "duplicate reward mission awards should collapse to one award.",
  );
  assert.equal(
    await countRows(
      `select count(*) from public.mission_awards where user_id = ${literal(missionRewardUserId)}::uuid and mission_id = ${literal(missionRewardAwardId)};`,
    ),
    1,
    "duplicate reward mission awards must create one mission_awards row.",
  );
  assert.equal(
    await countRows(
      `select count(*) from public.reward_redemptions where user_id = ${literal(missionRewardUserId)}::uuid and reward_id = ${literal(missionRewardId)};`,
    ),
    1,
    "duplicate reward mission awards must create one reward redemption.",
  );
  assert.equal(
    await countRows(
      `select quantity_available from public.reward_quantity_allocations where reward_id = ${literal(missionRewardId)};`,
    ),
    0,
    "duplicate reward mission awards must allocate inventory once.",
  );
  await assertLedgerMatchesProfile(missionRewardUserId, "reward mission cache must match ledger.");

  console.log("economic integrity regression passed");
} finally {
  await cleanup();
}
