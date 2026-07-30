# Auth Security Configuration

Production auth must fail closed when anti-abuse secrets are missing.

Required production environment:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
TURNSTILE_SECRET_KEY
FRAUD_HASH_SALT
OAUTH_SIGNUP_PROOF_SECRET
SUPABASE_SERVICE_ROLE_KEY
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` remains accepted as a legacy substitute for
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Development can use local fallback values for fraud hashing and OAuth proof
signing. Production cannot.

## Supabase CAPTCHA

Supabase Auth CAPTCHA must be enabled in the linked Supabase project dashboard
for direct Auth API signup protection. The app verifies Turnstile before calling
Auth and also passes the CAPTCHA token to `auth.signUp`, so dashboard-level
CAPTCHA enforcement remains the final boundary for direct Auth API calls that
bypass the app route.

Do not treat `auth.users.raw_user_meta_data` as a proof source. User metadata is
client-settable and is only safe for profile display fields such as name/avatar,
not risk or authorization decisions.
