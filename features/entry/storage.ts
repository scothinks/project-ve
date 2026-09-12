// Referral context is optional when browser storage is unavailable. Query context
// still reaches the existing server endpoints; storage never grants access.
export const authStorage = {
  getItem(key: string) { try { return window.localStorage.getItem(key); } catch { return null; } },
  setItem(key: string, value: string) { try { window.localStorage.setItem(key, value); } catch {} },
  removeItem(key: string) { try { window.localStorage.removeItem(key); } catch {} },
};
