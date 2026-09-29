import { randomUUID } from 'crypto';
import { query } from '../../db/index.js';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  CalendarOperationError,
} from '../../errors/index.js';
import { defaultAuditService, AuditService } from '../audit/index.js';
import { defaultLeadsRepository, LeadsRepository } from '../leads/index.js';

export type MeetingStatus = 'SCHEDULED' | 'RESCHEDULED' | 'CANCELLED' | 'COMPLETED';

export interface MeetingRecord {
  id: string;
  companyId: string;
  leadId: string;
  title: string;
  topic?: string;
  scheduledAt: string; // ISO 8601 UTC
  durationMinutes: number;
  timezone: string; // Explicit timezone, e.g. 'America/New_York'
  status: MeetingStatus;
  calendarEventId?: string;
  confirmationCode: string;
  cancellationReason?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingSlot {
  startIso: string;
  endIso: string;
  durationMinutes: number;
  formattedLocal: string;
  timezone: string;
}

export interface AvailabilityResult {
  timezone: string;
  durationMinutes: number;
  slots: MeetingSlot[];
  conversationalSummary: string;
}

export interface MeetingConfirmation {
  meetingId: string;
  confirmationCode: string;
  leadId: string;
  leadName: string;
  companyName?: string;
  scheduledAt: string;
  durationMinutes: number;
  timezone: string;
  formattedLocal: string;
  topic: string;
  calendarEventId?: string;
  status: MeetingStatus;
  instructions: string;
}

export interface AvailabilityQuery {
  fromDate: string;
  toDate: string;
  timezone?: string;
  durationMinutes?: number;
  companyId?: string;
}

export interface CreateMeetingDto {
  leadId: string;
  slotTime: string;
  topic?: string;
  timezone?: string;
  durationMinutes?: number;
  idempotencyKey?: string;
  companyId?: string;
  actorId?: string;
}

export interface RescheduleMeetingDto {
  newSlotTime: string;
  timezone?: string;
  reason?: string;
  actorId?: string;
}

export interface CancelMeetingDto {
  reason?: string;
  actorId?: string;
}

/**
 * Format a Date object into human-readable local time with explicit timezone
 */
export function formatInTimezone(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
    return formatter.format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * Calendar Provider Interface
 * Abstraction over external calendars (Google Calendar, Outlook, CalDAV)
 */
export interface CalendarProvider {
  getBusyRanges(fromDate: Date, toDate: Date): Promise<Array<{ start: Date; end: Date }>>;
  createEvent(event: {
    title: string;
    description: string;
    start: Date;
    end: Date;
    attendeeEmail?: string;
    attendeeName?: string;
  }): Promise<{ calendarEventId: string; meetingLink?: string }>;
  updateEvent(calendarEventId: string, event: { title?: string; start: Date; end: Date }): Promise<void>;
  deleteEvent(calendarEventId: string): Promise<void>;
  setSimulateFailure(shouldFail: boolean, message?: string): void;
}

export class SimulatedCalendarProvider implements CalendarProvider {
  private events = new Map<string, { id: string; title: string; start: Date; end: Date }>();
  private shouldFail = false;
  private failureMessage = 'Simulated external calendar upstream timeout (502)';

  setSimulateFailure(shouldFail: boolean, message?: string) {
    this.shouldFail = shouldFail;
    if (message) this.failureMessage = message;
  }

  async getBusyRanges(fromDate: Date, toDate: Date): Promise<Array<{ start: Date; end: Date }>> {
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }
    const busy: Array<{ start: Date; end: Date }> = [];
    for (const evt of this.events.values()) {
      if (evt.start < toDate && evt.end > fromDate) {
        busy.push({ start: evt.start, end: evt.end });
      }
    }
    return busy;
  }

  async createEvent(event: {
    title: string;
    description: string;
    start: Date;
    end: Date;
    attendeeEmail?: string;
    attendeeName?: string;
  }): Promise<{ calendarEventId: string; meetingLink?: string }> {
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }
    const calendarEventId = `cal_evt_${randomUUID().substring(0, 12)}`;
    this.events.set(calendarEventId, {
      id: calendarEventId,
      title: event.title,
      start: event.start,
      end: event.end,
    });
    return {
      calendarEventId,
      meetingLink: `https://meet.hq-employee.co/discovery-${randomUUID().substring(0, 8)}`,
    };
  }

  async updateEvent(calendarEventId: string, event: { title?: string; start: Date; end: Date }): Promise<void> {
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }
    const existing = this.events.get(calendarEventId);
    if (!existing) {
      throw new Error(`Calendar event ${calendarEventId} not found`);
    }
    this.events.set(calendarEventId, {
      ...existing,
      title: event.title || existing.title,
      start: event.start,
      end: event.end,
    });
  }

  async deleteEvent(calendarEventId: string): Promise<void> {
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }
    this.events.delete(calendarEventId);
  }

  clear() {
    this.events.clear();
    this.shouldFail = false;
  }
}

const defaultCompanyId = '00000000-0000-0000-0000-000000000001';

export class MeetingsRepository {
  private meetings: MeetingRecord[] = [
    {
      id: 'meeting-seed-001',
      companyId: defaultCompanyId,
      leadId: 'lead-002',
      title: 'AI Clinical Dictation Discovery Call',
      topic: 'AI Clinical Dictation with AssemblyAI EHR Integration',
      scheduledAt: '2026-09-22T14:00:00.000Z',
      durationMinutes: 30,
      timezone: 'America/New_York',
      status: 'SCHEDULED',
      calendarEventId: 'cal-seed-001',
      confirmationCode: 'WC-MKTG-8910',
      idempotencyKey: 'seed-idempotency-lead-002',
      createdAt: '2026-09-16T09:15:00Z',
      updatedAt: '2026-09-16T09:15:00Z',
    },
  ];

  // In-memory mutex to serialize availability checks and bookings, avoiding race conditions
  private mutexLock = Promise.resolve();

  async withLock<T>(action: () => Promise<T>): Promise<T> {
    let release: () => void;
    const nextLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const currentLock = this.mutexLock;
    this.mutexLock = (async () => {
      try {
        await currentLock;
      } catch {
        // Continue chain on error
      }
      await nextLock;
    })();

    await currentLock;
    try {
      return await action();
    } finally {
      release!();
    }
  }

  async getMeeting(id: string): Promise<MeetingRecord | null> {
    const meeting = this.meetings.find((m) => m.id === id);
    return meeting ? JSON.parse(JSON.stringify(meeting)) : null;
  }

  async getMeetingByIdempotencyKey(key: string): Promise<MeetingRecord | null> {
    const meeting = this.meetings.find((m) => m.idempotencyKey === key);
    return meeting ? JSON.parse(JSON.stringify(meeting)) : null;
  }

  async listMeetings(filter?: {
    companyId?: string;
    leadId?: string;
    status?: MeetingStatus;
  }): Promise<MeetingRecord[]> {
    let result = this.meetings;
    if (filter?.companyId) {
      result = result.filter((m) => m.companyId === filter.companyId);
    }
    if (filter?.leadId) {
      result = result.filter((m) => m.leadId === filter.leadId);
    }
    if (filter?.status) {
      result = result.filter((m) => m.status === filter.status);
    }
    return JSON.parse(JSON.stringify(result));
  }

  async isSlotOverlapping(
    companyId: string,
    start: Date,
    end: Date,
    excludeMeetingId?: string
  ): Promise<boolean> {
    const active = this.meetings.filter(
      (m) =>
        m.companyId === companyId &&
        (m.status === 'SCHEDULED' || m.status === 'RESCHEDULED') &&
        m.id !== excludeMeetingId
    );

    for (const m of active) {
      const mStart = new Date(m.scheduledAt);
      const mEnd = new Date(mStart.getTime() + m.durationMinutes * 60000);
      // Overlap condition: start < mEnd && end > mStart
      if (start < mEnd && end > mStart) {
        return true;
      }
    }
    return false;
  }

  async saveMeeting(meeting: MeetingRecord): Promise<MeetingRecord> {
    const existingIndex = this.meetings.findIndex((m) => m.id === meeting.id);
    if (existingIndex >= 0) {
      this.meetings[existingIndex] = {
        ...meeting,
        updatedAt: new Date().toISOString(),
      };
      return JSON.parse(JSON.stringify(this.meetings[existingIndex]));
    }

    this.meetings.push({
      ...meeting,
      updatedAt: new Date().toISOString(),
    });

    // Optionally mirror write to PostgreSQL if database is active
    try {
      await query(
        `INSERT INTO meetings (id, company_id, lead_id, title, topic, scheduled_at, duration_minutes, timezone, status, calendar_event_id, confirmation_code, idempotency_key, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           topic = EXCLUDED.topic,
           scheduled_at = EXCLUDED.scheduled_at,
           duration_minutes = EXCLUDED.duration_minutes,
           timezone = EXCLUDED.timezone,
           status = EXCLUDED.status,
           calendar_event_id = EXCLUDED.calendar_event_id,
           cancellation_reason = EXCLUDED.cancellation_reason,
           updated_at = NOW()`,
        [
          meeting.id,
          meeting.companyId,
          meeting.leadId,
          meeting.title,
          meeting.topic || null,
          meeting.scheduledAt,
          meeting.durationMinutes,
          meeting.timezone,
          meeting.status,
          meeting.calendarEventId || null,
          meeting.confirmationCode,
          meeting.idempotencyKey || null,
          meeting.createdAt,
          meeting.updatedAt,
        ]
      );
    } catch {
      // In-memory fallback
    }

    return JSON.parse(JSON.stringify(meeting));
  }

  clear() {
    this.meetings = [];
  }
}

export class MeetingsService {
  constructor(
    private readonly repository: MeetingsRepository,
    private readonly calendarProvider: CalendarProvider,
    private readonly leadsRepository: LeadsRepository,
    private readonly auditService: AuditService
  ) {}

  /**
   * Check calendar availability for discovery consultation meetings.
   * Filters out:
   * - Times outside company business hours (Mon-Fri 09:00 - 17:00 in target timezone)
   * - Past dates and slots with less than 2 hours lead time
   * - Local booked meetings in HQ-Employee DB
   * - External busy blocks from Calendar Provider
   */
  async checkAvailability(query: AvailabilityQuery): Promise<AvailabilityResult> {
    const tz = query.timezone || 'America/New_York';
    const durationMinutes = query.durationMinutes || 30;
    const companyId = query.companyId || defaultCompanyId;

    const fromDate = new Date(query.fromDate);
    const toDate = new Date(query.toDate);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new ValidationError('Invalid fromDate or toDate format. Must be valid ISO 8601 dates.');
    }

    if (toDate <= fromDate) {
      throw new ValidationError('toDate must be after fromDate.');
    }

    // Minimum notice required before booking: 1 hour from current time
    const minBookingTime = Date.now() + 60 * 60 * 1000;

    // Fetch busy blocks from external calendar
    const externalBusy = await this.calendarProvider.getBusyRanges(fromDate, toDate);

    const availableSlots: MeetingSlot[] = [];

    // Iterate through days within the requested window
    // Use step of 30 minutes across the window
    const current = new Date(fromDate);
    // Align current to next 30-minute boundary
    current.setMinutes(Math.ceil(current.getMinutes() / 30) * 30, 0, 0);

    // Limit search window to maximum 14 days to prevent performance issues
    const maxWindowMs = 14 * 24 * 60 * 60 * 1000;
    const windowEndMs = Math.min(toDate.getTime(), fromDate.getTime() + maxWindowMs);

    while (current.getTime() + durationMinutes * 60000 <= windowEndMs) {
      const slotStart = new Date(current);
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

      // Advance by 30 minutes for next check
      current.setTime(current.getTime() + 30 * 60000);

      // 1. Skip if slot is in the past or under minimum notice
      if (slotStart.getTime() < minBookingTime) {
        continue;
      }

      // 2. Check business hours in target timezone (Mon-Fri 09:00 - 17:00)
      const dayName = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short',
      }).format(slotStart);

      // Skip weekends
      if (dayName === 'Sat' || dayName === 'Sun') {
        continue;
      }

      const hourInTz = parseInt(
        new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: 'numeric',
          hour12: false,
        }).format(slotStart),
        10
      );

      // Business hours: 09:00 to 17:00 (last 30-min slot starts at 16:30)
      if (hourInTz < 9 || hourInTz >= 17) {
        continue;
      }

      // 3. Check for external calendar busy collision
      const hasExternalCollision = externalBusy.some(
        (busy) => slotStart < busy.end && slotEnd > busy.start
      );
      if (hasExternalCollision) {
        continue;
      }

      // 4. Check for internal scheduled meeting overlap
      const hasInternalOverlap = await this.repository.isSlotOverlapping(
        companyId,
        slotStart,
        slotEnd
      );
      if (hasInternalOverlap) {
        continue;
      }

      // Valid available slot found
      availableSlots.push({
        startIso: slotStart.toISOString(),
        endIso: slotEnd.toISOString(),
        durationMinutes,
        formattedLocal: formatInTimezone(slotStart, tz),
        timezone: tz,
      });

      // Limit to 20 slots max
      if (availableSlots.length >= 20) {
        break;
      }
    }

    // Build conversational summary for AI Voice Employee
    let conversationalSummary = '';
    if (availableSlots.length === 0) {
      conversationalSummary = `There are currently no open slots between ${fromDate.toISOString().slice(0, 10)} and ${toDate.toISOString().slice(0, 10)}. Would you like me to look at the following week?`;
    } else if (availableSlots.length === 1) {
      conversationalSummary = `I have one opening on ${availableSlots[0].formattedLocal}. Does that work for you?`;
    } else {
      const first = availableSlots[0].formattedLocal;
      const second = availableSlots[1].formattedLocal;
      conversationalSummary = `I have openings such as ${first} or ${second}. Would either of those work for you?`;
    }

    return {
      timezone: tz,
      durationMinutes,
      slots: availableSlots,
      conversationalSummary,
    };
  }

  /**
   * Book a consultation meeting.
   * Strict Rule: Never claim a meeting is booked until the calendar operation succeeds.
   */
  async createMeeting(dto: CreateMeetingDto): Promise<MeetingConfirmation> {
    if (!dto.leadId) {
      throw new ValidationError('leadId is required to schedule a meeting.');
    }
    if (!dto.slotTime) {
      throw new ValidationError('slotTime is required.');
    }

    const companyId = dto.companyId || defaultCompanyId;
    const tz = dto.timezone || 'America/New_York';
    const durationMinutes = dto.durationMinutes || 30;

    const slotStart = new Date(dto.slotTime);
    if (isNaN(slotStart.getTime())) {
      throw new ValidationError(`Invalid slotTime format: ${dto.slotTime}`);
    }

    // Must not be in the past
    if (slotStart.getTime() < Date.now() - 60000) {
      throw new ValidationError('Cannot schedule a meeting in the past.');
    }

    // Check lead exists
    const lead = await this.leadsRepository.getLead(dto.leadId);
    if (!lead) {
      throw new NotFoundError('Lead', dto.leadId);
    }

    // Idempotency check: if request was already executed with this key, return the existing meeting
    if (dto.idempotencyKey) {
      const existing = await this.repository.getMeetingByIdempotencyKey(dto.idempotencyKey);
      if (existing && (existing.status === 'SCHEDULED' || existing.status === 'RESCHEDULED')) {
        return {
          meetingId: existing.id,
          confirmationCode: existing.confirmationCode,
          leadId: lead.id,
          leadName: lead.fullName,
          companyName: lead.companyName,
          scheduledAt: existing.scheduledAt,
          durationMinutes: existing.durationMinutes,
          timezone: existing.timezone,
          formattedLocal: formatInTimezone(new Date(existing.scheduledAt), existing.timezone),
          topic: existing.topic || 'Discovery Consultation',
          calendarEventId: existing.calendarEventId,
          status: existing.status,
          instructions: 'Meeting already scheduled. Please use the calendar invite link to join.',
        };
      }
    }

    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

    // Concurrency Lock: Use mutex to prevent race conditions & double-booking
    return await this.repository.withLock(async () => {
      // 1. Check local collision (stale availability check)
      const isBookedLocally = await this.repository.isSlotOverlapping(companyId, slotStart, slotEnd);
      if (isBookedLocally) {
        throw new ConflictError(
          `The requested slot at ${formatInTimezone(slotStart, tz)} is no longer available (already booked). Please choose another time.`
        );
      }

      // 2. Check external calendar busy collision
      let externalBusy: Array<{ start: Date; end: Date }>;
      try {
        externalBusy = await this.calendarProvider.getBusyRanges(slotStart, slotEnd);
      } catch (calError: any) {
        await this.auditService.logEvent({
          actorType: 'EMPLOYEE',
          actorId: dto.actorId || 'hq-employee-coordinator',
          action: 'CALENDAR_OPERATION_FAILED',
          targetType: 'MEETING_RESERVATION',
          targetId: dto.leadId,
          metadata: {
            leadId: dto.leadId,
            attemptedSlot: slotStart.toISOString(),
            timezone: tz,
            error: calError?.message || 'Calendar upstream failure',
          },
        });
        throw new CalendarOperationError(
          `Calendar booking failed: ${calError?.message || 'Upstream provider error'}. The meeting was NOT booked.`,
          {
            leadId: dto.leadId,
            requestedSlot: slotStart.toISOString(),
            timezone: tz,
          }
        );
      }

      const hasExternalCollision = externalBusy.some(
        (busy) => slotStart < busy.end && slotEnd > busy.start
      );
      if (hasExternalCollision) {
        throw new ConflictError(
          `The requested slot at ${formatInTimezone(slotStart, tz)} conflicts with an external calendar booking. Please choose another time.`
        );
      }

      // 3. Calendar Operation:
      // "Never claim a meeting is booked until the calendar operation succeeds."
      let calResult: { calendarEventId: string; meetingLink?: string };
      try {
        calResult = await this.calendarProvider.createEvent({
          title: dto.topic ? `HQ-Employee Discovery: ${dto.topic}` : `HQ-Employee Consultation with ${lead.fullName}`,
          description: `Discovery consultation with ${lead.fullName} (${lead.companyName || 'Prospect'}). Agenda: ${dto.topic || 'Software Development Discovery'}`,
          start: slotStart,
          end: slotEnd,
          attendeeEmail: lead.contactEmail,
          attendeeName: lead.fullName,
        });
      } catch (calError: any) {
        // Log failure audit event
        await this.auditService.logEvent({
          actorType: 'EMPLOYEE',
          actorId: dto.actorId || 'hq-employee-coordinator',
          action: 'CALENDAR_OPERATION_FAILED',
          targetType: 'MEETING_RESERVATION',
          targetId: dto.leadId,
          metadata: {
            leadId: dto.leadId,
            attemptedSlot: slotStart.toISOString(),
            timezone: tz,
            error: calError?.message || 'Calendar upstream failure',
          },
        });

        // Do NOT create meeting record. Do NOT update lead to MEETING_BOOKED.
        throw new CalendarOperationError(
          `Calendar booking failed: ${calError?.message || 'Upstream provider error'}. The meeting was NOT booked.`,
          {
            leadId: dto.leadId,
            requestedSlot: slotStart.toISOString(),
            timezone: tz,
          }
        );
      }

      // 4. Calendar operation succeeded -> Save meeting record to DB / repository
      const randomCodeSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const confirmationCode = `WC-MKTG-${randomCodeSuffix}`;

      const meetingRecord: MeetingRecord = {
        id: randomUUID(),
        companyId,
        leadId: lead.id,
        title: dto.topic ? `Consultation: ${dto.topic}` : `Discovery Consultation: ${lead.fullName}`,
        topic: dto.topic || 'Software Project Discovery Consultation',
        scheduledAt: slotStart.toISOString(),
        durationMinutes,
        timezone: tz,
        status: 'SCHEDULED',
        calendarEventId: calResult.calendarEventId,
        confirmationCode,
        idempotencyKey: dto.idempotencyKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.repository.saveMeeting(meetingRecord);

      // 5. Update lead record to MEETING_BOOKED
      lead.status = 'MEETING_BOOKED';
      lead.qualificationNotes =
        (lead.qualificationNotes ? `${lead.qualificationNotes} | ` : '') +
        `Meeting confirmed for ${formatInTimezone(slotStart, tz)} (Code: ${confirmationCode})`;

      lead.memory.facts.push({
        id: randomUUID(),
        leadId: lead.id,
        conversationId: 'meeting-scheduler',
        key: 'timeline',
        value: `Meeting booked: ${formatInTimezone(slotStart, tz)}`,
        provenance: {
          source: 'MEETING_SCHEDULER',
          conversationId: 'meeting-scheduler',
          timestamp: new Date().toISOString(),
          confidence: 1.0,
          status: 'CONFIRMED',
        },
        createdAt: new Date().toISOString(),
      });

      await this.leadsRepository.updateLead(lead);

      // 6. Log audit event for meeting creation
      await this.auditService.logEvent({
        actorType: 'EMPLOYEE',
        actorId: dto.actorId || 'hq-employee-coordinator',
        action: 'MEETING_SCHEDULED',
        targetType: 'MEETING',
        targetId: meetingRecord.id,
        metadata: {
          leadId: lead.id,
          scheduledAt: meetingRecord.scheduledAt,
          timezone: meetingRecord.timezone,
          durationMinutes: meetingRecord.durationMinutes,
          confirmationCode: meetingRecord.confirmationCode,
          calendarEventId: meetingRecord.calendarEventId,
          idempotencyKey: meetingRecord.idempotencyKey,
        },
      });

      return {
        meetingId: meetingRecord.id,
        confirmationCode: meetingRecord.confirmationCode,
        leadId: lead.id,
        leadName: lead.fullName,
        companyName: lead.companyName,
        scheduledAt: meetingRecord.scheduledAt,
        durationMinutes: meetingRecord.durationMinutes,
        timezone: meetingRecord.timezone,
        formattedLocal: formatInTimezone(slotStart, tz),
        topic: meetingRecord.topic || 'Discovery Consultation',
        calendarEventId: meetingRecord.calendarEventId,
        status: meetingRecord.status,
        instructions: `Your discovery consultation has been confirmed for ${formatInTimezone(slotStart, tz)}. A calendar invite has been dispatched.`,
      };
    });
  }

  /**
   * Reschedule an existing meeting to a new slot.
   */
  async rescheduleMeeting(meetingId: string, dto: RescheduleMeetingDto): Promise<MeetingConfirmation> {
    const meeting = await this.repository.getMeeting(meetingId);
    if (!meeting) {
      throw new NotFoundError('Meeting', meetingId);
    }
    if (meeting.status === 'CANCELLED') {
      throw new ValidationError('Cannot reschedule a cancelled meeting.');
    }

    const tz = dto.timezone || meeting.timezone;
    const newStart = new Date(dto.newSlotTime);
    if (isNaN(newStart.getTime())) {
      throw new ValidationError(`Invalid newSlotTime format: ${dto.newSlotTime}`);
    }
    if (newStart.getTime() < Date.now() - 60000) {
      throw new ValidationError('Cannot reschedule to a slot in the past.');
    }

    const newEnd = new Date(newStart.getTime() + meeting.durationMinutes * 60000);

    return await this.repository.withLock(async () => {
      // Check collision with other meetings
      const isOverlapping = await this.repository.isSlotOverlapping(
        meeting.companyId,
        newStart,
        newEnd,
        meeting.id
      );
      if (isOverlapping) {
        throw new ConflictError(
          `The requested slot at ${formatInTimezone(newStart, tz)} is already booked.`
        );
      }

      // Update external calendar event
      if (meeting.calendarEventId) {
        try {
          await this.calendarProvider.updateEvent(meeting.calendarEventId, {
            start: newStart,
            end: newEnd,
          });
        } catch (calErr: any) {
          throw new CalendarOperationError(
            `Failed to reschedule external calendar event: ${calErr?.message || 'Calendar error'}`
          );
        }
      }

      const previousScheduledAt = meeting.scheduledAt;
      meeting.scheduledAt = newStart.toISOString();
      meeting.timezone = tz;
      meeting.status = 'RESCHEDULED';
      meeting.updatedAt = new Date().toISOString();

      await this.repository.saveMeeting(meeting);

      // Update lead memory
      const lead = await this.leadsRepository.getLead(meeting.leadId);
      if (lead) {
        lead.qualificationNotes =
          (lead.qualificationNotes ? `${lead.qualificationNotes} | ` : '') +
          `Rescheduled to ${formatInTimezone(newStart, tz)}. Reason: ${dto.reason || 'Client request'}`;
        await this.leadsRepository.updateLead(lead);
      }

      // Log audit event
      await this.auditService.logEvent({
        actorType: 'EMPLOYEE',
        actorId: dto.actorId || 'hq-employee-coordinator',
        action: 'MEETING_RESCHEDULED',
        targetType: 'MEETING',
        targetId: meeting.id,
        metadata: {
          leadId: meeting.leadId,
          previousScheduledAt,
          newScheduledAt: meeting.scheduledAt,
          timezone: meeting.timezone,
          reason: dto.reason || 'Lead requested reschedule',
        },
      });

      return {
        meetingId: meeting.id,
        confirmationCode: meeting.confirmationCode,
        leadId: meeting.leadId,
        leadName: lead?.fullName || 'Client',
        companyName: lead?.companyName,
        scheduledAt: meeting.scheduledAt,
        durationMinutes: meeting.durationMinutes,
        timezone: meeting.timezone,
        formattedLocal: formatInTimezone(newStart, tz),
        topic: meeting.topic || 'Discovery Consultation',
        calendarEventId: meeting.calendarEventId,
        status: meeting.status,
        instructions: `Your discovery consultation has been rescheduled to ${formatInTimezone(newStart, tz)}.`,
      };
    });
  }

  /**
   * Cancel an existing meeting.
   * Frees up slot immediately for other leads.
   */
  async cancelMeeting(meetingId: string, dto: CancelMeetingDto): Promise<{ success: boolean; message: string; meeting: MeetingRecord }> {
    const meeting = await this.repository.getMeeting(meetingId);
    if (!meeting) {
      throw new NotFoundError('Meeting', meetingId);
    }
    if (meeting.status === 'CANCELLED') {
      throw new ValidationError('Meeting is already cancelled.');
    }

    // Delete from external calendar
    if (meeting.calendarEventId) {
      try {
        await this.calendarProvider.deleteEvent(meeting.calendarEventId);
      } catch {
        // Continue cancellation even if calendar event was already deleted
      }
    }

    meeting.status = 'CANCELLED';
    meeting.cancellationReason = dto.reason || 'Cancelled by prospect';
    meeting.updatedAt = new Date().toISOString();

    await this.repository.saveMeeting(meeting);

    // Update lead record note
    const lead = await this.leadsRepository.getLead(meeting.leadId);
    if (lead) {
      lead.qualificationNotes =
        (lead.qualificationNotes ? `${lead.qualificationNotes} | ` : '') +
        `Meeting cancelled: ${meeting.cancellationReason}`;
      await this.leadsRepository.updateLead(lead);
    }

    // Log audit event
    await this.auditService.logEvent({
      actorType: 'EMPLOYEE',
      actorId: dto.actorId || 'hq-employee-coordinator',
      action: 'MEETING_CANCELLED',
      targetType: 'MEETING',
      targetId: meeting.id,
      metadata: {
        leadId: meeting.leadId,
        scheduledAt: meeting.scheduledAt,
        reason: meeting.cancellationReason,
      },
    });

    return {
      success: true,
      message: `Meeting ${meeting.id} has been cancelled successfully.`,
      meeting,
    };
  }

  async getMeeting(id: string): Promise<MeetingRecord | null> {
    return this.repository.getMeeting(id);
  }

  async listMeetings(filter?: { companyId?: string; leadId?: string; status?: MeetingStatus }): Promise<MeetingRecord[]> {
    return this.repository.listMeetings(filter);
  }
}

// Singletons
export const defaultSimulatedCalendarProvider = new SimulatedCalendarProvider();

// Use Google Calendar if credentials are present; fall back to simulated for dev/test.
import { createGoogleCalendarProvider } from './google-calendar.js';
const googleCalendarProvider = createGoogleCalendarProvider();
export const defaultCalendarProvider: CalendarProvider =
  googleCalendarProvider ?? defaultSimulatedCalendarProvider;

if (googleCalendarProvider) {
  console.info('[meetings] Using real GoogleCalendarProvider (GOOGLE_CALENDAR_* env vars set)');
} else {
  console.info('[meetings] Using SimulatedCalendarProvider (no GOOGLE_CALENDAR_* env vars)');
}

export const defaultMeetingsRepository = new MeetingsRepository();
export const defaultMeetingsService = new MeetingsService(
  defaultMeetingsRepository,
  defaultCalendarProvider,
  defaultLeadsRepository,
  defaultAuditService
);

export const meetingsModule = {
  name: 'meetings',
  status: 'active',
  description: 'Calendar availability, race-safe slot reservation, timezone conversion, and meeting management',
  service: defaultMeetingsService,
  repository: defaultMeetingsRepository,
  calendarProvider: defaultCalendarProvider,
  isUsingRealCalendar: googleCalendarProvider !== null,
};

