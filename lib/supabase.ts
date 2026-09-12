import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { authCookieOptions, sessionPersistenceCookie } from "@/lib/auth-session-persistence";
import type { Database } from "@/types/database";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export type AppSupabaseClient = SupabaseClient<Database>;

export function createSupabaseBrowserClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    return null;
  }

  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => typeof document === "undefined" ? [] : parseCookieHeader(document.cookie).map(({name, value}) => ({name, value: value ?? ""})),
      setAll(cookiesToSet) {
        const preference = parseCookieHeader(document.cookie).find(cookie => cookie.name === sessionPersistenceCookie)?.value;
        cookiesToSet.forEach(({name, value, options}) => {
          document.cookie = serializeCookieHeader(name, value, authCookieOptions(options, value, preference));
        });
      },
    },
  });
}

export function createPlainSupabaseClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    return null;
  }

  return createClient<Database>(supabaseUrl, supabasePublishableKey);
}
