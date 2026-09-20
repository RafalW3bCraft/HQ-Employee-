import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';
import { loadConfig } from '../src/config/index.js';
import {
  defaultMeetingsRepository,
  defaultSimulatedCalendarProvider,
  formatInTimezone,
} from '../src/modules/meetings/index.js';
import { defaultLeadsRepository } from '../src/modules/leads/index.js';
import { defaultAuditService } from '../src/modules/audit/index.js';

describe('Meeting Scheduling Subsystem Integration', () => {
  let server: FastifyInstance;
  let testLeadId: string;

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

  beforeEach(async () => {
    defaultSimulatedCalendarProvider.clear();
    defaultMeetingsRepository.clear();
    defaultAuditService.clearEvents();

    // Create a fresh test lead
    const lead = await defaultLeadsRepository.createLead({
      fullName: 'Dr. Evelyn Reed',
      companyName: 'Reed Medical Group',
      contactEmail: 'ereed@reedmedical.org',
      contactPhone: '+1 (555) 345-6789',
      status: 'QUALIFIED',
    });
    testLeadId = lead.id;
  });

  it('1. checks availability within business hours and applies timezone conversion', async () => {
    // Generate dates 3 days ahead in the future (weekday)
    const targetDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    // Align to Monday if weekend
    if (targetDate.getDay() === 0) targetDate.setDate(targetDate.getDate() + 1);
    if (targetDate.getDay() === 6) targetDate.setDate(targetDate.getDate() + 2);

    const fromDate = new Date(targetDate);
    fromDate.setHours(8, 0, 0, 0);
    const toDate = new Date(targetDate);
    toDate.setHours(18, 0, 0, 0);

    const res = await server.inject({
      method: 'GET',
      url: `/api/meetings/availability?fromDate=${encodeURIComponent(fromDate.toISOString())}&toDate=${encodeURIComponent(toDate.toISOString())}&timezone=America/New_York`,
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.timezone, 'America/New_York');
    assert.ok(Array.isArray(body.slots), 'slots should be an array');
    assert.ok(body.slots.length > 0, 'Should have available slots on a business day');
    assert.ok(body.conversationalSummary, 'Should have conversational summary for voice AI');

    // Verify slot formatting contains EDT or EST and business hours
    const firstSlot = body.slots[0];
    assert.ok(firstSlot.formattedLocal.includes('EDT') || firstSlot.formattedLocal.includes('EST'));
    assert.strictEqual(firstSlot.timezone, 'America/New_York');
    assert.strictEqual(firstSlot.durationMinutes, 30);
  });

  it('2. successfully schedules meeting: validates slot, calls calendar, updates lead to MEETING_BOOKED, and logs audit', async () => {
    const slotTime = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    slotTime.setHours(14, 0, 0, 0); // 2:00 PM

    const res = await server.inject({
      method: 'POST',
      url: '/api/meetings',
      payload: {
        leadId: testLeadId,
        slotTime: slotTime.toISOString(),
        topic: 'Custom EHR & Voice AI Integration',
        timezone: 'America/New_York',
        durationMinutes: 30,
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const confirmation = JSON.parse(res.payload);
    assert.ok(confirmation.meetingId, 'Meeting ID must be generated');
    assert.ok(confirmation.confirmationCode.startsWith('WC-MKTG-'), 'Confirmation code format');
    assert.strictEqual(confirmation.leadId, testLeadId);
    assert.strictEqual(confirmation.timezone, 'America/New_York');
    assert.strictEqual(confirmation.status, 'SCHEDULED');
    assert.ok(confirmation.calendarEventId, 'Calendar event ID must be present');

    // Verify lead status is updated to MEETING_BOOKED
    const updatedLead = await defaultLeadsRepository.getLead(testLeadId);
    assert.strictEqual(updatedLead?.status, 'MEETING_BOOKED');
    assert.ok(
      updatedLead?.qualificationNotes?.includes('Meeting confirmed'),
      'Notes should reflect meeting booking'
    );

    // Verify audit event was logged
    const auditEvents = await defaultAuditService.getRecentEvents(10, 'MEETING_SCHEDULED');
    assert.strictEqual(auditEvents.length, 1);
    assert.strictEqual(auditEvents[0].targetId, confirmation.meetingId);
    assert.strictEqual(auditEvents[0].actorType, 'EMPLOYEE');
  });

  it('3. prevents double booking: rejects duplicate reservation of the same slot with 409 Conflict', async () => {
    const slotTime = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    slotTime.setHours(11, 0, 0, 0);

    // Create second lead
    const secondLead = await defaultLeadsRepository.createLead({
      fullName: 'Sarah Connor',
      companyName: 'Cyberdyne Resistance',
    });

    // 1st booking succeeds
    const firstRes = await server.inject({
      method: 'POST',
      url: '/api/meetings',
      payload: {
        leadId: testLeadId,
        slotTime: slotTime.toISOString(),
        topic: 'Architecture Review',
      },
    });
    assert.strictEqual(firstRes.statusCode, 201);

    // 2nd booking for identical slot MUST fail with 409 Conflict
    const secondRes = await server.inject({
      method: 'POST',
      url: '/api/meetings',
      payload: {
        leadId: secondLead.id,
        slotTime: slotTime.toISOString(),
        topic: 'Autonomous Defense AI',
      },
    });

    assert.strictEqual(secondRes.statusCode, 409);
    const errorBody = JSON.parse(secondRes.payload);
    assert.strictEqual(errorBody.error.code, 'CONFLICT');
    assert.ok(errorBody.error.message.includes('already booked'));
  });

  it('4. detects stale availability: slot offered earlier but booked in between is rejected', async () => {
    const slotTime = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
    slotTime.setHours(15, 0, 0, 0);

    // Step A: Lead A checks availability (slot is free)
    const fromDate = new Date(slotTime.getTime() - 2 * 60 * 60 * 1000);
    const toDate = new Date(slotTime.getTime() + 2 * 60 * 60 * 1000);
    const availRes = await server.inject({
      method: 'GET',
      url: `/api/meetings/availability?fromDate=${encodeURIComponent(fromDate.toISOString())}&toDate=${encodeURIComponent(toDate.toISOString())}`,
    });
    assert.strictEqual(availRes.statusCode, 200);

    // Step B: Meanwhile, another customer books that slot
    const competitorLead = await defaultLeadsRepository.createLead({ fullName: 'Competitor Client' });
    const interimBooking = await server.inject({
      method: 'POST',
      url: '/api/meetings',
      payload: {
        leadId: competitorLead.id,
        slotTime: slotTime.toISOString(),
      },
    });
    assert.strictEqual(interimBooking.statusCode, 201);

    // Step C: Lead A now tries to book that previously seen slot -> must detect collision
    const staleBookingRes = await server.inject({
      method: 'POST',
      url: '/api/meetings',
      payload: {
        leadId: testLeadId,
        slotTime: slotTime.toISOString(),
      },
    });

    assert.strictEqual(staleBookingRes.statusCode, 409);
    const staleBody = JSON.parse(staleBookingRes.payload);
    assert.strictEqual(staleBody.error.code, 'CONFLICT');
  });

  it('5. handles concurrent booking race condition: exactly 1 succeeds and 1 fails with 409', async () => {
    const slotTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    slotTime.setHours(10, 0, 0, 0);

    const lead2 = await defaultLeadsRepository.createLead({ fullName: 'Concurrent Client 2' });

    // Send two booking requests at the exact same millisecond
    const [res1, res2] = await Promise.all([
      server.inject({
        method: 'POST',
        url: '/api/meetings',
        payload: {
          leadId: testLeadId,
          slotTime: slotTime.toISOString(),
          topic: 'Concurrent Client 1 Call',
        },
      }),
      server.inject({
        method: 'POST',
        url: '/api/meetings',
        payload: {
          leadId: lead2.id,
          slotTime: slotTime.toISOString(),
          topic: 'Concurrent Client 2 Call',
        },
      }),
    ]);

    const statuses = [res1.statusCode, res2.statusCode].sort();
    assert.deepStrictEqual(statuses, [201, 409], 'Exactly one booking must succeed (201) and one must conflict (409)');
  });

  it('6. handles idempotency key: re-submitting same booking returns existing record without duplicate', async () => {
    const slotTime = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    slotTime.setHours(13, 0, 0, 0);
    const idempotencyKey = 'call-session-turn-987';

    // First request
    const firstRes = await server.inject({
      method: 'POST',
      url: '/api/meetings',
      payload: {
        leadId: testLeadId,
        slotTime: slotTime.toISOString(),
        idempotencyKey,
      },
    });
    assert.strictEqual(firstRes.statusCode, 201);
    const firstBody = JSON.parse(firstRes.payload);

    // Second request with SAME idempotency key
    const retryRes = await server.inject({
      method: 'POST',
      url: '/api/meetings',
      payload: {
        leadId: testLeadId,
        slotTime: slotTime.toISOString(),
        idempotencyKey,
      },
    });
    assert.strictEqual(retryRes.statusCode, 201);
    const retryBody = JSON.parse(retryRes.payload);

    // IDs and confirmation codes must match exactly
    assert.strictEqual(firstBody.meetingId, retryBody.meetingId);
    assert.strictEqual(firstBody.confirmationCode, retryBody.confirmationCode);

    // Only 1 meeting in repo
    const allMeetings = await defaultMeetingsRepository.listMeetings();
    assert.strictEqual(allMeetings.length, 1);
  });

  it('7. calendar failure rollback: never claim meeting is booked when calendar operation fails', async () => {
    const slotTime = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000);
    slotTime.setHours(16, 0, 0, 0);

    // Simulate calendar upstream outage / timeout
    defaultSimulatedCalendarProvider.setSimulateFailure(true, 'Google Calendar API rate limit exceeded');

    const res = await server.inject({
      method: 'POST',
      url: '/api/meetings',
      payload: {
        leadId: testLeadId,
        slotTime: slotTime.toISOString(),
      },
    });

    assert.strictEqual(res.statusCode, 502);
    const errBody = JSON.parse(res.payload);
    assert.strictEqual(errBody.error.code, 'CALENDAR_OPERATION_FAILED');
    assert.ok(errBody.error.message.includes('NOT booked'));

    // Verify meeting record was NOT created
    const meetings = await defaultMeetingsRepository.listMeetings();
    assert.strictEqual(meetings.length, 0);

    // Verify lead status was NOT changed to MEETING_BOOKED
    const lead = await defaultLeadsRepository.getLead(testLeadId);
    assert.notStrictEqual(lead?.status, 'MEETING_BOOKED');

    // Verify audit event CALENDAR_OPERATION_FAILED was logged
    const failedEvents = await defaultAuditService.getRecentEvents(5, 'CALENDAR_OPERATION_FAILED');
    assert.strictEqual(failedEvents.length, 1);
    assert.strictEqual(failedEvents[0].targetId, testLeadId);

    // Restore provider
    defaultSimulatedCalendarProvider.setSimulateFailure(false);
  });

  it('8. reschedules existing meeting: updates time, frees old slot, updates calendar, logs audit', async () => {
    const slot1 = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    slot1.setHours(10, 0, 0, 0);

    // Create initial booking
    const bookRes = await server.inject({
      method: 'POST',
      url: '/api/meetings',
      payload: {
        leadId: testLeadId,
        slotTime: slot1.toISOString(),
        topic: 'Initial Discovery',
      },
    });
    assert.strictEqual(bookRes.statusCode, 201);
    const meeting = JSON.parse(bookRes.payload);

    // Reschedule to slot2
    const slot2 = new Date(Date.now() + 11 * 24 * 60 * 60 * 1000);
    slot2.setHours(14, 0, 0, 0);

    const reschedRes = await server.inject({
      method: 'POST',
      url: `/api/meetings/${meeting.meetingId}/reschedule`,
      payload: {
        newSlotTime: slot2.toISOString(),
        timezone: 'Europe/Warsaw',
        reason: 'Client requested European afternoon time',
      },
    });

    assert.strictEqual(reschedRes.statusCode, 200);
    const updated = JSON.parse(reschedRes.payload);
    assert.strictEqual(updated.status, 'RESCHEDULED');
    assert.strictEqual(updated.timezone, 'Europe/Warsaw');

    // Old slot1 should now be FREE again for another booking
    const newLead = await defaultLeadsRepository.createLead({ fullName: 'New Prospect' });
    const reuseOldSlotRes = await server.inject({
      method: 'POST',
      url: '/api/meetings',
      payload: {
        leadId: newLead.id,
        slotTime: slot1.toISOString(),
      },
    });
    assert.strictEqual(reuseOldSlotRes.statusCode, 201, 'Old slot should be bookable after reschedule');

    // Verify audit event logged
    const reschedAudits = await defaultAuditService.getRecentEvents(5, 'MEETING_RESCHEDULED');
    assert.strictEqual(reschedAudits.length, 1);
  });

  it('9. cancels meeting: marks CANCELLED, frees slot for others, and logs audit', async () => {
    const slotTime = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000);
    slotTime.setHours(11, 0, 0, 0);

    const bookRes = await server.inject({
      method: 'POST',
      url: '/api/meetings',
      payload: {
        leadId: testLeadId,
        slotTime: slotTime.toISOString(),
      },
    });
    assert.strictEqual(bookRes.statusCode, 201);
    const meeting = JSON.parse(bookRes.payload);

    // Cancel meeting
    const cancelRes = await server.inject({
      method: 'POST',
      url: `/api/meetings/${meeting.meetingId}/cancel`,
      payload: {
        reason: 'Project postponed to next fiscal quarter',
      },
    });

    assert.strictEqual(cancelRes.statusCode, 200);
    const cancelBody = JSON.parse(cancelRes.payload);
    assert.strictEqual(cancelBody.success, true);
    assert.strictEqual(cancelBody.meeting.status, 'CANCELLED');

    // Verify slot is immediately available to be re-booked
    const newLead = await defaultLeadsRepository.createLead({ fullName: 'Replacement Lead' });
    const rebookRes = await server.inject({
      method: 'POST',
      url: '/api/meetings',
      payload: {
        leadId: newLead.id,
        slotTime: slotTime.toISOString(),
      },
    });
    assert.strictEqual(rebookRes.statusCode, 201, 'Slot must be free after cancellation');

    // Verify audit event
    const cancelAudits = await defaultAuditService.getRecentEvents(5, 'MEETING_CANCELLED');
    assert.strictEqual(cancelAudits.length, 1);
  });

  it('10. rejects scheduling meetings in the past', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago

    const res = await server.inject({
      method: 'POST',
      url: '/api/meetings',
      payload: {
        leadId: testLeadId,
        slotTime: pastDate.toISOString(),
      },
    });

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
  });
});
