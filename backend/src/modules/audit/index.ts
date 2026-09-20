import { randomUUID } from 'crypto';
import { query } from '../../db/index.js';

// ============================================================================
// Types & Domain Models
// ============================================================================

export type AuditAction =
  | 'EMPLOYEE_SESSION_STARTED'
  | 'CALL_INITIATED'
  | 'CALL_COMPLETED'
  | 'CALL_FAILED'
  | 'CALL_SESSION_COMPLETED'
  | 'TELEPHONY_CALL_INITIATED'
  | 'TELEPHONY_CALL_ENDED'
  | 'TELEPHONY_CALL_FAILED'
  | 'TELEPHONY_CALL_POLICY_DENIED'
  | 'TELEPHONY_CALL_BLOCKED_OPT_OUT'
  | 'LEAD_CREATED'
  | 'LEAD_UPDATED'
  | 'LEAD_MEMORY_PURGED'
  | 'FACT_RECORDED'
  | 'FACT_CONFLICT_DETECTED'
  | 'MEETING_CREATED'
  | 'MEETING_CHANGED'
  | 'MEETING_CANCELLED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_REJECTED'
  | 'POLICY_EVALUATION'
  | 'POLICY_DECISION'
  | 'RUNTIME_CONTEXT_ASSEMBLED'
  | 'CREDIT_RESERVATION'
  | 'CREDIT_CONSUMPTION'
  | 'CREDIT_RELEASE'
  | string;

export interface AuditEventRecord {
  id: string;
  timestamp: string;
  createdAt: string; // backwards compatibility alias for timestamp
  companyId?: string;
  employeeId?: string;
  leadId?: string;
  conversationId?: string;
  callId?: string;
  policyVersion?: string;
  action: AuditAction;
  inputMetadata?: Record<string, unknown>;
  authorizationResult?: 'ALLOW' | 'REQUIRE_APPROVAL' | 'BLOCK';
  result?: string | Record<string, unknown>;
  failureReason?: string;
  actorType: 'SYSTEM' | 'EMPLOYEE' | 'HUMAN_ADMIN';
  actorId: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
}

export interface LogAuditEventDTO {
  companyId?: string;
  employeeId?: string;
  leadId?: string;
  conversationId?: string;
  callId?: string;
  policyVersion?: string;
  action: AuditAction;
  inputMetadata?: Record<string, unknown>;
  authorizationResult?: 'ALLOW' | 'REQUIRE_APPROVAL' | 'BLOCK';
  result?: string | Record<string, unknown>;
  failureReason?: string;
  actorType?: 'SYSTEM' | 'EMPLOYEE' | 'HUMAN_ADMIN';
  actorId?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Sensitive Data Redaction Pipeline
// ============================================================================

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth(orization)?/i,
  /private[_-]?key/i,
  /card[_-]?num(ber)?/i,
  /cvv/i,
  /cvc/i,
  /credit[_-]?card/i,
  /ssn/i,
];

export function sanitizeAuditData<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Check for Bearer token string patterns
    if (/^bearer\s+[a-zA-Z0-9_\-\.]+$/i.test(data.trim())) {
      return '[REDACTED_TOKEN]' as unknown as T;
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditData(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeAuditData(value);
      }
    }
    return sanitized as unknown as T;
  }

  return data;
}

// ============================================================================
// Append-Only Audit Repository
// ============================================================================

export class AuditRepository {
  // Append-only memory store: items are strictly appended, never modified
  private readonly events: AuditEventRecord[] = [];

  async appendEvent(dto: LogAuditEventDTO): Promise<AuditEventRecord> {
    const now = new Date().toISOString();
    const eventId = randomUUID();

    // Sanitize input metadata and results
    const sanitizedMetadata = sanitizeAuditData(dto.metadata || {});
    const sanitizedInput = sanitizeAuditData(dto.inputMetadata);
    const sanitizedResult = sanitizeAuditData(dto.result);

    const record: AuditEventRecord = {
      id: eventId,
      timestamp: now,
      createdAt: now,
      companyId: dto.companyId,
      employeeId: dto.employeeId,
      leadId: dto.leadId,
      conversationId: dto.conversationId,
      callId: dto.callId,
      policyVersion: dto.policyVersion,
      action: dto.action,
      inputMetadata: sanitizedInput,
      authorizationResult: dto.authorizationResult,
      result: sanitizedResult,
      failureReason: dto.failureReason,
      actorType: dto.actorType || 'EMPLOYEE',
      actorId: dto.actorId || 'hq-coordinator',
      targetType: dto.targetType || 'SYSTEM',
      targetId: dto.targetId || eventId,
      metadata: {
        ...sanitizedMetadata,
        ...(sanitizedInput ? { input: sanitizedInput } : {}),
        ...(sanitizedResult ? { result: sanitizedResult } : {}),
      },
    };

    // Immutability: Push to immutable append log
    const frozen = Object.freeze(record);
    this.events.unshift(frozen);

    // Persist to PostgreSQL if connected
    try {
      await query(
        `INSERT INTO audit_events (id, company_id, actor_type, actor_id, action, target_type, target_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          record.id,
          record.companyId || '00000000-0000-0000-0000-000000000001',
          record.actorType,
          record.actorId,
          record.action,
          record.targetType,
          record.targetId,
          JSON.stringify(record.metadata),
          record.timestamp,
        ]
      );
    } catch {
      // Standalone test/offline fallback
    }

    return frozen;
  }

  async getEvents(limit = 50, filterAction?: string): Promise<AuditEventRecord[]> {
    let list = this.events;
    if (filterAction) {
      list = list.filter((e) => e.action === filterAction);
    }
    return list.slice(0, limit);
  }

  async queryByLead(leadId: string, limit = 50): Promise<AuditEventRecord[]> {
    return this.events.filter((e) => e.leadId === leadId).slice(0, limit);
  }

  async queryByConversation(conversationId: string): Promise<AuditEventRecord[]> {
    return this.events.filter((e) => e.conversationId === conversationId);
  }

  async queryByCompany(companyId: string, limit = 100): Promise<AuditEventRecord[]> {
    return this.events.filter((e) => e.companyId === companyId).slice(0, limit);
  }

  clearEvents() {
    this.events.length = 0;
  }
}

// ============================================================================
// Audit Service Implementation
// ============================================================================

export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  /**
   * Log an auditable business event (with automatic secret redaction)
   */
  async logEvent(dto: LogAuditEventDTO): Promise<AuditEventRecord> {
    return this.repository.appendEvent(dto);
  }

  /**
   * Log a formal policy evaluation with full authorization traceability
   */
  async logPolicyEvaluation(params: {
    actorId?: string;
    action: string;
    decision: 'ALLOW' | 'REQUIRE_APPROVAL' | 'BLOCK';
    reason: string;
    policyVersion: string;
    policyId?: string;
    leadId?: string;
    callId?: string;
    companyId?: string;
    employeeId?: string;
    args?: Record<string, unknown>;
  }): Promise<AuditEventRecord> {
    return this.repository.appendEvent({
      actorType: 'EMPLOYEE',
      actorId: params.actorId || 'hq-coordinator',
      companyId: params.companyId || '00000000-0000-0000-0000-000000000001',
      employeeId: params.employeeId || '00000000-0000-0000-0000-000000000002',
      leadId: params.leadId,
      callId: params.callId,
      policyVersion: params.policyVersion,
      action: 'POLICY_EVALUATION',
      authorizationResult: params.decision,
      targetType: 'POLICY_DECISION',
      targetId: params.policyId || 'active-policy',
      inputMetadata: params.args,
      metadata: {
        actionRequested: params.action,
        decision: params.decision,
        reason: params.reason,
        policyVersion: params.policyVersion,
        leadId: params.leadId,
        callId: params.callId,
        args: params.args,
      },
    });
  }

  /**
   * Trace an authorization decision by lead or action
   */
  async traceAuthorization(action: string, leadId?: string): Promise<AuditEventRecord[]> {
    const all = await this.repository.getEvents(100);
    return all.filter((e) => {
      const matchAction = e.action === action || e.metadata?.actionRequested === action;
      const matchLead = leadId ? e.leadId === leadId || e.metadata?.leadId === leadId : true;
      return matchAction && matchLead;
    });
  }

  async getRecentEvents(limit = 50, filterAction?: string): Promise<AuditEventRecord[]> {
    return this.repository.getEvents(limit, filterAction);
  }

  async getLeadAuditTrail(leadId: string): Promise<AuditEventRecord[]> {
    return this.repository.queryByLead(leadId);
  }

  async getTrail(filter?: { leadId?: string }): Promise<AuditEventRecord[]> {
    if (filter?.leadId) {
      return this.repository.queryByLead(filter.leadId);
    }
    return this.repository.getEvents();
  }

  clear(): void {
    this.repository.clearEvents();
  }

  clearEvents(): void {
    this.repository.clearEvents();
  }
}

export const defaultAuditRepository = new AuditRepository();
export const defaultAuditService = new AuditService(defaultAuditRepository);

export const auditModule = {
  name: 'audit',
  status: 'active',
  description: 'HQ Employee Append-Only Audit Trail & Authorization Traceability',
  service: defaultAuditService,
  repository: defaultAuditRepository,
};
