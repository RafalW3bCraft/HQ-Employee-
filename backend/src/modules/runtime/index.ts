import { randomUUID } from 'crypto';
import { NotFoundError, ForbiddenError, ValidationError } from '../../errors/index.js';
import { defaultCompanyBrainRepository, CompanyBrainRepository, EmployeePolicy } from '../company/index.js';
import { defaultLeadsRepository, LeadsRepository, Lead } from '../leads/index.js';
import { defaultMemoryService, MemoryService, LeadMemoryStructured, FactRecord } from '../memory/index.js';
import { defaultAuditService, AuditService } from '../audit/index.js';

// ============================================================================
// Types & Domain Models
// ============================================================================

export interface RuntimeToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  governedCategory: 'information' | 'data' | 'calendar' | 'commercial' | 'escalation' | 'session';
}

export interface BuildContextParams {
  employeeId: string;
  companyId: string;
  leadId: string;
  conversationId: string;
  objective: string;
  requestedServiceSlug?: string;
}

export interface ConversationContext {
  conversationId: string;
  objective: string;
  policyVersion: string;
  employee: {
    id: string;
    name: string;
    role: string;
    persona: string;
  };
  company: {
    id: string;
    name: string;
    summary: string;
    approvedServices: Array<{ slug: string; title: string; description: string }>;
    relevantFaqs: Array<{ question: string; answer: string }>;
    pricingGuidance: Array<{ service: string; minCents: number; maxCents?: number; currency: string }>;
    timelineGuidance: Array<{ service: string; minWeeks: number; maxWeeks: number }>;
  };
  lead: {
    id: string;
    fullName: string;
    companyName?: string;
    qualificationStatus: string;
    budget?: string;
    timeline?: string;
    projectType?: string;
    businessObjective?: string;
    confirmedFacts: Array<{ category: string; value: string }>;
    unresolvedConflicts: Array<{ category: string; existingValue: string; conflictingValue: string }>;
    nextAction?: string;
  };
  availableTools: RuntimeToolDefinition[];
  systemPrompt: string;
  assembledAt: string;
}

// Master catalog of all business tools before policy filtering
const ALL_BUSINESS_TOOLS: RuntimeToolDefinition[] = [
  {
    name: 'get_company_profile',
    description: 'Retrieve approved background information about HQ, company history, headquarters, and core expertise.',
    parameters: { type: 'object', properties: {} },
    governedCategory: 'information',
  },
  {
    name: 'get_service_details',
    description: 'Get approved description, technologies, deliverables, and capabilities for a specific software engineering service.',
    parameters: {
      type: 'object',
      properties: { service_name: { type: 'string' } },
      required: ['service_name'],
    },
    governedCategory: 'information',
  },
  {
    name: 'get_pricing_guidance',
    description: 'Retrieve official approved pricing guidance and ranges for HQ services. Never guess or invent pricing outside approved ranges.',
    parameters: {
      type: 'object',
      properties: { service_name: { type: 'string' } },
    },
    governedCategory: 'commercial',
  },
  {
    name: 'get_timeline_guidance',
    description: 'Retrieve approved duration and delivery timeline guidance for project scopes.',
    parameters: {
      type: 'object',
      properties: { service_name: { type: 'string' } },
    },
    governedCategory: 'commercial',
  },
  {
    name: 'create_lead',
    description: 'Create a new prospective client lead record in structured memory.',
    parameters: {
      type: 'object',
      properties: {
        full_name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        company_name: { type: 'string' },
      },
      required: ['full_name'],
    },
    governedCategory: 'data',
  },
  {
    name: 'update_lead',
    description: 'Update contact details or company profile for an existing prospective client lead.',
    parameters: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        company_name: { type: 'string' },
      },
      required: ['lead_id'],
    },
    governedCategory: 'data',
  },
  {
    name: 'record_requirement',
    description: 'Record an explicit technical or business requirement for the prospective project.',
    parameters: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        requirement_text: { type: 'string' },
        category: { type: 'string' },
      },
      required: ['lead_id', 'requirement_text'],
    },
    governedCategory: 'data',
  },
  {
    name: 'record_budget',
    description: 'Record prospect stated budget allocation for the project.',
    parameters: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        budget_range: { type: 'string' },
      },
      required: ['lead_id', 'budget_range'],
    },
    governedCategory: 'commercial',
  },
  {
    name: 'record_timeline',
    description: 'Record prospect stated target launch or delivery timeline.',
    parameters: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        timeline_expected: { type: 'string' },
      },
      required: ['lead_id', 'timeline_expected'],
    },
    governedCategory: 'commercial',
  },
  {
    name: 'request_human_approval',
    description: 'Escalate an out-of-scope or out-of-authority request to human leadership.',
    parameters: {
      type: 'object',
      properties: {
        action_type: { type: 'string' },
        reason: { type: 'string' },
        requested_payload: { type: 'object' },
      },
      required: ['action_type', 'reason'],
    },
    governedCategory: 'escalation',
  },
  {
    name: 'check_calendar',
    description: 'Check available meeting slots for a consultation.',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string' },
        end_date: { type: 'string' },
      },
    },
    governedCategory: 'calendar',
  },
  {
    name: 'schedule_meeting',
    description: 'Schedule an approved discovery consultation meeting on the calendar.',
    parameters: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        slot_iso: { type: 'string' },
        topic: { type: 'string' },
      },
      required: ['lead_id', 'slot_iso'],
    },
    governedCategory: 'calendar',
  },
  {
    name: 'end_call',
    description: 'Cleanly conclude the voice conversation session.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
      },
    },
    governedCategory: 'session',
  },
];

// ============================================================================
// Employee Runtime Service Implementation
// ============================================================================

export class EmployeeRuntimeService {
  private conversationPolicyVersions = new Map<string, string>(); // conversationId -> policyVersion

  constructor(
    private companyRepo: CompanyBrainRepository = defaultCompanyBrainRepository,
    private leadRepo: LeadsRepository = defaultLeadsRepository,
    private memoryService: MemoryService = defaultMemoryService,
    private auditService: AuditService = defaultAuditService
  ) {}

  /**
   * Deterministic Context Builder: Assembles relevant context for a single conversation.
   * Enforces cross-company and cross-lead isolation, policy version tracking, and tool filtering.
   */
  async buildConversationContext(params: BuildContextParams): Promise<ConversationContext> {
    const { employeeId, companyId, leadId, conversationId, objective, requestedServiceSlug } = params;

    // 1. Verify Lead and Cross-Company Isolation
    const lead = await this.leadRepo.getLead(leadId);
    if (!lead) {
      throw new NotFoundError(`Lead ${leadId} not found`);
    }
    if (lead.companyId !== companyId) {
      throw new ForbiddenError(`Isolation violation: Lead ${leadId} does not belong to company ${companyId}`);
    }

    // 2. Retrieve Company Memory & Policy
    const companyMemory = await this.memoryService.getCompanyMemory(companyId);
    const activePolicy = companyMemory.activePolicy;
    const policyVersion = activePolicy.version;

    // Record employee_policy_version on this conversation
    this.conversationPolicyVersions.set(conversationId, policyVersion);

    // 3. Retrieve Employee Memory
    const employeeMemory = await this.memoryService.getEmployeeMemory(employeeId, companyId);

    // 4. Retrieve Lead Memory (only relevant information)
    const leadMemory = await this.memoryService.getLeadMemory(leadId, companyId);

    // Filter relevant services
    let relevantServices = companyMemory.services.map((s) => ({
      slug: s.slug,
      title: s.title,
      description: s.description,
    }));
    if (requestedServiceSlug) {
      relevantServices = relevantServices.filter((s) => s.slug === requestedServiceSlug);
    }

    // Relevant FAQs
    const relevantFaqs = companyMemory.faqs
      .slice(0, 3)
      .map((f) => ({ question: f.question, answer: f.answer }));

    // Confirmed facts & unresolved conflicts
    const confirmedFacts = leadMemory.facts
      .filter((f) => f.status === 'CONFIRMED')
      .map((f) => ({ category: f.category, value: f.value }));

    const unresolvedConflicts = leadMemory.conflicts
      .filter((c) => !c.resolved)
      .map((c) => ({
        category: c.category,
        existingValue: c.existingValue,
        conflictingValue: c.conflictingValue,
      }));

    // 5. Tool Availability: Filter tools according to active policy
    const availableTools = this.filterToolsForPolicy(activePolicy);

    // 6. Build Deterministic System Prompt
    const systemPrompt = this.generateSystemPrompt({
      employeeName: employeeMemory.name,
      employeeRole: employeeMemory.role,
      persona: employeeMemory.persona,
      companyName: companyMemory.profile.name,
      companySummary: `${companyMemory.profile.name} — ${companyMemory.profile.tagline}\n${companyMemory.profile.description}`,
      objective,
      policyVersion,
      systemInstructions: activePolicy.systemInstructions,
      leadName: lead.fullName,
      leadCompany: lead.companyName,
      leadQualification: lead.status,
      services: relevantServices,
      confirmedFacts,
      unresolvedConflicts,
      availableTools,
    });

    const context: ConversationContext = {
      conversationId,
      objective,
      policyVersion,
      employee: {
        id: employeeId,
        name: employeeMemory.name,
        role: employeeMemory.role,
        persona: employeeMemory.persona,
      },
      company: {
        id: companyId,
        name: companyMemory.profile.name,
        summary: `${companyMemory.profile.name} — ${companyMemory.profile.tagline}`,
        approvedServices: relevantServices,
        relevantFaqs,
        pricingGuidance: companyMemory.pricingGuidance,
        timelineGuidance: companyMemory.timelineGuidance,
      },
      lead: {
        id: leadId,
        fullName: lead.fullName,
        companyName: lead.companyName,
        qualificationStatus: lead.status,
        budget: leadMemory.budget,
        timeline: leadMemory.timeline,
        projectType: leadMemory.projectType,
        businessObjective: leadMemory.businessObjective,
        confirmedFacts,
        unresolvedConflicts,
        nextAction: leadMemory.nextAction,
      },
      availableTools,
      systemPrompt,
      assembledAt: new Date().toISOString(),
    };

    // Audit context assembly
    await this.auditService.logEvent({
      actorType: 'EMPLOYEE',
      actorId: `employee:${employeeId}`,
      action: 'RUNTIME_CONTEXT_ASSEMBLED',
      targetType: 'CONVERSATION',
      targetId: conversationId,
      metadata: {
        companyId,
        leadId,
        policyVersion,
        toolsCount: availableTools.length,
      },
    });

    return context;
  }

  /**
   * Filter tools against policy:
   * Unauthorized tools (BLOCK) are completely excluded from available tools.
   */
  filterToolsForPolicy(policy: EmployeePolicy): RuntimeToolDefinition[] {
    const rulesMap = new Map<string, string>(); // action -> decision ('ALLOW' | 'REQUIRE_APPROVAL' | 'BLOCK')

    for (const rule of policy.authorityRules) {
      rulesMap.set(rule.action, rule.decision);
    }

    return ALL_BUSINESS_TOOLS.filter((tool) => {
      const decision = rulesMap.get(tool.name);

      // If policy explicitly blocks this action, exclude tool
      if (decision === 'BLOCK') {
        return false;
      }

      // If action requires approval, direct tool is excluded (human escalation tool is used instead)
      if (decision === 'REQUIRE_APPROVAL' && tool.name !== 'request_human_approval') {
        return false;
      }

      return true;
    });
  }

  /**
   * Query recorded policy version for a conversation
   */
  getConversationPolicyVersion(conversationId: string): string | undefined {
    return this.conversationPolicyVersions.get(conversationId);
  }

  private generateSystemPrompt(ctx: {
    employeeName: string;
    employeeRole: string;
    persona: string;
    companyName: string;
    companySummary: string;
    objective: string;
    policyVersion: string;
    systemInstructions: string;
    leadName: string;
    leadCompany?: string;
    leadQualification: string;
    services: Array<{ title: string; description: string }>;
    confirmedFacts: Array<{ category: string; value: string }>;
    unresolvedConflicts: Array<{ category: string; existingValue: string; conflictingValue: string }>;
    availableTools: RuntimeToolDefinition[];
  }): string {
    return `You are ${ctx.employeeName}, representing ${ctx.companyName}.
ROLE: ${ctx.employeeRole}
POLICY VERSION: ${ctx.policyVersion}
PERSONA: ${ctx.persona}

TRANSPARENCY & IDENTITY:
- You are a professional AI company representative.
- When asked, or when disclosure is required, state honestly that you are an AI assistant representing ${ctx.companyName}. Never claim to be a human person.

OBJECTIVE:
${ctx.objective}

APPROVED COMPANY CONTEXT:
${ctx.companySummary}
Services: ${ctx.services.map((s) => `${s.title}: ${s.description}`).join('; ')}

PROSPECT IDENTITY & KNOWN FACTS:
Prospect: ${ctx.leadName}${ctx.leadCompany ? ` from ${ctx.leadCompany}` : ''} (Status: ${ctx.leadQualification})
Confirmed Facts: ${ctx.confirmedFacts.length > 0 ? ctx.confirmedFacts.map((f) => `${f.category}: ${f.value}`).join(', ') : 'None yet.'}
${ctx.unresolvedConflicts.length > 0 ? `CONFLICTS NEEDING CONFIRMATION: ${ctx.unresolvedConflicts.map((c) => `${c.category} differs (${c.existingValue} vs ${c.conflictingValue})`).join('; ')}` : ''}

GOVERNED POLICY RULES:
${ctx.systemInstructions}

AVAILABLE TOOLS:
${ctx.availableTools.map((t) => `- ${t.name}: ${t.description}`).join('\n')}
Call tools when information is needed or when recording prospect criteria. Never invent information outside approved company guidance.`;
  }
}

export const defaultEmployeeRuntimeService = new EmployeeRuntimeService();

export const runtimeModule = {
  name: 'runtime',
  status: 'active',
  description: 'HQ Employee Runtime Context Builder & Policy-Filtered Execution',
  service: defaultEmployeeRuntimeService,
};
