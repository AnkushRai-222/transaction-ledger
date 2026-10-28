'use strict';

const { body } = require('express-validator');

/**
 * Validation rules for POST /transfers
 */
const transferRules = [
  body('from_account_id')
    .trim()
    .notEmpty()
    .withMessage('from_account_id is required'),

  body('to_account_id')
    .trim()
    .notEmpty()
    .withMessage('to_account_id is required')
    .custom((value, { req }) => {
      if (value === req.body.from_account_id) {
        throw new Error('to_account_id must differ from from_account_id');
      }
      return true;
    }),

  body('amount')
    .notEmpty()
    .withMessage('amount is required')
    .isFloat({ gt: 0 })
    .withMessage('amount must be a number greater than 0'),

  body('description')
    .optional()
    .isString()
    .withMessage('description must be a string'),

  body('reference_id')
    .trim()
    .notEmpty()
    .withMessage('reference_id is required'),
];

module.exports = { transferRules };
