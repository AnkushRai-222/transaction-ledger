'use strict';

const request = require('supertest');
const app = require('../../src/app');
const db = require('../helpers/db');

beforeAll(db.connect);
afterAll(db.disconnect);
beforeEach(db.clearCollections);

const ACCOUNTS_URL = '/api/v1/accounts';

/** Create an account and return its data */
const createAccount = async (name = 'Test User') => {
  const res = await request(app).post(ACCOUNTS_URL).send({ name });
  expect(res.status).toBe(201);
  return res.body.data;
};

/** POST a transaction */
const postTx = (accountId, payload) =>
  request(app)
    .post(`${ACCOUNTS_URL}/${accountId}/transactions`)
    .send(payload);

/** GET transactions list */
const getTx = (accountId, query = '') =>
  request(app).get(`${ACCOUNTS_URL}/${accountId}/transactions${query}`);

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/v1/accounts/:accountId/transactions — Transaction History', () => {
  let account;

  // Seed 5 transactions before each test:
  // credit 100, credit 200, debit 50, credit 75, debit 25
  beforeEach(async () => {
    account = await createAccount('Xavier');
    await postTx(account.id, { type: 'credit', amount: 100, reference_id: 'R1', description: 'Salary' });
    await postTx(account.id, { type: 'credit', amount: 200, reference_id: 'R2', description: 'Bonus' });
    await postTx(account.id, { type: 'debit',  amount: 50,  reference_id: 'R3', description: 'Rent' });
    await postTx(account.id, { type: 'credit', amount: 75,  reference_id: 'R4', description: 'Freelance' });
    await postTx(account.id, { type: 'debit',  amount: 25,  reference_id: 'R5', description: 'Coffee' });
  });

  // ── Response shape ─────────────────────────────────────────────────────────
  describe('Response shape', () => {
    it('returns 200 with transactions and pagination metadata', async () => {
      const res = await getTx(account.id);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transactions).toBeInstanceOf(Array);

      const { pagination } = res.body.data;
      expect(pagination).toMatchObject({
        total_records: 5,
        total_pages: 1,
        current_page: 1,
        page_size: 10,
      });
    });

    it('each transaction has all required fields', async () => {
      const res = await getTx(account.id);
      const tx = res.body.data.transactions[0];

      expect(tx).toHaveProperty('id');
      expect(tx).toHaveProperty('account_id', account.id);
      expect(tx).toHaveProperty('type');
      expect(tx).toHaveProperty('amount');
      expect(tx).toHaveProperty('description');
      expect(tx).toHaveProperty('reference_id');
      expect(tx).toHaveProperty('created_at');
    });
  });

  // ── Sorting ────────────────────────────────────────────────────────────────
  describe('Sorting (latest first)', () => {
    it('returns transactions in descending created_at order', async () => {
      const res = await getTx(account.id);
      const txs = res.body.data.transactions;

      const dates = txs.map((t) => new Date(t.created_at).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });

    it('the most recent transaction appears first', async () => {
      const res = await getTx(account.id);
      // R5 was the last one inserted
      expect(res.body.data.transactions[0].reference_id).toBe('R5');
    });
  });

  // ── Filtering ──────────────────────────────────────────────────────────────
  describe('Filtering by type', () => {
    it('filters to only credit transactions', async () => {
      const res = await getTx(account.id, '?type=credit');
      expect(res.status).toBe(200);
      const txs = res.body.data.transactions;
      expect(txs.length).toBe(3);
      txs.forEach((t) => expect(t.type).toBe('credit'));
    });

    it('filters to only debit transactions', async () => {
      const res = await getTx(account.id, '?type=debit');
      expect(res.status).toBe(200);
      const txs = res.body.data.transactions;
      expect(txs.length).toBe(2);
      txs.forEach((t) => expect(t.type).toBe('debit'));
    });

    it('returns all transactions when no type filter is given', async () => {
      const res = await getTx(account.id);
      expect(res.body.data.transactions.length).toBe(5);
    });

    it('returns empty array (not error) when filter matches nothing', async () => {
      // Create fresh account with only credits
      const acc = await createAccount('Yara');
      await postTx(acc.id, { type: 'credit', amount: 10, reference_id: 'X1' });

      const res = await getTx(acc.id, '?type=debit');
      expect(res.status).toBe(200);
      expect(res.body.data.transactions).toHaveLength(0);
      expect(res.body.data.pagination.total_records).toBe(0);
    });
  });

  // ── Pagination ─────────────────────────────────────────────────────────────
  describe('Pagination', () => {
    it('respects the limit query param', async () => {
      const res = await getTx(account.id, '?limit=2');
      expect(res.status).toBe(200);
      expect(res.body.data.transactions.length).toBe(2);
      expect(res.body.data.pagination).toMatchObject({
        total_records: 5,
        total_pages: 3,
        current_page: 1,
        page_size: 2,
      });
    });

    it('returns the correct page of results', async () => {
      const res = await getTx(account.id, '?limit=2&page=2');
      expect(res.status).toBe(200);
      expect(res.body.data.transactions.length).toBe(2);
      expect(res.body.data.pagination.current_page).toBe(2);
    });

    it('returns the last page correctly (may have fewer items)', async () => {
      const res = await getTx(account.id, '?limit=2&page=3');
      expect(res.status).toBe(200);
      expect(res.body.data.transactions.length).toBe(1);
      expect(res.body.data.pagination.current_page).toBe(3);
    });

    it('defaults to page=1 and limit=10', async () => {
      const res = await getTx(account.id);
      expect(res.body.data.pagination.current_page).toBe(1);
      expect(res.body.data.pagination.page_size).toBe(10);
    });

    it('returns empty array on page beyond total pages', async () => {
      const res = await getTx(account.id, '?page=999');
      expect(res.status).toBe(200);
      expect(res.body.data.transactions).toHaveLength(0);
    });
  });

  // ── Pagination + Filter combined ───────────────────────────────────────────
  describe('Combined filter + pagination', () => {
    it('paginates filtered results correctly', async () => {
      const res = await getTx(account.id, '?type=credit&limit=2&page=1');
      expect(res.status).toBe(200);
      expect(res.body.data.transactions.length).toBe(2);
      res.body.data.transactions.forEach((t) => expect(t.type).toBe('credit'));
      expect(res.body.data.pagination.total_records).toBe(3);
      expect(res.body.data.pagination.total_pages).toBe(2);
    });
  });

  // ── Validation errors ──────────────────────────────────────────────────────
  describe('Validation errors', () => {
    it('returns 422 for an invalid type filter', async () => {
      const res = await getTx(account.id, '?type=invalid');
      expect(res.status).toBe(422);
    });

    it('returns 422 for page=0', async () => {
      const res = await getTx(account.id, '?page=0');
      expect(res.status).toBe(422);
    });

    it('returns 422 for limit=0', async () => {
      const res = await getTx(account.id, '?limit=0');
      expect(res.status).toBe(422);
    });

    it('returns 422 for limit > 100', async () => {
      const res = await getTx(account.id, '?limit=101');
      expect(res.status).toBe(422);
    });
  });

  // ── Account not found ──────────────────────────────────────────────────────
  describe('Account not found', () => {
    it('returns 404 for a non-existent account', async () => {
      const res = await getTx('ghost-account-id');
      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });
  });

  // ── Isolation ─────────────────────────────────────────────────────────────
  describe('Account isolation', () => {
    it('only returns transactions belonging to the requested account', async () => {
      const other = await createAccount('Zelda');
      await postTx(other.id, { type: 'credit', amount: 999, reference_id: 'Z1' });

      const res = await getTx(account.id);
      // Xavier's account should still have exactly 5 transactions
      expect(res.body.data.pagination.total_records).toBe(5);
      res.body.data.transactions.forEach((t) =>
        expect(t.account_id).toBe(account.id)
      );
    });
  });
});
