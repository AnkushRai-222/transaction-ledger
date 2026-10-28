'use strict';

require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const connectDB = require('./config/db');
const accountRoutes = require('./routes/accountRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const transferRoutes = require('./routes/transferRoutes');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() })
);

// ── API Routes ──────────────────────────────────────────────────────────────
const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/accounts`, accountRoutes);
app.use(`${API_PREFIX}/accounts/:accountId/transactions`, transactionRoutes);
app.use(`${API_PREFIX}/transfers`, transferRoutes);

// ── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) =>
  res
    .status(404)
    .json({ success: false, message: 'Route not found' })
);

// ── Global error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[SERVER] Transaction Ledger API running on http://localhost:${PORT}`);
    console.log(`[SERVER] Health check → http://localhost:${PORT}/health`);
    console.log(`[SERVER] API base     → http://localhost:${PORT}${API_PREFIX}`);
  });
};

// Only connect + listen when this file is run directly (not when imported by tests)
if (require.main === module) {
  start();
}

module.exports = app; // exported for testing
