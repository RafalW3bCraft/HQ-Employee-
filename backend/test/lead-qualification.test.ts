import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';
import { loadConfig } from '../src/config/index.js';
import { defaultLeadsRepository } from '../src/modules/leads/index.js';

describe('Lead Qualification Workflow Integration', () => {
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

  it('1. Full Discovery to QUALIFIED transition with all 5 core criteria', async () => {
    // Create new lead
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/leads',
      payload: {
        fullName: 'Alexander Wright',
        companyName: 'Wright Aerospace Logistics',
        contactEmail: 'awright@wrightaero.com',
      },
    });

    assert.strictEqual(createRes.statusCode, 201);
    const lead = JSON.parse(createRes.payload);
    assert.strictEqual(lead.status, 'NEW');

    // Ingest all 5 essential qualification facts
    const facts = [
      { key: 'project_type', value: 'Custom Software Development', confidence: 0.95, source: 'VOICE_TURN_2' },
      { key: 'business_objective', value: 'Fleet dispatch scheduling automation with live GPS telemetry integration', confidence: 0.92, source: 'VOICE_TURN_4' },
      { key: 'timeline', value: '10 weeks target delivery', confidence: 0.88, source: 'VOICE_TURN_6' },
      { key: 'budget', value: '$25,000 - $35,000 approved budget', confidence: 0.90, source: 'VOICE_TURN_8' },
      { key: 'decision_maker', value: 'Chief Technology Officer (Sole Decision Maker)', confidence: 0.95, source: 'VOICE_TURN_10' },
    ];

    for (const fact of facts) {
      const factRes = await server.inject({
        method: 'POST',
        url: `/api/leads/${lead.id}/facts`,
        payload: fact,
      });
      assert.strictEqual(factRes.statusCode, 200);
      const resBody = JSON.parse(factRes.payload);
      assert.strictEqual(resBody.fact.provenance.status, 'CONFIRMED');
    }

    // Trigger qualification evaluation
    const qualifyRes = await server.inject({
      method: 'POST',
      url: `/api/leads/${lead.id}/qualify`,
    });

    assert.strictEqual(qualifyRes.statusCode, 200);
    const evalResult = JSON.parse(qualifyRes.payload);
    assert.strictEqual(evalResult.status, 'QUALIFIED');
    assert.strictEqual(evalResult.score, 100);
    assert.ok(evalResult.reasons[0].includes('All 5 core qualification criteria met'));

    // Check adaptive question when discovery complete
    const questionRes = await server.inject({
      method: 'GET',
      url: `/api/leads/${lead.id}/next-question`,
    });
    const question = JSON.parse(questionRes.payload);
    assert.strictEqual(question.isDiscoveryComplete, true);
    assert.ok(question.questionText.includes('schedule an introductory consultation'));
  });

  it('2. Sub-minimum budget evaluates to UNQUALIFIED', async () => {
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/leads',
      payload: {
        fullName: 'Budget Sensitive Client',
      },
    });
    const lead = JSON.parse(createRes.payload);

    // Provide project type and sub-minimum budget ($500)
    await server.inject({
      method: 'POST',
      url: `/api/leads/${lead.id}/facts`,
      payload: { key: 'project_type', value: 'Website Development', confidence: 0.9, source: 'VOICE_TURN_1' },
    });
    await server.inject({
      method: 'POST',
      url: `/api/leads/${lead.id}/facts`,
      payload: { key: 'budget', value: '$500 total budget', confidence: 0.95, source: 'VOICE_TURN_3' },
    });

    const qualifyRes = await server.inject({
      method: 'POST',
      url: `/api/leads/${lead.id}/qualify`,
    });

    const evalResult = JSON.parse(qualifyRes.payload);
    assert.strictEqual(evalResult.status, 'UNQUALIFIED');
    assert.ok(evalResult.reasons[0].includes('below firm minimum starting threshold'));
  });

  it('3. Contradictory information detection triggers HUMAN_HANDOFF', async () => {
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/leads',
      payload: {
        fullName: 'Conflicted Lead',
      },
    });
    const lead = JSON.parse(createRes.payload);

    // Initial confirmed budget: $25,000
    const fact1 = await server.inject({
      method: 'POST',
      url: `/api/leads/${lead.id}/facts`,
      payload: { key: 'budget', value: '$25,000 budget', confidence: 0.9, source: 'VOICE_TURN_2' },
    });
    assert.strictEqual(JSON.parse(fact1.payload).fact.provenance.status, 'CONFIRMED');

    // Conflicting incoming budget: $2,000 (discrepancy > 10x)
    const fact2 = await server.inject({
      method: 'POST',
      url: `/api/leads/${lead.id}/facts`,
      payload: { key: 'budget', value: '$2,000 only', confidence: 0.85, source: 'VOICE_TURN_6' },
    });
    const fact2Body = JSON.parse(fact2.payload);
    assert.strictEqual(fact2Body.fact.provenance.status, 'DISPUTED');
    assert.strictEqual(fact2Body.newStatus, 'HUMAN_HANDOFF');

    // Verify qualification evaluation reflects HUMAN_HANDOFF
    const qualifyRes = await server.inject({
      method: 'POST',
      url: `/api/leads/${lead.id}/qualify`,
    });
    const evalResult = JSON.parse(qualifyRes.payload);
    assert.strictEqual(evalResult.status, 'HUMAN_HANDOFF');
    assert.ok(evalResult.reasons[0].includes('Unresolved contradiction'));
  });

  it('4. Incomplete information evaluates to QUALIFYING and guides adaptive question', async () => {
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/leads',
      payload: {
        fullName: 'Early Inquiry Lead',
      },
    });
    const lead = JSON.parse(createRes.payload);

    // Only project type provided
    await server.inject({
      method: 'POST',
      url: `/api/leads/${lead.id}/facts`,
      payload: { key: 'project_type', value: 'AI & ML Engineering', confidence: 0.95, source: 'VOICE_TURN_1' },
    });

    const qualifyRes = await server.inject({
      method: 'POST',
      url: `/api/leads/${lead.id}/qualify`,
    });
    const evalResult = JSON.parse(qualifyRes.payload);
    assert.strictEqual(evalResult.status, 'QUALIFYING');

    // Adaptive question engine should identify missing business objective next
    const questionRes = await server.inject({
      method: 'GET',
      url: `/api/leads/${lead.id}/next-question`,
    });
    const question = JSON.parse(questionRes.payload);
    assert.strictEqual(question.factKey, 'business_objective');
    assert.strictEqual(question.isDiscoveryComplete, false);
  });

  it('5. Low-confidence fact (< 0.6) is NOT marked CONFIRMED', async () => {
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/leads',
      payload: {
        fullName: 'Ambiguous Acoustic Lead',
      },
    });
    const lead = JSON.parse(createRes.payload);

    const factRes = await server.inject({
      method: 'POST',
      url: `/api/leads/${lead.id}/facts`,
      payload: {
        key: 'budget',
        value: 'Maybe around twenty thousand?',
        confidence: 0.45, // Low confidence
        source: 'AUDIO_AMBIGUOUS_TURN_3',
      },
    });

    assert.strictEqual(factRes.statusCode, 200);
    const factBody = JSON.parse(factRes.payload);
    assert.strictEqual(factBody.fact.provenance.status, 'UNCONFIRMED');

    // Verify lead memory was NOT corrupted with this unconfirmed fact
    const getLeadRes = await server.inject({
      method: 'GET',
      url: `/api/leads/${lead.id}`,
    });
    const fetchedLead = JSON.parse(getLeadRes.payload);
    assert.strictEqual(fetchedLead.memory.budgetRange, undefined);
  });

  it('6. Structured Project Brief generation contains complete provenance trail', async () => {
    const briefRes = await server.inject({
      method: 'GET',
      url: '/api/leads/lead-001/brief',
    });

    assert.strictEqual(briefRes.statusCode, 200);
    const brief = JSON.parse(briefRes.payload);
    assert.ok(brief.briefId);
    assert.strictEqual(brief.leadId, 'lead-001');
    assert.strictEqual(brief.leadName, 'Sarah Jenkins');
    assert.strictEqual(brief.opportunityDetails.projectType, 'Custom Software');
    assert.ok(brief.opportunityDetails.businessObjective.includes('Automate warehouse'));
    assert.ok(brief.commercialParameters.budgetRange.includes('$15,000'));
    assert.strictEqual(brief.commercialParameters.decisionMakerConfirmed, true);
    assert.ok(brief.recommendedNextSteps);
    assert.ok(brief.generatedAt);
  });
});
