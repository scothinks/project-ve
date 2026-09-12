/** Compare the browser origin with the public Host, since Next may use an internal URL. */
export function isSameOrigin(origin: string | null, host: string | null, protocol: string) {
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return url.origin === origin && url.host === host && url.protocol === protocol;
  } catch { return false; }
}
