/**
 * Governed Autonomous Company Operating Agent — Domain Types & Interfaces
 *
 * Establishes the P1 architectural foundation for continuous, autonomous,
 * policy-governed business execution across Sales, BD, and Marketing.
 */

// ── 1. Company Operating Configuration ───────────────────────────────────────

export interface BusinessHoursWindow {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  openTime: string;  // "09:00" (HH:MM 24h format)
  closeTime: string; // "17:00" (HH:MM 24h format)
  isOpen: boolean;
}

export interface OperatingHoursConfig {
  timezone: string; // IANA identifier e.g. "America/New_York", "Europe/London"
  businessHours: BusinessHoursWindow[];
  holidays: string[]; // ISO date strings e.g. "2026-12-25"
  callingHours: {
    startHour: number; // e.g. 9 (9 AM local to contact)
    endHour: number;   // e.g. 17 (5 PM local to contact)
  };
}

export interface CommercialAuthorityConfig {
  standardPricingEnabled: boolean;
  maxAutonomousDiscountPercent: number; // e.g. 5 (5% without human escalation)
  escalationDiscountPercent: number;    // e.g. 20 (up to 20% requires approval)
  blockDiscountPercent: number;         // e.g. 20 (> 20% strictly blocked)
  allowAutonomousProposalGeneration: boolean;
  allowAutonomousContractSigning: false; // Always false — fail-closed security boundary
  allowAutonomousPaymentDisbursements: false; // Always false
}

export interface OutreachConfig {
  allowedChannels: Array<'voice_inbound' | 'voice_outbound' | 'calendar' | 'email_followup'>;
  maxCallsPerDay: number;
  maxContactsPerDay: number;
  maxConcurrentCalls: number;
  followUpCadenceDays: number;
  retryLimit: number;
  enforceCallingHours: boolean;
  enforceOptOutCheck: boolean;
  mandatoryAiDisclosure: string; // e.g. "I am HQ-Employee, an AI assistant representing..."
}

export interface EmployeeRoleConfig {
  roleId: string;
  roleName: string;
  responsibilities: string[];
  allowedTools: string[];
  prohibitedActions: string[];
  communicationTone: 'professional' | 'consultative' | 'concise' | 'executive';
}

export interface CompanyOperatingConfig {
  companyId: string;
  companyName: string;
  industryId: string;
  targetMarket: string;
  geography: string[];
  operatingHours: OperatingHoursConfig;
  commercialAuthority: CommercialAuthorityConfig;
  outreach: OutreachConfig;
  employeeRoles: EmployeeRoleConfig[];
  emergencyStopEnabled: boolean;
  updatedAt: string;
}

// ── 2. Industry Operating Profile ───────────────────────────────────────────

export interface IndustrySalesQuestion {
  id: string;
  category: 'need' | 'budget' | 'timeline' | 'technical' | 'decision_maker';
  questionText: string;
  rationale: string;
  isMandatoryForQualification: boolean;
}

export interface IndustryQualificationCriteria {
  minBudgetUsd: number;
  maxDeliveryTimelineMonths: number;
  mandatoryRoles: string[];
  requiredSignals: string[];
}

export interface IndustryCampaignTemplate {
  templateId: string;
  name: string;
  targetAudience: string;
  valueProposition: string;
  suggestedScript: string;
}

export interface IndustryProfile {
  id: string;
  title: string;
  description: string;
  recommendedServices: Array<{
    title: string;
    description: string;
    startingPriceCents: number;
    currency: string;
    minTimelineWeeks: number;
  }>;
  approvedQuestions: IndustrySalesQuestion[];
  qualificationRules: IndustryQualificationCriteria;
  campaignTemplates: IndustryCampaignTemplate[];
  complianceNotes: string[];
}

// ── 3. Autonomous Sales Pipeline (14 Stages) ────────────────────────────────

export type AutonomousPipelineStage =
  | 'NEW'
  | 'CONTACTING'
  | 'CONNECTED'
  | 'DISCOVERY'
  | 'QUALIFIED'
  | 'MEETING_REQUESTED'
  | 'MEETING_SCHEDULED'
  | 'MEETING_COMPLETED'
  | 'PROPOSAL_PREPARATION'
  | 'PROPOSAL_SENT'
  | 'FOLLOW_UP'
  | 'NEGOTIATION'
  | 'APPROVAL'
  | 'CLOSED_WON'
  | 'CLOSED_LOST';

export interface PipelineTransitionEvent {
  leadId: string;
  companyId: string;
  fromStage: AutonomousPipelineStage;
  toStage: AutonomousPipelineStage;
  triggeredBy: string;
  reason: string;
  timestamp: string;
}

// ── 4. Scheduler & Worker Types ─────────────────────────────────────────────

export type JobPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type JobStatus = 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'CANCELLED';

export interface ScheduledJob {
  id: string;
  companyId: string;
  jobType: string;
  priority: JobPriority;
  status: JobStatus;
  scheduledFor: string; // ISO string
  idempotencyKey: string;
  payload: Record<string, unknown>;
  attemptCount: number;
  maxAttempts: number;
  lastAttemptAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobExecutionRecord {
  jobId: string;
  companyId: string;
  status: JobStatus;
  durationMs: number;
  result?: Record<string, unknown>;
  error?: string;
  timestamp: string;
}

// ── 5. Human Control & Emergency Stop ───────────────────────────────────────

export interface EmergencyStopState {
  companyId: string;
  isStopped: boolean;
  reason?: string;
  trippedAt?: string;
  trippedBy?: string;
}

// ── 6. Meeting Attendance Agent Provider Abstraction ────────────────────────

export interface MeetingBrief {
  meetingId: string;
  leadId: string;
  companyName: string;
  attendeeNames: string[];
  keyObjectives: string[];
  priorCapturedFacts: string[];
  suggestedAgenda: string[];
}

export interface MeetingSummary {
  meetingId: string;
  durationMinutes: number;
  decisionsMade: string[];
  actionItems: Array<{ task: string; owner: string; dueDate?: string }>;
  nextSteps: string[];
  transcriptId?: string;
  executiveSummary: string;
}

export interface MeetingAgentProvider {
  name: string;
  prepareMeetingBrief(meetingId: string, companyId: string): Promise<MeetingBrief>;
  joinMeetingSession(meetingId: string, joinUrl: string): Promise<{ sessionId: string; status: 'JOINED' | 'FAILED' }>;
  concludeMeetingSession(sessionId: string): Promise<MeetingSummary>;
}

// ── 7. Marketing Distribution Provider Abstraction ──────────────────────────

export interface MarketingCampaign {
  id: string;
  companyId: string;
  name: string;
  industryProfileId: string;
  targetAudience: string;
  channel: 'email' | 'voice' | 'linkedin' | 'sms';
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  contactsCount: number;
  conversionsCount: number;
  budgetUsd: number;
  createdAt: string;
}

export interface MarketingDistributionProvider {
  name: string;
  sendOutreachMessage(recipient: string, messageBody: string, campaignId: string): Promise<{ messageId: string; delivered: boolean }>;
  checkUnsubscribeStatus(recipient: string): Promise<boolean>;
}
