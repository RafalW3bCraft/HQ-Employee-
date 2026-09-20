import { randomUUID } from 'crypto';
import { query } from '../../db/index.js';
import { AppError, NotFoundError } from '../../errors/index.js';

export type ApprovalStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface ApprovalRequest {
  id: string;
  companyId: string;
  leadId: string;
  callId?: string;
  actionName: string;
  actionPayload: Record<string, unknown>;
  reason: string;
  status: ApprovalStatus;
  requestedAt: string;
  resolvedAt?: string;
  approverId?: string;
  expiresAt: string;
}

const defaultCompanyId = '00000000-0000-0000-0000-000000000001';

export class ApprovalsRepository {
  private approvals: ApprovalRequest[] = [];

  async createRequest(data: {
    companyId?: string;
    leadId: string;
    callId?: string;
    actionName: string;
    actionPayload: Record<string, unknown>;
    reason: string;
    expiresInHours?: number;
  }): Promise<ApprovalRequest> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (data.expiresInHours || 24) * 60 * 60 * 1000);

    const record: ApprovalRequest = {
      id: randomUUID(),
      companyId: data.companyId || defaultCompanyId,
      leadId: data.leadId,
      callId: data.callId,
      actionName: data.actionName,
      actionPayload: data.actionPayload,
      reason: data.reason,
      status: 'REQUESTED',
      requestedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    this.approvals.unshift(record);

    try {
      await query(
        `INSERT INTO approvals (id, company_id, lead_id, call_id, action_type, action_payload, reason, status, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          record.id,
          record.companyId,
          record.leadId,
          record.callId || null,
          record.actionName,
          JSON.stringify(record.actionPayload),
          record.reason,
          record.status,
          record.expiresAt,
          record.requestedAt,
        ]
      );
    } catch {
      // In-memory fallback
    }

    return JSON.parse(JSON.stringify(record));
  }

  async getRequest(id: string): Promise<ApprovalRequest | null> {
    const item = this.approvals.find((a) => a.id === id);
    if (!item) return null;
    if (item.status === 'REQUESTED' && new Date(item.expiresAt).getTime() < Date.now()) {
      item.status = 'EXPIRED';
    }
    return JSON.parse(JSON.stringify(item));
  }

  async listRequests(filter?: { status?: ApprovalStatus; leadId?: string }): Promise<ApprovalRequest[]> {
    const now = Date.now();
    for (const item of this.approvals) {
      if (item.status === 'REQUESTED' && new Date(item.expiresAt).getTime() < now) {
        item.status = 'EXPIRED';
      }
    }
    let result = this.approvals;
    if (filter?.status) {
      result = result.filter((a) => a.status === filter.status);
    }
    if (filter?.leadId) {
      result = result.filter((a) => a.leadId === filter.leadId);
    }
    return JSON.parse(JSON.stringify(result));
  }

  async resolveRequest(id: string, status: 'APPROVED' | 'REJECTED', approverId: string): Promise<ApprovalRequest> {
    const idx = this.approvals.findIndex((a) => a.id === id);
    if (idx < 0) {
      throw new NotFoundError('ApprovalRequest', id);
    }
    const item = this.approvals[idx];
    if (new Date(item.expiresAt).getTime() < Date.now()) {
      item.status = 'EXPIRED';
      throw new AppError(`Approval request '${id}' has expired and cannot be resolved`, 410, 'APPROVAL_EXPIRED');
    }
    const updated: ApprovalRequest = {
      ...this.approvals[idx],
      status,
      approverId,
      resolvedAt: new Date().toISOString(),
    };
    this.approvals[idx] = updated;

    try {
      await query(
        `UPDATE approvals SET status = $1, approver_id = $2, resolved_at = $3 WHERE id = $4`,
        [status, approverId, updated.resolvedAt, id]
      );
    } catch {
      // In-memory fallback
    }

    return JSON.parse(JSON.stringify(updated));
  }

  clear() {
    this.approvals = [];
  }
}

export class ApprovalsService {
  constructor(private readonly repository: ApprovalsRepository) {}

  async createRequest(data: {
    companyId?: string;
    leadId: string;
    callId?: string;
    actionName: string;
    actionPayload: Record<string, unknown>;
    reason: string;
    expiresInHours?: number;
  }): Promise<ApprovalRequest> {
    return this.repository.createRequest(data);
  }

  async resolveRequest(id: string, status: 'APPROVED' | 'REJECTED', approverId: string): Promise<ApprovalRequest> {
    return this.repository.resolveRequest(id, status, approverId);
  }

  async listRequests(filter?: { status?: ApprovalStatus; leadId?: string }): Promise<ApprovalRequest[]> {
    return this.repository.listRequests(filter);
  }

  async getRequest(id: string): Promise<ApprovalRequest | null> {
    return this.repository.getRequest(id);
  }

  async executeApprovedAction(id: string): Promise<{ success: boolean; message: string }> {
    const request = await this.getRequest(id);
    if (!request) {
      throw new NotFoundError('ApprovalRequest', id);
    }
    if (request.status === 'EXPIRED') {
      throw new AppError(`Cannot execute action: Approval request '${id}' has expired`, 410, 'APPROVAL_EXPIRED');
    }
    if (request.status !== 'APPROVED') {
      throw new AppError(`Cannot execute action: Approval request '${id}' is in status '${request.status}'`, 403, 'APPROVAL_NOT_GRANTED');
    }
    return {
      success: true,
      message: `Action '${request.actionName}' executed successfully under approval '${id}'.`,
    };
  }
}

export const defaultApprovalsRepository = new ApprovalsRepository();
export const defaultApprovalsService = new ApprovalsService(defaultApprovalsRepository);

export const approvalsModule = {
  name: 'approvals',
  status: 'active',
  description: 'Human approval and escalation workflow boundary',
  service: defaultApprovalsService,
  repository: defaultApprovalsRepository,
};
