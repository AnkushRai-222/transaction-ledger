'use strict';

const request = require('supertest');
const app = require('../../src/app');
const db = require('../helpers/db');

beforeAll(db.connect);
afterAll(db.disconnect);
beforeEach(db.clearCollections);

const ACCOUNTS_URL = '/api/v1/accounts';
const TRANSFER_URL = '/api/v1/transfers';

/** Create an account and return its data */
const createAccount = async (name) => {
  const res = await request(app).post(ACCOUNTS_URL).send({ name });
  expect(res.status).toBe(201);
  return res.body.data;
};

/** Seed an account with an initial credit */
const seedBalance = async (accountId, amount) => {
  const res = await request(app)
    .post(`${ACCOUNTS_URL}/${accountId}/transactions`)
    .send({ type: 'credit', amount, reference_id: `SEED-${Date.now()}-${Math.random()}` });
  expect(res.status).toBe(201);
};

/** GET the current balance of an account */
const getBalance = async (accountId) => {
  const res = await request(app).get(`${ACCOUNTS_URL}/${accountId}/balance`);
  expect(res.status).toBe(200);
  return res.body.data.balance;
};

/** POST a transfer */
const postTransfer = (payload) =>
  request(app).post(TRANSFER_URL).send(payload);

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/transfers — Money Transfer (Bonus)', () => {
  // ── Happy path ─────────────────────────────────────────────────────────────
  describe('Success (200)', () => {
    it('transfers money and returns updated balances for both accounts', async () => {
      const src = await createAccount('Alice');
      const dst = await createAccount('Bob');
      await seedBalance(src.id, 500);

      const res = await postTransfer({
        from_account_id: src.id,
        to_account_id: dst.id,
        amount: 150,
        reference_id: 'TXF-001',
        description: 'Rent split',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/completed/i);

      const { data } = res.body;
      expect(data.reference_id).toBe('TXF-001');
      expect(data.amount).toBe(150);
      expect(data.from_account.account_id).toBe(src.id);
      expect(data.from_account.new_balance).toBe(350);
      expect(data.to_account.account_id).toBe(dst.id);
      expect(data.to_account.new_balance).toBe(150);
    });

    it('actual DB balances reflect the transfer', async () => {
      const src = await createAccount('Carol');
      const dst = await createAccount('Dave');
      await seedBalance(src.id, 1000);

      await postTransfer({
        from_account_id: src.id,
        to_account_id: dst.id,
        amount: 400,
        reference_id: 'TXF-002',
      });

      expect(await getBalance(src.id)).toBe(600);
      expect(await getBalance(dst.id)).toBe(400);
    });

    it('creates two transaction records (debit on src, credit on dst)', async () => {
      const src = await createAccount('Eve');
      const dst = await createAccount('Frank');
      await seedBalance(src.id, 300);

      const transferRes = await postTransfer({
        from_account_id: src.id,
        to_account_id: dst.id,
        amount: 100,
        reference_id: 'TXF-003',
      });
      expect(transferRes.status).toBe(200);

      // Check debit on src
      const srcTxRes = await request(app).get(`${ACCOUNTS_URL}/${src.id}/transactions`);
      const srcTxs = srcTxRes.body.data.transactions;
      expect(srcTxs.some((t) => t.type === 'debit' && t.amount === 100)).toBe(true);

      // Check credit on dst
      const dstTxRes = await request(app).get(`${ACCOUNTS_URL}/${dst.id}/transactions`);
      const dstTxs = dstTxRes.body.data.transactions;
      expect(dstTxs.some((t) => t.type === 'credit' && t.amount === 100)).toBe(true);
    });

    it('transfer with amount exactly equal to source balance succeeds', async () => {
      const src = await createAccount('Grace');
      const dst = await createAccount('Hank');
      await seedBalance(src.id, 75);

      const res = await postTransfer({
        from_account_id: src.id,
        to_account_id: dst.id,
        amount: 75,
        reference_id: 'TXF-EXACT',
      });
      expect(res.status).toBe(200);
      expect(await getBalance(src.id)).toBe(0);
      expect(await getBalance(dst.id)).toBe(75);
    });

    it('description is optional', async () => {
      const src = await createAccount('Iris');
      const dst = await createAccount('Jack');
      await seedBalance(src.id, 100);

      const res = await postTransfer({
        from_account_id: src.id,
        to_account_id: dst.id,
        amount: 10,
        reference_id: 'TXF-NODESC',
      });
      expect(res.status).toBe(200);
    });
  });

  // ── Insufficient balance ───────────────────────────────────────────────────
  describe('Insufficient balance (422)', () => {
    it('returns 422 when source has insufficient balance', async () => {
      const src = await createAccount('Kim');
      const dst = await createAccount('Leo');
      await seedBalance(src.id, 100);

      const res = await postTransfer({
        from_account_id: src.id,
        to_account_id: dst.id,
        amount: 500,
        reference_id: 'TXF-FAIL',
      });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/insufficient/i);
    });

    it('balances are unchanged after a rejected transfer', async () => {
      const src = await createAccount('Mia');
      const dst = await createAccount('Nick');
      await seedBalance(src.id, 50);
      await seedBalance(dst.id, 200);

      await postTransfer({
        from_account_id: src.id,
        to_account_id: dst.id,
        amount: 999,
        reference_id: 'TXF-ATOMIC',
      });

      expect(await getBalance(src.id)).toBe(50);
      expect(await getBalance(dst.id)).toBe(200);
    });

    it('returns 422 when source balance is 0', async () => {
      const src = await createAccount('Owen');
      const dst = await createAccount('Pam');

      const res = await postTransfer({
        from_account_id: src.id,
        to_account_id: dst.id,
        amount: 1,
        reference_id: 'TXF-ZERO',
      });
      expect(res.status).toBe(422);
    });
  });

  // ── Account not found ──────────────────────────────────────────────────────
  describe('Account not found (404)', () => {
    it('returns 404 when source account does not exist', async () => {
      const dst = await createAccount('Quinn');

      const res = await postTransfer({
        from_account_id: 'ghost-src',
        to_account_id: dst.id,
        amount: 100,
        reference_id: 'TXF-NOSRC',
      });
      expect(res.status).toBe(404);
    });

    it('returns 404 when destination account does not exist', async () => {
      const src = await createAccount('Rita');
      await seedBalance(src.id, 200);

      const res = await postTransfer({
        from_account_id: src.id,
        to_account_id: 'ghost-dst',
        amount: 100,
        reference_id: 'TXF-NODST',
      });
      expect(res.status).toBe(404);
    });
  });

  // ── Duplicate reference_id ─────────────────────────────────────────────────
  describe('Duplicate reference_id (409)', () => {
    it('returns 409 on a duplicate transfer reference_id', async () => {
      const src = await createAccount('Sam');
      const dst = await createAccount('Tina');
      await seedBalance(src.id, 1000);

      await postTransfer({
        from_account_id: src.id,
        to_account_id: dst.id,
        amount: 100,
        reference_id: 'TXF-DUP',
      });

      const dupRes = await postTransfer({
        from_account_id: src.id,
        to_account_id: dst.id,
        amount: 100,
        reference_id: 'TXF-DUP',
      });
      expect(dupRes.status).toBe(409);
    });

    it('duplicate transfer does NOT change balances a second time', async () => {
      const src = await createAccount('Uma');
      const dst = await createAccount('Vic');
      await seedBalance(src.id, 500);

      await postTransfer({
        from_account_id: src.id,
        to_account_id: dst.id,
        amount: 200,
        reference_id: 'TXF-ONCE',
      });
      // attempt duplicate
      await postTransfer({
        from_account_id: src.id,
        to_account_id: dst.id,
        amount: 200,
        reference_id: 'TXF-ONCE',
      });

      expect(await getBalance(src.id)).toBe(300);
      expect(await getBalance(dst.id)).toBe(200);
    });
  });

  // ── Validation errors ──────────────────────────────────────────────────────
  describe('Validation errors (422)', () => {
    let src, dst;
    beforeEach(async () => {
      src = await createAccount('Wendy');
      dst = await createAccount('Xena');
      await seedBalance(src.id, 300);
    });

    it('returns 422 when from_account_id is missing', async () => {
      const res = await postTransfer({
        to_account_id: dst.id,
        amount: 50,
        reference_id: 'TXF-V1',
      });
      expect(res.status).toBe(422);
      expect(res.body.errors.some((e) => e.field === 'from_account_id')).toBe(true);
    });

    it('returns 422 when to_account_id is missing', async () => {
      const res = await postTransfer({
        from_account_id: src.id,
        amount: 50,
        reference_id: 'TXF-V2',
      });
      expect(res.status).toBe(422);
      expect(res.body.errors.some((e) => e.field === 'to_account_id')).toBe(true);
    });

    it('returns 422 when from and to accounts are the same', async () => {
      const res = await postTransfer({
        from_account_id: src.id,
        to_account_id: src.id,
        amount: 50,
        reference_id: 'TXF-SELF',
      });
      expect(res.status).toBe(422);
    });

    it('returns 422 when amount is missing', async () => {
      const res = await postTransfer({
        from_account_id: src.id,
        to_account_id: dst.id,
        reference_id: 'TXF-V3',
      });
      expect(res.status).toBe(422);
    });

    it('returns 422 when amount is 0', async () => {
      const res = await postTransfer({
        from_account_id: src.id,
        to_account_id: dst.id,
        amount: 0,
        reference_id: 'TXF-V4',
      });
      expect(res.status).toBe(422);
    });

    it('returns 422 when amount is negative', async () => {
      const res = await postTransfer({
        from_account_id: src.id,
        to_account_id: dst.id,
        amount: -100,
        reference_id: 'TXF-V5',
      });
      expect(res.status).toBe(422);
    });

    it('returns 422 when reference_id is missing', async () => {
      const res = await postTransfer({
        from_account_id: src.id,
        to_account_id: dst.id,
        amount: 50,
      });
      expect(res.status).toBe(422);
      expect(res.body.errors.some((e) => e.field === 'reference_id')).toBe(true);
    });
  });
});
