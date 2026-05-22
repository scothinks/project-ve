import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export function createSupabaseBrowserClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    return null;
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

export function createPlainSupabaseClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    return null;
  }

  return createClient(supabaseUrl, supabasePublishableKey);
}
