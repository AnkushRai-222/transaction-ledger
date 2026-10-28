'use strict';

const { Router } = require('express');
const {
  addTransaction,
  getTransactions,
} = require('../controllers/transactionController');
const {
  createTransactionRules,
  listTransactionRules,
} = require('../validators/transactionValidator');
const validate = require('../middlewares/validate');

/**
 * Routes are mounted at /accounts/:accountId/transactions
 * The router is created with mergeParams so :accountId is accessible.
 */
const router = Router({ mergeParams: true });

/**
 * @route  POST /accounts/:accountId/transactions
 * @desc   Add a credit or debit transaction
 * @access Public
 */
router.post('/', createTransactionRules, validate, addTransaction);

/**
 * @route  GET /accounts/:accountId/transactions
 * @desc   List transactions with optional filter, pagination, and sorting
 * @access Public
 */
router.get('/', listTransactionRules, validate, getTransactions);

module.exports = router;
