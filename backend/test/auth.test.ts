/**
 * Authentication & Authorization Tests
 *
 * Verifies:
 * 1. POST /api/auth/dev-token issues a valid JWT
 * 2. GET /api/auth/me returns 401 without token
 * 3. GET /api/auth/me returns user info with valid token
 * 4. Protected routes return 401 without token (spot-check)
 * 5. JWT tampering is rejected
 * 6. Dev tokens are blocked in production
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { loadConfig } from '../src/config/index.js';

describe('Authentication & Authorization', async () => {
  let server: Awaited<ReturnType<typeof createServer>>;
  let devToken: string;

  const testCompanyId = 'c0000000-0000-0000-0000-000000000001';

  before(async () => {
    const config = loadConfig({
      PORT: '3099',
      HOST: '127.0.0.1',
      NODE_ENV: 'test',
      LOG_LEVEL: 'warn',
      DATABASE_URL: 'postgresql://localhost/test',
      ASSEMBLYAI_API_KEY: 'test_key_does_not_matter',
      ALLOWED_ORIGINS: '*',
      RATE_LIMIT_GLOBAL: '1000',
      RATE_LIMIT_VOICE_TOKEN: '1000',
      RATE_LIMIT_TELEPHONY: '1000',
    });
    server = await createServer(config);
    await server.ready();
  });

  after(async () => {
    await server.close();
  });

  // ── Token Issuance ─────────────────────────────────────────────────────────

  it('POST /api/auth/dev-token issues a valid JWT', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/auth/dev-token',
      payload: { companyId: testCompanyId },
    });

    assert.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);

    const body = JSON.parse(res.body);
    assert.ok(body.token, 'Response must include token');
    assert.equal(body.companyId, testCompanyId, 'Token must be scoped to the requested company');
    assert.equal(body.role, 'admin', 'Dev tokens should have admin role');
    assert.ok(body.warning?.toLowerCase().includes('dev'), 'Must include dev warning');

    devToken = body.token;
  });

  // ── Protected Route 401 ───────────────────────────────────────────────────

  it('GET /api/auth/me returns 401 without Authorization header', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/auth/me',
    });
    assert.equal(res.statusCode, 401, `Expected 401, got ${res.statusCode}`);

    const body = JSON.parse(res.body);
    const errorCode = typeof body.error === 'string' ? body.error : body.error?.code;
    assert.equal(errorCode, 'UNAUTHORIZED');
  });

  it('GET /api/auth/me returns 401 with malformed token', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { Authorization: 'Bearer this_is_not_a_valid_jwt' },
    });
    assert.equal(res.statusCode, 401, `Expected 401, got ${res.statusCode}`);
  });

  it('GET /api/auth/me returns user info with valid dev token', async () => {
    if (!devToken) {
      assert.fail('devToken not obtained from previous test');
    }

    const res = await server.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { Authorization: `Bearer ${devToken}` },
    });

    assert.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);

    const body = JSON.parse(res.body);
    assert.ok(body.user, 'Response must include user');
    assert.equal(body.user.companyId, testCompanyId);
    assert.equal(body.user.role, 'admin');
  });

  // ── JWT Tampering ─────────────────────────────────────────────────────────

  it('rejects JWT with tampered payload', async () => {
    if (!devToken) {
      assert.fail('devToken not obtained from previous test');
    }

    // Tamper with the payload by modifying the base64 middle section
    const parts = devToken.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    payload.companyId = 'attacker-company';
    payload.role = 'system';
    parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const tamperedToken = parts.join('.');

    const res = await server.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { Authorization: `Bearer ${tamperedToken}` },
    });

    assert.equal(res.statusCode, 401, 'Tampered JWT must be rejected');
  });

  // ── Dev Token Production Block ────────────────────────────────────────────

  it('POST /api/auth/dev-token returns 403 in production mode', async () => {
    // Temporarily set NODE_ENV to production in the process env
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const res = await server.inject({
        method: 'POST',
        url: '/api/auth/dev-token',
        payload: { companyId: testCompanyId },
      });

      assert.equal(res.statusCode, 403, `Expected 403 in production, got ${res.statusCode}`);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  // ── Root & Health Routes (should not require auth) ───────────────────────

  it('GET / returns 200 without authentication', async () => {
    const res = await server.inject({ method: 'GET', url: '/' });
    assert.equal(res.statusCode, 200);
  });

  it('GET /health returns 200 without authentication', async () => {
    const res = await server.inject({ method: 'GET', url: '/health' });
    assert.equal(res.statusCode, 200);
  });
});
