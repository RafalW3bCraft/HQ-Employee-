import { randomUUID } from 'crypto';
import { NotFoundError, ValidationError, ForbiddenError } from '../../errors/index.js';
import { defaultCompanyBrainRepository, CompanyBrainRepository, CompanyProfile, ApprovedServiceWithGuidance, CompanyFaq, EmployeePolicy } from '../company/index.js';
import { defaultLeadsRepository, LeadsRepository, Lead } from '../leads/index.js';
import { defaultAuditService, AuditService } from '../audit/index.js';

// ============================================================================
// Types & Domain Models
// ============================================================================

export type FactStatus = 'CONFIRMED' | 'TENTATIVE' | 'NEEDS_CONFIRMATION' | 'DISPUTED';

export interface FactRecord {
  factId: string;
  leadId: string;
  companyId: string;
  category: string;
  value: string;
  source: string;
  conversationId: string;
  timestamp: string;
  status: FactStatus;
}

export interface FactConflict {
  conflictId: string;
  leadId: string;
  companyId: string;
  category: string;
  existingFactId: string;
  existingValue: string;
  newConversationId: string;
  conflictingValue: string;
  detectedAt: string;
  resolved: boolean;
}

export interface CompanyMemory {
  companyId: string;
  profile: CompanyProfile;
  services: ApprovedServiceWithGuidance[];
  pricingGuidance: Array<{ service: string; minCents: number; maxCents?: number; currency: string }>;
  timelineGuidance: Array<{ service: string; minWeeks: number; maxWeeks: number }>;
  faqs: CompanyFaq[];
  activePolicy: EmployeePolicy;
}

export interface EmployeeMemory {
  employeeId: string;
  companyId: string;
  name: string;
  role: string;
  persona: string;
  activePolicyVersion: string;
  authorizedCapabilities: string[];
}

export interface LeadMemoryStructured {
  leadId: string;
  companyId: string;
  contact: {
    fullName: string;
    email?: string;
    phone?: string;
  };
  companyName?: string;
  projectType?: string;
  businessObjective?: string;
  targetUsers?: string;
  requirements: string[];
  budget?: string;
  timeline?: string;
  decisionMakerStatus?: string;
  urgency?: string;
  objections: string[];
  meetings: Array<{ meetingId: string; title: string; scheduledAt: string; status: string }>;
  previousOutcomes: string[];
  nextAction?: string;
  facts: FactRecord[];
  conflicts: FactConflict[];
}

export interface InteractionMemory {
  conversationId: string;
  leadId: string;
  companyId: string;
  objective: string;
  factsCollected: FactRecord[];
  decisions: Array<{ action: string; decision: string; timestamp: string }>;
  toolActions: Array<{ tool: string; args: any; result: any; timestamp: string }>;
  outcome?: string;
  nextAction?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecordFactDTO {
  leadId: string;
  companyId: string;
  category: string;
  value: string;
  source: string;
  conversationId: string;
  confidence?: number;
}

export interface RecordInteractionDTO {
  conversationId: string;
  leadId: string;
  companyId: string;
  objective: string;
}

// ============================================================================
// Memory Service Implementation
// ============================================================================

export class MemoryService {
  private facts = new Map<string, FactRecord>(); // factId -> FactRecord
  private conflicts = new Map<string, FactConflict>(); // conflictId -> FactConflict
  private leadCategoryFacts = new Map<string, string>(); // `${leadId}:${category}` -> factId
  private interactions = new Map<string, InteractionMemory>(); // conversationId -> InteractionMemory
  private leadObjections = new Map<string, string[]>(); // leadId -> objections
  private leadPreviousOutcomes = new Map<string, string[]>(); // leadId -> previousOutcomes

  constructor(
    private companyRepo: CompanyBrainRepository = defaultCompanyBrainRepository,
    private leadRepo: LeadsRepository = defaultLeadsRepository,
    private auditService: AuditService = defaultAuditService
  ) {}

  // --------------------------------------------------------------------------
  // 1. Company Memory Layer
  // --------------------------------------------------------------------------
  async getCompanyMemory(companyId: string, callerCompanyId?: string): Promise<CompanyMemory> {
    // Cross-company isolation
    if (callerCompanyId && callerCompanyId !== companyId) {
      throw new ForbiddenError(`Company memory isolation violation: Access denied to company ${companyId}`);
    }

    const profile = await this.companyRepo.getProfile(companyId);
    if (!profile) {
      throw new NotFoundError(`Company profile for ${companyId} not found`);
    }

    const services = await this.companyRepo.listServices(companyId);
    const faqs = await this.companyRepo.listFaqs(companyId);
    const activePolicy = await this.companyRepo.getActivePolicy(companyId);

    const pricingGuidance: Array<{ service: string; minCents: number; maxCents?: number; currency: string }> = [];
    const timelineGuidance: Array<{ service: string; minWeeks: number; maxWeeks: number }> = [];

    for (const s of services) {
      if (s.pricing && s.pricing.length > 0) {
        for (const p of s.pricing) {
          pricingGuidance.push({
            service: s.title,
            minCents: p.minPriceCents,
            maxCents: p.maxPriceCents,
            currency: p.currency,
          });
        }
      }
      if (s.timelines && s.timelines.length > 0) {
        for (const t of s.timelines) {
          timelineGuidance.push({
            service: s.title,
            minWeeks: t.minDurationWeeks,
            maxWeeks: t.maxDurationWeeks,
          });
        }
      }
    }

    return {
      companyId,
      profile,
      services,
      pricingGuidance,
      timelineGuidance,
      faqs,
      activePolicy: activePolicy || {
        id: 'default',
        employeeId: 'default',
        version: '1.0.0',
        status: 'ACTIVE',
        systemInstructions: 'You are the HQ-Employee Business Development & Client Coordinator.',
        authorityRules: [],
        escalationRules: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }

  // --------------------------------------------------------------------------
  // 2. Employee Memory Layer
  // --------------------------------------------------------------------------
  async getEmployeeMemory(employeeId: string, companyId: string, callerCompanyId?: string): Promise<EmployeeMemory> {
    // Company isolation
    if (callerCompanyId && callerCompanyId !== companyId) {
      throw new ForbiddenError(`Employee memory isolation violation: Caller cannot access company ${companyId}`);
    }

    const activePolicy = await this.companyRepo.getActivePolicy(companyId);
    const authorizedCapabilities: string[] = [];

    if (activePolicy) {
      for (const rule of activePolicy.authorityRules) {
        if (rule.decision === 'ALLOW') {
          authorizedCapabilities.push(rule.action);
        }
      }
    }

    return {
      employeeId,
      companyId,
      name: 'HQ-Employee Business Development & Client Coordinator',
      role: 'Business Development & Client Coordination',
      persona: 'Professional, concise, consultative, and transparent AI business coordinator.',
      activePolicyVersion: activePolicy?.version || '1.0.0',
      authorizedCapabilities,
    };
  }

  // --------------------------------------------------------------------------
  // 3. Lead Memory Layer
  // --------------------------------------------------------------------------
  async getLeadMemory(leadId: string, companyId: string): Promise<LeadMemoryStructured> {
    const lead = await this.leadRepo.getLead(leadId);
    if (!lead) {
      throw new NotFoundError(`Lead with ID ${leadId} not found`);
    }

    // Strict Cross-Company Isolation
    if (lead.companyId !== companyId) {
      throw new ForbiddenError(`Lead isolation violation: Lead ${leadId} does not belong to company ${companyId}`);
    }

    // Retrieve structured facts for this lead
    const leadFacts: FactRecord[] = [];
    for (const fact of this.facts.values()) {
      if (fact.leadId === leadId && fact.companyId === companyId) {
        leadFacts.push(fact);
      }
    }

    // Retrieve conflicts for this lead
    const leadConflicts: FactConflict[] = [];
    for (const conflict of this.conflicts.values()) {
      if (conflict.leadId === leadId && conflict.companyId === companyId) {
        leadConflicts.push(conflict);
      }
    }

    // Extract categories
    const getFactVal = (cat: string) => leadFacts.find((f) => f.category === cat && f.status !== 'DISPUTED')?.value;
    const requirements = leadFacts.filter((f) => f.category.startsWith('req_')).map((f) => f.value);

    const objections = this.leadObjections.get(leadId) || [];
    const previousOutcomes = this.leadPreviousOutcomes.get(leadId) || [];

    return {
      leadId,
      companyId,
      contact: {
        fullName: lead.fullName,
        email: lead.contactEmail,
        phone: lead.contactPhone,
      },
      companyName: lead.companyName,
      projectType: getFactVal('project_type'),
      businessObjective: getFactVal('business_objective'),
      targetUsers: getFactVal('target_users'),
      requirements,
      budget: getFactVal('budget'),
      timeline: getFactVal('timeline'),
      decisionMakerStatus: getFactVal('decision_maker'),
      urgency: getFactVal('urgency'),
      objections,
      meetings: [],
      previousOutcomes,
      nextAction: getFactVal('next_action') || 'Discover requirements and schedule consultation',
      facts: leadFacts,
      conflicts: leadConflicts,
    };
  }

  // --------------------------------------------------------------------------
  // 4. Fact Model with Provenance & Conflict Resolution
  // --------------------------------------------------------------------------
  async recordFact(dto: RecordFactDTO): Promise<{ fact: FactRecord; conflict?: FactConflict }> {
    const lead = await this.leadRepo.getLead(dto.leadId);
    if (!lead) {
      throw new NotFoundError(`Lead ${dto.leadId} not found`);
    }

    if (lead.companyId !== dto.companyId) {
      throw new ForbiddenError(`Isolation violation: Lead does not belong to company ${dto.companyId}`);
    }

    const confidence = dto.confidence !== undefined ? dto.confidence : 1.0;
    const key = `${dto.leadId}:${dto.category}`;
    const existingFactId = this.leadCategoryFacts.get(key);

    if (existingFactId) {
      const existingFact = this.facts.get(existingFactId);
      if (existingFact && existingFact.value.trim().toLowerCase() !== dto.value.trim().toLowerCase()) {
        // CONFLICT DETECTED: Do not overwrite silently!
        const conflict: FactConflict = {
          conflictId: randomUUID(),
          leadId: dto.leadId,
          companyId: dto.companyId,
          category: dto.category,
          existingFactId: existingFact.factId,
          existingValue: existingFact.value,
          newConversationId: dto.conversationId,
          conflictingValue: dto.value,
          detectedAt: new Date().toISOString(),
          resolved: false,
        };

        this.conflicts.set(conflict.conflictId, conflict);

        // Mark existing fact as needing confirmation
        existingFact.status = 'NEEDS_CONFIRMATION';
        this.facts.set(existingFact.factId, existingFact);

        // Create the new fact with NEEDS_CONFIRMATION status
        const newFact: FactRecord = {
          factId: randomUUID(),
          leadId: dto.leadId,
          companyId: dto.companyId,
          category: dto.category,
          value: dto.value,
          source: dto.source,
          conversationId: dto.conversationId,
          timestamp: new Date().toISOString(),
          status: 'NEEDS_CONFIRMATION',
        };
        this.facts.set(newFact.factId, newFact);

        // Log audit event
        await this.auditService.logEvent({
          actorType: 'EMPLOYEE',
          actorId: `conv:${dto.conversationId}`,
          action: 'FACT_CONFLICT_DETECTED',
          targetType: 'LEAD_FACT',
          targetId: newFact.factId,
          metadata: {
            category: dto.category,
            existingValue: existingFact.value,
            conflictingValue: dto.value,
            conflictId: conflict.conflictId,
          },
        });

        return { fact: newFact, conflict };
      }
    }

    // Normal Fact Creation / Confirmation
    const status: FactStatus = confidence < 0.7 ? 'TENTATIVE' : 'CONFIRMED';
    const fact: FactRecord = {
      factId: randomUUID(),
      leadId: dto.leadId,
      companyId: dto.companyId,
      category: dto.category,
      value: dto.value,
      source: dto.source,
      conversationId: dto.conversationId,
      timestamp: new Date().toISOString(),
      status,
    };

    this.facts.set(fact.factId, fact);
    this.leadCategoryFacts.set(key, fact.factId);

    // Also associate fact with active interaction memory if present
    const interaction = this.interactions.get(dto.conversationId);
    if (interaction) {
      interaction.factsCollected.push(fact);
      interaction.updatedAt = new Date().toISOString();
      this.interactions.set(dto.conversationId, interaction);
    }

    await this.auditService.logEvent({
      actorType: 'EMPLOYEE',
      actorId: `conv:${dto.conversationId}`,
      action: 'FACT_RECORDED',
      targetType: 'LEAD_FACT',
      targetId: fact.factId,
      metadata: {
        leadId: dto.leadId,
        category: dto.category,
        confidence,
        status,
      },
    });

    return { fact };
  }

  // --------------------------------------------------------------------------
  // 5. Interaction Memory Layer
  // --------------------------------------------------------------------------
  async startInteraction(dto: RecordInteractionDTO): Promise<InteractionMemory> {
    const memory: InteractionMemory = {
      conversationId: dto.conversationId,
      leadId: dto.leadId,
      companyId: dto.companyId,
      objective: dto.objective,
      factsCollected: [],
      decisions: [],
      toolActions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.interactions.set(dto.conversationId, memory);
    return memory;
  }

  async getInteractionMemory(conversationId: string, companyId: string): Promise<InteractionMemory> {
    const interaction = this.interactions.get(conversationId);
    if (!interaction) {
      throw new NotFoundError(`Interaction memory for conversation ${conversationId} not found`);
    }

    if (interaction.companyId !== companyId) {
      throw new ForbiddenError(`Isolation violation: Interaction does not belong to company ${companyId}`);
    }

    return interaction;
  }

  async recordDecision(conversationId: string, action: string, decision: string): Promise<void> {
    const interaction = this.interactions.get(conversationId);
    if (interaction) {
      interaction.decisions.push({
        action,
        decision,
        timestamp: new Date().toISOString(),
      });
      interaction.updatedAt = new Date().toISOString();
    }
  }

  async recordToolAction(conversationId: string, tool: string, args: any, result: any): Promise<void> {
    const interaction = this.interactions.get(conversationId);
    if (interaction) {
      interaction.toolActions.push({
        tool,
        args,
        result,
        timestamp: new Date().toISOString(),
      });
      interaction.updatedAt = new Date().toISOString();
    }
  }

  async completeInteraction(conversationId: string, outcome: string, nextAction?: string): Promise<InteractionMemory> {
    const interaction = this.interactions.get(conversationId);
    if (!interaction) {
      throw new NotFoundError(`Interaction ${conversationId} not found`);
    }

    interaction.outcome = outcome;
    interaction.nextAction = nextAction;
    interaction.updatedAt = new Date().toISOString();
    this.interactions.set(conversationId, interaction);

    // Record previous outcome on lead memory
    const existingOutcomes = this.leadPreviousOutcomes.get(interaction.leadId) || [];
    existingOutcomes.push(outcome);
    this.leadPreviousOutcomes.set(interaction.leadId, existingOutcomes);

    return interaction;
  }

  // --------------------------------------------------------------------------
  // 6. Privacy & Deletion (GDPR / Right to be Forgotten)
  // --------------------------------------------------------------------------
  async purgeLeadMemory(leadId: string, companyId: string): Promise<void> {
    const lead = await this.leadRepo.getLead(leadId);
    if (lead && lead.companyId !== companyId) {
      throw new ForbiddenError(`Isolation violation: Cannot purge lead belonging to another company`);
    }

    // Remove all facts
    for (const [factId, fact] of this.facts.entries()) {
      if (fact.leadId === leadId) {
        this.facts.delete(factId);
        this.leadCategoryFacts.delete(`${leadId}:${fact.category}`);
      }
    }

    // Remove all conflicts
    for (const [conflictId, conflict] of this.conflicts.entries()) {
      if (conflict.leadId === leadId) {
        this.conflicts.delete(conflictId);
      }
    }

    // Remove interaction memory for this lead
    for (const [convId, inter] of this.interactions.entries()) {
      if (inter.leadId === leadId) {
        this.interactions.delete(convId);
      }
    }

    this.leadObjections.delete(leadId);
    this.leadPreviousOutcomes.delete(leadId);

    await this.auditService.logEvent({
      actorType: 'SYSTEM',
      actorId: 'gdpr:retention_service',
      action: 'LEAD_MEMORY_PURGED',
      targetType: 'LEAD',
      targetId: leadId,
      metadata: { companyId, reason: 'Privacy data deletion request' },
    });
  }
}

export const defaultMemoryService = new MemoryService();

export const memoryModule = {
  name: 'memory',
  status: 'active',
  description: 'HQ Employee 4-layer Structured Memory Subsystem',
  service: defaultMemoryService,
};
