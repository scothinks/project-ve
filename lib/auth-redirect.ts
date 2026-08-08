export const defaultAuthNextPath = "/dashboard";

export function getSafeAuthNextPath(
  value: string | string[] | null | undefined,
  fallback = defaultAuthNextPath,
) {
  const next = Array.isArray(value) ? value[0] : value;

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }

  return next;
}

export function createLoginHref(nextPath: string) {
  const safeNextPath = getSafeAuthNextPath(nextPath);
  return `/login?next=${encodeURIComponent(safeNextPath)}`;
}
