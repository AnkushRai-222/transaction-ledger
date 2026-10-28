'use strict';

const request = require('supertest');
const app = require('../../src/app');
const db = require('../helpers/db');

beforeAll(db.connect);
afterAll(db.disconnect);
beforeEach(db.clearCollections);

const ACCOUNTS_URL = '/api/v1/accounts';

/** Helper: create an account and return its id */
const createAccount = async (name = 'Test User') => {
  const res = await request(app).post(ACCOUNTS_URL).send({ name });
  expect(res.status).toBe(201);
  return res.body.data;
};

/** Helper: post a credit transaction */
const credit = (accountId, amount, refId) =>
  request(app)
    .post(`${ACCOUNTS_URL}/${accountId}/transactions`)
    .send({ type: 'credit', amount, reference_id: refId });

/** Helper: post a debit transaction */
const debit = (accountId, amount, refId) =>
  request(app)
    .post(`${ACCOUNTS_URL}/${accountId}/transactions`)
    .send({ type: 'debit', amount, reference_id: refId });

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/v1/accounts/:accountId/balance — Get Balance', () => {
  // ── Happy paths ────────────────────────────────────────────────────────────
  describe('Success (200)', () => {
    it('returns balance of 0 for a newly created account', async () => {
      const account = await createAccount('Eve');
      const res = await request(app).get(
        `${ACCOUNTS_URL}/${account.id}/balance`
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        account_id: account.id,
        name: 'Eve',
        balance: 0,
      });
    });

    it('reflects a credit transaction in the balance', async () => {
      const account = await createAccount('Frank');
      await credit(account.id, 250, 'REF-001');

      const res = await request(app).get(
        `${ACCOUNTS_URL}/${account.id}/balance`
      );
      expect(res.status).toBe(200);
      expect(res.body.data.balance).toBe(250);
    });

    it('reflects both credit and debit transactions correctly', async () => {
      const account = await createAccount('Grace');
      // +100 +50 -30 -20 → final 100
      await credit(account.id, 100, 'REF-C1');
      await credit(account.id, 50, 'REF-C2');
      await debit(account.id, 30, 'REF-D1');
      await debit(account.id, 20, 'REF-D2');

      const res = await request(app).get(
        `${ACCOUNTS_URL}/${account.id}/balance`
      );
      expect(res.status).toBe(200);
      expect(res.body.data.balance).toBe(100);
    });

    it('balance is not affected by a rejected debit (insufficient funds)', async () => {
      const account = await createAccount('Hank');
      await credit(account.id, 50, 'REF-SEED');
      // try to debit more than balance
      const rejectRes = await debit(account.id, 200, 'REF-BAD');
      expect(rejectRes.status).toBe(422);

      const balRes = await request(app).get(
        `${ACCOUNTS_URL}/${account.id}/balance`
      );
      expect(balRes.body.data.balance).toBe(50);
    });
  });

  // ── Error paths ────────────────────────────────────────────────────────────
  describe('Error cases', () => {
    it('returns 404 for a non-existent account id', async () => {
      const res = await request(app).get(
        `${ACCOUNTS_URL}/non-existent-id-xyz/balance`
      );
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });
  });
});
