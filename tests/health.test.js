'use strict';

const request = require('supertest');
const app = require('../src/app');
const db = require('./helpers/db');

beforeAll(db.connect);
afterAll(db.disconnect);

// ─────────────────────────────────────────────────────────────────────────────
describe('Health check and generic routes', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, status: 'ok' });
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/route not found/i);
  });
});
