/**
 * Objective Engine
 *
 * Provides proactive action capabilities: the employee can follow up on stale
 * leads, send proposal reminders, and re-engage prospects without requiring a
 * live voice/API trigger.
 *
 * Every action must pass through the PolicyEngine before execution.
 * This is NOT a scheduler — it evaluates pending objectives and returns the
 * next best action when invoked. External scheduling (cron, webhook, or
 * background worker) triggers the evaluation.
 *
 * Objective lifecycle:
 *   PENDING → IN_PROGRESS → COMPLETED | FAILED | SKIPPED | DEFERRED
 */
import { randomUUID } from 'crypto';
import { defaultAuditService, AuditService } from '../audit/index.js';
import { defaultLeadsRepository, LeadsRepository, Lead } from '../leads/index.js';
import { defaultProposalService, ProposalService } from '../proposals/index.js';
import { AppError } from '../../errors/index.js';

// ── Domain Types ─────────────────────────────────────────────────────────────

export type ObjectiveType =
  | 'FOLLOW_UP_STALE_LEAD'
  | 'PROPOSAL_REMINDER'
  | 'RE_ENGAGE_LOST_LEAD'
  | 'MEETING_REMINDER'
  | 'POST_MEETING_FOLLOW_UP'
  | 'COLLECT_FEEDBACK'
  | 'CUSTOM';

export type ObjectiveStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED'
  | 'DEFERRED';

export type ObjectivePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Objective {
  id: string;
  companyId: string;
  type: ObjectiveType;
  status: ObjectiveStatus;
  priority: ObjectivePriority;
  leadId?: string;
  proposalId?: string;
  description: string;
  /** ISO date — when this objective becomes actionable */
  scheduledAfter: string;
  /** ISO date — after this, auto-expire */
  expiresAt: string;
  /** Number of attempts made */
  attemptCount: number;
  maxAttempts: number;
  /** Result from last attempt */
  lastAttemptResult?: string;
  lastAttemptAt?: string;
  /** What action should the employee take */
  suggestedAction: string;
  /** Metadata for the action */
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ObjectiveEvaluation {
  objective: Objective;
  action: string;
  policyCheck: 'ALLOW' | 'REQUIRE_APPROVAL' | 'BLOCK';
  reason: string;
}

// ── In-Memory Repository ──────────────────────────────────────────────────────

export class ObjectivesRepository {
  private objectives: Objective[] = [];

  async create(objective: Objective): Promise<Objective> {
    this.objectives.push(objective);
    return { ...objective };
  }

  async getById(id: string): Promise<Objective | null> {
    return this.objectives.find((o) => o.id === id) ?? null;
  }

  async listPending(companyId: string, now: Date = new Date()): Promise<Objective[]> {
    const nowISO = now.toISOString();
    return this.objectives.filter(
      (o) =>
        o.companyId === companyId &&
        o.status === 'PENDING' &&
        o.scheduledAfter <= nowISO &&
        o.expiresAt > nowISO &&
        o.attemptCount < o.maxAttempts
    );
  }

  async listByLead(leadId: string, companyId: string): Promise<Objective[]> {
    return this.objectives.filter(
      (o) => o.leadId === leadId && o.companyId === companyId
    );
  }

  async listAll(companyId: string): Promise<Objective[]> {
    return this.objectives.filter((o) => o.companyId === companyId);
  }

  async update(objective: Objective): Promise<Objective> {
    const idx = this.objectives.findIndex((o) => o.id === objective.id);
    if (idx < 0) throw new AppError('Objective not found', 404, 'NOT_FOUND');
    this.objectives[idx] = objective;
    return { ...objective };
  }

  async expireOverdue(companyId: string, now: Date = new Date()): Promise<number> {
    const nowISO = now.toISOString();
    let expired = 0;
    for (const o of this.objectives) {
      if (
        o.companyId === companyId &&
        o.status === 'PENDING' &&
        o.expiresAt <= nowISO
      ) {
        o.status = 'SKIPPED';
        o.updatedAt = nowISO;
        expired++;
      }
    }
    return expired;
  }
}

export const defaultObjectivesRepository = new ObjectivesRepository();

// ── Objective Engine ──────────────────────────────────────────────────────────

export class ObjectiveEngine {
  constructor(
    private readonly repository: ObjectivesRepository = defaultObjectivesRepository,
    private readonly leadsRepository: LeadsRepository = defaultLeadsRepository,
    private readonly auditService: AuditService = defaultAuditService
  ) {}

  /**
   * Scan all leads for a company and generate pending objectives based on
   * their current state and timing. Called by an external trigger (cron/webhook).
   */
  async generateObjectives(companyId: string): Promise<Objective[]> {
    const leads = await this.leadsRepository.listLeads({ companyId });
    const now = new Date();
    const generated: Objective[] = [];

    for (const lead of leads) {
      // Check existing objectives to avoid duplicates
      const existing = await this.repository.listByLead(lead.id, companyId);
      const pendingTypes = new Set(
        existing
          .filter((o) => o.status === 'PENDING' || o.status === 'IN_PROGRESS')
          .map((o) => o.type)
      );

      const objectives = this.evaluateLeadObjectives(lead, companyId, now, pendingTypes);
      for (const obj of objectives) {
        const saved = await this.repository.create(obj);
        generated.push(saved);
      }
    }

    // Expire overdue objectives
    const expiredCount = await this.repository.expireOverdue(companyId, now);

    await this.auditService.logEvent({
      actorType: 'SYSTEM',
      actorId: 'objective-engine',
      action: 'OBJECTIVES_GENERATED',
      targetType: 'COMPANY',
      targetId: companyId,
      metadata: {
        generatedCount: generated.length,
        expiredCount,
        evaluatedLeads: leads.length,
      },
    });

    return generated;
  }

  /**
   * Get the next actionable objective for the employee to execute.
   * Returns the highest-priority pending objective.
   */
  async getNextObjective(companyId: string): Promise<ObjectiveEvaluation | null> {
    const pending = await this.repository.listPending(companyId);
    if (pending.length === 0) return null;

    // Sort by priority (CRITICAL > HIGH > MEDIUM > LOW), then by scheduledAfter (oldest first)
    const priorityOrder: Record<ObjectivePriority, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };
    pending.sort((a, b) => {
      const pDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (pDiff !== 0) return pDiff;
      return a.scheduledAfter.localeCompare(b.scheduledAfter);
    });

    const objective = pending[0];

    // In a full implementation, this would call the PolicyEngine to check
    // if the employee is authorized to perform this action. For now, we
    // return ALLOW for standard follow-ups and REQUIRE_APPROVAL for re-engagement.
    const policyCheck: 'ALLOW' | 'REQUIRE_APPROVAL' | 'BLOCK' =
      objective.type === 'RE_ENGAGE_LOST_LEAD' ? 'REQUIRE_APPROVAL' : 'ALLOW';

    return {
      objective,
      action: objective.suggestedAction,
      policyCheck,
      reason:
        policyCheck === 'ALLOW'
          ? 'Standard follow-up within employee authority'
          : 'Re-engagement of lost lead requires human approval',
    };
  }

  /**
   * Mark an objective as completed after the employee has taken action.
   */
  async completeObjective(
    id: string,
    result: string,
    actorId = 'employee:coordinator'
  ): Promise<Objective> {
    const objective = await this.repository.getById(id);
    if (!objective) throw new AppError('Objective not found', 404, 'NOT_FOUND');

    objective.status = 'COMPLETED';
    objective.lastAttemptResult = result;
    objective.lastAttemptAt = new Date().toISOString();
    objective.updatedAt = new Date().toISOString();

    const updated = await this.repository.update(objective);

    await this.auditService.logEvent({
      actorType: 'EMPLOYEE',
      actorId,
      action: 'OBJECTIVE_COMPLETED',
      targetType: 'OBJECTIVE',
      targetId: id,
      metadata: {
        type: objective.type,
        leadId: objective.leadId,
        result,
      },
    });

    return updated;
  }

  /**
   * Mark an objective as failed (will retry if under maxAttempts).
   */
  async failObjective(id: string, reason: string): Promise<Objective> {
    const objective = await this.repository.getById(id);
    if (!objective) throw new AppError('Objective not found', 404, 'NOT_FOUND');

    objective.attemptCount += 1;
    objective.lastAttemptResult = reason;
    objective.lastAttemptAt = new Date().toISOString();
    objective.updatedAt = new Date().toISOString();

    if (objective.attemptCount >= objective.maxAttempts) {
      objective.status = 'FAILED';
    }
    // else: stays PENDING for retry

    return this.repository.update(objective);
  }

  /**
   * Defer an objective to a later time.
   */
  async deferObjective(id: string, deferUntil: Date): Promise<Objective> {
    const objective = await this.repository.getById(id);
    if (!objective) throw new AppError('Objective not found', 404, 'NOT_FOUND');

    objective.status = 'DEFERRED';
    objective.scheduledAfter = deferUntil.toISOString();
    objective.updatedAt = new Date().toISOString();

    // When the deferred time arrives, it becomes PENDING again
    if (deferUntil > new Date()) {
      objective.status = 'PENDING';
    }

    return this.repository.update(objective);
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  private evaluateLeadObjectives(
    lead: Lead,
    companyId: string,
    now: Date,
    pendingTypes: Set<ObjectiveType>
  ): Objective[] {
    const objectives: Objective[] = [];
    const dayMs = 24 * 60 * 60 * 1000;
    const leadAge = now.getTime() - new Date(lead.createdAt).getTime();

    // Rule 1: Stale QUALIFYING leads (> 3 days without update)
    if (
      ['QUALIFYING', 'ENGAGED'].includes(lead.status) &&
      leadAge > 3 * dayMs &&
      !pendingTypes.has('FOLLOW_UP_STALE_LEAD')
    ) {
      objectives.push(
        this.buildObjective({
          companyId,
          type: 'FOLLOW_UP_STALE_LEAD',
          priority: 'HIGH',
          leadId: lead.id,
          description: `Follow up with ${lead.fullName} — lead has been in ${lead.status} for ${Math.floor(leadAge / dayMs)} days`,
          suggestedAction: `Send a follow-up message to ${lead.fullName} (${lead.contactEmail}) asking about their project timeline and availability.`,
          scheduledAfter: now,
          expiresInDays: 7,
        })
      );
    }

    // Rule 2: PROPOSAL_SENT > 5 days without response
    if (
      lead.status === 'PROPOSAL_SENT' &&
      leadAge > 5 * dayMs &&
      !pendingTypes.has('PROPOSAL_REMINDER')
    ) {
      objectives.push(
        this.buildObjective({
          companyId,
          type: 'PROPOSAL_REMINDER',
          priority: 'HIGH',
          leadId: lead.id,
          description: `Proposal reminder for ${lead.fullName} — sent ${Math.floor(leadAge / dayMs)} days ago with no response`,
          suggestedAction: `Send a gentle reminder to ${lead.fullName} about the pending proposal. Ask if they have questions or need clarification.`,
          scheduledAfter: now,
          expiresInDays: 14,
        })
      );
    }

    // Rule 3: MEETING_BOOKED — post-meeting follow-up (scheduled 1 day after meeting)
    if (
      lead.status === 'MEETING_BOOKED' &&
      !pendingTypes.has('POST_MEETING_FOLLOW_UP')
    ) {
      objectives.push(
        this.buildObjective({
          companyId,
          type: 'POST_MEETING_FOLLOW_UP',
          priority: 'MEDIUM',
          leadId: lead.id,
          description: `Post-meeting follow-up with ${lead.fullName}`,
          suggestedAction: `Send a thank-you and next-steps summary to ${lead.fullName} after the meeting. Include the proposal generation timeline.`,
          scheduledAfter: new Date(now.getTime() + 1 * dayMs),
          expiresInDays: 3,
        })
      );
    }

    // Rule 4: LOST leads > 30 days — re-engagement (requires approval)
    if (
      lead.status === 'LOST' &&
      leadAge > 30 * dayMs &&
      !pendingTypes.has('RE_ENGAGE_LOST_LEAD')
    ) {
      objectives.push(
        this.buildObjective({
          companyId,
          type: 'RE_ENGAGE_LOST_LEAD',
          priority: 'LOW',
          leadId: lead.id,
          description: `Re-engage ${lead.fullName} — lost ${Math.floor(leadAge / dayMs)} days ago`,
          suggestedAction: `Send a non-intrusive check-in to ${lead.fullName} asking if their project needs have changed. Do NOT offer discounts without approval.`,
          scheduledAfter: now,
          expiresInDays: 30,
          maxAttempts: 1,
        })
      );
    }

    return objectives;
  }

  private buildObjective(params: {
    companyId: string;
    type: ObjectiveType;
    priority: ObjectivePriority;
    leadId?: string;
    proposalId?: string;
    description: string;
    suggestedAction: string;
    scheduledAfter: Date;
    expiresInDays: number;
    maxAttempts?: number;
  }): Objective {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    return {
      id: randomUUID(),
      companyId: params.companyId,
      type: params.type,
      status: 'PENDING',
      priority: params.priority,
      leadId: params.leadId,
      proposalId: params.proposalId,
      description: params.description,
      scheduledAfter: params.scheduledAfter.toISOString(),
      expiresAt: new Date(now.getTime() + params.expiresInDays * dayMs).toISOString(),
      attemptCount: 0,
      maxAttempts: params.maxAttempts ?? 3,
      suggestedAction: params.suggestedAction,
      metadata: {},
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }
}

export const defaultObjectiveEngine = new ObjectiveEngine();

export const objectivesModule = {
  name: 'objectives',
  status: 'active',
  description: 'Proactive follow-up engine: generates and prioritizes actionable objectives from lead state',
  engine: defaultObjectiveEngine,
  repository: defaultObjectivesRepository,
};
