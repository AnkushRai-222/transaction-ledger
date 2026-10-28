'use strict';

const { validationResult } = require('express-validator');

/**
 * Middleware that runs after express-validator chains.
 * If validation errors exist it responds with 422 and exits early.
 * Otherwise it calls next() to continue to the controller.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
};

module.exports = validate;
