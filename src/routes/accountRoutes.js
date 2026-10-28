'use strict';

const { Router } = require('express');
const { createAccount, getBalance } = require('../controllers/accountController');
const { createAccountRules } = require('../validators/accountValidator');
const validate = require('../middlewares/validate');

const router = Router();

/**
 * @route  POST /accounts
 * @desc   Create a new account
 * @access Public
 */
router.post('/', createAccountRules, validate, createAccount);

/**
 * @route  GET /accounts/:accountId/balance
 * @desc   Get current balance for an account
 * @access Public
 */
router.get('/:accountId/balance', getBalance);

module.exports = router;
