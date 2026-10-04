// Custom, typed application errors. The central error middleware inspects
// `statusCode` and `code` to build a safe, consistent response — internal
// details (stack traces, DB errors) never reach the client directly.

export class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR", details) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed.", details) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication failed.") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You are not authorized to perform this action.") {
    super(message, 403, "AUTHORIZATION_ERROR");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found.") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "This resource already exists.", details) {
    super(message, 409, "CONFLICT", details);
  }
}

export class AccountStatusError extends AppError {
  // Used for PENDING_VERIFICATION / INACTIVE / REJECTED login attempts.
  constructor(message, code) {
    super(message, 403, code);
  }
}

export class MaintenanceModeError extends AppError {
  // Thrown by auth.middleware.js when System Settings' maintenanceMode
  // is ON and the authenticated caller is not an Administrator. 503
  // (Service Unavailable) — the standard status for "temporarily down
  // for maintenance," distinct from a 403 (which would imply the user
  // specifically lacks permission, not that the whole system is paused).
  constructor(message = "SENIORCARE is currently undergoing maintenance. Please try again later.") {
    super(message, 503, "MAINTENANCE_MODE");
  }
}
