import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { logAppError, toDependencyUnavailableError } from "@/lib/app-errors";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase";
import type { Database } from "@/types/database";

export async function createSupabaseServerClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
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

function isAuthSessionMissingError(error: unknown) {
  return error instanceof Error && error.name === "AuthSessionMissingError";
}

export async function hasSupabaseAuthCookies() {
  const cookieStore = await cookies();

  return cookieStore
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));
}

export async function getCurrentUserProfile(
  existingSupabase?: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const supabase = existingSupabase ?? await createSupabaseServerClient();

  if (!supabase) {
    return { user: null, profile: null };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError && !isAuthSessionMissingError(userError)) {
    const appError = toDependencyUnavailableError(userError, "Authentication state is temporarily unavailable.");
    logAppError(appError, {
      operation: "auth.current_user.load",
    });
    throw appError;
  }

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, referral_code, xp_balance_cached, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    const appError = toDependencyUnavailableError(profileError, "Profile is temporarily unavailable.");
    logAppError(appError, {
      operation: "profile.current_user.load",
      userId: user.id,
    });
    throw appError;
  }

  return { user, profile: profile as UserProfile | null };
}
