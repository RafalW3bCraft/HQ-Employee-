/**
 * Pre-Configured Industry Operating Profiles
 *
 * Implements Section 2: INDUSTRY -> OPERATING PROFILE.
 * Loads audited, structured business guidance, approved sales questions,
 * qualification criteria, and campaign templates into Company Brain.
 */

import { IndustryProfile } from './types.js';

export const B2B_SAAS_PROFILE: IndustryProfile = {
  id: 'b2b_saas',
  title: 'B2B Enterprise SaaS',
  description: 'Subscription software platforms serving mid-market and enterprise business teams.',
  recommendedServices: [
    {
      title: 'Enterprise Platform Subscription',
      description: 'Annual seat licenses including dedicated SLA, SSO/SAML, and priority support.',
      startingPriceCents: 1500000, // $15,000 / year
      currency: 'USD',
      minTimelineWeeks: 2,
    },
    {
      title: 'Managed Implementation & Data Migration',
      description: 'White-glove data ingestion, API integration, and user training.',
      startingPriceCents: 800000, // $8,000
      currency: 'USD',
      minTimelineWeeks: 4,
    },
  ],
  approvedQuestions: [
    {
      id: 'saas_seats',
      category: 'need',
      questionText: 'How many team members or daily active users would need access to the platform?',
      rationale: 'Establishes tiering and seat license requirements.',
      isMandatoryForQualification: true,
    },
    {
      id: 'saas_integrations',
      category: 'technical',
      questionText: 'Which existing systems or CRMs (e.g. Salesforce, HubSpot, Slack) do we need to integrate with?',
      rationale: 'Identifies technical scope and migration feasibility.',
      isMandatoryForQualification: false,
    },
    {
      id: 'saas_budget',
      category: 'budget',
      questionText: 'Has an annual software budget between $15,000 and $50,000 been allocated for this initiative?',
      rationale: 'Ensures economic fit before scheduling architecture review.',
      isMandatoryForQualification: true,
    },
    {
      id: 'saas_timeline',
      category: 'timeline',
      questionText: 'What is your target launch or cutover date for replacing your current workflow?',
      rationale: 'Validates implementation scheduling window.',
      isMandatoryForQualification: true,
    },
  ],
  qualificationRules: {
    minBudgetUsd: 15000,
    maxDeliveryTimelineMonths: 6,
    mandatoryRoles: ['VP', 'Director', 'CTO', 'Head of', 'Operations Lead'],
    requiredSignals: ['Active pain in existing workflow', 'Budget identified', 'Decision maker involved'],
  },
  campaignTemplates: [
    {
      templateId: 'saas_outreach_efficiency',
      name: 'Workflow Modernization Outreach',
      targetAudience: 'VPs of Operations and IT Leaders',
      valueProposition: 'Eliminate manual reconciliation bottlenecks with governed automated operations.',
      suggestedScript: 'Hi {{name}}, I am reaching out from {{company}}. We noticed {{prospectCompany}} is scaling its operations team and wanted to share how we helped similar teams automate their workflow orchestration.',
    },
  ],
  complianceNotes: [
    'Always provide mandatory AI disclosure at call start.',
    'Do not store payment card credentials directly in conversation memory.',
    'Confirm company data residency requirements during discovery.',
  ],
};

export const SOFTWARE_DEV_PROFILE: IndustryProfile = {
  id: 'software_dev',
  title: 'Custom Software & Cloud Engineering',
  description: 'Full-stack web application, API development, cloud architecture, and AI integration services.',
  recommendedServices: [
    {
      title: 'Full-Stack Web Application Development',
      description: 'End-to-end custom application design, development, and deployment.',
      startingPriceCents: 500000, // $5,000
      currency: 'USD',
      minTimelineWeeks: 4,
    },
    {
      title: 'Cloud Architecture & Infrastructure Modernization',
      description: 'Cloud Run, Kubernetes, serverless API modernization, and database tuning.',
      startingPriceCents: 350000, // $3,500
      currency: 'USD',
      minTimelineWeeks: 2,
    },
    {
      title: 'AI Agent & Real-Time Voice Integration',
      description: 'AssemblyAI Voice Agent API integration, deterministic governance, and telephony.',
      startingPriceCents: 750000, // $7,500
      currency: 'USD',
      minTimelineWeeks: 3,
    },
  ],
  approvedQuestions: [
    {
      id: 'dev_scope',
      category: 'need',
      questionText: 'What are the core technical capabilities and user workflows required for this platform?',
      rationale: 'Determines engineering architecture and module footprint.',
      isMandatoryForQualification: true,
    },
    {
      id: 'dev_budget',
      category: 'budget',
      questionText: 'What budget range do you have allocated for design, development, and production rollout?',
      rationale: 'Custom software requires minimum $5,000 starting budget.',
      isMandatoryForQualification: true,
    },
    {
      id: 'dev_timeline',
      category: 'timeline',
      questionText: 'When do you need the production build launched, and is there an existing system to migrate from?',
      rationale: 'Timelines under 2 weeks strictly require human director clearance.',
      isMandatoryForQualification: true,
    },
  ],
  qualificationRules: {
    minBudgetUsd: 5000,
    maxDeliveryTimelineMonths: 12,
    mandatoryRoles: ['Founder', 'CTO', 'VP Engineering', 'Product Manager', 'Managing Director'],
    requiredSignals: ['Defined technical requirements', 'Minimum $5k budget', 'Realistic delivery schedule >= 2 weeks'],
  },
  campaignTemplates: [
    {
      templateId: 'dev_outreach_modernization',
      name: 'Cloud & AI Modernization Campaign',
      targetAudience: 'CTOs and Technical Founders',
      valueProposition: 'Accelerate your roadmap with production-ready AI agents and high-performance cloud architecture.',
      suggestedScript: 'Hello {{name}}, this is {{companyName}} AI coordination team. We partner with tech teams to deploy governed AI voice agents and scalable cloud backends.',
    },
  ],
  complianceNotes: [
    'Delivery timelines under 2 weeks require explicit human engineering clearance.',
    'Contractual agreements and scope sign-offs must be executed by legal officers.',
  ],
};

export const PROFESSIONAL_CONSULTING_PROFILE: IndustryProfile = {
  id: 'consulting',
  title: 'Management & Strategy Consulting',
  description: 'Strategic advisory, operational audits, and organizational performance optimization.',
  recommendedServices: [
    {
      title: 'Operational Diagnostic & Strategic Roadmap',
      description: '2-week comprehensive business diagnostic with executive presentation.',
      startingPriceCents: 1000000, // $10,000
      currency: 'USD',
      minTimelineWeeks: 2,
    },
    {
      title: 'Executive Advisory Retainer',
      description: 'Monthly dedicated strategic advisory and leadership coaching.',
      startingPriceCents: 500000, // $5,000 / month
      currency: 'USD',
      minTimelineWeeks: 12,
    },
  ],
  approvedQuestions: [
    {
      id: 'consult_objective',
      category: 'need',
      questionText: 'What is the primary operational or revenue metric you are aiming to transform in the next two quarters?',
      rationale: 'Clarifies strategic intent and success criteria.',
      isMandatoryForQualification: true,
    },
    {
      id: 'consult_sponsor',
      category: 'decision_maker',
      questionText: 'Who on the executive team will sponsor and champion this initiative?',
      rationale: 'Consulting requires C-level sponsorship.',
      isMandatoryForQualification: true,
    },
  ],
  qualificationRules: {
    minBudgetUsd: 10000,
    maxDeliveryTimelineMonths: 6,
    mandatoryRoles: ['CEO', 'COO', 'Managing Partner', 'Board Member'],
    requiredSignals: ['Executive sponsor identified', 'Defined business goal', 'Dedicated budget >= $10k'],
  },
  campaignTemplates: [
    {
      templateId: 'consult_advisory_reach',
      name: 'Executive Diagnostic Outreach',
      targetAudience: 'Chief Executive Officers and COOs',
      valueProposition: 'Unlock operational efficiency and strategic clarity with an evidence-backed diagnostic.',
      suggestedScript: 'Good morning {{name}}, I am reaching out on behalf of {{companyName}}. We help mid-market executives identify operational friction points and scale their business margins.',
    },
  ],
  complianceNotes: [
    'Strict non-disclosure agreements must precede deep financial disclosures.',
  ],
};

export const HEALTHCARE_TECH_PROFILE: IndustryProfile = {
  id: 'healthcare_tech',
  title: 'Digital Health & HealthTech Solutions',
  description: 'Clinical workflow automation, patient engagement, and telemedicine systems.',
  recommendedServices: [
    {
      title: 'HIPAA-Compliant Patient Portal & Communication Hub',
      description: 'Secure, encrypted patient communication and scheduling integration.',
      startingPriceCents: 2000000, // $20,000
      currency: 'USD',
      minTimelineWeeks: 8,
    },
  ],
  approvedQuestions: [
    {
      id: 'health_compliance',
      category: 'technical',
      questionText: 'What compliance frameworks (HIPAA, HITECH, SOC 2 Type II) are required for your environment?',
      rationale: 'Healthcare projects have strict regulatory constraints.',
      isMandatoryForQualification: true,
    },
  ],
  qualificationRules: {
    minBudgetUsd: 20000,
    maxDeliveryTimelineMonths: 12,
    mandatoryRoles: ['Chief Medical Officer', 'Clinical Director', 'VP Health Informatics'],
    requiredSignals: ['Compliance needs specified', 'Minimum $20k budget', 'Clinical lead engaged'],
  },
  campaignTemplates: [
    {
      templateId: 'health_care_engagement',
      name: 'Patient Communication Modernization',
      targetAudience: 'Clinical Directors and Health System Leaders',
      valueProposition: 'Reduce appointment no-shows and administrative overhead with HIPAA-compliant communication.',
      suggestedScript: 'Hello {{name}}, this is {{companyName}} clinical coordination assistant. We assist medical groups in automating appointment reminders while strictly safeguarding patient privacy.',
    },
  ],
  complianceNotes: [
    'Zero PHI / PII may be logged in unencrypted debug files.',
    'AssemblyAI medical domain mode (domain: "medical-v1") is recommended when transcribing clinical terms.',
  ],
};

const INDUSTRY_CATALOG: Record<string, IndustryProfile> = {
  b2b_saas: B2B_SAAS_PROFILE,
  software_dev: SOFTWARE_DEV_PROFILE,
  consulting: PROFESSIONAL_CONSULTING_PROFILE,
  healthcare_tech: HEALTHCARE_TECH_PROFILE,
};

export function getIndustryProfile(industryId: string): IndustryProfile {
  const profile = INDUSTRY_CATALOG[industryId.toLowerCase()];
  if (!profile) {
    // Default to software_dev if unknown
    return SOFTWARE_DEV_PROFILE;
  }
  return profile;
}

export function listAvailableIndustryProfiles(): IndustryProfile[] {
  return Object.values(INDUSTRY_CATALOG);
}
