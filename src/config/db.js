'use strict';

const mongoose = require('mongoose');

/**
 * Establishes a connection to MongoDB.
 * Exits the process on failure so misconfiguration surfaces immediately.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('[DB] MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      // Mongoose 8 uses these defaults; listed explicitly for clarity
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[DB] Connected to MongoDB: ${mongoose.connection.host}`);
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
