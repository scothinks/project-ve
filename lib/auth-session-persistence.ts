import type { CookieOptions } from "@supabase/ssr";
export const sessionPersistenceCookie = "ve-session-persistence";
/** Session-only cookies must stay session-only when middleware refreshes them. */
export function authCookieOptions(options: CookieOptions, value: string, preference?: string) {
  if (!value || preference !== "session") return options;
  return { ...options, maxAge: undefined, expires: undefined };
}
