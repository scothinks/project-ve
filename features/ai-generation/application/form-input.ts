import { normalizeImageFit, normalizeImagePosition } from "../../../lib/image-presentation.ts";
import { sanitizePlainTextInput } from "../../../lib/input-safety.ts";

export function getRedirectTarget(formData: FormData, fallback: string) {
  const redirectTo = sanitizePlainTextInput(String(formData.get("redirectTo") ?? fallback), 400);
  return redirectTo || fallback;
}

export function parseBooleanFlag(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
}

export function parseImagePresentationInput(formData: FormData) {
  return {
    fit: normalizeImageFit(String(formData.get("imageFit") ?? "cover")),
    positionX: normalizeImagePosition(Number.parseInt(String(formData.get("imagePositionX") ?? "50"), 10), 50),
    positionY: normalizeImagePosition(Number.parseInt(String(formData.get("imagePositionY") ?? "50"), 10), 50),
  };
}

export function getImagePayloadString(
  image: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = image?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export function parseRequiredChangeRequest(formData: FormData, fieldName: string) {
  const feedback = sanitizePlainTextInput(String(formData.get(fieldName) ?? ""), 3000).trim();
  if (!feedback) {
    throw new Error("Add the specific changes you want before submitting.");
  }
  return feedback;
}

export function getContinuityInstruction(formData: FormData) {
  return sanitizePlainTextInput(String(formData.get("continuityInstruction") ?? ""), 1000);
}
