import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase";

export async function createSupabaseServerClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. Middleware refreshes sessions.
        }
      },
    },
  });
}

export type UserProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  referral_code: string | null;
  xp_balance_cached: number;
  role: "learner" | "admin";
};

export async function getCurrentUserProfile() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { user: null, profile: null };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, referral_code, xp_balance_cached, role")
    .eq("id", user.id)
    .maybeSingle<UserProfile>();

  return { user, profile };
}
