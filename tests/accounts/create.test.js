'use strict';

const request = require('supertest');
const app = require('../../src/app');
const db = require('../helpers/db');

beforeAll(db.connect);
afterAll(db.disconnect);
beforeEach(db.clearCollections);

const URL = '/api/v1/accounts';

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/accounts — Create Account', () => {
  // ── Happy paths ────────────────────────────────────────────────────────────
  describe('Success (201)', () => {
    it('creates an account and returns 201 with correct shape', async () => {
      const res = await request(app)
        .post(URL)
        .send({ name: 'Alice Johnson' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/created/i);

      const { data } = res.body;
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Alice Johnson');
      expect(data.balance).toBe(0);
      expect(data.created_at).toBeDefined();
      // ensure _id is not exposed
      expect(data._id).toBeUndefined();
    });

    it('always initialises balance to 0', async () => {
      const res = await request(app).post(URL).send({ name: 'Bob Smith' });
      expect(res.status).toBe(201);
      expect(res.body.data.balance).toBe(0);
    });

    it('trims whitespace from name', async () => {
      const res = await request(app)
        .post(URL)
        .send({ name: '  Charlie  ' });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Charlie');
    });

    it('generates a unique id for each account', async () => {
      const [r1, r2] = await Promise.all([
        request(app).post(URL).send({ name: 'Acc A' }),
        request(app).post(URL).send({ name: 'Acc B' }),
      ]);
      expect(r1.body.data.id).not.toBe(r2.body.data.id);
    });

    it('accepts a name with special characters', async () => {
      const res = await request(app)
        .post(URL)
        .send({ name: "O'Brien-García" });
      expect(res.status).toBe(201);
    });
  });

  // ── Validation failures ────────────────────────────────────────────────────
  describe('Validation errors (422)', () => {
    it('returns 422 when name is missing', async () => {
      const res = await request(app).post(URL).send({});
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeInstanceOf(Array);
      expect(res.body.errors.some((e) => e.field === 'name')).toBe(true);
    });

    it('returns 422 when name is an empty string', async () => {
      const res = await request(app).post(URL).send({ name: '' });
      expect(res.status).toBe(422);
      expect(res.body.errors.some((e) => e.field === 'name')).toBe(true);
    });

    it('returns 422 when name is only whitespace', async () => {
      const res = await request(app).post(URL).send({ name: '   ' });
      expect(res.status).toBe(422);
    });

    it('returns 422 when client sends a balance field', async () => {
      const res = await request(app)
        .post(URL)
        .send({ name: 'Dave', balance: 5000 });
      expect(res.status).toBe(422);
      expect(res.body.errors.some((e) => e.field === 'balance')).toBe(true);
    });

    it('returns 422 when no body is sent', async () => {
      const res = await request(app)
        .post(URL)
        .set('Content-Type', 'application/json')
        .send('{}');
      // empty JSON object — name is missing
      expect(res.status).toBe(422);
    });
  });
});
