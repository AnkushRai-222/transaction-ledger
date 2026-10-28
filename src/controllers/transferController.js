'use strict';

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const { AppError } = require('../middlewares/errorHandler');

/**
 * POST /transfers
 *
 * Atomically transfers `amount` from one account to another.
 *
 * Business rules enforced:
 *  - Both accounts must exist.
 *  - Source account must have sufficient balance.
 *  - The debit (source) and credit (destination) happen in a single
 *    MongoDB multi-document transaction — a partial transfer is impossible.
 *  - reference_id is scoped per account, so the same reference_id can
 *    be reused across accounts but we use prefixed variants to maintain
 *    a clean audit trail for both legs.
 */
const transfer = async (req, res, next) => {
  const {
    from_account_id,
    to_account_id,
    amount,
    description = '',
    reference_id,
  } = req.body;

  const numericAmount = parseFloat(amount);

  const session = await mongoose.startSession();

  try {
    let debitTx, creditTx, fromAccount, toAccount;

    await session.withTransaction(async () => {
      // ── 1. Fetch both accounts inside the session ────────────────────────
      [fromAccount, toAccount] = await Promise.all([
        Account.findById(from_account_id).session(session),
        Account.findById(to_account_id).session(session),
      ]);

      if (!fromAccount) {
        throw new AppError(`Source account not found: ${from_account_id}`, 404);
      }
      if (!toAccount) {
        throw new AppError(
          `Destination account not found: ${to_account_id}`,
          404
        );
      }

      // ── 2. Sufficient balance ────────────────────────────────────────────
      if (fromAccount.balance < numericAmount) {
        throw new AppError(
          `Insufficient balance in source account. Available: ${fromAccount.balance}, Requested: ${numericAmount}`,
          422
        );
      }

      // ── 3. Check for duplicate reference_id on both accounts ─────────────
      const debitRefId = `${reference_id}:debit`;
      const creditRefId = `${reference_id}:credit`;

      const [debitDup, creditDup] = await Promise.all([
        Transaction.findOne({
          account_id: from_account_id,
          reference_id: debitRefId,
        }).session(session),
        Transaction.findOne({
          account_id: to_account_id,
          reference_id: creditRefId,
        }).session(session),
      ]);

      if (debitDup || creditDup) {
        throw new AppError(
          `Transfer with reference_id '${reference_id}' already exists`,
          409
        );
      }

      // ── 4. Create debit leg (source account) ─────────────────────────────
      [debitTx] = await Transaction.create(
        [
          {
            account_id: from_account_id,
            type: 'debit',
            amount: numericAmount,
            description: description || `Transfer to ${to_account_id}`,
            reference_id: debitRefId,
          },
        ],
        { session }
      );

      // ── 5. Create credit leg (destination account) ────────────────────────
      [creditTx] = await Transaction.create(
        [
          {
            account_id: to_account_id,
            type: 'credit',
            amount: numericAmount,
            description: description || `Transfer from ${from_account_id}`,
            reference_id: creditRefId,
          },
        ],
        { session }
      );

      // ── 6. Update both balances atomically ────────────────────────────────
      await Promise.all([
        Account.findByIdAndUpdate(
          from_account_id,
          { $inc: { balance: -numericAmount } },
          { session }
        ),
        Account.findByIdAndUpdate(
          to_account_id,
          { $inc: { balance: numericAmount } },
          { session }
        ),
      ]);
    });

    // Re-fetch updated balances (outside the session is fine here)
    const [updatedFrom, updatedTo] = await Promise.all([
      Account.findById(from_account_id).lean(),
      Account.findById(to_account_id).lean(),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Transfer completed successfully',
      data: {
        reference_id,
        amount: numericAmount,
        from_account: {
          account_id: from_account_id,
          new_balance: updatedFrom.balance,
          transaction_id: debitTx._id,
        },
        to_account: {
          account_id: to_account_id,
          new_balance: updatedTo.balance,
          transaction_id: creditTx._id,
        },
      },
    });
  } catch (err) {
    next(err);
  } finally {
    session.endSession();
  }
};

module.exports = { transfer };
