import { sanitizePlainTextInput, sanitizeUrlInput } from "./input-safety.ts";
import type { ValidationIssue, ValidationResult } from "./request-validation.ts";

export type FormStringOptions = {
  allowEmpty?: boolean;
  maxLength?: number;
  minLength?: number;
  required?: boolean;
  trim?: boolean;
};

export type FormIntegerOptions = {
  fallback?: number;
  max?: number;
  min?: number;
  required?: boolean;
};

export function formOk<T>(data: T): ValidationResult<T> {
  return { ok: true, data };
}

export function formFailed<T>(issues: ValidationIssue[]): ValidationResult<T> {
  return { ok: false, issues };
}

export function getFormString(
  formData: FormData,
  key: string,
  issues: ValidationIssue[],
  options: FormStringOptions = {},
) {
  const {
    allowEmpty = false,
    maxLength = 500,
    minLength,
    required = true,
    trim = true,
  } = options;
  const value = formData.get(key);

  if (value === null) {
    if (required) issues.push({ path: key, message: "Required." });
    return null;
  }

  if (typeof value !== "string") {
    issues.push({ path: key, message: "Expected a string." });
    return null;
  }

  const sanitized = sanitizePlainTextInput(value, maxLength);
  const nextValue = trim ? sanitized.trim() : sanitized;

  if (!allowEmpty && nextValue.length === 0) {
    issues.push({ path: key, message: "Required." });
    return null;
  }

  if (minLength !== undefined && nextValue.length < minLength) {
    issues.push({ path: key, message: `Must be at least ${minLength} characters.` });
    return null;
  }

  return nextValue;
}

export function getOptionalFormString(
  formData: FormData,
  key: string,
  issues: ValidationIssue[],
  options: Omit<FormStringOptions, "required"> = {},
) {
  return getFormString(formData, key, issues, { ...options, required: false }) ?? "";
}

export function getFormInteger(
  formData: FormData,
  key: string,
  issues: ValidationIssue[],
  options: FormIntegerOptions = {},
) {
  const { fallback, max, min, required = true } = options;
  const value = formData.get(key);

  if (value === null) {
    if (fallback !== undefined) return fallback;
    if (required) issues.push({ path: key, message: "Required." });
    return null;
  }

  if (typeof value !== "string") {
    issues.push({ path: key, message: "Expected an integer." });
    return null;
  }

  const raw = value.trim();
  if (!raw) {
    if (fallback !== undefined) return fallback;
    if (required) issues.push({ path: key, message: "Required." });
    return null;
  }

  if (!/^-?\d+$/.test(raw)) {
    issues.push({ path: key, message: "Expected an integer." });
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed)) {
    issues.push({ path: key, message: "Expected a safe integer." });
    return null;
  }

  if (min !== undefined && parsed < min) {
    issues.push({ path: key, message: `Must be at least ${min}.` });
    return null;
  }

  if (max !== undefined && parsed > max) {
    issues.push({ path: key, message: `Must be at most ${max}.` });
    return null;
  }

  return parsed;
}

export function getOptionalFormInteger(
  formData: FormData,
  key: string,
  issues: ValidationIssue[],
  options: Omit<FormIntegerOptions, "fallback" | "required"> = {},
) {
  const value = formData.get(key);

  if (value === null || (typeof value === "string" && value.trim() === "")) {
    return null;
  }

  return getFormInteger(formData, key, issues, { ...options, required: false });
}

export function getFormEnum<const T extends readonly string[]>(
  formData: FormData,
  key: string,
  allowed: T,
  issues: ValidationIssue[],
  fallback?: T[number],
) {
  const value = getFormString(formData, key, issues, {
    allowEmpty: fallback !== undefined,
    required: fallback === undefined,
  });

  if (value === null || value === "") return fallback ?? null;

  if (!(allowed as readonly string[]).includes(value)) {
    issues.push({ path: key, message: `Expected one of: ${allowed.join(", ")}.` });
    return null;
  }

  return value as T[number];
}

export function getBooleanFlag(formData: FormData, key: string, trueValue = "on") {
  return formData.get(key) === trueValue;
}

export function getFormStringList(
  formData: FormData,
  key: string,
  issues: ValidationIssue[],
  options: { itemMaxLength?: number; required?: boolean } = {},
) {
  const raw = getFormString(formData, key, issues, {
    allowEmpty: !(options.required ?? false),
    maxLength: 4000,
    required: options.required ?? false,
  });

  if (raw === null) return [];

  return raw
    .split(",")
    .map((item) => sanitizePlainTextInput(item, options.itemMaxLength ?? 80).trim())
    .filter(Boolean);
}

export function getFormStringArray(
  formData: FormData,
  key: string,
  issues: ValidationIssue[],
  options: { itemMaxLength?: number; required?: boolean } = {},
) {
  const values = formData.getAll(key);

  if (values.length === 0 && (options.required ?? false)) {
    issues.push({ path: key, message: "Must include at least one item." });
  }

  return values
    .map((value, index) => {
      if (typeof value !== "string") {
        issues.push({ path: `${key}.${index}`, message: "Expected a string." });
        return "";
      }

      return sanitizePlainTextInput(value, options.itemMaxLength ?? 120).trim();
    })
    .filter(Boolean);
}

export function getOptionalFormDate(
  formData: FormData,
  key: string,
  issues: ValidationIssue[],
) {
  const raw = getOptionalFormString(formData, key, issues, {
    allowEmpty: true,
    maxLength: 80,
  });

  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    issues.push({ path: key, message: "Expected a valid date." });
    return null;
  }

  return date.toISOString();
}

export function getRequiredFormDate(
  formData: FormData,
  key: string,
  issues: ValidationIssue[],
) {
  const raw = getFormString(formData, key, issues, {
    maxLength: 80,
  });

  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    issues.push({ path: key, message: "Expected a valid date." });
    return null;
  }

  return date.toISOString();
}

export function getFormUrl(
  formData: FormData,
  key: string,
  issues: ValidationIssue[],
  options: FormStringOptions & { httpsOnly?: boolean } = {},
) {
  const raw = getFormString(formData, key, issues, {
    ...options,
    allowEmpty: options.allowEmpty ?? true,
    trim: true,
  });

  if (!raw) return "";

  const parsed = sanitizeUrlInput(raw, options.maxLength ?? 1000);
  if (!parsed) {
    issues.push({ path: key, message: "Expected a valid HTTP or HTTPS URL." });
    return "";
  }

  if (options.httpsOnly && !parsed.startsWith("https://")) {
    issues.push({ path: key, message: "Must use HTTPS." });
    return "";
  }

  return parsed;
}

export function parseFormJsonObject(
  formData: FormData,
  key: string,
  issues: ValidationIssue[],
) {
  const raw = getOptionalFormString(formData, key, issues, {
    allowEmpty: true,
    maxLength: 10000,
  });

  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    issues.push({ path: key, message: "Expected a JSON object." });
  } catch {
    issues.push({ path: key, message: "Malformed JSON." });
  }

  return {};
}

export function formatValidationIssues(issues: ValidationIssue[]) {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join(" ");
}
