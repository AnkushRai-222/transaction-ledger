'use strict';

const { body, query } = require('express-validator');

/**
 * Validation rules for POST /accounts/:accountId/transactions
 */
const createTransactionRules = [
  body('type')
    .trim()
    .notEmpty()
    .withMessage('type is required')
    .isIn(['credit', 'debit'])
    .withMessage("type must be 'credit' or 'debit'"),

  body('amount')
    .notEmpty()
    .withMessage('amount is required')
    .isFloat({ gt: 0 })
    .withMessage('amount must be a number greater than 0'),

  body('reference_id')
    .trim()
    .notEmpty()
    .withMessage('reference_id is required'),

  body('description')
    .optional()
    .isString()
    .withMessage('description must be a string'),
];

/**
 * Validation rules for GET /accounts/:accountId/transactions query params
 */
const listTransactionRules = [
  query('type')
    .optional()
    .isIn(['credit', 'debit'])
    .withMessage("type filter must be 'credit' or 'debit'"),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),
];

module.exports = { createTransactionRules, listTransactionRules };
