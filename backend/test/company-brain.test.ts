import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';
import { loadConfig } from '../src/config/index.js';

describe('Company Brain Subsystem Integration', () => {
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

  it('GET /api/company/brain returns full company knowledge and active policy', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/company/brain',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);

    assert.ok(body.profile);
    assert.strictEqual(body.profile.name, 'HQ-Employee');
    assert.ok(body.services.length >= 4);
    assert.ok(body.faqs.length >= 3);
    assert.ok(body.activePolicy);
    assert.strictEqual(body.activePolicy.status, 'ACTIVE');
    assert.strictEqual(body.activePolicy.version, '1.0.0');
    assert.ok(body.activePolicy.id);
    assert.ok(body.activePolicy.createdAt);
    assert.ok(body.activePolicy.updatedAt);
  });

  it('PUT /api/company/profile updates company profile and returns 200', async () => {
    const res = await server.inject({
      method: 'PUT',
      url: '/api/company/profile',
      payload: {
        tagline: 'Leading AI Engineering & Governed Software Solutions',
        description: 'Updated firm description for HQ.',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const updated = JSON.parse(res.payload);
    assert.strictEqual(updated.tagline, 'Leading AI Engineering & Governed Software Solutions');
    assert.strictEqual(updated.description, 'Updated firm description for HQ.');

    // Verify change is persisted in GET
    const getRes = await server.inject({ method: 'GET', url: '/api/company/profile' });
    const profile = JSON.parse(getRes.payload);
    assert.strictEqual(profile.tagline, 'Leading AI Engineering & Governed Software Solutions');
  });

  it('POST /api/company/services upserts an approved service with pricing and timeline guidance', async () => {
    const newService = {
      slug: 'mobile-app-dev',
      title: 'Native Android & iOS Engineering',
      description: 'Modern Jetpack Compose and SwiftUI mobile applications with cloud synchronization.',
      minPriceCents: 1000000,
      maxPriceCents: 2000000,
      minDurationWeeks: 6,
      maxDurationWeeks: 10,
      tierName: 'Native Mobile MVP',
      scopeDescription: 'Complete mobile client with offline-first architecture',
    };

    const res = await server.inject({
      method: 'POST',
      url: '/api/company/services',
      payload: newService,
    });

    assert.strictEqual(res.statusCode, 200);
    const service = JSON.parse(res.payload);
    assert.strictEqual(service.slug, 'mobile-app-dev');
    assert.strictEqual(service.pricing[0].minPriceCents, 1000000);
    assert.strictEqual(service.timelines[0].minDurationWeeks, 6);

    // Verify service appears in services list
    const listRes = await server.inject({ method: 'GET', url: '/api/company/services' });
    const list = JSON.parse(listRes.payload);
    const found = list.find((s: { slug: string }) => s.slug === 'mobile-app-dev');
    assert.ok(found);
  });

  it('POST /api/company/services rejects invalid pricing or timeline bounds', async () => {
    const invalidService = {
      slug: 'invalid-bounds',
      title: 'Invalid Bounds Test',
      description: 'Test service',
      minPriceCents: 2000000,
      maxPriceCents: 1000000, // Invalid: max < min
      minDurationWeeks: 6,
      maxDurationWeeks: 10,
    };

    const res = await server.inject({
      method: 'POST',
      url: '/api/company/services',
      payload: invalidService,
    });

    assert.strictEqual(res.statusCode, 400);
  });

  it('POST /api/company/faqs creates a new FAQ', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/company/faqs',
      payload: {
        question: 'Do you offer post-launch maintenance SLA contracts?',
        answer: 'Yes, we provide 24/7 infrastructure monitoring, security patching, and on-call response SLAs.',
        displayOrder: 4,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const faq = JSON.parse(res.payload);
    assert.ok(faq.id);
    assert.strictEqual(faq.question, 'Do you offer post-launch maintenance SLA contracts?');

    const faqsRes = await server.inject({ method: 'GET', url: '/api/company/faqs' });
    const faqs = JSON.parse(faqsRes.payload);
    assert.ok(faqs.some((f: { question: string }) => f.question.includes('post-launch maintenance')));
  });

  it('Policy Versioning: creates new versioned policy and activates it', async () => {
    // 1. Create a v1.1.0 policy
    const newPolicyPayload = {
      version: '1.1.0',
      systemInstructions: 'You are the HQ Business Development & Client Coordinator v1.1.0. Emphasize AI security and high-velocity development.',
      authorityRules: [
        { action: 'get_company_profile', category: 'information', decision: 'ALLOW', rationale: 'Public knowledge' },
        { action: 'apply_custom_discount', category: 'commercial', decision: 'REQUIRE_APPROVAL', rationale: 'Discounts must be human approved' },
        { action: 'sign_contract', category: 'legal', decision: 'BLOCK', rationale: 'No AI contract signing' },
      ],
      escalationRules: [
        { condition: 'Security sensitive question', targetRole: 'CISO', notificationChannel: 'slack_security', timeoutMinutes: 15 },
      ],
    };

    const createRes = await server.inject({
      method: 'POST',
      url: '/api/company/policies',
      payload: newPolicyPayload,
    });

    assert.strictEqual(createRes.statusCode, 201);
    const createdPolicy = JSON.parse(createRes.payload);
    assert.ok(createdPolicy.id);
    assert.strictEqual(createdPolicy.version, '1.1.0');
    assert.strictEqual(createdPolicy.status, 'DRAFT');
    assert.ok(createdPolicy.createdAt);
    assert.ok(createdPolicy.updatedAt);

    // 2. Activate the new policy
    const activateRes = await server.inject({
      method: 'POST',
      url: `/api/company/policies/${createdPolicy.id}/activate`,
    });

    assert.strictEqual(activateRes.statusCode, 200);
    const activatedPolicy = JSON.parse(activateRes.payload);
    assert.strictEqual(activatedPolicy.status, 'ACTIVE');

    // 3. Verify active policy endpoint returns v1.1.0
    const activeRes = await server.inject({
      method: 'GET',
      url: '/api/company/policies/active',
    });
    const active = JSON.parse(activeRes.payload);
    assert.strictEqual(active.id, createdPolicy.id);
    assert.strictEqual(active.version, '1.1.0');

    // 4. Verify original v1.0.0 policy was archived
    const listRes = await server.inject({
      method: 'GET',
      url: '/api/company/policies',
    });
    const allPolicies = JSON.parse(listRes.payload);
    const v100 = allPolicies.find((p: { version: string }) => p.version === '1.0.0');
    assert.ok(v100);
    assert.strictEqual(v100.status, 'ARCHIVED');
  });

  it('GET /api/company/runtime-context provides structured context for AI employee runtime', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/company/runtime-context',
    });

    assert.strictEqual(res.statusCode, 200);
    const ctx = JSON.parse(res.payload);

    assert.ok(ctx.companySummary.includes('HQ-Employee'));
    assert.strictEqual(ctx.activePolicyVersion, '1.1.0');
    assert.ok(ctx.systemInstructions);
    assert.ok(ctx.approvedServices.length >= 4);

    // Verify authority decisions separation
    assert.ok(Array.isArray(ctx.authorityDecisions.ALLOW));
    assert.ok(Array.isArray(ctx.authorityDecisions.REQUIRE_APPROVAL));
    assert.ok(Array.isArray(ctx.authorityDecisions.BLOCK));
    assert.ok(ctx.authorityDecisions.BLOCK.some((r: string) => r.includes('sign_contract')));

    // Verify service filter
    const serviceRes = await server.inject({
      method: 'GET',
      url: '/api/company/runtime-context?service=website-dev',
    });
    const serviceCtx = JSON.parse(serviceRes.payload);
    assert.strictEqual(serviceCtx.approvedServices.length, 1);
    assert.strictEqual(serviceCtx.approvedServices[0].slug, 'website-dev');
  });
});
