export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DEPENDENCY_UNAVAILABLE"
  | "INVARIANT_VIOLATION";

export type AppErrorContext = {
  operation: string;
  requestId?: string | null;
  resourceId?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
};

export class AppError extends Error {
  code: AppErrorCode;
  status: number;
  cause?: unknown;

  constructor({
    cause,
    code,
    message,
    status,
  }: {
    cause?: unknown;
    code: AppErrorCode;
    message: string;
    status: number;
  }) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

export class ValidationError extends AppError {
  constructor(message = "The submitted value is invalid.", cause?: unknown) {
    super({
      cause,
      code: "VALIDATION_ERROR",
      message,
      status: 400,
    });
    this.name = "ValidationError";
  }
}

export class DependencyUnavailableError extends AppError {
  constructor(message = "A required service is temporarily unavailable.", cause?: unknown) {
    super({
      cause,
      code: "DEPENDENCY_UNAVAILABLE",
      message,
      status: 503,
    });
    this.name = "DependencyUnavailableError";
  }
}

export class InvariantViolationError extends AppError {
  constructor(message = "Application state violated an expected invariant.", cause?: unknown) {
    super({
      cause,
      code: "INVARIANT_VIOLATION",
      message,
      status: 500,
    });
    this.name = "InvariantViolationError";
  }
}

function getErrorRecord(error: unknown) {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      name: error.name,
      status: error.status,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    };
  }

  return {
    message: String(error),
    name: "UnknownError",
  };
}

export function logAppError(error: unknown, context: AppErrorContext) {
  const appError =
    error instanceof AppError
      ? error
      : new DependencyUnavailableError("Unhandled dependency failure.", error);

  const payload = {
    level: "error",
    type: appError.name,
    code: appError.code,
    status: appError.status,
    operation: context.operation,
    userId: context.userId ?? undefined,
    resourceId: context.resourceId ?? undefined,
    requestId: context.requestId ?? undefined,
    metadata: context.metadata,
    error: getErrorRecord(appError.cause ?? appError),
  };

  console.error(JSON.stringify(payload));
}

export function toDependencyUnavailableError(
  error: unknown,
  message = "A required service is temporarily unavailable.",
) {
  return error instanceof DependencyUnavailableError
    ? error
    : new DependencyUnavailableError(message, error);
}

export async function withLoggedFallback<T>({
  context,
  fallback,
  promise,
}: {
  context: AppErrorContext;
  fallback: T;
  promise: Promise<T>;
}) {
  try {
    return await promise;
  } catch (error) {
    logAppError(error, context);
    return fallback;
  }
}
