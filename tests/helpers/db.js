'use strict';

/**
 * Shared database helper for Jest tests.
 *
 * Uses MongoMemoryReplSet (single-node replica set) so that
 * Mongoose multi-document transactions (used in addTransaction and transfer)
 * work correctly without needing a real MongoDB instance.
 *
 * Usage inside a test file:
 *
 *   const db = require('../helpers/db');
 *   beforeAll(db.connect);
 *   afterAll(db.disconnect);
 *   beforeEach(db.clearCollections);
 */

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

/** @type {MongoMemoryReplSet | null} */
let replSet = null;

/**
 * Starts the in-memory replica set and connects Mongoose to it.
 * Call once per test suite in `beforeAll`.
 */
const connect = async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 }, // single-node RS is enough for transactions
  });
  const uri = replSet.getUri();
  await mongoose.connect(uri);
};

/**
 * Disconnects Mongoose and stops the in-memory replica set.
 * Call once per test suite in `afterAll`.
 */
const disconnect = async () => {
  await mongoose.disconnect();
  if (replSet) {
    await replSet.stop();
    replSet = null;
  }
};

/**
 * Wipes every collection without dropping the indexes.
 * Call in `beforeEach` so tests start with a clean slate.
 */
const clearCollections = async () => {
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((col) => col.deleteMany({}))
  );
};

module.exports = { connect, disconnect, clearCollections };
