'use strict';

const Account = require('../models/Account');
const { AppError } = require('../middlewares/errorHandler');

/**
 * POST /accounts
 * Creates a new account with balance always initialised to 0.
 * The client is not allowed to set the balance — the validator enforces this.
 */
const createAccount = async (req, res, next) => {
  try {
    const { name } = req.body;

    const account = await Account.create({ name });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: account.toJSON(),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /accounts/:accountId/balance
 * Returns the current balance of an account.
 */
const getBalance = async (req, res, next) => {
  try {
    const { accountId } = req.params;

    const account = await Account.findById(accountId).lean();
    if (!account) {
      return next(new AppError(`Account not found: ${accountId}`, 404));
    }

    return res.status(200).json({
      success: true,
      data: {
        account_id: account._id,
        name: account.name,
        balance: account.balance,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createAccount, getBalance };
