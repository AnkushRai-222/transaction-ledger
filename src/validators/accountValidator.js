'use strict';

const { body } = require('express-validator');

/**
 * Validation rules for POST /accounts
 */
const createAccountRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('name is required')
    .isString()
    .withMessage('name must be a string'),

  // Explicitly reject any attempt to seed the balance
  body('balance')
    .not()
    .exists()
    .withMessage('balance cannot be set by the client — it always starts at 0'),
];

module.exports = { createAccountRules };
