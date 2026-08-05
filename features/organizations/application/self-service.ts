import { normalizeEmailInput, sanitizePlainTextInput } from "@/lib/input-safety";

export type SelfServiceOrganizationInput = {
  description: string;
  name: string;
  shortName: string;
  slug: string;
  supportEmail: string;
  termsAccepted: boolean;
};

export function normalizeOrganizationSlugInput(value: string, fallback = "") {
  const source = sanitizePlainTextInput(value || fallback, 90).trim();
  const slug = source
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return slug.slice(0, 80);
}

export function parseSelfServiceOrganizationInput(formData: FormData): SelfServiceOrganizationInput {
  const name = sanitizePlainTextInput(String(formData.get("name") ?? ""), 160).trim();
  const slug = normalizeOrganizationSlugInput(String(formData.get("slug") ?? ""), name);
  const shortName = sanitizePlainTextInput(String(formData.get("shortName") ?? ""), 80).trim();
  const description = sanitizePlainTextInput(String(formData.get("description") ?? ""), 2000).trim();
  const supportEmail = normalizeEmailInput(String(formData.get("supportEmail") ?? ""));
  const termsAccepted = formData.get("termsAccepted") === "on";

  if (!name) {
    throw new Error("Enter an organisation name.");
  }

  if (slug.length < 3) {
    throw new Error("Use at least three letters or numbers in the organisation web address.");
  }

  if (supportEmail && !supportEmail.includes("@")) {
    throw new Error("Enter a valid support email address.");
  }

  if (!termsAccepted) {
    throw new Error("Accept the organisation terms to continue.");
  }

  return {
    description,
    name,
    shortName,
    slug,
    supportEmail,
    termsAccepted,
  };
}

export function createSelfServiceOrganizationRedirect(
  path: string,
  message?: string | null,
  key = "error",
) {
  if (!message) {
    return path;
  }

  const url = new URL(path, "http://localhost");
  url.searchParams.set(key, message);
  return `${url.pathname}?${url.searchParams.toString()}`;
}
