// Readable hints schedule work only. The HttpOnly signed receipt and authenticated
// POST remain the sole authority for awards. Acknowledgements never erase newer work.
export const progressPendingCookie = "ve-welcome-pending";
export const progressAckCookie = "ve-welcome-ack";
export const progressWakeEvent = "ve:welcome-progress-pending";
export const progressSavedEvent = "ve:welcome-progress-saved";
export function progressRevision(receipt: { id: string; completed: readonly string[] }) {
  return receipt.completed.length ? `${receipt.id}:${[...receipt.completed].sort().join(",")}` : "";
}
export function readProgressCookie(name: string) {
  const value = document.cookie.split("; ").find(item => item.startsWith(`${name}=`))?.slice(name.length + 1);
  try { return value ? decodeURIComponent(value) : ""; } catch { return ""; }
}
export function pendingProgressRevision() {
  const revision = readProgressCookie(progressPendingCookie);
  return revision && revision !== readProgressCookie(progressAckCookie) ? revision : "";
}
export function seedProgressHint(revision: string) {
  const pending = readProgressCookie(progressPendingCookie);
  if (revision && (!pending || pending === readProgressCookie(progressAckCookie))) {
    document.cookie = `${progressPendingCookie}=${encodeURIComponent(revision)}; Path=/; Max-Age=2592000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }
  window.dispatchEvent(new Event(progressWakeEvent));
}
