import { randomUUID } from 'crypto';
import { query } from '../../db/index.js';
import { NotFoundError, ValidationError } from '../../errors/index.js';

// --- Domain Models ---

export interface CompanyProfile {
  id: string;
  name: string;
  tagline: string;
  website: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface PricingTier {
  id: string;
  serviceId: string;
  tierName: string;
  minPriceCents: number;
  maxPriceCents?: number;
  currency: string;
  pricingModel: string;
  notes?: string;
}

export interface TimelineScope {
  id: string;
  serviceId: string;
  scopeDescription: string;
  minDurationWeeks: number;
  maxDurationWeeks: number;
  notes?: string;
}

export interface ApprovedServiceWithGuidance {
  id: string;
  companyId: string;
  slug: string;
  title: string;
  description: string;
  isActive: boolean;
  pricing: PricingTier[];
  timelines: TimelineScope[];
}

export interface CompanyFaq {
  id: string;
  companyId: string;
  question: string;
  answer: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthorityRule {
  action: string;
  category: string;
  decision: 'ALLOW' | 'REQUIRE_APPROVAL' | 'BLOCK';
  rationale: string;
}

export interface EscalationRule {
  condition: string;
  targetRole: string;
  notificationChannel: string;
  timeoutMinutes: number;
}

export interface EmployeePolicy {
  id: string;
  employeeId: string;
  version: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  systemInstructions: string;
  authorityRules: AuthorityRule[];
  escalationRules: EscalationRule[];
  createdAt: string;
  updatedAt: string;
}

export interface CompanyBrainView {
  profile: CompanyProfile;
  services: ApprovedServiceWithGuidance[];
  faqs: CompanyFaq[];
  activePolicy: EmployeePolicy | null;
}

export interface EmployeeRuntimeContext {
  companySummary: string;
  activePolicyVersion: string;
  systemInstructions: string;
  approvedServices: Array<{
    slug: string;
    title: string;
    description: string;
    startingPrice: string;
    timelineRange: string;
  }>;
  authorityDecisions: Record<'ALLOW' | 'REQUIRE_APPROVAL' | 'BLOCK', string[]>;
  frequentlyAskedQuestions: Array<{ question: string; answer: string }>;
}

// --- Initial Seed / In-Memory State for Deterministic Storage ---

const defaultCompanyId = 'c0000000-0000-0000-0000-000000000001';
const defaultEmployeeId = 'e0000000-0000-0000-0000-000000000001';

const initialProfile: CompanyProfile = {
  id: defaultCompanyId,
  name: 'HQ',
  tagline: 'Engineering next-generation web, custom software, and voice AI solutions.',
  website: 'https://hq.example.com',
  description: 'HQ is a premier digital engineering firm building high-performance web applications, bespoke software platforms, enterprise conversational AI solutions, and secure systems.',
  createdAt: new Date('2026-09-01T00:00:00Z').toISOString(),
  updatedAt: new Date('2026-09-17T00:00:00Z').toISOString(),
};

const initialServices: ApprovedServiceWithGuidance[] = [
  {
    id: 's0000000-0000-0000-0000-000000000001',
    companyId: defaultCompanyId,
    slug: 'website-dev',
    title: 'Website Development',
    description: 'Custom, responsive web applications, modern JAMstack architectures, and headless CMS integrations.',
    isActive: true,
    pricing: [
      {
        id: 'p0000000-0000-0000-0000-000000000001',
        serviceId: 's0000000-0000-0000-0000-000000000001',
        tierName: 'Standard MVP',
        minPriceCents: 500000,
        maxPriceCents: 1000000,
        currency: 'USD',
        pricingModel: 'FIXED_RANGE',
        notes: 'Includes responsive design, SEO optimization, and CMS handoff.',
      },
    ],
    timelines: [
      {
        id: 't0000000-0000-0000-0000-000000000001',
        serviceId: 's0000000-0000-0000-0000-000000000001',
        scopeDescription: 'Production launch with staging review',
        minDurationWeeks: 4,
        maxDurationWeeks: 6,
        notes: 'Dependent on timely client asset delivery.',
      },
    ],
  },
  {
    id: 's0000000-0000-0000-0000-000000000002',
    companyId: defaultCompanyId,
    slug: 'custom-software',
    title: 'Custom Software Development',
    description: 'Tailored SaaS products, workflow automation backends, and internal company business tools.',
    isActive: true,
    pricing: [
      {
        id: 'p0000000-0000-0000-0000-000000000002',
        serviceId: 's0000000-0000-0000-0000-000000000002',
        tierName: 'Core Platform MVP',
        minPriceCents: 1500000,
        maxPriceCents: 3500000,
        currency: 'USD',
        pricingModel: 'FIXED_RANGE',
        notes: 'Full-stack architecture, relational database, role-based auth, and API.',
      },
    ],
    timelines: [
      {
        id: 't0000000-0000-0000-0000-000000000002',
        serviceId: 's0000000-0000-0000-0000-000000000002',
        scopeDescription: 'Multi-tenant architecture and core workflow engine',
        minDurationWeeks: 8,
        maxDurationWeeks: 12,
      },
    ],
  },
  {
    id: 's0000000-0000-0000-0000-000000000003',
    companyId: defaultCompanyId,
    slug: 'ai-ml',
    title: 'AI & ML Engineering',
    description: 'Conversational voice agents (AssemblyAI), RAG systems, model fine-tuning, and LLM governance.',
    isActive: true,
    pricing: [
      {
        id: 'p0000000-0000-0000-0000-000000000003',
        serviceId: 's0000000-0000-0000-0000-000000000003',
        tierName: 'Governed Voice Agent MVP',
        minPriceCents: 1200000,
        maxPriceCents: 2500000,
        currency: 'USD',
        pricingModel: 'FIXED_RANGE',
        notes: 'Turn-taking voice agent with structured tool execution and policy guards.',
      },
    ],
    timelines: [
      {
        id: 't0000000-0000-0000-0000-000000000003',
        serviceId: 's0000000-0000-0000-0000-000000000003',
        scopeDescription: 'Voice streaming integration, tool definitions, and policy testing',
        minDurationWeeks: 6,
        maxDurationWeeks: 10,
      },
    ],
  },
  {
    id: 's0000000-0000-0000-0000-000000000004',
    companyId: defaultCompanyId,
    slug: 'cybersecurity',
    title: 'Cybersecurity Engineering',
    description: 'Penetration testing, application vulnerability audits, security policy engineering, and compliance prep.',
    isActive: true,
    pricing: [
      {
        id: 'p0000000-0000-0000-0000-000000000004',
        serviceId: 's0000000-0000-0000-0000-000000000004',
        tierName: 'Comprehensive App Audit',
        minPriceCents: 750000,
        maxPriceCents: 1500000,
        currency: 'USD',
        pricingModel: 'FIXED_RANGE',
        notes: 'Includes black-box pen test, code review, and remediation report.',
      },
    ],
    timelines: [
      {
        id: 't0000000-0000-0000-0000-000000000004',
        serviceId: 's0000000-0000-0000-0000-000000000004',
        scopeDescription: 'Security assessment, validation exploit run, and executive brief',
        minDurationWeeks: 2,
        maxDurationWeeks: 4,
      },
    ],
  },
];

const initialFaqs: CompanyFaq[] = [
  {
    id: 'f0000000-0000-0000-0000-000000000001',
    companyId: defaultCompanyId,
    question: 'Do you sign NDAs before discovery discussions?',
    answer: 'Yes, HQ routinely executes mutual non-disclosure agreements prior to in-depth technical discussions.',
    displayOrder: 1,
    isActive: true,
    createdAt: new Date('2026-09-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2026-09-17T00:00:00Z').toISOString(),
  },
  {
    id: 'f0000000-0000-0000-0000-000000000002',
    companyId: defaultCompanyId,
    question: 'What is your standard billing milestone structure?',
    answer: 'Typical projects are billed milestone-based: 40% kick-off, 30% mid-project milestone delivery, and 30% final acceptance sign-off.',
    displayOrder: 2,
    isActive: true,
    createdAt: new Date('2026-09-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2026-09-17T00:00:00Z').toISOString(),
  },
  {
    id: 'f0000000-0000-0000-0000-000000000003',
    companyId: defaultCompanyId,
    question: 'How do we begin a project with HQ?',
    answer: 'We schedule an initial 30-minute discovery consultation to discover your requirements, followed by a formal technical scope and proposal.',
    displayOrder: 3,
    isActive: true,
    createdAt: new Date('2026-09-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2026-09-17T00:00:00Z').toISOString(),
  },
];

const initialPolicy: EmployeePolicy = {
  id: 'pol-0000000-0000-0000-0000-000000000001',
  employeeId: defaultEmployeeId,
  version: '1.0.0',
  status: 'ACTIVE',
  systemInstructions: `You are the HQ Business Development & Client Coordinator for HQ.
Your role is to communicate with prospective clients, qualify software development opportunities, discuss only approved company information, schedule discovery meetings, maintain structured lead memory, and escalate out-of-scope decisions to human leadership.
Always speak concisely, professionally, and warmly. Identify yourself honestly as an AI coordinator.`,
  authorityRules: [
    { action: 'get_company_profile', category: 'information', decision: 'ALLOW', rationale: 'Public company background' },
    { action: 'get_service_details', category: 'information', decision: 'ALLOW', rationale: 'Approved service descriptions' },
    { action: 'get_pricing_guidance', category: 'commercial', decision: 'ALLOW', rationale: 'Approved standard starting ranges' },
    { action: 'get_timeline_guidance', category: 'commercial', decision: 'ALLOW', rationale: 'Approved standard duration windows' },
    { action: 'create_lead', category: 'data', decision: 'ALLOW', rationale: 'Capture contact facts' },
    { action: 'record_requirement', category: 'data', decision: 'ALLOW', rationale: 'Capture discovered requirements' },
    { action: 'schedule_meeting', category: 'calendar', decision: 'ALLOW', rationale: 'Schedule discovery consultation' },
    { action: 'apply_custom_discount', category: 'commercial', decision: 'REQUIRE_APPROVAL', rationale: 'Pricing deviations must be human approved' },
    { action: 'commit_rush_delivery', category: 'commercial', decision: 'REQUIRE_APPROVAL', rationale: 'Accelerated timelines under 2 weeks require operator clearance' },
    { action: 'sign_contract', category: 'legal', decision: 'BLOCK', rationale: 'Contracts can only be executed by human leadership' },
    { action: 'request_payment', category: 'financial', decision: 'BLOCK', rationale: 'Financial transactions cannot be initiated by voice AI' },
    { action: 'request_password', category: 'security', decision: 'BLOCK', rationale: 'Security secrets must never be requested' },
    { action: 'claim_human_identity', category: 'governance', decision: 'BLOCK', rationale: 'Must never impersonate a human' },
  ],
  escalationRules: [
    { condition: 'Lead requests legal negotiation', targetRole: 'Legal & Managing Director', notificationChannel: 'slack_urgent', timeoutMinutes: 60 },
    { condition: 'Lead requests discount exceeding 10%', targetRole: 'Commercial Director', notificationChannel: 'dashboard_approval', timeoutMinutes: 120 },
    { condition: 'Lead expresses dissatisfaction or dispute', targetRole: 'Client Partner', notificationChannel: 'sms_lead_alert', timeoutMinutes: 30 },
  ],
  createdAt: new Date('2026-09-01T00:00:00Z').toISOString(),
  updatedAt: new Date('2026-09-17T00:00:00Z').toISOString(),
};

// --- Repository Implementation ---

export class CompanyBrainRepository {
  private profile: CompanyProfile = { ...initialProfile };
  private services: ApprovedServiceWithGuidance[] = initialServices.map(s => ({
    ...s,
    pricing: [...s.pricing],
    timelines: [...s.timelines],
  }));
  private faqs: CompanyFaq[] = initialFaqs.map(f => ({ ...f }));
  private policies: EmployeePolicy[] = [{ ...initialPolicy }];

  // Profile operations
  async getProfile(companyId: string): Promise<CompanyProfile> {
    return { ...this.profile };
  }

  async updateProfile(companyId: string, updates: Partial<Omit<CompanyProfile, 'id' | 'createdAt' | 'updatedAt'>>): Promise<CompanyProfile> {
    this.profile = {
      ...this.profile,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return { ...this.profile };
  }

  // Service operations
  async listServices(companyId: string): Promise<ApprovedServiceWithGuidance[]> {
    return this.services.filter(s => s.isActive);
  }

  async getServiceBySlug(companyId: string, slug: string): Promise<ApprovedServiceWithGuidance | null> {
    const service = this.services.find(s => s.slug === slug && s.isActive);
    return service ? { ...service } : null;
  }

  async upsertService(companyId: string, serviceData: {
    slug: string;
    title: string;
    description: string;
    minPriceCents: number;
    maxPriceCents?: number;
    minDurationWeeks: number;
    maxDurationWeeks: number;
    tierName?: string;
    scopeDescription?: string;
  }): Promise<ApprovedServiceWithGuidance> {
    const existingIndex = this.services.findIndex(s => s.slug === serviceData.slug);
    const serviceId = existingIndex >= 0 ? this.services[existingIndex].id : randomUUID();

    const pricingTier: PricingTier = {
      id: randomUUID(),
      serviceId,
      tierName: serviceData.tierName || 'Standard',
      minPriceCents: serviceData.minPriceCents,
      maxPriceCents: serviceData.maxPriceCents,
      currency: 'USD',
      pricingModel: 'FIXED_RANGE',
    };

    const timelineScope: TimelineScope = {
      id: randomUUID(),
      serviceId,
      scopeDescription: serviceData.scopeDescription || 'Standard delivery milestone',
      minDurationWeeks: serviceData.minDurationWeeks,
      maxDurationWeeks: serviceData.maxDurationWeeks,
    };

    const newService: ApprovedServiceWithGuidance = {
      id: serviceId,
      companyId,
      slug: serviceData.slug,
      title: serviceData.title,
      description: serviceData.description,
      isActive: true,
      pricing: [pricingTier],
      timelines: [timelineScope],
    };

    if (existingIndex >= 0) {
      this.services[existingIndex] = newService;
    } else {
      this.services.push(newService);
    }

    return { ...newService };
  }

  // FAQ operations
  async listFaqs(companyId: string): Promise<CompanyFaq[]> {
    return this.faqs
      .filter(f => f.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async upsertFaq(companyId: string, data: { id?: string; question: string; answer: string; displayOrder?: number }): Promise<CompanyFaq> {
    const now = new Date().toISOString();
    if (data.id) {
      const idx = this.faqs.findIndex(f => f.id === data.id);
      if (idx >= 0) {
        this.faqs[idx] = {
          ...this.faqs[idx],
          question: data.question,
          answer: data.answer,
          displayOrder: data.displayOrder ?? this.faqs[idx].displayOrder,
          updatedAt: now,
        };
        return { ...this.faqs[idx] };
      }
    }

    const newFaq: CompanyFaq = {
      id: randomUUID(),
      companyId,
      question: data.question,
      answer: data.answer,
      displayOrder: data.displayOrder ?? (this.faqs.length + 1),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.faqs.push(newFaq);
    return { ...newFaq };
  }

  // Policy operations
  async listPolicies(companyId: string): Promise<EmployeePolicy[]> {
    return this.policies.map(p => ({ ...p }));
  }

  async getActivePolicy(companyId: string): Promise<EmployeePolicy | null> {
    const active = this.policies.find(p => p.status === 'ACTIVE');
    return active ? { ...active } : null;
  }

  async createPolicyVersion(companyId: string, data: {
    version: string;
    systemInstructions: string;
    authorityRules: AuthorityRule[];
    escalationRules: EscalationRule[];
  }): Promise<EmployeePolicy> {
    const now = new Date().toISOString();

    // Check version uniqueness
    const exists = this.policies.some(p => p.version === data.version);
    if (exists) {
      throw new ValidationError(`Policy version ${data.version} already exists.`);
    }

    const newPolicy: EmployeePolicy = {
      id: randomUUID(),
      employeeId: defaultEmployeeId,
      version: data.version,
      status: 'DRAFT',
      systemInstructions: data.systemInstructions,
      authorityRules: data.authorityRules,
      escalationRules: data.escalationRules,
      createdAt: now,
      updatedAt: now,
    };

    this.policies.push(newPolicy);
    return { ...newPolicy };
  }

  async activatePolicyVersion(companyId: string, policyId: string): Promise<EmployeePolicy> {
    const target = this.policies.find(p => p.id === policyId);
    if (!target) {
      throw new NotFoundError('Policy', policyId);
    }

    const now = new Date().toISOString();

    // Archive or deactivate any previously active policies
    this.policies = this.policies.map(p => {
      if (p.id === policyId) {
        return { ...p, status: 'ACTIVE', updatedAt: now };
      }
      if (p.status === 'ACTIVE') {
        return { ...p, status: 'ARCHIVED', updatedAt: now };
      }
      return p;
    });

    return { ...target, status: 'ACTIVE', updatedAt: now };
  }
}

// --- Service Layer ---

export class CompanyBrainService {
  constructor(private readonly repository: CompanyBrainRepository) {}

  async getCompanyBrain(companyId = defaultCompanyId): Promise<CompanyBrainView> {
    const [profile, services, faqs, activePolicy] = await Promise.all([
      this.repository.getProfile(companyId),
      this.repository.listServices(companyId),
      this.repository.listFaqs(companyId),
      this.repository.getActivePolicy(companyId),
    ]);

    return { profile, services, faqs, activePolicy };
  }

  async updateProfile(companyId = defaultCompanyId, updates: Partial<Omit<CompanyProfile, 'id' | 'createdAt' | 'updatedAt'>>) {
    return this.repository.updateProfile(companyId, updates);
  }

  async listServices(companyId = defaultCompanyId) {
    return this.repository.listServices(companyId);
  }

  async upsertService(companyId = defaultCompanyId, data: {
    slug: string;
    title: string;
    description: string;
    minPriceCents: number;
    maxPriceCents?: number;
    minDurationWeeks: number;
    maxDurationWeeks: number;
    tierName?: string;
    scopeDescription?: string;
  }) {
    if (data.minPriceCents <= 0) {
      throw new ValidationError('Starting price must be greater than zero');
    }
    if (data.maxPriceCents && data.maxPriceCents < data.minPriceCents) {
      throw new ValidationError('Maximum price cannot be less than minimum price');
    }
    if (data.minDurationWeeks <= 0) {
      throw new ValidationError('Minimum duration weeks must be greater than zero');
    }
    if (data.maxDurationWeeks < data.minDurationWeeks) {
      throw new ValidationError('Maximum duration cannot be less than minimum duration');
    }

    return this.repository.upsertService(companyId, data);
  }

  async listFaqs(companyId = defaultCompanyId) {
    return this.repository.listFaqs(companyId);
  }

  async upsertFaq(companyId = defaultCompanyId, data: { id?: string; question: string; answer: string; displayOrder?: number }) {
    if (!data.question.trim()) throw new ValidationError('FAQ question is required');
    if (!data.answer.trim()) throw new ValidationError('FAQ answer is required');
    return this.repository.upsertFaq(companyId, data);
  }

  async listPolicies(companyId = defaultCompanyId) {
    return this.repository.listPolicies(companyId);
  }

  async getActivePolicy(companyId = defaultCompanyId) {
    return this.repository.getActivePolicy(companyId);
  }

  async createPolicyVersion(companyId = defaultCompanyId, data: {
    version: string;
    systemInstructions: string;
    authorityRules: AuthorityRule[];
    escalationRules: EscalationRule[];
  }) {
    if (!data.version || !data.version.trim()) {
      throw new ValidationError('Policy version string is required');
    }
    if (!data.systemInstructions || !data.systemInstructions.trim()) {
      throw new ValidationError('System instructions are required for policy');
    }
    return this.repository.createPolicyVersion(companyId, data);
  }

  async activatePolicyVersion(companyId = defaultCompanyId, policyId: string) {
    return this.repository.activatePolicyVersion(companyId, policyId);
  }

  /**
   * Generates compiled runtime knowledge for the AI employee prompt.
   * Gives the LLM approved services, authorized bounds, and authority boundaries.
   */
  async getRuntimeContext(companyId = defaultCompanyId, serviceSlug?: string): Promise<EmployeeRuntimeContext> {
    const [profile, services, faqs, policy] = await Promise.all([
      this.repository.getProfile(companyId),
      this.repository.listServices(companyId),
      this.repository.listFaqs(companyId),
      this.repository.getActivePolicy(companyId),
    ]);

    const activeServices = serviceSlug
      ? services.filter(s => s.slug === serviceSlug)
      : services;

    const formattedServices = activeServices.map(s => {
      const primaryPricing = s.pricing[0];
      const primaryTimeline = s.timelines[0];

      const priceStr = primaryPricing
        ? primaryPricing.maxPriceCents
          ? `$${(primaryPricing.minPriceCents / 100).toLocaleString()} - $${(primaryPricing.maxPriceCents / 100).toLocaleString()}`
          : `From $${(primaryPricing.minPriceCents / 100).toLocaleString()}`
        : 'Contact for custom quote';

      const timelineStr = primaryTimeline
        ? `${primaryTimeline.minDurationWeeks} to ${primaryTimeline.maxDurationWeeks} weeks`
        : 'To be determined during technical scoping';

      return {
        slug: s.slug,
        title: s.title,
        description: s.description,
        startingPrice: priceStr,
        timelineRange: timelineStr,
      };
    });

    const authorityDecisions: Record<'ALLOW' | 'REQUIRE_APPROVAL' | 'BLOCK', string[]> = {
      ALLOW: [],
      REQUIRE_APPROVAL: [],
      BLOCK: [],
    };

    if (policy) {
      for (const rule of policy.authorityRules) {
        authorityDecisions[rule.decision].push(`${rule.action}: ${rule.rationale}`);
      }
    }

    return {
      companySummary: `${profile.name} — ${profile.tagline}\n${profile.description}`,
      activePolicyVersion: policy?.version || 'none',
      systemInstructions: policy?.systemInstructions || 'You are the HQ AI Coordinator.',
      approvedServices: formattedServices,
      authorityDecisions,
      frequentlyAskedQuestions: faqs.map(f => ({ question: f.question, answer: f.answer })),
    };
  }
}

// Default singleton instance for application use
export const defaultCompanyBrainRepository = new CompanyBrainRepository();
export const defaultCompanyBrainService = new CompanyBrainService(defaultCompanyBrainRepository);

export const companyModule = {
  name: 'company',
  status: 'active',
  description: 'Company Brain, approved services, pricing guidance, FAQs, and versioned governance policies',
  service: defaultCompanyBrainService,
  repository: defaultCompanyBrainRepository,
};
