export const defaultAuthNextPath = "/dashboard";

export function getSafeAuthNextPath(
  value: string | string[] | null | undefined,
  fallback = defaultAuthNextPath,
) {
  const next = Array.isArray(value) ? value[0] : value;

  if (!next || next.length > 2048 || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) {
    return fallback;
  }

  try {
    const decoded = decodeURIComponent(next);
    if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded)) return fallback;
    if (new URL(next, "https://project-ve.local").origin !== "https://project-ve.local") return fallback;
  } catch { return fallback; }
  const url = new URL(next, "https://project-ve.local");
  if (url.pathname === "/welcome/save") {
    const destination = url.searchParams.get("next");
    // Historical reward links enter normal onboarding; retain explicit org context.
    if (!destination || destination.startsWith("/welcome/save") || destination === "/xp-store") return fallback;
    return getSafeAuthNextPath(destination, fallback);
  }
  return next;
}

export function createLoginHref(nextPath: string) {
  const safeNextPath = getSafeAuthNextPath(nextPath);
  return `/login?next=${encodeURIComponent(safeNextPath)}`;
}

export function isOrganizationAuthNextPath(nextPath: string): boolean {
  const safeNextPath = getSafeAuthNextPath(nextPath);
  const nextUrl = new URL(safeNextPath, "https://project-ve.local");

  if (nextUrl.pathname === "/org" || nextUrl.pathname.startsWith("/org/")) {
    return true;
  }

  if (nextUrl.pathname === "/o" || nextUrl.pathname.startsWith("/o/")) {
    return true;
  }

  if (nextUrl.pathname === "/login") {
    const confirmedNext = nextUrl.searchParams.get("next");
    return confirmedNext ? isOrganizationAuthNextPath(confirmedNext) : false;
  }

  return false;
}

export function shouldRouteAuthNextToPublicAssessment(nextPath: string) {
  const safeNextPath = getSafeAuthNextPath(nextPath);
  const nextUrl = new URL(safeNextPath, "https://project-ve.local");

  return !["/login", "/onboarding/assessment"].includes(nextUrl.pathname) && !isOrganizationAuthNextPath(safeNextPath);
}
