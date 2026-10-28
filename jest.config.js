'use strict';

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',

  // Discover only files in tests/ matching *.test.js
  testMatch: ['**/tests/**/*.test.js'],

  // Run suites serially — required because all suites share one
  // MongoMemoryReplSet instance (started in tests/helpers/db.js)
  // and --runInBand is also passed via the npm script.
  maxWorkers: 1,

  // MongoMemoryReplSet can take >5 s to spin up on the first suite
  testTimeout: 30000,

  // Ensure the process exits even if an open Mongoose connection lingers
  forceExit: true,

  // Show each test name in output
  verbose: true,

  // Show a coverage summary when running npm run test:coverage
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js'],
};
