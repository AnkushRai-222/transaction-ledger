'use strict';

/**
 * Global error-handling middleware.
 * Must be registered LAST in the Express middleware chain (4-arg signature).
 *
 * Handles:
 *  - Mongoose duplicate-key errors  (11000)
 *  - Mongoose validation errors
 *  - Mongoose cast errors (invalid ObjectId / type cast)
 *  - AppError instances (custom operational errors)
 *  - Generic unhandled errors
 */

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = null;

  // Mongoose duplicate key (e.g. unique index violation)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = field
      ? `Duplicate value for field: ${field}`
      : 'Duplicate key error';
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 422;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Mongoose CastError (type mismatch)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for field: ${err.path}`;
  }

  // Log unexpected server errors
  if (statusCode === 500) {
    console.error('[ERROR]', err);
  }

  const body = { success: false, message };
  if (errors) body.errors = errors;

  return res.status(statusCode).json(body);
};

module.exports = { errorHandler, AppError };
