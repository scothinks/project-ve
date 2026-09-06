import { mediaVersionId } from "../features/media/domain/media-reference.ts";

const dangerousAngleChars = /[<>]/g;
const unsafeControlChars = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizePlainTextInput(value: string, maxLength = 500) {
  return value
    .normalize("NFKC")
    .replace(unsafeControlChars, "")
    .replace(dangerousAngleChars, "")
    .slice(0, maxLength);
}

export function normalizeEmailInput(value: string) {
  return sanitizePlainTextInput(value, 254).trim().toLowerCase();
}

export function normalizeReferralCodeInput(value: string) {
  return sanitizePlainTextInput(value, 80).replace(/[^a-zA-Z0-9_-]/g, "");
}

export function sanitizeUrlInput(value: string, maxLength = 1000) {
  const cleaned = sanitizePlainTextInput(value, maxLength).trim();

  if (!cleaned) {
    return "";
  }

  if (mediaVersionId(cleaned)) return cleaned;

  try {
    const url = new URL(cleaned);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}
