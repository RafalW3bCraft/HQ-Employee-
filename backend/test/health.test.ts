import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';
import { loadConfig } from '../src/config/index.js';

describe('Health Endpoint Integration', () => {
  let server: FastifyInstance;

  before(async () => {
    const testConfig = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'fatal',
      ASSEMBLYAI_API_KEY: 'test_key',
    });
    server = await createServer(testConfig);
    await server.ready();
  });

  after(async () => {
    await server.close();
  });

  it('GET /health returns HTTP 200 with service metadata and request ID', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health',
      headers: {
        'x-request-id': 'test-req-12345',
      },
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.status, 'ok');
    assert.strictEqual(body.service, 'hq-employee-api');
    assert.strictEqual(body.version, '0.1.0');
    assert.strictEqual(body.requestId, 'test-req-12345');
    assert.strictEqual(typeof body.uptime, 'number');
    assert.ok(body.timestamp);
  });

  it('GET / returns operational message', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/',
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.status, 'operational');
    assert.ok(body.requestId);
  });

  it('GET /health/live returns HTTP 200 with service metadata and uptime', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health/live',
      headers: {
        'x-request-id': 'live-check-001',
      },
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.status, 'ok');
    assert.strictEqual(body.service, 'hq-employee-api');
    assert.strictEqual(body.version, '0.1.0');
    assert.strictEqual(body.requestId, 'live-check-001');
    assert.strictEqual(typeof body.uptimeSeconds, 'number');
    assert.ok(body.timestamp);
  });

  it('GET /health/ready returns HTTP 200/503 structured status with checks', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health/ready',
    });

    // In test environment, ready returns structured response with checks object
    assert.ok([200, 503].includes(response.statusCode));
    const body = JSON.parse(response.payload);
    assert.ok(['ok', 'degraded'].includes(body.status));
    assert.strictEqual(body.service, 'hq-employee-api');
    assert.ok(body.checks);
    assert.ok(body.timestamp);
  });
});
