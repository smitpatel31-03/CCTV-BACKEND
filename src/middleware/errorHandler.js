/**
 * Global Error Handling Middleware
 *
 * Catches all errors that reach the Express error pipeline and returns
 * structured JSON responses with appropriate HTTP status codes.
 *
 * @module middleware/errorHandler
 */

/**
 * 404 Not Found middleware.
 * Mount after all route definitions to catch unmatched requests.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const notFound = (req, res, next) => {
  const error = new Error(`Not found — ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

/**
 * Central error handler.
 * Translates known error types (Mongoose, JWT, duplicate-key) into
 * user-friendly JSON responses.
 *
 * @param {Error & { statusCode?: number, code?: number, errors?: object, path?: string, value?: unknown, keyValue?: object }} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  /** @type {{ statusCode: number, message: string, errors?: object[] }} */
  let error = {
    statusCode: err.statusCode || 500,
    message: err.message || 'Internal server error.',
  };

  // ── Mongoose Validation Error ──────────────────────────────────────────
  if (err.name === 'ValidationError' && err.errors) {
    error.statusCode = 400;
    error.message = 'Validation failed.';
    error.errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
      value: e.value,
    }));
  }

  // ── Mongoose CastError (invalid ObjectId, etc.) ────────────────────────
  if (err.name === 'CastError') {
    error.statusCode = 400;
    error.message = `Invalid ${err.path}: ${err.value}.`;
  }

  // ── MongoDB Duplicate Key Error ────────────────────────────────────────
  if (err.code === 11000) {
    const duplicateField = Object.keys(err.keyValue || {}).join(', ');
    error.statusCode = 409;
    error.message = duplicateField
      ? `Duplicate value for field(s): ${duplicateField}. Please use a different value.`
      : 'Duplicate key error. A record with this value already exists.';
  }

  // ── JSON Web Token Errors ──────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    error.statusCode = 401;
    error.message = 'Invalid token. Please authenticate again.';
  }

  if (err.name === 'TokenExpiredError') {
    error.statusCode = 401;
    error.message = 'Token has expired. Please authenticate again.';
  }

  // ── Build response payload ─────────────────────────────────────────────
  const response = {
    success: false,
    message: error.message,
    ...(error.errors && { errors: error.errors }),
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
    }),
  };

  res.status(error.statusCode).json(response);
};
