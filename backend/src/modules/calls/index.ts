import { randomUUID } from 'crypto';
import { query } from '../../db/index.js';
import { NotFoundError } from '../../errors/index.js';
import {
  defaultAssemblyAIService,
  AssemblyAIService,
  ToolExecutionResult,
} from '../assemblyai/index.js';
import { defaultAuditService, AuditService } from '../audit/index.js';

export type CallChannel = 'WEB_VOICE' | 'TELEPHONY';
export type CallStatus = 'INITIALIZING' | 'CONNECTED' | 'COMPLETED' | 'FAILED' | 'RECONNECTING';

export interface CallSessionRecord {
  id: string;
  companyId: string;
  leadId?: string;
  employeeId: string;
  channel: CallChannel;
  status: CallStatus;
  assemblySessionId?: string;
  durationSeconds: number;
  audioDurationSeconds?: number;
  startedAt: string;
  endedAt?: string;
  transcripts: Array<{
    speaker: 'user' | 'agent';
    text: string;
    timestamp: string;
    interrupted?: boolean;
  }>;
  toolCalls: Array<{
    callId: string;
    name: string;
    arguments: Record<string, unknown>;
    policyDecision: string;
    isError: boolean;
    timestamp: string;
  }>;
}

export type NormalizedVoiceEventType =
  | 'voice.connected'
  | 'voice.speech_started'
  | 'voice.speech_stopped'
  | 'voice.user_transcript'
  | 'voice.agent_speaking'
  | 'voice.agent_transcript'
  | 'voice.agent_audio'
  | 'voice.tool_activity'
  | 'voice.error'
  | 'voice.session_ended';

export interface NormalizedVoiceEvent {
  type: NormalizedVoiceEventType;
  sessionId: string;
  callId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

const defaultCompanyId = '00000000-0000-0000-0000-000000000001';

export class CallsRepository {
  private sessions: CallSessionRecord[] = [];

  async createSession(data: {
    companyId?: string;
    leadId?: string;
    employeeId?: string;
    channel?: CallChannel;
  }): Promise<CallSessionRecord> {
    const record: CallSessionRecord = {
      id: randomUUID(),
      companyId: data.companyId || defaultCompanyId,
      leadId: data.leadId,
      employeeId: data.employeeId || 'hq-employee-coordinator',
      channel: data.channel || 'WEB_VOICE',
      status: 'INITIALIZING',
      durationSeconds: 0,
      startedAt: new Date().toISOString(),
      transcripts: [],
      toolCalls: [],
    };

    this.sessions.unshift(record);

    try {
      await query(
        `INSERT INTO calls (id, company_id, lead_id, employee_id, channel, status, started_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          record.id,
          record.companyId,
          record.leadId || null,
          record.employeeId,
          record.channel,
          record.status,
          record.startedAt,
        ]
      );
    } catch {
      // In-memory fallback
    }

    return JSON.parse(JSON.stringify(record));
  }

  async getSession(id: string): Promise<CallSessionRecord | null> {
    const s = this.sessions.find((sess) => sess.id === id);
    return s ? JSON.parse(JSON.stringify(s)) : null;
  }

  async updateSession(session: CallSessionRecord): Promise<CallSessionRecord> {
    const idx = this.sessions.findIndex((s) => s.id === session.id);
    if (idx < 0) {
      throw new NotFoundError('CallSession', session.id);
    }
    this.sessions[idx] = JSON.parse(JSON.stringify(session));

    try {
      await query(
        `UPDATE calls SET status = $1, duration_seconds = $2, ended_at = $3 WHERE id = $4`,
        [session.status, session.durationSeconds, session.endedAt || null, session.id]
      );
    } catch {
      // In-memory fallback
    }

    return JSON.parse(JSON.stringify(this.sessions[idx]));
  }

  async listSessions(filter?: { leadId?: string; status?: CallStatus }): Promise<CallSessionRecord[]> {
    let list = this.sessions;
    if (filter?.leadId) {
      list = list.filter((s) => s.leadId === filter.leadId);
    }
    if (filter?.status) {
      list = list.filter((s) => s.status === filter.status);
    }
    return JSON.parse(JSON.stringify(list));
  }

  clear() {
    this.sessions = [];
  }
}

export class CallsService {
  constructor(
    private readonly repository: CallsRepository,
    private readonly assemblyaiService: AssemblyAIService = defaultAssemblyAIService,
    private readonly auditService: AuditService = defaultAuditService
  ) {}

  async startSession(leadId?: string, employeeId?: string): Promise<CallSessionRecord> {
    return this.repository.createSession({ leadId, employeeId });
  }

  async getSession(id: string): Promise<CallSessionRecord | null> {
    return this.repository.getSession(id);
  }

  async recordAssemblySessionId(callId: string, assemblySessionId: string): Promise<void> {
    const sess = await this.repository.getSession(callId);
    if (sess) {
      sess.status = 'CONNECTED';
      sess.assemblySessionId = assemblySessionId;
      await this.repository.updateSession(sess);
    }
  }

  async recordTranscript(callId: string, item: { speaker: 'user' | 'agent'; text: string; interrupted?: boolean }): Promise<void> {
    const sess = await this.repository.getSession(callId);
    if (sess) {
      sess.transcripts.push({
        ...item,
        timestamp: new Date().toISOString(),
      });
      await this.repository.updateSession(sess);
    }
  }

  async recordToolCall(callId: string, item: { callId: string; name: string; arguments: Record<string, unknown>; policyDecision: string; isError: boolean }): Promise<void> {
    const sess = await this.repository.getSession(callId);
    if (sess) {
      sess.toolCalls.push({
        ...item,
        timestamp: new Date().toISOString(),
      });
      await this.repository.updateSession(sess);
    }
  }

  async endSession(callId: string, durationSeconds = 0, audioDurationSeconds?: number): Promise<CallSessionRecord> {
    const sess = await this.repository.getSession(callId);
    if (!sess) {
      throw new NotFoundError('CallSession', callId);
    }
    sess.status = 'COMPLETED';
    sess.durationSeconds = durationSeconds;
    sess.audioDurationSeconds = audioDurationSeconds;
    sess.endedAt = new Date().toISOString();

    const updated = await this.repository.updateSession(sess);

    await this.auditService.logEvent({
      actorType: 'EMPLOYEE',
      actorId: sess.employeeId,
      action: 'CALL_SESSION_COMPLETED',
      targetType: 'CALL_SESSION',
      targetId: sess.id,
      metadata: {
        leadId: sess.leadId,
        durationSeconds: sess.durationSeconds,
        transcriptTurns: sess.transcripts.length,
        toolExecutions: sess.toolCalls.length,
      },
    });

    return updated;
  }

  /**
   * Normalize an incoming raw AssemblyAI Voice Agent WebSocket event
   * into a standardized internal application event.
   */
  normalizeProviderEvent(
    rawEvent: Record<string, any>,
    callId: string,
    assemblySessionId?: string
  ): NormalizedVoiceEvent | null {
    const now = new Date().toISOString();
    const sessionId = assemblySessionId || rawEvent.session_id || 'unassigned-session';

    switch (rawEvent.type) {
      case 'session.ready':
        return {
          type: 'voice.connected',
          sessionId: rawEvent.session_id,
          callId,
          timestamp: now,
          payload: {
            sessionId: rawEvent.session_id,
            expiresAt: rawEvent.expires_at,
            resumeToken: rawEvent.resume_token,
          },
        };

      case 'input.speech.started':
        return {
          type: 'voice.speech_started',
          sessionId,
          callId,
          timestamp: now,
          payload: { isSpeaking: true },
        };

      case 'input.speech.stopped':
        return {
          type: 'voice.speech_stopped',
          sessionId,
          callId,
          timestamp: now,
          payload: { isSpeaking: false },
        };

      case 'transcript.user.delta':
        return {
          type: 'voice.user_transcript',
          sessionId,
          callId,
          timestamp: now,
          payload: {
            text: rawEvent.text,
            isFinal: false,
            itemId: rawEvent.item_id,
          },
        };

      case 'transcript.user':
        return {
          type: 'voice.user_transcript',
          sessionId,
          callId,
          timestamp: now,
          payload: {
            text: rawEvent.text,
            isFinal: true,
            itemId: rawEvent.item_id,
          },
        };

      case 'reply.started':
        return {
          type: 'voice.agent_speaking',
          sessionId,
          callId,
          timestamp: now,
          payload: {
            isSpeaking: true,
            replyId: rawEvent.reply_id,
          },
        };

      case 'reply.audio':
        return {
          type: 'voice.agent_audio',
          sessionId,
          callId,
          timestamp: now,
          payload: {
            audioChunkBase64: rawEvent.data,
          },
        };

      case 'transcript.agent.delta':
        return {
          type: 'voice.agent_transcript',
          sessionId,
          callId,
          timestamp: now,
          payload: {
            text: rawEvent.delta,
            isFinal: false,
            replyId: rawEvent.reply_id,
            startMs: rawEvent.start_ms,
            endMs: rawEvent.end_ms,
          },
        };

      case 'transcript.agent':
        return {
          type: 'voice.agent_transcript',
          sessionId,
          callId,
          timestamp: now,
          payload: {
            text: rawEvent.text,
            isFinal: true,
            interrupted: rawEvent.interrupted || false,
            replyId: rawEvent.reply_id,
          },
        };

      case 'reply.done':
        return {
          type: 'voice.agent_speaking',
          sessionId,
          callId,
          timestamp: now,
          payload: {
            isSpeaking: false,
            status: rawEvent.status, // "completed" or "interrupted"
            replyId: rawEvent.reply_id,
          },
        };

      case 'session.error':
        return {
          type: 'voice.error',
          sessionId,
          callId,
          timestamp: now,
          payload: {
            code: rawEvent.code,
            message: rawEvent.message,
          },
        };

      case 'session.ended':
        return {
          type: 'voice.session_ended',
          sessionId,
          callId,
          timestamp: now,
          payload: {
            sessionDurationSeconds: rawEvent.session_duration_seconds,
            audioDurationSeconds: rawEvent.audio_duration_seconds,
          },
        };

      default:
        return null;
    }
  }
}

export const defaultCallsRepository = new CallsRepository();
export const defaultCallsService = new CallsService(
  defaultCallsRepository,
  defaultAssemblyAIService,
  defaultAuditService
);

export const callsModule = {
  name: 'calls',
  status: 'active',
  description: 'Call lifecycle, event normalization, and voice session tracking boundary',
  service: defaultCallsService,
  repository: defaultCallsRepository,
};
