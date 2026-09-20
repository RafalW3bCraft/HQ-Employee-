import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';
import { loadConfig } from '../src/config/index.js';
import { PolicyDeniedError, ValidationError } from '../src/errors/index.js';

describe('Structured Error Handling', () => {
  let server: FastifyInstance;

  before(async () => {
    const testConfig = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'fatal',
      ASSEMBLYAI_API_KEY: 'test_key',
    });
    server = await createServer(testConfig);

    // Test routes throwing custom errors
    server.get('/test/policy-denial', async () => {
      throw new PolicyDeniedError('sign_contract', 'AI employee has no contract authority');
    });

    server.get('/test/validation-error', async () => {
      throw new ValidationError('Lead name is required', { field: 'fullName' });
    });

    await server.ready();
  });

  after(async () => {
    await server.close();
  });

  it('handles 404 with structured error schema', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/non-existent-endpoint',
    });

    assert.strictEqual(response.statusCode, 404);
    const body = JSON.parse(response.payload);
    assert.ok(body.error);
    assert.strictEqual(body.error.code, 'ROUTE_NOT_FOUND');
    assert.ok(body.error.message.includes('/non-existent-endpoint'));
    assert.ok(body.error.requestId);
    assert.ok(body.error.timestamp);
  });

  it('formats PolicyDeniedError as 403 with details', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/test/policy-denial',
    });

    assert.strictEqual(response.statusCode, 403);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.error.code, 'POLICY_DENIED');
    assert.strictEqual(body.error.details.action, 'sign_contract');
  });

  it('formats ValidationError as 400 with details', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/test/validation-error',
    });

    assert.strictEqual(response.statusCode, 400);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
    assert.strictEqual(body.error.details.field, 'fullName');
  });
});
