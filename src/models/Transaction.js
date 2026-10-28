'use strict';

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

/**
 * Transaction Schema
 *
 * Each document is immutable after creation — no update or delete paths
 * are exposed by the API, and the schema is designed to make accidental
 * mutations obvious.
 *
 * Uniqueness of reference_id is scoped per account via a compound index.
 */
const transactionSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    account_id: {
      type: String,
      required: [true, 'account_id is required'],
      ref: 'Account',
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: ['credit', 'debit'],
        message: "type must be 'credit' or 'debit'",
      },
      required: [true, 'Transaction type is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    reference_id: {
      type: String,
      required: [true, 'reference_id is required'],
      trim: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

/**
 * Compound unique index: reference_id must be unique per account.
 * The same reference_id is allowed across different accounts.
 */
transactionSchema.index({ account_id: 1, reference_id: 1 }, { unique: true });

module.exports = mongoose.model('Transaction', transactionSchema);
