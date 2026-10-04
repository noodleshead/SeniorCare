import { AppError } from "../utils/errors.js";

export function notFoundHandler(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, "NOT_FOUND"));
}

// Converts any thrown error into the app's consistent response shape.
// Never leaks stack traces, driver error names, or connection strings
// to the client — those are logged server-side only.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let code = err.code || "INTERNAL_ERROR";
  let message = err.message || "Something went wrong. Please try again.";
  let errors = err.details;

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    code = "CONFLICT";
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    // Friendlier, field-specific wording for the cases users actually
    // hit (raw Mongo errors must never reach the client) — falls back to
    // the generic phrasing for any other unique field.
    const FRIENDLY_DUPLICATE_MESSAGES = {
      seniorCitizenId: "This Senior Citizen ID is already registered.",
      email: "An account with this email already exists.",
      accountEmail: "An account with this email already exists.",
    };
    message = FRIENDLY_DUPLICATE_MESSAGES[field] || `A record with this ${field} already exists.`;
    errors = undefined;
  }

  // Mongoose validation error
  if (err.name === "ValidationError" && err.errors) {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = "Please correct the highlighted fields.";
    errors = Object.fromEntries(
      Object.entries(err.errors).map(([key, val]) => [key, val.message])
    );
  }

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = "Invalid identifier provided.";
  }

  if (!err.isOperational && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.error(err);
  } else if (!err.isOperational) {
    console.error(`[error] ${err.name}: ${err.message}`);
  }

  res.status(statusCode).json({
    success: false,
    code,
    message,
    ...(errors ? { errors } : {}),
  });
}
