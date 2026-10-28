'use strict';

const mongoose = require('mongoose');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const { AppError } = require('../middlewares/errorHandler');

/**
 * POST /accounts/:accountId/transactions
 *
 * Atomically:
 *  1. Verifies the account exists.
 *  2. Checks for duplicate reference_id (per account).
 *  3. Rejects debits with insufficient balance.
 *  4. Inserts the transaction and updates the account balance in a
 *     single MongoDB session/transaction so neither change can persist
 *     without the other.
 */
const addTransaction = async (req, res, next) => {
  const { accountId } = req.params;
  const { type, amount, description = '', reference_id } = req.body;

  const numericAmount = parseFloat(amount);

  const session = await mongoose.startSession();

  try {
    let transaction;

    await session.withTransaction(async () => {
      // ── 1. Verify account exists ─────────────────────────────────────────
      const account = await Account.findById(accountId).session(session);
      if (!account) {
        throw new AppError(`Account not found: ${accountId}`, 404);
      }

      // ── 2. Check for duplicate reference_id (same account) ───────────────
      const duplicate = await Transaction.findOne({
        account_id: accountId,
        reference_id,
      }).session(session);

      if (duplicate) {
        // Return 409 without creating a new transaction
        throw new AppError(
          `Transaction with reference_id '${reference_id}' already exists for this account`,
          409
        );
      }

      // ── 3. Insufficient balance check for debits ─────────────────────────
      if (type === 'debit' && account.balance < numericAmount) {
        throw new AppError(
          `Insufficient balance. Available: ${account.balance}, Requested: ${numericAmount}`,
          422
        );
      }

      // ── 4. Persist transaction ───────────────────────────────────────────
      const [created] = await Transaction.create(
        [
          {
            account_id: accountId,
            type,
            amount: numericAmount,
            description,
            reference_id,
          },
        ],
        { session }
      );

      // ── 5. Update account balance atomically ─────────────────────────────
      const balanceDelta = type === 'credit' ? numericAmount : -numericAmount;

      await Account.findByIdAndUpdate(
        accountId,
        { $inc: { balance: balanceDelta } },
        { session, new: true }
      );

      transaction = created;
    });

    return res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: transaction.toJSON(),
    });
  } catch (err) {
    // AppError instances bubble up with the right status code
    next(err);
  } finally {
    session.endSession();
  }
};

/**
 * GET /accounts/:accountId/transactions
 *
 * Returns paginated, filtered, and sorted transactions for an account.
 *
 * Query params:
 *   type   — 'credit' | 'debit' (optional)
 *   page   — positive integer (default: 1)
 *   limit  — 1–100 (default: 10)
 */
const getTransactions = async (req, res, next) => {
  try {
    const { accountId } = req.params;

    // ── Verify account ───────────────────────────────────────────────────
    const accountExists = await Account.exists({ _id: accountId });
    if (!accountExists) {
      return next(new AppError(`Account not found: ${accountId}`, 404));
    }

    // ── Parse & sanitise query params ────────────────────────────────────
    const typeFilter = req.query.type; // undefined | 'credit' | 'debit'
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    // ── Build filter ─────────────────────────────────────────────────────
    const filter = { account_id: accountId };
    if (typeFilter) filter.type = typeFilter;

    // ── Query ────────────────────────────────────────────────────────────
    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ created_at: -1 }) // latest first
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      data: {
        transactions: transactions.map((t) => ({
          id: t._id,
          account_id: t.account_id,
          type: t.type,
          amount: t.amount,
          description: t.description,
          reference_id: t.reference_id,
          created_at: t.created_at,
        })),
        pagination: {
          total_records: total,
          total_pages: totalPages,
          current_page: page,
          page_size: limit,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { addTransaction, getTransactions };
