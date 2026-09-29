import { defaultCompanyBrainService, CompanyBrainService } from '../company/index.js';
import { defaultAuditService, AuditService } from '../audit/index.js';

export type PolicyDecision = 'ALLOW' | 'REQUIRE_APPROVAL' | 'BLOCK';

export interface PolicyEvaluationResult {
  decision: PolicyDecision;
  reason: string;
  policyVersion: string;
  policyId: string;
  action: string;
  evaluatedAt: string;
  requiresHumanApproval: boolean;
}

export interface EvaluateActionParams {
  action: string;
  args?: Record<string, unknown>;
  leadId?: string;
  callId?: string;
  employeeId?: string;
}

export class PolicyEngineService {
  constructor(
    private readonly companyBrainService: CompanyBrainService = defaultCompanyBrainService,
    private readonly auditService: AuditService = defaultAuditService
  ) {}

  async evaluateAction(params: EvaluateActionParams): Promise<PolicyEvaluationResult> {
    const action = params.action.trim();
    const args = params.args || {};

    // 1. Fetch current active policy from Company Brain
    const activePolicy = await this.companyBrainService.getActivePolicy();
    const policyVersion = activePolicy?.version || '1.0.0';
    const policyId = activePolicy?.id || 'default-policy-v1';

    let decision: PolicyDecision = 'BLOCK';
    let reason = 'Action prohibited by default security policy.';

    // 2. Deterministic Rule Matching
    const lowerAction = action.toLowerCase();

    // A. Contracts and Legal Commitments -> STRICTLY BLOCK
    if (
      lowerAction === 'sign_contract' ||
      lowerAction === 'accept_contract' ||
      lowerAction === 'negotiate_terms' ||
      lowerAction === 'commit_legal_agreement' ||
      lowerAction.includes('contract')
    ) {
      decision = 'BLOCK';
      reason = 'AI employee is strictly prohibited from signing or accepting contracts. All agreements require human director authorization.';
    }
    // B. Legal commitments and liability guarantees -> STRICTLY BLOCK
    else if (
      lowerAction === 'make_legal_commitment' ||
      lowerAction === 'guarantee_liability' ||
      lowerAction === 'waive_liability' ||
      lowerAction.includes('legal_commitment')
    ) {
      decision = 'BLOCK';
      reason = 'Legal commitments and warranties are strictly prohibited under AI employee governance.';
    }
    // C. Payments & Financial Transactions -> STRICTLY BLOCK
    else if (
      lowerAction === 'request_payment' ||
      lowerAction === 'transfer_funds' ||
      lowerAction === 'process_credit_card' ||
      lowerAction === 'accept_payment' ||
      lowerAction.includes('payment') ||
      lowerAction.includes('transfer_funds')
    ) {
      decision = 'BLOCK';
      reason = 'Financial transfers, payments, and credit card processing are strictly prohibited for voice AI.';
    }
    // D. Credentials, Passwords, PINs, OTPs -> STRICTLY BLOCK
    else if (
      lowerAction === 'request_password' ||
      lowerAction === 'request_pin' ||
      lowerAction === 'request_otp' ||
      lowerAction === 'request_security_token' ||
      lowerAction.includes('password') ||
      lowerAction.includes('otp') ||
      lowerAction.includes('pin')
    ) {
      decision = 'BLOCK';
      reason = 'Soliciting passwords, PINs, OTPs, or authentication secrets is strictly blocked by security policy.';
    }
    // E. Confidential Information & Internal Secrets -> STRICTLY BLOCK
    else if (
      lowerAction === 'reveal_confidential_info' ||
      lowerAction === 'expose_api_keys' ||
      lowerAction === 'reveal_internal_secrets'
    ) {
      decision = 'BLOCK';
      reason = 'Disclosure of confidential company secrets or API credentials is strictly blocked.';
    }
    // F. Human Impersonation -> STRICTLY BLOCK
    else if (
      lowerAction === 'claim_human_identity' ||
      lowerAction === 'deny_ai_identity'
    ) {
      decision = 'BLOCK';
      reason = 'The AI employee must always identify itself truthfully and never impersonate a human.';
    }
    // G. Discounts -> REQUIRE_APPROVAL (or BLOCK if extreme)
    else if (
      lowerAction === 'apply_custom_discount' ||
      lowerAction === 'request_discount' ||
      args.discount_pct !== undefined ||
      args.discount !== undefined
    ) {
      const discountPct = Number(args.discount_pct || args.discount || 0);
      if (discountPct > 20) {
        decision = 'BLOCK';
        reason = `Requested discount of ${discountPct}% exceeds the maximum 20% threshold. Refused by policy.`;
      } else {
        decision = 'REQUIRE_APPROVAL';
        reason = `Discount request (${discountPct > 0 ? discountPct + '%' : 'custom'}) exceeds autonomous employee authority and requires Commercial Director approval.`;
      }
    }
    // H. Rush Timeline Guidance -> REQUIRE_APPROVAL
    else if (
      lowerAction === 'commit_rush_delivery' ||
      (args.requested_weeks !== undefined && Number(args.requested_weeks) < 2) ||
      args.is_rush === true
    ) {
      decision = 'REQUIRE_APPROVAL';
      reason = 'Rush delivery timelines under 2 weeks require operations and technical lead clearance.';
    }
    // I. Approved Service Information -> ALLOW
    else if (
      lowerAction === 'get_company_profile' ||
      lowerAction === 'get_service_details' ||
      lowerAction === 'list_services'
    ) {
      decision = 'ALLOW';
      reason = 'Approved company knowledge and service details may be freely discussed.';
    }
    // J. Approved Pricing Guidance -> ALLOW
    else if (lowerAction === 'get_pricing_guidance') {
      decision = 'ALLOW';
      reason = 'Standard approved pricing ranges may be provided to prospects.';
    }
    // K. Approved Timeline Guidance -> ALLOW
    else if (lowerAction === 'get_timeline_guidance') {
      decision = 'ALLOW';
      reason = 'Standard approved project timeline windows may be provided to prospects.';
    }
    // L. Meeting Scheduling, Rescheduling & Cancellation -> ALLOW
    else if (
      lowerAction === 'check_calendar' ||
      lowerAction === 'schedule_meeting' ||
      lowerAction === 'reschedule_meeting' ||
      lowerAction === 'cancel_meeting'
    ) {
      // Check if scheduling in the past
      if (args.slot_time && typeof args.slot_time === 'string') {
        const slotDate = new Date(args.slot_time);
        if (!isNaN(slotDate.getTime()) && slotDate.getTime() < Date.now() - 60000) {
          decision = 'BLOCK';
          reason = 'Cannot schedule a meeting in the past.';
        } else {
          decision = 'ALLOW';
          reason = 'Meeting scheduling within approved business availability is permitted.';
        }
      } else {
        decision = 'ALLOW';
        reason = 'Calendar checking, meeting scheduling, and cancellation is permitted.';
      }
    }
    // M. Lead Qualification, Creation & Updates -> ALLOW
    else if (
      lowerAction === 'create_lead' ||
      lowerAction === 'update_lead' ||
      lowerAction === 'record_requirement' ||
      lowerAction === 'record_budget' ||
      lowerAction === 'record_timeline'
    ) {
      decision = 'ALLOW';
      reason = 'Recording discovered project requirements and contact details is permitted.';
    }
    // N. Call End -> ALLOW
    else if (lowerAction === 'end_call') {
      decision = 'ALLOW';
      reason = 'Graceful termination of call session is permitted.';
    }
    // O. Explicit Human Approval Request -> ALLOW (creates approval record)
    else if (lowerAction === 'request_human_approval') {
      decision = 'ALLOW';
      reason = 'Escalation to human operator is explicitly supported.';
    }
    // P. Outbound Telephony Call Initiation -> ALLOW
    else if (lowerAction === 'initiate_outbound_call') {
      decision = 'ALLOW';
      reason = 'Governed outbound calling for consented leads is permitted.';
    }
    // Q. Missing / Unknown Authority -> BLOCK by default
    else {
      decision = 'BLOCK';
      reason = `Action '${action}' has no authorized grant in policy version ${policyVersion}. Denied by default.`;
    }

    const evaluatedAt = new Date().toISOString();

    // 3. Log Immutable Audit Event
    await this.auditService.logPolicyEvaluation({
      actorId: params.employeeId || 'hq-employee-coordinator',
      action,
      decision,
      reason,
      policyVersion,
      policyId,
      leadId: params.leadId,
      callId: params.callId,
      args,
    });

    return {
      decision,
      reason,
      policyVersion,
      policyId,
      action,
      evaluatedAt,
      requiresHumanApproval: decision === 'REQUIRE_APPROVAL',
    };
  }
}

export const defaultPolicyEngineService = new PolicyEngineService();

export const policiesModule = {
  name: 'policies',
  status: 'active',
  description: 'Deterministic employee policy and authority boundary',
  service: defaultPolicyEngineService,
};
