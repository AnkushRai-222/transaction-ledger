'use strict';

const request = require('supertest');
const app = require('../../src/app');
const db = require('../helpers/db');

beforeAll(db.connect);
afterAll(db.disconnect);
beforeEach(db.clearCollections);

const ACCOUNTS_URL = '/api/v1/accounts';

/** Create an account, assert success, return data */
const createAccount = async (name = 'Test User') => {
  const res = await request(app).post(ACCOUNTS_URL).send({ name });
  expect(res.status).toBe(201);
  return res.body.data;
};

/** POST a transaction to an account */
const postTx = (accountId, payload) =>
  request(app)
    .post(`${ACCOUNTS_URL}/${accountId}/transactions`)
    .send(payload);

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/accounts/:accountId/transactions — Add Transaction', () => {
  // ── Credit ─────────────────────────────────────────────────────────────────
  describe('Credit transactions', () => {
    it('creates a credit and returns 201 with correct shape', async () => {
      const account = await createAccount('Ivy');
      const res = await postTx(account.id, {
        type: 'credit',
        amount: 500,
        reference_id: 'INV-001',
        description: 'Invoice payment',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        account_id: account.id,
        type: 'credit',
        amount: 500,
        reference_id: 'INV-001',
        description: 'Invoice payment',
      });
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.created_at).toBeDefined();
    });

    it('increases the account balance by the credit amount', async () => {
      const account = await createAccount('Jake');
      await postTx(account.id, { type: 'credit', amount: 300, reference_id: 'R1' });

      const balRes = await request(app).get(`${ACCOUNTS_URL}/${account.id}/balance`);
      expect(balRes.body.data.balance).toBe(300);
    });

    it('accumulates multiple credits correctly', async () => {
      const account = await createAccount('Kim');
      await postTx(account.id, { type: 'credit', amount: 100, reference_id: 'R1' });
      await postTx(account.id, { type: 'credit', amount: 200, reference_id: 'R2' });
      await postTx(account.id, { type: 'credit', amount: 50, reference_id: 'R3' });

      const balRes = await request(app).get(`${ACCOUNTS_URL}/${account.id}/balance`);
      expect(balRes.body.data.balance).toBe(350);
    });

    it('description is optional and defaults to empty string', async () => {
      const account = await createAccount('Liam');
      const res = await postTx(account.id, {
        type: 'credit',
        amount: 10,
        reference_id: 'R1',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.description).toBe('');
    });

    it('accepts decimal amounts', async () => {
      const account = await createAccount('Mia');
      const res = await postTx(account.id, {
        type: 'credit',
        amount: 99.99,
        reference_id: 'R1',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.amount).toBe(99.99);
    });
  });

  // ── Debit ──────────────────────────────────────────────────────────────────
  describe('Debit transactions', () => {
    it('creates a debit and decreases balance', async () => {
      const account = await createAccount('Noah');
      await postTx(account.id, { type: 'credit', amount: 200, reference_id: 'R1' });

      const res = await postTx(account.id, {
        type: 'debit',
        amount: 80,
        reference_id: 'R2',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe('debit');

      const balRes = await request(app).get(`${ACCOUNTS_URL}/${account.id}/balance`);
      expect(balRes.body.data.balance).toBe(120);
    });

    it('allows debit that exactly empties the balance', async () => {
      const account = await createAccount('Olivia');
      await postTx(account.id, { type: 'credit', amount: 100, reference_id: 'R1' });

      const res = await postTx(account.id, {
        type: 'debit',
        amount: 100,
        reference_id: 'R2',
      });
      expect(res.status).toBe(201);

      const balRes = await request(app).get(`${ACCOUNTS_URL}/${account.id}/balance`);
      expect(balRes.body.data.balance).toBe(0);
    });

    it('rejects debit with insufficient balance (422)', async () => {
      const account = await createAccount('Pete');
      await postTx(account.id, { type: 'credit', amount: 100, reference_id: 'R1' });

      const res = await postTx(account.id, {
        type: 'debit',
        amount: 150,
        reference_id: 'R2',
      });
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/insufficient/i);
    });

    it('rejected debit does NOT change the account balance', async () => {
      const account = await createAccount('Quinn');
      await postTx(account.id, { type: 'credit', amount: 50, reference_id: 'R1' });
      await postTx(account.id, { type: 'debit', amount: 200, reference_id: 'R2' }); // rejected

      const balRes = await request(app).get(`${ACCOUNTS_URL}/${account.id}/balance`);
      expect(balRes.body.data.balance).toBe(50);
    });

    it('rejects debit when balance is 0', async () => {
      const account = await createAccount('Rita');
      const res = await postTx(account.id, {
        type: 'debit',
        amount: 1,
        reference_id: 'R1',
      });
      expect(res.status).toBe(422);
    });
  });

  // ── Duplicate reference_id ─────────────────────────────────────────────────
  describe('Duplicate reference_id handling', () => {
    it('returns 409 when reference_id is reused for the same account', async () => {
      const account = await createAccount('Sam');
      await postTx(account.id, { type: 'credit', amount: 100, reference_id: 'DUP-REF' });

      const dupRes = await postTx(account.id, {
        type: 'credit',
        amount: 50,
        reference_id: 'DUP-REF',
      });
      expect(dupRes.status).toBe(409);
      expect(dupRes.body.success).toBe(false);
      expect(dupRes.body.message).toMatch(/already exists/i);
    });

    it('duplicate reference_id does NOT create a new transaction', async () => {
      const account = await createAccount('Tara');
      await postTx(account.id, { type: 'credit', amount: 100, reference_id: 'DUP-REF' });
      await postTx(account.id, { type: 'credit', amount: 50, reference_id: 'DUP-REF' }); // rejected

      // Balance should still be 100 (only one transaction succeeded)
      const balRes = await request(app).get(`${ACCOUNTS_URL}/${account.id}/balance`);
      expect(balRes.body.data.balance).toBe(100);
    });

    it('allows the same reference_id on a DIFFERENT account', async () => {
      const acc1 = await createAccount('Uma');
      const acc2 = await createAccount('Victor');

      const r1 = await postTx(acc1.id, { type: 'credit', amount: 100, reference_id: 'SHARED-REF' });
      const r2 = await postTx(acc2.id, { type: 'credit', amount: 200, reference_id: 'SHARED-REF' });

      expect(r1.status).toBe(201);
      expect(r2.status).toBe(201);
    });
  });

  // ── Validation errors ──────────────────────────────────────────────────────
  describe('Validation errors (422)', () => {
    let accountId;
    beforeEach(async () => {
      const account = await createAccount('Wanda');
      accountId = account.id;
    });

    it('returns 422 if type is missing', async () => {
      const res = await postTx(accountId, { amount: 100, reference_id: 'R1' });
      expect(res.status).toBe(422);
      expect(res.body.errors.some((e) => e.field === 'type')).toBe(true);
    });

    it('returns 422 if type is invalid (not credit/debit)', async () => {
      const res = await postTx(accountId, {
        type: 'transfer',
        amount: 100,
        reference_id: 'R1',
      });
      expect(res.status).toBe(422);
    });

    it('returns 422 if amount is missing', async () => {
      const res = await postTx(accountId, { type: 'credit', reference_id: 'R1' });
      expect(res.status).toBe(422);
      expect(res.body.errors.some((e) => e.field === 'amount')).toBe(true);
    });

    it('returns 422 if amount is 0', async () => {
      const res = await postTx(accountId, {
        type: 'credit',
        amount: 0,
        reference_id: 'R1',
      });
      expect(res.status).toBe(422);
    });

    it('returns 422 if amount is negative', async () => {
      const res = await postTx(accountId, {
        type: 'credit',
        amount: -50,
        reference_id: 'R1',
      });
      expect(res.status).toBe(422);
    });

    it('returns 422 if amount is a non-numeric string', async () => {
      const res = await postTx(accountId, {
        type: 'credit',
        amount: 'abc',
        reference_id: 'R1',
      });
      expect(res.status).toBe(422);
    });

    it('returns 422 if reference_id is missing', async () => {
      const res = await postTx(accountId, { type: 'credit', amount: 100 });
      expect(res.status).toBe(422);
      expect(res.body.errors.some((e) => e.field === 'reference_id')).toBe(true);
    });

    it('returns 422 if reference_id is empty string', async () => {
      const res = await postTx(accountId, {
        type: 'credit',
        amount: 100,
        reference_id: '',
      });
      expect(res.status).toBe(422);
    });
  });

  // ── Account not found ──────────────────────────────────────────────────────
  describe('Account not found', () => {
    it('returns 404 when accountId does not exist', async () => {
      const res = await postTx('does-not-exist', {
        type: 'credit',
        amount: 100,
        reference_id: 'R1',
      });
      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });
  });
});
