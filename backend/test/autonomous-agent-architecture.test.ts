import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getIndustryProfile,
  listAvailableIndustryProfiles,
  B2B_SAAS_PROFILE,
  SOFTWARE_DEV_PROFILE,
  EmergencyStopService,
  AutonomousScheduler,
  AutonomousSalesPipeline,
  OperatingHoursConfig,
} from '../src/modules/autonomous/index.js';

describe('Governed Autonomous Company Operating Agent Architecture', () => {
  describe('1. Industry Operating Profiles & Company Brain', () => {
    test('loads pre-configured B2B SaaS profile with approved sales questions', () => {
      const profile = getIndustryProfile('b2b_saas');
      assert.equal(profile.id, 'b2b_saas');
      assert.equal(profile.title, 'B2B Enterprise SaaS');
      assert.ok(profile.approvedQuestions.length >= 4);
      assert.equal(profile.qualificationRules.minBudgetUsd, 15000);
      assert.equal(profile.qualificationRules.maxDeliveryTimelineMonths, 6);

      // Verify mandatory qualification question exists
      const mandatoryQuestion = profile.approvedQuestions.find((q) => q.isMandatoryForQualification);
      assert.ok(mandatoryQuestion);
    });

    test('loads pre-configured Custom Software & Cloud Development profile', () => {
      const profile = getIndustryProfile('software_dev');
      assert.equal(profile.id, 'software_dev');
      assert.equal(profile.qualificationRules.minBudgetUsd, 5000);
      assert.ok(profile.recommendedServices.some((s) => s.title.includes('Full-Stack')));
      assert.ok(profile.recommendedServices.some((s) => s.title.includes('AI Agent')));
    });

    test('falls back gracefully to software_dev on unknown industry ID', () => {
      const fallback = getIndustryProfile('quantum_astronomy_unknown');
      assert.equal(fallback.id, 'software_dev');
    });

    test('lists all available predefined industry profiles', () => {
      const profiles = listAvailableIndustryProfiles();
      assert.ok(profiles.length >= 4);
      const ids = profiles.map((p) => p.id);
      assert.ok(ids.includes('b2b_saas'));
      assert.ok(ids.includes('software_dev'));
      assert.ok(ids.includes('consulting'));
      assert.ok(ids.includes('healthcare_tech'));
    });
  });

  describe('2. Fail-Safe Emergency Stop Control', () => {
    test('defaults to not stopped for fresh company', async () => {
      const emergencyService = new EmergencyStopService();
      const isStopped = await emergencyService.isEmergencyStopped('comp_test_normal');
      assert.equal(isStopped, false);
    });

    test('tripping emergency stop immediately locks company execution', async () => {
      const emergencyService = new EmergencyStopService();
      const companyId = 'comp_test_lockdown';

      await emergencyService.setEmergencyStop(
        companyId,
        true,
        'Director issued emergency lockdown due to carrier incident',
        'operator_admin_123'
      );

      const isStopped = await emergencyService.isEmergencyStopped(companyId);
      assert.equal(isStopped, true);

      const state = emergencyService.getEmergencyStopState(companyId);
      assert.equal(state.isStopped, true);
      assert.equal(state.trippedBy, 'operator_admin_123');
      assert.ok(state.reason?.includes('carrier incident'));
    });

    test('clearing emergency stop restores operational readiness', async () => {
      const emergencyService = new EmergencyStopService();
      const companyId = 'comp_test_restore';

      await emergencyService.setEmergencyStop(companyId, true, 'Temporary pause', 'operator_admin_123');
      assert.equal(await emergencyService.isEmergencyStopped(companyId), true);

      await emergencyService.setEmergencyStop(companyId, false, 'Cleared by director', 'operator_admin_123');
      assert.equal(await emergencyService.isEmergencyStopped(companyId), false);
    });
  });

  describe('3. Persistent Autonomous Scheduler & Worker Queue', () => {
    test('schedules job and deduplicates by idempotency key', async () => {
      const scheduler = new AutonomousScheduler();
      const companyId = 'comp_sched_01';
      const scheduledFor = new Date(Date.now() - 5000); // 5 seconds in the past (executable)

      const job1 = await scheduler.scheduleJob({
        companyId,
        jobType: 'OUTBOUND_DISCOVERY_CALL',
        priority: 'HIGH',
        scheduledFor,
        idempotencyKey: 'idemp_call_prospect_42',
        payload: { leadId: 'lead_42' },
      });

      // Repeat with same idempotency key
      const job2 = await scheduler.scheduleJob({
        companyId,
        jobType: 'OUTBOUND_DISCOVERY_CALL',
        priority: 'HIGH',
        scheduledFor,
        idempotencyKey: 'idemp_call_prospect_42',
        payload: { leadId: 'lead_42' },
      });

      assert.equal(job1.id, job2.id);
    });

    test('sorts executable jobs strictly by priority (CRITICAL > HIGH > MEDIUM > LOW)', async () => {
      const scheduler = new AutonomousScheduler();
      const companyId = 'comp_sched_priority';
      const past = new Date(Date.now() - 10000);

      await scheduler.scheduleJob({
        companyId,
        jobType: 'LOW_PRIORITY_TASK',
        priority: 'LOW',
        scheduledFor: past,
        idempotencyKey: 'idemp_p_low',
      });

      await scheduler.scheduleJob({
        companyId,
        jobType: 'CRITICAL_TASK',
        priority: 'CRITICAL',
        scheduledFor: past,
        idempotencyKey: 'idemp_p_critical',
      });

      await scheduler.scheduleJob({
        companyId,
        jobType: 'HIGH_PRIORITY_TASK',
        priority: 'HIGH',
        scheduledFor: past,
        idempotencyKey: 'idemp_p_high',
      });

      const executable = await scheduler.getExecutableJobs(companyId);
      assert.ok(executable.length >= 3);
      assert.equal(executable[0].priority, 'CRITICAL');
      assert.equal(executable[1].priority, 'HIGH');
      assert.equal(executable[2].priority, 'LOW');
    });

    test('emergency stop halts scheduler and returns zero executable jobs', async () => {
      const emergencyService = new EmergencyStopService();
      const scheduler = new AutonomousScheduler(undefined, emergencyService);
      const companyId = 'comp_sched_halted';
      const past = new Date(Date.now() - 1000);

      await scheduler.scheduleJob({
        companyId,
        jobType: 'OUTBOUND_CALL',
        priority: 'CRITICAL',
        scheduledFor: past,
        idempotencyKey: 'idemp_halt_check',
      });

      // Trip emergency stop
      await emergencyService.setEmergencyStop(companyId, true, 'Emergency Pause', 'director');

      const executable = await scheduler.getExecutableJobs(companyId);
      assert.equal(executable.length, 0); // Strictly zero jobs returned
    });

    test('records job completion and applies exponential backoff on failure', async () => {
      const scheduler = new AutonomousScheduler();
      const companyId = 'comp_sched_retry';
      const past = new Date(Date.now() - 1000);

      const job = await scheduler.scheduleJob({
        companyId,
        jobType: 'CONNECT_LEAD',
        priority: 'MEDIUM',
        scheduledFor: past,
        idempotencyKey: 'idemp_retry_01',
        maxAttempts: 3,
      });

      // First failure
      await scheduler.recordJobResult(job.id, false, 'Carrier busy');
      assert.equal(job.attemptCount, 1);
      assert.equal(job.status, 'SCHEDULED');
      assert.ok(new Date(job.scheduledFor).getTime() > Date.now()); // Shifted into the future

      // Second failure
      await scheduler.recordJobResult(job.id, false, 'Carrier busy again');
      assert.equal(job.attemptCount, 2);

      // Third failure reaches maxAttempts -> FAILED
      await scheduler.recordJobResult(job.id, false, 'Third attempt failed');
      assert.equal(job.attemptCount, 3);
      assert.equal(job.status, 'FAILED');
    });

    test('evaluates operating business hours and holiday exclusion', () => {
      const scheduler = new AutonomousScheduler();
      const config: OperatingHoursConfig = {
        timezone: 'UTC',
        businessHours: [
          { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', isOpen: true }, // Monday
          { dayOfWeek: 0, openTime: '09:00', closeTime: '17:00', isOpen: false }, // Sunday (closed)
        ],
        holidays: ['2026-12-25'],
        callingHours: { startHour: 9, endHour: 17 },
      };

      // Monday at 14:00 UTC -> Open
      const mondayOpen = new Date('2026-09-28T14:00:00Z');
      assert.equal(scheduler.isWithinBusinessHours(mondayOpen, config), true);

      // Monday at 20:00 UTC (after 17:00) -> Closed
      const mondayLate = new Date('2026-09-28T20:00:00Z');
      assert.equal(scheduler.isWithinBusinessHours(mondayLate, config), false);

      // Sunday (closed all day) -> Closed
      const sunday = new Date('2026-09-27T14:00:00Z');
      assert.equal(scheduler.isWithinBusinessHours(sunday, config), false);

      // Holiday date -> Closed
      const holiday = new Date('2026-12-25T14:00:00Z');
      assert.equal(scheduler.isWithinBusinessHours(holiday, config), false);
    });
  });

  describe('4. Autonomous 14-Stage Sales Pipeline', () => {
    test('recommends discovery questions when lead criteria are incomplete', () => {
      const pipeline = new AutonomousSalesPipeline();
      const rec = pipeline.evaluateNextAction('DISCOVERY', {
        daysInStage: 0,
        qualificationScore: 20, // Below 40 threshold
      });

      assert.equal(rec.suggestedAction, 'ASK_ADAPTIVE_DISCOVERY_QUESTION');
      assert.equal(rec.requiresHumanApproval, false);
      assert.equal(rec.priority, 'HIGH');
    });

    test('recommends calendar booking once lead is qualified (score >= 40)', () => {
      const pipeline = new AutonomousSalesPipeline();
      const rec = pipeline.evaluateNextAction('DISCOVERY', {
        daysInStage: 0,
        qualificationScore: 50,
      });

      assert.equal(rec.suggestedAction, 'OFFER_CONSULTATION_SLOT');
      assert.equal(rec.nextStage, 'QUALIFIED');
    });

    test('escalates proposal discount > 5% to human director approval', () => {
      const pipeline = new AutonomousSalesPipeline();
      const rec = pipeline.evaluateNextAction('PROPOSAL_PREPARATION', {
        daysInStage: 0,
        discountRequestedPercent: 15,
      });

      assert.equal(rec.suggestedAction, 'REQUEST_HUMAN_APPROVAL_DISCOUNT');
      assert.equal(rec.nextStage, 'APPROVAL');
      assert.equal(rec.requiresHumanApproval, true);
    });

    test('delivers standard proposal without escalation when discount <= 5%', () => {
      const pipeline = new AutonomousSalesPipeline();
      const rec = pipeline.evaluateNextAction('PROPOSAL_PREPARATION', {
        daysInStage: 0,
        discountRequestedPercent: 3,
      });

      assert.equal(rec.suggestedAction, 'DELIVER_PROPOSAL_TO_CLIENT');
      assert.equal(rec.nextStage, 'PROPOSAL_SENT');
      assert.equal(rec.requiresHumanApproval, false);
    });

    test('triggers gentle follow-up reminder after proposal unanswered for 3+ days', () => {
      const pipeline = new AutonomousSalesPipeline();
      const rec = pipeline.evaluateNextAction('PROPOSAL_SENT', {
        daysInStage: 4,
      });

      assert.equal(rec.suggestedAction, 'SEND_PROPOSAL_REMINDER');
      assert.equal(rec.nextStage, 'FOLLOW_UP');
    });
  });

  describe('5. Autonomous HTTP Endpoints Integration', () => {
    test('GET /api/autonomous/industry-profiles returns available profiles', async () => {
      const { createServer } = await import('../src/server.js');
      const { config } = await import('../src/config/index.js');
      const app = await createServer(config);

      const res = await app.inject({
        method: 'GET',
        url: '/api/autonomous/industry-profiles',
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.total >= 4);
      assert.ok(Array.isArray(data.profiles));
      await app.close();
    });

    test('GET /api/autonomous/industry-profiles/software_dev returns specific profile details', async () => {
      const { createServer } = await import('../src/server.js');
      const { config } = await import('../src/config/index.js');
      const app = await createServer(config);

      const res = await app.inject({
        method: 'GET',
        url: '/api/autonomous/industry-profiles/software_dev',
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.profile.id, 'software_dev');
      assert.ok(data.profile.recommendedServices.length >= 2);
      await app.close();
    });

    test('POST /api/autonomous/emergency-stop trips kill-switch and updates GET /api/autonomous/status', async () => {
      const { createServer } = await import('../src/server.js');
      const { config } = await import('../src/config/index.js');
      const app = await createServer(config);
      const companyId = 'comp_http_emergency_01';

      // 1. Initial status -> AVAILABLE
      const initialRes = await app.inject({
        method: 'GET',
        url: `/api/autonomous/status?companyId=${companyId}`,
      });
      assert.equal(initialRes.statusCode, 200);
      const initData = JSON.parse(initialRes.body);
      assert.equal(initData.status, 'AVAILABLE');

      // 2. Trip emergency stop
      const stopRes = await app.inject({
        method: 'POST',
        url: `/api/autonomous/emergency-stop?companyId=${companyId}`,
        payload: {
          stopped: true,
          reason: 'Manual emergency stop triggered via control dashboard',
          actorId: 'operator_dan_99',
        },
      });
      assert.equal(stopRes.statusCode, 200);
      const stopData = JSON.parse(stopRes.body);
      assert.equal(stopData.success, true);
      assert.equal(stopData.emergencyStop.isStopped, true);

      // 3. Status now reflects EMERGENCY_STOPPED
      const lockedRes = await app.inject({
        method: 'GET',
        url: `/api/autonomous/status?companyId=${companyId}`,
      });
      const lockedData = JSON.parse(lockedRes.body);
      assert.equal(lockedData.status, 'EMERGENCY_STOPPED');
      assert.equal(lockedData.emergencyStop.isStopped, true);

      // 4. Clear emergency stop
      const clearRes = await app.inject({
        method: 'POST',
        url: `/api/autonomous/emergency-stop?companyId=${companyId}`,
        payload: {
          stopped: false,
          reason: 'Cleared by operator',
          actorId: 'operator_dan_99',
        },
      });
      assert.equal(clearRes.statusCode, 200);
      await app.close();
    });

    test('POST /api/autonomous/scheduler/jobs schedules persistent job and returns in executable list', async () => {
      const { createServer } = await import('../src/server.js');
      const { config } = await import('../src/config/index.js');
      const app = await createServer(config);
      const companyId = 'comp_http_sched_01';

      const scheduleRes = await app.inject({
        method: 'POST',
        url: `/api/autonomous/scheduler/jobs?companyId=${companyId}`,
        payload: {
          jobType: 'OUTBOUND_LEAD_DISCOVERY',
          priority: 'CRITICAL',
          scheduledFor: new Date(Date.now() - 5000).toISOString(),
          idempotencyKey: 'idemp_http_job_test_01',
          payload: { leadId: 'lead_xyz_123' },
        },
      });
      assert.equal(scheduleRes.statusCode, 201);
      const schedData = JSON.parse(scheduleRes.body);
      assert.equal(schedData.success, true);
      assert.equal(schedData.job.jobType, 'OUTBOUND_LEAD_DISCOVERY');

      // Query executable jobs
      const execRes = await app.inject({
        method: 'GET',
        url: `/api/autonomous/scheduler/executable?companyId=${companyId}`,
      });
      assert.equal(execRes.statusCode, 200);
      const execData = JSON.parse(execRes.body);
      assert.ok(execData.total >= 1);
      assert.ok(execData.jobs.some((j: any) => j.idempotencyKey === 'idemp_http_job_test_01'));
      await app.close();
    });
  });
});

