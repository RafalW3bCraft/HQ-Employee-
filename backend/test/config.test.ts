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

  it('fails closed in production if JWT_SECRET is missing', () => {
    assert.throws(() => {
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://prod:secret@ep-cool-db.us-east-2.aws.neon.tech/neondb?sslmode=require',
        ASSEMBLYAI_API_KEY: 'real_production_key_abc123',
      });
    }, /JWT_SECRET is required in production/);
  });

  it('fails closed in production if ASSEMBLYAI_API_KEY uses dummy testing key', () => {
    assert.throws(() => {
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://prod:secret@ep-cool-db.us-east-2.aws.neon.tech/neondb?sslmode=require',
        ASSEMBLYAI_API_KEY: 'dummy_dev_key_for_testing',
        JWT_SECRET: 'super-secure-production-jwt-secret-key-32chars',
        ALLOWED_ORIGINS: 'https://hq.example.com',
      });
    }, /ASSEMBLYAI_API_KEY must be set to a real key in production/);
  });

  it('fails closed in production if DATABASE_URL points to localhost', () => {
    assert.throws(() => {
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        ASSEMBLYAI_API_KEY: 'real_production_key_abc123',
        JWT_SECRET: 'super-secure-production-jwt-secret-key-32chars',
        ALLOWED_ORIGINS: 'https://hq.example.com',
        AAI_WEBHOOK_SECRET: 'prod_telephony_secret_1234567890123',
      });
    }, /DATABASE_URL must not use localhost in production/);
  });

  it('fails closed in production if AAI_WEBHOOK_SECRET is missing', () => {
    assert.throws(() => {
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://prod:secret@ep-cool-db.us-east-2.aws.neon.tech/neondb?sslmode=require',
        ASSEMBLYAI_API_KEY: 'real_production_key_abc123',
        JWT_SECRET: 'super-secure-production-jwt-secret-key-32chars',
        ALLOWED_ORIGINS: 'https://hq.example.com',
      });
    }, /AAI_WEBHOOK_SECRET is required in production/);
  });

  it('succeeds in production when all production credentials and non-local database are supplied', () => {
    const prodCfg = loadConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://prod:secret@ep-cool-db.us-east-2.aws.neon.tech/neondb?sslmode=require',
      ASSEMBLYAI_API_KEY: 'real_production_key_abc123',
      JWT_SECRET: 'super-secure-production-jwt-secret-key-32chars',
      ALLOWED_ORIGINS: 'https://hq.example.com',
      AAI_WEBHOOK_SECRET: 'prod_telephony_secret_1234567890123',
      VOICE_MAX_SESSION_SECONDS: '360',
      VOICE_MAX_CONCURRENT: '5',
      VOICE_DAILY_SESSION_MINUTES: '180',
      DEMO_ACCESS_CODE: 'access_code_123',
    });
    assert.strictEqual(prodCfg.NODE_ENV, 'production');
    assert.strictEqual(prodCfg.JWT_SECRET, 'super-secure-production-jwt-secret-key-32chars');
    assert.strictEqual(prodCfg.AAI_WEBHOOK_SECRET, 'prod_telephony_secret_1234567890123');
    assert.strictEqual(prodCfg.VOICE_MAX_SESSION_SECONDS, 360);
    assert.strictEqual(prodCfg.VOICE_MAX_CONCURRENT, 5);
    assert.strictEqual(prodCfg.VOICE_DAILY_SESSION_MINUTES, 180);
    assert.strictEqual(prodCfg.DEMO_ACCESS_CODE, 'access_code_123');
  });
});
