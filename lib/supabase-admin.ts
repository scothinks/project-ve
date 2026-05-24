import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/supabase";

export function getSupabaseAdminConfig() {
  return {
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

export function createSupabaseAdminClient(): SupabaseClient {
  const config = getSupabaseAdminConfig();
  const url = supabaseUrl;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!config.hasSupabaseUrl || !url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing. Add it to the server environment before generating media.");
  }

  if (!config.hasServiceRoleKey || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Add it to the server environment before generating media assets.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
