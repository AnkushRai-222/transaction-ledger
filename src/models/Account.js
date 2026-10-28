'use strict';

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

/**
 * Account Schema
 *
 * Stores account holder information and the current running balance.
 * The balance is kept as a derived field — updated atomically with each
 * valid transaction — so reads are O(1) without needing to sum transactions.
 */
const accountSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    name: {
      type: String,
      required: [true, 'Account holder name is required'],
      trim: true,
      minlength: [1, 'Name cannot be empty'],
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, 'Balance cannot be negative'],
    },
  },
  {
    // Use _id as "id" in JSON responses; suppress __v
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

module.exports = mongoose.model('Account', accountSchema);
