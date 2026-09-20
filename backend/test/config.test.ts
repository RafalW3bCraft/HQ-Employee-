import { describe, it } from 'node:test';
import assert from 'node:assert';
import { loadConfig } from '../src/config/index.js';

describe('Configuration Module Validation', () => {
  it('loads valid configuration with defaults', () => {
    const customEnv = {
      PORT: '4000',
      HOST: '127.0.0.1',
      NODE_ENV: 'test',
      LOG_LEVEL: 'warn',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
      ASSEMBLYAI_API_KEY: 'test_assembly_key',
    };

    const cfg = loadConfig(customEnv);
    assert.strictEqual(cfg.PORT, 4000);
    assert.strictEqual(cfg.HOST, '127.0.0.1');
    assert.strictEqual(cfg.NODE_ENV, 'test');
    assert.strictEqual(cfg.LOG_LEVEL, 'warn');
    assert.strictEqual(cfg.ASSEMBLYAI_API_KEY, 'test_assembly_key');
  });

  it('fails validation on invalid DATABASE_URL', () => {
    const invalidEnv = {
      DATABASE_URL: 'not-a-url',
    };

    assert.throws(() => {
      loadConfig(invalidEnv);
    }, /Invalid application configuration/);
  });

  it('fails validation on invalid LOG_LEVEL', () => {
    const invalidEnv = {
      LOG_LEVEL: 'super-verbose',
    };

    assert.throws(() => {
      loadConfig(invalidEnv);
    }, /Invalid application configuration/);
  });
});
