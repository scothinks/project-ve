const localRiskSalt = "project-ve-local-risk-salt";
const localProofSecret = "project-ve-local-oauth-proof-secret";

export type SecurityEnv = {
  [key: string]: string | undefined;
  NODE_ENV?: string;
};

function isPresent(value: string | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}

export function isProductionEnv(env: SecurityEnv = process.env) {
  return env.NODE_ENV === "production";
}

export function getRequiredSecurityEnvStatus(env: SecurityEnv = process.env) {
  const missing: string[] = [];

  if (!isProductionEnv(env)) {
    return { isProduction: false, missing };
  }

  if (!isPresent(env.NEXT_PUBLIC_SUPABASE_URL)) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (
    !isPresent(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) &&
    !isPresent(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ) {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  for (const name of [
    "TURNSTILE_SECRET_KEY",
    "FRAUD_HASH_SALT",
    "OAUTH_SIGNUP_PROOF_SECRET",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    if (!isPresent(env[name])) {
      missing.push(name);
    }
  }

  return { isProduction: true, missing };
}

export function assertRequiredSecurityEnv(
  context: string,
  env: SecurityEnv = process.env,
) {
  const status = getRequiredSecurityEnvStatus(env);

  if (status.missing.length > 0) {
    throw new Error(
      `Security configuration missing for ${context}: ${status.missing.join(", ")}`,
    );
  }
}

export function getFraudHashSalt(env: SecurityEnv = process.env): string {
  const salt = env.FRAUD_HASH_SALT;

  if (isPresent(salt)) {
    return salt;
  }

  if (isProductionEnv(env)) {
    throw new Error("FRAUD_HASH_SALT is required in production.");
  }

  return localRiskSalt;
}

export function getTurnstileSecret(env: SecurityEnv = process.env): string | null {
  const secret = env.TURNSTILE_SECRET_KEY;

  if (isPresent(secret)) {
    return secret;
  }

  if (isProductionEnv(env)) {
    throw new Error("TURNSTILE_SECRET_KEY is required in production.");
  }

  return null;
}

export function getOAuthSignupProofSecret(env: SecurityEnv = process.env): string {
  const proofSecret = env.OAUTH_SIGNUP_PROOF_SECRET;

  if (isPresent(proofSecret)) {
    return proofSecret;
  }

  if (isProductionEnv(env)) {
    throw new Error("OAUTH_SIGNUP_PROOF_SECRET is required in production.");
  }

  return env.FRAUD_HASH_SALT || env.TURNSTILE_SECRET_KEY || localProofSecret;
}
