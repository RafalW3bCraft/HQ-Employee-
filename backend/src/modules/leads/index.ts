import { randomUUID } from 'crypto';
import { query } from '../../db/index.js';
import { NotFoundError, ValidationError } from '../../errors/index.js';
import { defaultAuditService } from '../audit/index.js';

export type QualificationStatus =
  // ── Discovery & Qualification ─────────────────────────────────────────────
  | 'NEW'
  | 'CONTACTED'
  | 'ENGAGED'
  | 'QUALIFYING'
  | 'QUALIFIED'
  | 'UNQUALIFIED'
  // ── Meeting ───────────────────────────────────────────────────────────────
  | 'MEETING_PENDING'
  | 'MEETING_BOOKED'
  // ── Proposal & Negotiation ────────────────────────────────────────────────
  | 'PROPOSAL_PREPARATION'
  | 'PROPOSAL_SENT'
  | 'NEGOTIATION'
  | 'AGREED'
  // ── Project Lifecycle ─────────────────────────────────────────────────────
  | 'PROJECT_CREATED'
  | 'ONBOARDING'
  | 'IN_DEVELOPMENT'
  | 'CLIENT_REVIEW'
  | 'DELIVERED'
  | 'SUPPORT'
  // ── Terminal States ───────────────────────────────────────────────────────
  | 'HUMAN_HANDOFF'
  | 'CONVERTED'
  | 'LOST';


export type LeadFactKey =
  | 'project_type'
  | 'business_objective'
  | 'target_users'
  | 'required_features'
  | 'integrations'
  | 'existing_system'
  | 'timeline'
  | 'budget'
  | 'decision_maker'
  | 'urgency';

export interface FactProvenance {
  source: string;
  conversationId: string;
  timestamp: string;
  confidence: number;
  status: 'CONFIRMED' | 'UNCONFIRMED' | 'DISPUTED';
}

export interface ConversationFact {
  id: string;
  leadId: string;
  conversationId: string;
  key: LeadFactKey;
  value: string;
  provenance: FactProvenance;
  createdAt: string;
}

export interface DisputedFactRecord {
  key: LeadFactKey;
  confirmedValue: string;
  conflictingValue: string;
  reason: string;
  timestamp: string;
}

export interface LeadMemory {
  projectType?: string;
  businessObjective?: string;
  targetUsers?: string;
  requiredFeatures: string[];
  integrations: string[];
  existingSystem?: string;
  timelineExpected?: string;
  budgetRange?: string;
  decisionMaker?: string;
  urgency?: string;
  facts: ConversationFact[];
  disputedFacts: DisputedFactRecord[];
}

export interface Lead {
  id: string;
  companyId: string;
  fullName: string;
  companyName?: string;
  contactEmail?: string;
  contactPhone?: string;
  status: QualificationStatus;
  qualificationNotes?: string;
  memory: LeadMemory;
  createdAt: string;
  updatedAt: string;
}

export interface AdaptiveQuestion {
  factKey?: LeadFactKey;
  questionText: string;
  rationale: string;
  isDiscoveryComplete: boolean;
  recommendedNextAction: string;
}

export interface ProjectBrief {
  briefId: string;
  leadId: string;
  leadName: string;
  companyName?: string;
  qualificationStatus: QualificationStatus;
  qualificationScore: number; // 0 to 100
  executiveSummary: string;
  opportunityDetails: {
    projectType: string;
    businessObjective: string;
    targetAudience: string;
    keyFeatures: string[];
    integrations: string[];
    existingSystem: string;
  };
  commercialParameters: {
    budgetRange: string;
    timelineExpected: string;
    urgencyLevel: string;
    decisionMakerConfirmed: boolean;
  };
  provenanceTrail: Array<{
    key: string;
    value: string;
    confidence: number;
    source: string;
    status: string;
    timestamp: string;
  }>;
  recommendedNextSteps: string;
  generatedAt: string;
}

// Default initial seeds
const defaultCompanyId = 'c0000000-0000-0000-0000-000000000001';

// Initial in-memory repository store
export class LeadsRepository {
  private leads: Lead[] = [
    {
      id: 'lead-001',
      companyId: defaultCompanyId,
      fullName: 'Sarah Jenkins',
      companyName: 'Apex Logistics',
      contactEmail: 'sarah.j@apexlogistics.com',
      contactPhone: '+1 (555) 342-9810',
      status: 'QUALIFIED',
      qualificationNotes: 'High-urgency logistics workflow portal. Budget $20k aligns with custom software tier.',
      memory: {
        projectType: 'Custom Software',
        businessObjective: 'Automate warehouse dispatch and driver communication portal.',
        targetUsers: '120 drivers and dispatch managers',
        requiredFeatures: ['Driver mobile check-in', 'Real-time dispatch map', 'Automated SMS alerts'],
        integrations: ['Existing ERP database', 'Twilio SMS'],
        existingSystem: 'Legacy spreadsheets and manual phone dispatch',
        timelineExpected: '8 weeks',
        budgetRange: '$15,000 - $25,000',
        decisionMaker: 'VP of Operations (Sole Decision Maker)',
        urgency: 'HIGH',
        facts: [],
        disputedFacts: [],
      },
      createdAt: '2026-09-15T14:32:00Z',
      updatedAt: '2026-09-15T14:32:00Z',
    },
    {
      id: 'lead-002',
      companyId: defaultCompanyId,
      fullName: 'Marcus Vance',
      companyName: 'Vance Health Tech',
      contactPhone: '+1 (555) 890-4122',
      status: 'MEETING_BOOKED',
      qualificationNotes: 'AI clinical notes summarizer with AssemblyAI integration. Discovery meeting booked.',
      memory: {
        projectType: 'AI & ML Engineering',
        businessObjective: 'Build real-time speech-to-text clinical notes summarizer with strict policy guardrails.',
        targetUsers: 'Clinicians and nurses',
        requiredFeatures: ['Voice dictation', 'EHR export', 'Medical terms biased transcription'],
        integrations: ['AssemblyAI Voice Agent API', 'Epic EHR'],
        timelineExpected: '3 months',
        budgetRange: '$30,000+',
        decisionMaker: 'Co-founder & CTO',
        urgency: 'HIGH',
        facts: [],
        disputedFacts: [],
      },
      createdAt: '2026-09-16T09:15:00Z',
      updatedAt: '2026-09-16T09:15:00Z',
    },
  ];

  async getLead(id: string): Promise<Lead | null> {
    const lead = this.leads.find(l => l.id === id);
    return lead ? JSON.parse(JSON.stringify(lead)) : null;
  }

  async listLeads(filter?: { status?: QualificationStatus; companyId?: string }): Promise<Lead[]> {
    let result = this.leads;
    if (filter?.status) {
      result = result.filter(l => l.status === filter.status);
    }
    if (filter?.companyId) {
      result = result.filter(l => l.companyId === filter.companyId);
    }
    return JSON.parse(JSON.stringify(result));
  }

  async createLead(data: {
    companyId?: string;
    fullName: string;
    companyName?: string;
    contactEmail?: string;
    contactPhone?: string;
    status?: QualificationStatus;
  }): Promise<Lead> {
    const now = new Date().toISOString();
    const newLead: Lead = {
      id: randomUUID(),
      companyId: data.companyId || defaultCompanyId,
      fullName: data.fullName,
      companyName: data.companyName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      status: data.status || 'NEW',
      qualificationNotes: '',
      memory: {
        requiredFeatures: [],
        integrations: [],
        facts: [],
        disputedFacts: [],
      },
      createdAt: now,
      updatedAt: now,
    };

    this.leads.unshift(newLead);
    return JSON.parse(JSON.stringify(newLead));
  }

  async updateLead(lead: Lead): Promise<Lead> {
    const idx = this.leads.findIndex(l => l.id === lead.id);
    if (idx >= 0) {
      this.leads[idx] = {
        ...lead,
        updatedAt: new Date().toISOString(),
      };
      return JSON.parse(JSON.stringify(this.leads[idx]));
    }
    throw new NotFoundError('Lead', lead.id);
  }

  clear() {
    this.leads = [];
  }
}

export class LeadQualificationService {
  constructor(
    private readonly repository: LeadsRepository,
    private readonly auditService = defaultAuditService
  ) {}

  async getLead(id: string): Promise<Lead> {
    const lead = await this.repository.getLead(id);
    if (!lead) throw new NotFoundError('Lead', id);
    return lead;
  }

  async listLeads(filter?: { status?: QualificationStatus; companyId?: string }): Promise<Lead[]> {
    return this.repository.listLeads(filter);
  }

  async createLead(data: {
    fullName: string;
    companyName?: string;
    contactEmail?: string;
    contactPhone?: string;
    companyId?: string;
  }): Promise<Lead> {
    if (!data.fullName || !data.fullName.trim()) {
      throw new ValidationError('Lead full name is required');
    }
    return this.repository.createLead(data);
  }

  async updateLeadStatus(id: string, status: QualificationStatus): Promise<Lead> {
    const lead = await this.getLead(id);
    lead.status = status;
    const updated = await this.repository.updateLead(lead);
    await this.auditService.logEvent({
      action: 'LEAD_UPDATED',
      companyId: lead.companyId,
      leadId: id,
      targetType: 'LEAD',
      targetId: id,
      actorType: 'SYSTEM',
      actorId: 'system',
      metadata: { leadId: id, oldStatus: lead.status, newStatus: status },
    });
    return updated;
  }

  /**
   * Ingests and validates an extracted conversation fact with strict provenance.
   * Prevents unsupported facts from being marked confirmed.
   * Intercepts and flags contradictory facts.
   */
  async recordFact(params: {
    leadId: string;
    key: LeadFactKey;
    value: string;
    confidence: number;
    source: string;
    conversationId?: string;
  }): Promise<{ fact: ConversationFact; statusChanged: boolean; newStatus: QualificationStatus }> {
    const lead = await this.getLead(params.leadId);
    const convId = params.conversationId || randomUUID();
    const now = new Date().toISOString();

    // 1. Validation: Confidence gate
    // Unsupported / low-confidence claims (< 0.6) are never silently written as confirmed
    const isSupported = params.confidence >= 0.6;
    let factStatus: 'CONFIRMED' | 'UNCONFIRMED' | 'DISPUTED' = isSupported ? 'CONFIRMED' : 'UNCONFIRMED';
    let contradictionDetected = false;

    // 2. Contradiction Detection against existing confirmed facts
    if (isSupported) {
      const existingConfirmed = lead.memory.facts.filter(f => f.key === params.key && f.provenance.status === 'CONFIRMED');
      if (existingConfirmed.length > 0) {
        const lastFact = existingConfirmed[existingConfirmed.length - 1];
        if (this.isContradiction(params.key, lastFact.value, params.value)) {
          contradictionDetected = true;
          factStatus = 'DISPUTED';

          lead.memory.disputedFacts.push({
            key: params.key,
            confirmedValue: lastFact.value,
            conflictingValue: params.value,
            reason: `Conflicting value received for ${params.key}: '${params.value}' contradicts previously confirmed '${lastFact.value}'`,
            timestamp: now,
          });

          // Log audit event for conflict
          await this.auditService.logEvent({
            actorType: 'SYSTEM',
            actorId: 'qualification-engine',
            action: 'CONTRADICTION_DETECTED',
            targetType: 'LEAD',
            targetId: lead.id,
            metadata: {
              key: params.key,
              existing: lastFact.value,
              conflicting: params.value,
            },
          });
        }
      }
    }

    const newFact: ConversationFact = {
      id: randomUUID(),
      leadId: lead.id,
      conversationId: convId,
      key: params.key,
      value: params.value.trim(),
      provenance: {
        source: params.source,
        conversationId: convId,
        timestamp: now,
        confidence: params.confidence,
        status: factStatus,
      },
      createdAt: now,
    };

    lead.memory.facts.push(newFact);

    // 3. Update memory fields if confirmed
    if (factStatus === 'CONFIRMED') {
      this.applyFactToMemory(lead.memory, params.key, params.value.trim());
    }

    // 4. Update status dynamically
    let oldStatus = lead.status;
    let newStatus = oldStatus;

    if (contradictionDetected) {
      newStatus = 'HUMAN_HANDOFF';
      lead.qualificationNotes = `Automated handoff triggered: Contradictory information received for ${params.key}.`;
    } else if (oldStatus === 'NEW' || oldStatus === 'CONTACTED') {
      newStatus = 'QUALIFYING';
    }

    lead.status = newStatus;
    await this.repository.updateLead(lead);

    return {
      fact: newFact,
      statusChanged: oldStatus !== newStatus,
      newStatus,
    };
  }

  /**
   * Deterministic qualification service evaluating all confirmed facts.
   */
  async qualifyLead(leadId: string): Promise<{
    status: QualificationStatus;
    score: number;
    reasons: string[];
    adaptiveQuestion?: string;
  }> {
    const qual = await this.evaluateQualification(leadId);
    let adaptiveQuestion: string | undefined;
    if (qual.status === 'QUALIFYING') {
      const q = await this.getNextAdaptiveQuestion(leadId);
      adaptiveQuestion = q.questionText;
    }
    return { ...qual, adaptiveQuestion };
  }

  async evaluateQualification(leadId: string): Promise<{
    status: QualificationStatus;
    score: number;
    reasons: string[];
  }> {
    const lead = await this.getLead(leadId);
    const memory = lead.memory;
    const reasons: string[] = [];

    // Check 1: Disputed facts -> HUMAN_HANDOFF
    if (memory.disputedFacts.length > 0) {
      lead.status = 'HUMAN_HANDOFF';
      await this.repository.updateLead(lead);
      return {
        status: 'HUMAN_HANDOFF',
        score: 40,
        reasons: [`Unresolved contradiction in ${memory.disputedFacts.map(d => d.key).join(', ')}`],
      };
    }

    // Check 2: Unqualified criteria (Budget sub-minimum, impossible timeline, out of scope)
    const budgetStr = (memory.budgetRange || '').toLowerCase();
    const timelineStr = (memory.timelineExpected || '').toLowerCase();

    const isSubMinimumBudget =
      budgetStr.includes('$500') ||
      budgetStr.includes('$1,000') ||
      budgetStr.includes('500') ||
      (budgetStr.includes('$') && parseInt(budgetStr.replace(/[^0-9]/g, ''), 10) < 2000 && parseInt(budgetStr.replace(/[^0-9]/g, ''), 10) > 0);

    const isImpossibleTimeline =
      timelineStr.includes('1 day') ||
      timelineStr.includes('2 days') ||
      timelineStr.includes('tomorrow') ||
      timelineStr.includes('48 hours');

    if (isSubMinimumBudget) {
      lead.status = 'UNQUALIFIED';
      reasons.push('Stated budget is below firm minimum starting threshold ($5,000).');
      await this.repository.updateLead(lead);
      return { status: 'UNQUALIFIED', score: 15, reasons };
    }

    if (isImpossibleTimeline) {
      lead.status = 'UNQUALIFIED';
      reasons.push('Requested delivery timeline (< 1 week) is infeasible for bespoke production software.');
      await this.repository.updateLead(lead);
      return { status: 'UNQUALIFIED', score: 20, reasons };
    }

    // Check 3: Qualified criteria
    const hasType = !!memory.projectType;
    const hasObjective = !!memory.businessObjective && memory.businessObjective.length > 10;
    const hasBudget = !!memory.budgetRange;
    const hasTimeline = !!memory.timelineExpected;
    const hasDecisionMaker = !!memory.decisionMaker;

    let score = 0;
    if (hasType) score += 20;
    if (hasObjective) score += 25;
    if (hasBudget) score += 25;
    if (hasTimeline) score += 15;
    if (hasDecisionMaker) score += 15;

    let status: QualificationStatus = lead.status;

    if (hasType && hasObjective && hasBudget && hasTimeline && hasDecisionMaker) {
      status = 'QUALIFIED';
      reasons.push('All 5 core qualification criteria met (Scope, Objective, Commercials, Timeline, Authority).');
    } else if (hasType || hasObjective) {
      status = 'QUALIFYING';
      reasons.push('Discovery underway. Incomplete commercial or decision-maker parameters.');
    }

    lead.status = status;
    lead.qualificationNotes = reasons.join(' ');
    await this.repository.updateLead(lead);

    return { status, score, reasons };
  }

  /**
   * Adaptive Questioning Engine:
   * Prioritizes the single highest-value missing fact rather than forcing a static questionnaire.
   */
  async getNextAdaptiveQuestion(leadId: string): Promise<AdaptiveQuestion> {
    const lead = await this.getLead(leadId);
    const memory = lead.memory;

    if (!memory.projectType) {
      return {
        factKey: 'project_type',
        questionText: 'What type of digital product or software solution are you looking to build?',
        rationale: 'Project type establishes the core technical capability domain (Web, Custom Software, AI/ML, Cybersecurity).',
        isDiscoveryComplete: false,
        recommendedNextAction: 'Ask for project category',
      };
    }

    if (!memory.businessObjective) {
      return {
        factKey: 'business_objective',
        questionText: 'What is the primary business goal or operational problem this project needs to solve?',
        rationale: 'Clarifies business objective and value proposition before diving into technical details.',
        isDiscoveryComplete: false,
        recommendedNextAction: 'Discover primary business objective',
      };
    }

    if (!memory.timelineExpected) {
      return {
        factKey: 'timeline',
        questionText: 'What is your target launch date or desired delivery timeframe for this initiative?',
        rationale: 'Timeline feasibility is a required commercial gating criterion.',
        isDiscoveryComplete: false,
        recommendedNextAction: 'Inquire about target launch window',
      };
    }

    if (!memory.budgetRange) {
      return {
        factKey: 'budget',
        questionText: 'What budget range has your organization allocated for this project?',
        rationale: 'Verifies commercial viability against HQ minimum project starting ranges.',
        isDiscoveryComplete: false,
        recommendedNextAction: 'Discuss budget allocation or provide approved pricing guidance',
      };
    }

    if (!memory.decisionMaker) {
      return {
        factKey: 'decision_maker',
        questionText: 'Who on your team will be guiding the final technical sign-off and commercial decision?',
        rationale: 'Confirms decision-maker stakeholder involvement.',
        isDiscoveryComplete: false,
        recommendedNextAction: 'Identify key stakeholders and decision authority',
      };
    }

    // If core discovery is complete:
    return {
      questionText: 'We have all the key discovery details. Would you like to schedule an introductory consultation with our lead software architect?',
      rationale: 'Core qualification criteria discovered. Ready to book calendar meeting.',
      isDiscoveryComplete: true,
      recommendedNextAction: 'Proceed to schedule discovery consultation',
    };
  }

  /**
   * Generates an executive structured Project Brief.
   */
  async generateProjectBrief(leadId: string): Promise<ProjectBrief> {
    const lead = await this.getLead(leadId);
    const evalResult = await this.evaluateQualification(leadId);
    const memory = lead.memory;

    const brief: ProjectBrief = {
      briefId: randomUUID(),
      leadId: lead.id,
      leadName: lead.fullName,
      companyName: lead.companyName,
      qualificationStatus: evalResult.status,
      qualificationScore: evalResult.score,
      executiveSummary: `Lead Brief for ${lead.fullName} (${lead.companyName || 'Independent'}). Project: ${memory.projectType || 'General Ingestion'} to achieve: ${memory.businessObjective || 'Scoping pending'}. Commercial guidance: ${memory.budgetRange || 'Pending'}, target delivery: ${memory.timelineExpected || 'Pending'}.`,
      opportunityDetails: {
        projectType: memory.projectType || 'Undisclosed',
        businessObjective: memory.businessObjective || 'Under discovery',
        targetAudience: memory.targetUsers || 'Not specified',
        keyFeatures: memory.requiredFeatures,
        integrations: memory.integrations,
        existingSystem: memory.existingSystem || 'None identified',
      },
      commercialParameters: {
        budgetRange: memory.budgetRange || 'Unstated',
        timelineExpected: memory.timelineExpected || 'Unstated',
        urgencyLevel: memory.urgency || 'NORMAL',
        decisionMakerConfirmed: !!memory.decisionMaker,
      },
      provenanceTrail: memory.facts.map(f => ({
        key: f.key,
        value: f.value,
        confidence: f.provenance.confidence,
        source: f.provenance.source,
        status: f.provenance.status,
        timestamp: f.provenance.timestamp,
      })),
      recommendedNextSteps: evalResult.status === 'QUALIFIED'
        ? 'Schedule 30-minute discovery call with technical lead.'
        : evalResult.status === 'HUMAN_HANDOFF'
        ? 'Route to client partner to resolve contradictory information.'
        : evalResult.status === 'UNQUALIFIED'
        ? 'Send standard capabilities deck and polite decline on custom engagement.'
        : 'Continue qualification inquiry on next interaction.',
      generatedAt: new Date().toISOString(),
    };

    return brief;
  }

  // --- Helpers ---

  private applyFactToMemory(memory: LeadMemory, key: LeadFactKey, value: string) {
    switch (key) {
      case 'project_type':
        memory.projectType = value;
        break;
      case 'business_objective':
        memory.businessObjective = value;
        break;
      case 'target_users':
        memory.targetUsers = value;
        break;
      case 'required_features':
        if (!memory.requiredFeatures.includes(value)) {
          memory.requiredFeatures.push(value);
        }
        break;
      case 'integrations':
        if (!memory.integrations.includes(value)) {
          memory.integrations.push(value);
        }
        break;
      case 'existing_system':
        memory.existingSystem = value;
        break;
      case 'timeline':
        memory.timelineExpected = value;
        break;
      case 'budget':
        memory.budgetRange = value;
        break;
      case 'decision_maker':
        memory.decisionMaker = value;
        break;
      case 'urgency':
        memory.urgency = value;
        break;
    }
  }

  private isContradiction(key: LeadFactKey, existing: string, incoming: string): boolean {
    const e = existing.toLowerCase().trim();
    const i = incoming.toLowerCase().trim();

    if (e === i) return false;

    // Check budget contradiction: e.g. "$25,000" vs "$2,000"
    if (key === 'budget') {
      const eNum = parseInt(e.replace(/[^0-9]/g, ''), 10);
      const iNum = parseInt(i.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(eNum) && !isNaN(iNum)) {
        // Significant difference (> 3x discrepancy)
        if (eNum > 0 && iNum > 0 && (eNum / iNum > 3 || iNum / eNum > 3)) {
          return true;
        }
      }
    }

    // Check timeline contradiction: e.g. "6 months" vs "tomorrow" / "2 days"
    if (key === 'timeline') {
      const eIsMonths = e.includes('month') || e.includes('quarter') || e.includes('weeks');
      const iIsImmediate = i.includes('tomorrow') || i.includes('today') || i.includes('2 days') || i.includes('48 hours');
      if (eIsMonths && iIsImmediate) return true;
    }

    // Check decision maker contradiction: "I am the sole decision maker" vs "I cannot approve this, my CEO must decide"
    if (key === 'decision_maker') {
      const eIsSole = e.includes('sole') || e.includes('only me') || e.includes('yes');
      const iIsNot = i.includes('not me') || i.includes('no authority') || i.includes('cannot approve');
      if (eIsSole && iIsNot) return true;
    }

    return false;
  }
}

export const defaultLeadsRepository = new LeadsRepository();
export const defaultLeadQualificationService = new LeadQualificationService(defaultLeadsRepository);
export const defaultLeadsService = defaultLeadQualificationService;

export const leadsModule = {
  name: 'leads',
  status: 'active',
  description: 'Lead qualification, adaptive questioning, structured memory, and project brief boundary',
  service: defaultLeadQualificationService,
  repository: defaultLeadsRepository,
};
