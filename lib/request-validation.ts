export type JsonObject = Record<string, unknown>;

export type ValidationIssue = {
  path: string;
  message: string;
};

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; issues: ValidationIssue[] };

type FieldOptions = {
  allowEmpty?: boolean;
  maxLength?: number;
  minLength?: number;
  required?: boolean;
  trim?: boolean;
};

export function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function readJsonObject(request: Request): Promise<ValidationResult<JsonObject>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      issues: [{ path: "body", message: "Malformed JSON." }],
    };
  }

  if (!isJsonObject(body)) {
    return {
      ok: false,
      issues: [{ path: "body", message: "Expected a JSON object." }],
    };
  }

  return { ok: true, data: body };
}

export function validationErrorResponse(issues: ValidationIssue[]) {
  return Response.json(
    {
      error: "Invalid request body.",
      issues,
    },
    { status: 400 },
  );
}

export function getStringField(
  input: JsonObject,
  key: string,
  issues: ValidationIssue[],
  options: FieldOptions = {},
) {
  const {
    allowEmpty = false,
    maxLength,
    minLength,
    required = true,
    trim = true,
  } = options;
  const value = input[key];

  if (value === undefined || value === null) {
    if (required) {
      issues.push({ path: key, message: "Required." });
    }
    return null;
  }

  if (typeof value !== "string") {
    issues.push({ path: key, message: "Expected a string." });
    return null;
  }

  const nextValue = trim ? value.trim() : value;

  if (!allowEmpty && nextValue.length === 0) {
    issues.push({ path: key, message: "Required." });
    return null;
  }

  if (minLength !== undefined && nextValue.length < minLength) {
    issues.push({ path: key, message: `Must be at least ${minLength} characters.` });
    return null;
  }

  if (maxLength !== undefined && nextValue.length > maxLength) {
    issues.push({ path: key, message: `Must be at most ${maxLength} characters.` });
    return null;
  }

  return nextValue;
}

export function getOptionalStringField(
  input: JsonObject,
  key: string,
  issues: ValidationIssue[],
  options: Omit<FieldOptions, "required"> = {},
) {
  return getStringField(input, key, issues, { ...options, required: false });
}

export function getBooleanField(
  input: JsonObject,
  key: string,
  issues: ValidationIssue[],
  options: { required?: boolean } = {},
) {
  const { required = true } = options;
  const value = input[key];

  if (value === undefined || value === null) {
    if (required) {
      issues.push({ path: key, message: "Required." });
    }
    return null;
  }

  if (typeof value !== "boolean") {
    issues.push({ path: key, message: "Expected a boolean." });
    return null;
  }

  return value;
}

export function getNumberField(
  input: JsonObject,
  key: string,
  issues: ValidationIssue[],
  options: { integer?: boolean; max?: number; min?: number; required?: boolean } = {},
) {
  const { integer = false, max, min, required = true } = options;
  const value = input[key];

  if (value === undefined || value === null) {
    if (required) {
      issues.push({ path: key, message: "Required." });
    }
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push({ path: key, message: "Expected a number." });
    return null;
  }

  if (integer && !Number.isInteger(value)) {
    issues.push({ path: key, message: "Expected an integer." });
    return null;
  }

  if (min !== undefined && value < min) {
    issues.push({ path: key, message: `Must be at least ${min}.` });
    return null;
  }

  if (max !== undefined && value > max) {
    issues.push({ path: key, message: `Must be at most ${max}.` });
    return null;
  }

  return value;
}

export function getEnumField<const T extends readonly string[]>(
  input: JsonObject,
  key: string,
  allowed: T,
  issues: ValidationIssue[],
  options: { required?: boolean } = {},
): T[number] | null {
  const value = getStringField(input, key, issues, { required: options.required ?? true });

  if (value === null) {
    return null;
  }

  if (!(allowed as readonly string[]).includes(value)) {
    issues.push({ path: key, message: `Expected one of: ${allowed.join(", ")}.` });
    return null;
  }

  return value;
}

export function getObjectField(
  input: JsonObject,
  key: string,
  issues: ValidationIssue[],
  options: { required?: boolean } = {},
) {
  const { required = true } = options;
  const value = input[key];

  if (value === undefined || value === null) {
    if (required) {
      issues.push({ path: key, message: "Required." });
    }
    return null;
  }

  if (!isJsonObject(value)) {
    issues.push({ path: key, message: "Expected an object." });
    return null;
  }

  return value;
}

export function getArrayField(
  input: JsonObject,
  key: string,
  issues: ValidationIssue[],
  options: { required?: boolean } = {},
) {
  const { required = true } = options;
  const value = input[key];

  if (value === undefined || value === null) {
    if (required) {
      issues.push({ path: key, message: "Required." });
    }
    return null;
  }

  if (!Array.isArray(value)) {
    issues.push({ path: key, message: "Expected an array." });
    return null;
  }

  return value;
}

export function getStringArrayField(
  input: JsonObject,
  key: string,
  issues: ValidationIssue[],
  options: { allowEmpty?: boolean; required?: boolean } = {},
) {
  const { allowEmpty = true, required = true } = options;
  const values = getArrayField(input, key, issues, { required });

  if (values === null) {
    return null;
  }

  const strings: string[] = [];

  values.forEach((value, index) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      issues.push({ path: `${key}.${index}`, message: "Expected a non-empty string." });
      return;
    }

    strings.push(value.trim());
  });

  if (!allowEmpty && strings.length === 0) {
    issues.push({ path: key, message: "Must include at least one item." });
    return null;
  }

  return strings;
}
