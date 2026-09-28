/**
 * Proposals Module
 *
 * Handles generation, tracking, and lifecycle of client project proposals.
 * The AI employee can present standard approved pricing. Custom terms or
 * deviations require human director approval via the policy engine.
 *
 * Proposal Lifecycle:
 *   DRAFT → SENT → VIEWED → NEGOTIATING → ACCEPTED | REJECTED | EXPIRED
 */
import { randomUUID } from 'crypto';
import { query } from '../../db/index.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../errors/index.js';
import { defaultAuditService, AuditService } from '../audit/index.js';
import { ProjectBrief } from '../leads/index.js';

// ── Domain Types ─────────────────────────────────────────────────────────────

export type ProposalStatus =
  | 'DRAFT'
  | 'SENT'
  | 'VIEWED'
  | 'NEGOTIATING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED';

export interface ProposalLineItem {
  id: string;
  description: string;
  unitPriceCents: number;
  quantity: number;
  totalCents: number;
  notes?: string;
}

export interface Proposal {
  id: string;
  companyId: string;
  leadId: string;
  briefId: string;
  status: ProposalStatus;
  title: string;
  executiveSummary: string;
  lineItems: ProposalLineItem[];
  totalCents: number;
  currency: string;
  validUntil: string; // ISO date — proposals expire
  deliveryWeeks: number;
  paymentTermsDays: number;
  termsAndConditionsUrl?: string;
  // Approval tracking for custom terms
  requiresHumanApproval: boolean;
  approvalId?: string;
  // Signature tracking
  signedAt?: string;
  signedByName?: string;
  // Version control
  version: number;
  createdBy: string; // employee ID or 'system'
  createdAt: string;
  updatedAt: string;
}

export interface CreateProposalDTO {
  companyId: string;
  leadId: string;
  brief: ProjectBrief;
  createdBy: string;
  customOverrides?: {
    totalCents?: number;
    deliveryWeeks?: number;
    requiresApproval?: boolean;
    approvalId?: string;
  };
}

export interface UpdateProposalDTO {
  status?: ProposalStatus;
  lineItems?: ProposalLineItem[];
  totalCents?: number;
  deliveryWeeks?: number;
  signedAt?: string;
  signedByName?: string;
  requiresHumanApproval?: boolean;
  approvalId?: string;
}

// ── In-Memory Repository ──────────────────────────────────────────────────────

export class ProposalsRepository {
  private proposals: Proposal[] = [];

  private mapRowToProposal(row: any, lineItemRows: any[] = []): Proposal {
    return {
      id: row.id,
      companyId: row.company_id,
      leadId: row.lead_id,
      briefId: row.brief_id,
      status: row.status as ProposalStatus,
      title: row.title,
      executiveSummary: row.executive_summary,
      lineItems: lineItemRows.map((item) => ({
        id: item.id,
        description: item.description,
        unitPriceCents: Number(item.unit_price_cents),
        quantity: Number(item.quantity),
        totalCents: Number(item.total_cents),
        notes: item.notes ?? undefined,
      })),
      totalCents: Number(row.total_cents),
      currency: row.currency,
      validUntil: row.valid_until instanceof Date ? row.valid_until.toISOString() : String(row.valid_until),
      deliveryWeeks: Number(row.delivery_weeks),
      paymentTermsDays: Number(row.payment_terms_days),
      termsAndConditionsUrl: row.terms_and_conditions_url ?? undefined,
      requiresHumanApproval: Boolean(row.requires_human_approval),
      approvalId: row.approval_id ?? undefined,
      signedAt: row.signed_at ? (row.signed_at instanceof Date ? row.signed_at.toISOString() : String(row.signed_at)) : undefined,
      signedByName: row.signed_by_name ?? undefined,
      version: Number(row.version),
      createdBy: row.created_by,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  async getProposal(id: string): Promise<Proposal | null> {
    try {
      const res = await query<any>('SELECT * FROM proposals WHERE id = $1', [id]);
      if (res.rows.length > 0) {
        const lineItemsRes = await query<any>(
          'SELECT * FROM proposal_line_items WHERE proposal_id = $1 ORDER BY display_order ASC',
          [id]
        );
        return this.mapRowToProposal(res.rows[0], lineItemsRes.rows);
      }
    } catch {
      // In-memory fallback
    }
    return this.proposals.find((p) => p.id === id) ?? null;
  }

  async getProposalsByLead(leadId: string, companyId: string): Promise<Proposal[]> {
    try {
      const res = await query<any>(
        'SELECT * FROM proposals WHERE lead_id = $1 AND company_id = $2 ORDER BY created_at DESC',
        [leadId, companyId]
      );
      if (res.rows.length > 0) {
        const proposals: Proposal[] = [];
        for (const row of res.rows) {
          const lineItemsRes = await query<any>(
            'SELECT * FROM proposal_line_items WHERE proposal_id = $1 ORDER BY display_order ASC',
            [row.id]
          );
          proposals.push(this.mapRowToProposal(row, lineItemsRes.rows));
        }
        return proposals;
      }
    } catch {
      // In-memory fallback
    }
    return this.proposals.filter((p) => p.leadId === leadId && p.companyId === companyId);
  }

  async listProposals(companyId: string): Promise<Proposal[]> {
    try {
      const res = await query<any>(
        'SELECT * FROM proposals WHERE company_id = $1 ORDER BY created_at DESC',
        [companyId]
      );
      if (res.rows.length > 0) {
        const proposals: Proposal[] = [];
        for (const row of res.rows) {
          const lineItemsRes = await query<any>(
            'SELECT * FROM proposal_line_items WHERE proposal_id = $1 ORDER BY display_order ASC',
            [row.id]
          );
          proposals.push(this.mapRowToProposal(row, lineItemsRes.rows));
        }
        return proposals;
      }
    } catch {
      // In-memory fallback
    }
    return this.proposals.filter((p) => p.companyId === companyId);
  }

  async createProposal(proposal: Proposal): Promise<Proposal> {
    try {
      await query(
        `INSERT INTO proposals (
          id, company_id, lead_id, brief_id, status, title, executive_summary,
          total_cents, currency, valid_until, delivery_weeks, payment_terms_days,
          terms_and_conditions_url, requires_human_approval, approval_id,
          signed_at, signed_by_name, version, created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        )`,
        [
          proposal.id,
          proposal.companyId,
          proposal.leadId,
          proposal.briefId,
          proposal.status,
          proposal.title,
          proposal.executiveSummary,
          proposal.totalCents,
          proposal.currency,
          proposal.validUntil,
          proposal.deliveryWeeks,
          proposal.paymentTermsDays,
          proposal.termsAndConditionsUrl ?? null,
          proposal.requiresHumanApproval,
          proposal.approvalId ?? null,
          proposal.signedAt ?? null,
          proposal.signedByName ?? null,
          proposal.version,
          proposal.createdBy,
          proposal.createdAt,
          proposal.updatedAt,
        ]
      );

      for (let i = 0; i < proposal.lineItems.length; i++) {
        const item = proposal.lineItems[i];
        await query(
          `INSERT INTO proposal_line_items (
            id, proposal_id, description, unit_price_cents, quantity, total_cents, notes, display_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            item.id,
            proposal.id,
            item.description,
            item.unitPriceCents,
            item.quantity,
            item.totalCents,
            item.notes ?? null,
            i,
          ]
        );
      }
    } catch {
      // Allow in-memory fallback
    }

    const existingIdx = this.proposals.findIndex((p) => p.id === proposal.id);
    if (existingIdx >= 0) {
      this.proposals[existingIdx] = proposal;
    } else {
      this.proposals.push(proposal);
    }
    return JSON.parse(JSON.stringify(proposal));
  }

  async updateProposal(proposal: Proposal): Promise<Proposal> {
    try {
      await query(
        `UPDATE proposals SET
          status = $1, title = $2, executive_summary = $3, total_cents = $4,
          delivery_weeks = $5, requires_human_approval = $6, approval_id = $7,
          signed_at = $8, signed_by_name = $9, version = $10, updated_at = $11
        WHERE id = $12`,
        [
          proposal.status,
          proposal.title,
          proposal.executiveSummary,
          proposal.totalCents,
          proposal.deliveryWeeks,
          proposal.requiresHumanApproval,
          proposal.approvalId ?? null,
          proposal.signedAt ?? null,
          proposal.signedByName ?? null,
          proposal.version,
          proposal.updatedAt,
          proposal.id,
        ]
      );
    } catch {
      // In-memory fallback
    }

    const idx = this.proposals.findIndex((p) => p.id === proposal.id);
    if (idx < 0) throw new NotFoundError('Proposal', proposal.id);
    this.proposals[idx] = proposal;
    return JSON.parse(JSON.stringify(proposal));
  }
}

export const defaultProposalsRepository = new ProposalsRepository();

// ── Proposal Service ──────────────────────────────────────────────────────────

// Standard line item templates derived from approved pricing guidance
const STANDARD_RATE_CENTS_PER_WEEK = 500000; // $5,000/week baseline

export class ProposalService {
  constructor(
    private readonly repository: ProposalsRepository = defaultProposalsRepository,
    private readonly auditService: AuditService = defaultAuditService
  ) {}

  /**
   * Generate a structured proposal from a completed ProjectBrief.
   * Uses approved pricing guidance. Custom overrides require approval flag.
   */
  async generateProposal(dto: CreateProposalDTO): Promise<Proposal> {
    const { companyId, leadId, brief, createdBy, customOverrides } = dto;

    if (!brief.leadId) throw new ValidationError('Brief must reference a lead');
    if (brief.qualificationScore < 40) {
      throw new ValidationError(
        'Lead qualification score too low to generate proposal. Continue discovery first.'
      );
    }

    // Build line items from brief
    const lineItems: ProposalLineItem[] = [];

    // Development time estimate
    const estimatedWeeks = this.estimateWeeks(brief);
    const devCents = estimatedWeeks * STANDARD_RATE_CENTS_PER_WEEK;
    lineItems.push({
      id: randomUUID(),
      description: `Software Development — ${brief.opportunityDetails.projectType}`,
      unitPriceCents: STANDARD_RATE_CENTS_PER_WEEK,
      quantity: estimatedWeeks,
      totalCents: devCents,
      notes: `Based on ${estimatedWeeks} weeks of development for scope described in discovery.`,
    });

    // Requirements & Architecture phase
    const archCents = 150000; // $1,500 fixed
    lineItems.push({
      id: randomUUID(),
      description: 'Technical Discovery & Architecture Documentation',
      unitPriceCents: archCents,
      quantity: 1,
      totalCents: archCents,
      notes: 'Includes technical specification, system architecture, and project plan.',
    });

    // Testing & QA
    const qaCents = Math.round(devCents * 0.15);
    lineItems.push({
      id: randomUUID(),
      description: 'Quality Assurance & Testing',
      unitPriceCents: qaCents,
      quantity: 1,
      totalCents: qaCents,
      notes: 'Automated and manual testing, performance validation.',
    });

    let totalCents = lineItems.reduce((sum, li) => sum + li.totalCents, 0);

    // Apply custom override if present (requires approval)
    const requiresHumanApproval = customOverrides?.requiresApproval ?? false;
    if (customOverrides?.totalCents && customOverrides.totalCents !== totalCents) {
      totalCents = customOverrides.totalCents;
    }

    const deliveryWeeks = customOverrides?.deliveryWeeks ?? estimatedWeeks;

    // Proposals valid for 14 days
    const validUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const now = new Date().toISOString();
    const proposal: Proposal = {
      id: randomUUID(),
      companyId,
      leadId,
      briefId: brief.briefId,
      status: 'DRAFT',
      title: `Project Proposal — ${brief.opportunityDetails.projectType} for ${brief.leadName}`,
      executiveSummary: brief.executiveSummary,
      lineItems,
      totalCents,
      currency: 'USD',
      validUntil,
      deliveryWeeks,
      paymentTermsDays: 30,
      requiresHumanApproval,
      approvalId: customOverrides?.approvalId,
      version: 1,
      createdBy,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.repository.createProposal(proposal);

    await this.auditService.logEvent({
      actorType: 'EMPLOYEE',
      actorId: createdBy,
      action: 'PROPOSAL_GENERATED',
      targetType: 'PROPOSAL',
      targetId: saved.id,
      metadata: {
        companyId,
        leadId,
        briefId: brief.briefId,
        totalCents,
        deliveryWeeks,
        requiresHumanApproval,
        lineItemCount: lineItems.length,
      },
    });

    return saved;
  }

  async getProposal(id: string, companyId: string): Promise<Proposal> {
    const proposal = await this.repository.getProposal(id);
    if (!proposal) throw new NotFoundError('Proposal', id);
    if (proposal.companyId !== companyId) {
      throw new ForbiddenError(`Cross-tenant proposal access denied for proposal '${id}'`);
    }
    return proposal;
  }

  async listProposals(companyId: string): Promise<Proposal[]> {
    return this.repository.listProposals(companyId);
  }

  async getProposalsByLead(leadId: string, companyId: string): Promise<Proposal[]> {
    return this.repository.getProposalsByLead(leadId, companyId);
  }

  /**
   * Update proposal status and details.
   * Transitions must follow the valid lifecycle sequence.
   */
  async updateProposal(
    id: string,
    companyId: string,
    updates: UpdateProposalDTO,
    actorId: string
  ): Promise<Proposal> {
    const proposal = await this.getProposal(id, companyId);

    // Validate status transition
    if (updates.status) {
      this.validateTransition(proposal.status, updates.status);
    }

    const now = new Date().toISOString();
    const updated: Proposal = {
      ...proposal,
      ...updates,
      updatedAt: now,
    };

    const saved = await this.repository.updateProposal(updated);

    await this.auditService.logEvent({
      actorType: 'EMPLOYEE',
      actorId,
      action: 'PROPOSAL_UPDATED',
      targetType: 'PROPOSAL',
      targetId: id,
      metadata: {
        companyId,
        leadId: proposal.leadId,
        previousStatus: proposal.status,
        newStatus: updates.status || proposal.status,
        changes: Object.keys(updates),
      },
    });

    return saved;
  }

  /**
   * Mark proposal as SENT to the prospect.
   * This is recorded as a governed action.
   */
  async sendProposal(id: string, companyId: string, actorId: string): Promise<Proposal> {
    const proposal = await this.getProposal(id, companyId);

    if (proposal.requiresHumanApproval && !proposal.approvalId) {
      throw new ValidationError(
        'This proposal contains custom terms and requires human director approval before sending.'
      );
    }

    return this.updateProposal(id, companyId, { status: 'SENT' }, actorId);
  }

  /**
   * Record prospect acceptance (e-signature or verbal confirmation).
   * Requires human follow-up for formal contract.
   */
  async acceptProposal(
    id: string,
    companyId: string,
    signedByName: string,
    actorId: string
  ): Promise<Proposal> {
    return this.updateProposal(
      id,
      companyId,
      {
        status: 'ACCEPTED',
        signedAt: new Date().toISOString(),
        signedByName,
      },
      actorId
    );
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  private estimateWeeks(brief: ProjectBrief): number {
    const complexity = brief.opportunityDetails.keyFeatures.length;
    const integrations = brief.opportunityDetails.integrations.length;

    // Base: 4 weeks + 1 week per 2 features + 1 week per integration
    const base = 4 + Math.ceil(complexity / 2) + integrations;

    // Override if brief has explicit timeline
    const tlDesc = brief.commercialParameters.timelineExpected?.toLowerCase() || '';
    const weekMatch = tlDesc.match(/(\d+)\s*week/);
    if (weekMatch) {
      return Math.max(2, parseInt(weekMatch[1], 10));
    }
    const monthMatch = tlDesc.match(/(\d+)\s*month/);
    if (monthMatch) {
      return Math.max(2, parseInt(monthMatch[1], 10) * 4);
    }

    return Math.max(4, Math.min(base, 24)); // Cap at 24 weeks for autonomous proposals
  }

  private validateTransition(from: ProposalStatus, to: ProposalStatus): void {
    const validTransitions: Record<ProposalStatus, ProposalStatus[]> = {
      DRAFT: ['SENT', 'REJECTED'],
      SENT: ['VIEWED', 'NEGOTIATING', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
      VIEWED: ['NEGOTIATING', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
      NEGOTIATING: ['ACCEPTED', 'REJECTED', 'EXPIRED'],
      ACCEPTED: [], // Terminal
      REJECTED: [], // Terminal
      EXPIRED: ['DRAFT'], // Can re-draft
    };

    if (!validTransitions[from]?.includes(to)) {
      throw new ValidationError(
        `Invalid proposal status transition: ${from} → ${to}`
      );
    }
  }
}

export const defaultProposalService = new ProposalService();

export const proposalsModule = {
  name: 'proposals',
  status: 'active',
  description: 'Client project proposal generation, lifecycle management, and governance',
  service: defaultProposalService,
  repository: defaultProposalsRepository,
};
