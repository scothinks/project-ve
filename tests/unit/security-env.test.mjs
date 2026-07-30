import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRequiredSecurityEnv,
  getFraudHashSalt,
  getOAuthSignupProofSecret,
  getRequiredSecurityEnvStatus,
  getTurnstileSecret,
} from "../../lib/security-env.ts";

test("development keeps local security fallbacks available", () => {
  const env = { NODE_ENV: "development" };

  assert.equal(getFraudHashSalt(env), "project-ve-local-risk-salt");
  assert.equal(getTurnstileSecret(env), null);
  assert.equal(getOAuthSignupProofSecret(env), "project-ve-local-oauth-proof-secret");
  assert.deepEqual(getRequiredSecurityEnvStatus(env), {
    isProduction: false,
    missing: [],
  });
});

test("production reports missing security secrets and Supabase config", () => {
  const env = { NODE_ENV: "production" };

  assert.deepEqual(getRequiredSecurityEnvStatus(env), {
    isProduction: true,
    missing: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "TURNSTILE_SECRET_KEY",
      "FRAUD_HASH_SALT",
      "OAUTH_SIGNUP_PROOF_SECRET",
      "SUPABASE_SERVICE_ROLE_KEY",
    ],
  });
});

test("production accepts the legacy anon key as publishable Supabase config", () => {
  const env = {
    NODE_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    TURNSTILE_SECRET_KEY: "turnstile-secret",
    FRAUD_HASH_SALT: "fraud-salt",
    OAUTH_SIGNUP_PROOF_SECRET: "proof-secret",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  };

  assert.deepEqual(getRequiredSecurityEnvStatus(env), {
    isProduction: true,
    missing: [],
  });
});

test("production refuses local fallback secrets", () => {
  const env = { NODE_ENV: "production" };

  assert.throws(
    () => getFraudHashSalt(env),
    /FRAUD_HASH_SALT is required in production/,
  );
  assert.throws(
    () => getTurnstileSecret(env),
    /TURNSTILE_SECRET_KEY is required in production/,
  );
  assert.throws(
    () => getOAuthSignupProofSecret(env),
    /OAUTH_SIGNUP_PROOF_SECRET is required in production/,
  );
  assert.throws(
    () => assertRequiredSecurityEnv("test context", env),
    /Security configuration missing for test context/,
  );
});
