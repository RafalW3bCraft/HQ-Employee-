import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';
import { loadConfig } from '../src/config/index.js';
import {
  CampaignEngine,
  defaultCampaignEngine,
} from '../src/modules/campaigns/index.js';
import {
  GoogleOAuthManager,
  GoogleMeetProvider,
  GoogleMeetMediaProvider,
} from '../src/modules/meetings/google-meet.js';
import { defaultOptOutRepository } from '../src/modules/telephony/index.js';

describe('Campaigns & Integrations Suite', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    const testConfig = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
      ASSEMBLYAI_API_KEY: 'test_key',
      JWT_SECRET: 'dev_test_secret_for_campaigns_tests_32chars',
    });
    server = await createServer(testConfig);
    defaultCampaignEngine.clear();
  });

  // 1. CSV Parsing & Validation
  it('1. validates CSV format, E.164 normalization, and suppression list filtering', async () => {
    const engine = new CampaignEngine();
    await defaultOptOutRepository.addOptOut('+14155550999', 'DNC test');

    const csvData = `name,company,phone,email,timezone,consent_status
John Doe,Acme Corp,+14155550101,john@acme.com,America/New_York,CONSENTED
Jane Smith,Beta LLC,415-555-0102,jane@beta.com,America/Chicago,CONSENTED
Blocked User,Evil Corp,+14155550999,blocked@evil.com,America/New_York,CONSENTED
Invalid Row,Ghost Co,not-a-phone,ghost@ghost.com,America/New_York,CONSENTED`;

    const result = await engine.validateCsv(csvData);

    assert.strictEqual(result.totalParsed, 4);
    assert.strictEqual(result.validContacts.length, 1); // Only John Doe is strictly valid (+14155550101)
    assert.strictEqual(result.suppressedCount, 1); // +14155550999 is blocked
    assert.strictEqual(result.invalidRows.length, 3); // Jane (no +), Blocked (DNC), Invalid (not-a-phone)
  });

  // 2. Campaign Creation and State Machine
  it('2. creates campaign, tracks contacts, and manages lifecycle (start, pause, stop)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/campaigns',
      payload: {
        name: 'Fall 2026 Enterprise Outreach',
        objective: 'Qualify enterprise web modernization opportunities',
        concurrencyLimit: 2,
        maxAttempts: 3,
        contacts: [
          { name: 'Lead One', phone: '+14155550201' },
          { name: 'Lead Two', phone: '+14155550202' },
          { name: 'Lead Three', phone: '+14155550203' },
        ],
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const campaign = res.json();
    assert.ok(campaign.id);
    assert.strictEqual(campaign.status, 'READY');
    assert.strictEqual(campaign.stats.total, 3);
    assert.strictEqual(campaign.concurrencyLimit, 2);

    // Start
    const startRes = await server.inject({
      method: 'POST',
      url: `/api/campaigns/${campaign.id}/start`,
    });
    assert.strictEqual(startRes.statusCode, 200);
    assert.strictEqual(startRes.json().status, 'RUNNING');

    // Pause
    const pauseRes = await server.inject({
      method: 'POST',
      url: `/api/campaigns/${campaign.id}/pause`,
    });
    assert.strictEqual(pauseRes.statusCode, 200);
    assert.strictEqual(pauseRes.json().status, 'PAUSED');

    // Resume
    const resumeRes = await server.inject({
      method: 'POST',
      url: `/api/campaigns/${campaign.id}/resume`,
    });
    assert.strictEqual(resumeRes.statusCode, 200);
    assert.strictEqual(resumeRes.json().status, 'RUNNING');

    // Stop
    const stopRes = await server.inject({
      method: 'POST',
      url: `/api/campaigns/${campaign.id}/stop`,
    });
    assert.strictEqual(stopRes.statusCode, 200);
    assert.strictEqual(stopRes.json().status, 'CANCELLED');
  });

  // 3. Google Meet Media API Honest Status
  it('3. Google Meet Media API honestly reports NOT CONFIGURED / NOT ELIGIBLE when preview access is absent', () => {
    const mediaProvider = new GoogleMeetMediaProvider();
    const eligibility = mediaProvider.checkEligibility();

    assert.strictEqual(eligibility.eligible, false);
    assert.strictEqual(eligibility.status, 'NOT CONFIGURED');
    assert.ok(eligibility.message.includes('LIVE AI MEET MEDIA: Not configured / Not eligible'));
  });

  // 4. Google OAuth Flow
  it('4. GoogleOAuthManager generates correct auth URL and checks configuration honestly', () => {
    const oauth = new GoogleOAuthManager({
      clientId: 'google-test-client-id.apps.googleusercontent.com',
      clientSecret: 'test-secret',
    });

    const url = oauth.getAuthUrl();
    assert.ok(url.startsWith('https://accounts.google.com/o/oauth2/v2/auth'));
    assert.ok(url.includes('google-test-client-id'));
    assert.ok(url.includes('scope='));
  });

  // 5. One-Click System Health Check
  it('5. GET /api/admin/health executes one-click diagnostics across all subsystems', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/health',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();

    assert.ok(body.overall);
    assert.ok(body.correlationId);
    assert.ok(Array.isArray(body.checks));

    // Verify all core checks are present
    const checkNames = body.checks.map((c: any) => c.name);
    assert.ok(checkNames.some((n: string) => n.includes('AssemblyAI')));
    assert.ok(checkNames.some((n: string) => n.includes('Call-E')));
    assert.ok(checkNames.some((n: string) => n.includes('Google Calendar')));
    assert.ok(checkNames.some((n: string) => n.includes('Google Meet Media')));
    assert.ok(checkNames.some((n: string) => n.includes('Database')));
    assert.ok(checkNames.some((n: string) => n.includes('Policy Engine')));

    // Each check must contain honest diagnostic message
    for (const c of body.checks) {
      assert.ok(['PASS', 'WARN', 'FAIL', 'BLOCKED'].includes(c.status));
      assert.ok(c.diagnostic && c.diagnostic.length > 0);
    }
  });

  // 6. Overall Integration Status
  it('6. GET /api/integrations/status returns honest status summary for Setup Center', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/integrations/status',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();

    assert.ok(body.assemblyai);
    assert.strictEqual(body.assemblyai.endpoint, 'wss://agents.assemblyai.com/v1/ws');
    assert.ok(body.telephony);
    assert.strictEqual(body.telephony.primaryProvider, 'Call-E (heycall-e.com)');
    assert.ok(body.google);
    assert.ok(body.google.mediaApi.message.includes('LIVE AI MEET MEDIA'));
  });
});
