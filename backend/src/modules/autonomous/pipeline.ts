/**
 * Autonomous Sales Pipeline State Machine
 *
 * Implements Section 7: AUTONOMOUS SALES PIPELINE.
 * Manages deterministic transitions across the 14 sales stages and
 * automatically triggers the next authorized business objective.
 */

import { defaultAuditService, AuditService } from '../audit/index.js';
import { AutonomousPipelineStage, PipelineTransitionEvent } from './types.js';

export interface NextActionRecommendation {
  suggestedAction: string;
  nextStage?: AutonomousPipelineStage;
  requiresPolicyCheck: boolean;
  requiresHumanApproval: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rationale: string;
}

export class AutonomousSalesPipeline {
  constructor(private readonly auditService: AuditService = defaultAuditService) {}

  /**
   * Determine the next autonomous action for a lead in the pipeline.
   */
  evaluateNextAction(stage: AutonomousPipelineStage, context: {
    daysInStage: number;
    qualificationScore?: number;
    hasMeetingBooked?: boolean;
    hasProposalSent?: boolean;
    discountRequestedPercent?: number;
  }): NextActionRecommendation {
    switch (stage) {
      case 'NEW':
        return {
          suggestedAction: 'INITIATE_FIRST_CONTACT',
          nextStage: 'CONTACTING',
          requiresPolicyCheck: true,
          requiresHumanApproval: false,
          priority: 'HIGH',
          rationale: 'New lead requires outbound contact within legal business hours.',
        };

      case 'CONTACTING':
        if (context.daysInStage >= 2) {
          return {
            suggestedAction: 'SCHEDULE_FOLLOW_UP_CALL',
            nextStage: 'CONTACTING',
            requiresPolicyCheck: true,
            requiresHumanApproval: false,
            priority: 'MEDIUM',
            rationale: 'Initial contact unreached after 2 days; schedule second attempt.',
          };
        }
        return {
          suggestedAction: 'WAIT_FOR_CONTACT_WINDOW',
          requiresPolicyCheck: false,
          requiresHumanApproval: false,
          priority: 'LOW',
          rationale: 'Recently contacted; awaiting response window.',
        };

      case 'CONNECTED':
        return {
          suggestedAction: 'CONDUCT_STRUCTURED_DISCOVERY',
          nextStage: 'DISCOVERY',
          requiresPolicyCheck: true,
          requiresHumanApproval: false,
          priority: 'CRITICAL',
          rationale: 'Active live conversation in progress; gather 5 qualification criteria.',
        };

      case 'DISCOVERY':
        if ((context.qualificationScore ?? 0) >= 40) {
          return {
            suggestedAction: 'OFFER_CONSULTATION_SLOT',
            nextStage: 'QUALIFIED',
            requiresPolicyCheck: true,
            requiresHumanApproval: false,
            priority: 'HIGH',
            rationale: 'Lead satisfies qualification criteria; offer available calendar slots.',
          };
        }
        return {
          suggestedAction: 'ASK_ADAPTIVE_DISCOVERY_QUESTION',
          requiresPolicyCheck: true,
          requiresHumanApproval: false,
          priority: 'HIGH',
          rationale: 'Missing criteria (budget, timeline, or scope); ask adaptive question.',
        };

      case 'QUALIFIED':
        return {
          suggestedAction: 'SCHEDULE_CALENDAR_MEETING',
          nextStage: 'MEETING_SCHEDULED',
          requiresPolicyCheck: true,
          requiresHumanApproval: false,
          priority: 'HIGH',
          rationale: 'Lead confirmed interest; book conflict-free slot in Google Calendar.',
        };

      case 'MEETING_REQUESTED':
        return {
          suggestedAction: 'CONFIRM_CALENDAR_RESERVATION',
          nextStage: 'MEETING_SCHEDULED',
          requiresPolicyCheck: true,
          requiresHumanApproval: false,
          priority: 'HIGH',
          rationale: 'Reservation pending slot validation.',
        };

      case 'MEETING_SCHEDULED':
        if (context.hasMeetingBooked) {
          return {
            suggestedAction: 'PREPARE_MEETING_BRIEF',
            requiresPolicyCheck: false,
            requiresHumanApproval: false,
            priority: 'MEDIUM',
            rationale: 'Meeting confirmed; assemble structured prospect facts for briefing.',
          };
        }
        return {
          suggestedAction: 'SEND_MEETING_CONFIRMATION',
          requiresPolicyCheck: false,
          requiresHumanApproval: false,
          priority: 'MEDIUM',
          rationale: 'Send calendar invite to attendee.',
        };

      case 'MEETING_COMPLETED':
        return {
          suggestedAction: 'GENERATE_STRUCTURED_PROPOSAL',
          nextStage: 'PROPOSAL_PREPARATION',
          requiresPolicyCheck: true,
          requiresHumanApproval: false,
          priority: 'HIGH',
          rationale: 'Meeting concluded; compute scope and generate proposal draft.',
        };

      case 'PROPOSAL_PREPARATION':
        if ((context.discountRequestedPercent ?? 0) > 5) {
          return {
            suggestedAction: 'REQUEST_HUMAN_APPROVAL_DISCOUNT',
            nextStage: 'APPROVAL',
            requiresPolicyCheck: true,
            requiresHumanApproval: true,
            priority: 'HIGH',
            rationale: `Discount of ${context.discountRequestedPercent}% exceeds 5% autonomous limit; escalate to director.`,
          };
        }
        return {
          suggestedAction: 'DELIVER_PROPOSAL_TO_CLIENT',
          nextStage: 'PROPOSAL_SENT',
          requiresPolicyCheck: true,
          requiresHumanApproval: false,
          priority: 'HIGH',
          rationale: 'Standard proposal ready; deliver to client.',
        };

      case 'PROPOSAL_SENT':
        if (context.daysInStage >= 3) {
          return {
            suggestedAction: 'SEND_PROPOSAL_REMINDER',
            nextStage: 'FOLLOW_UP',
            requiresPolicyCheck: true,
            requiresHumanApproval: false,
            priority: 'MEDIUM',
            rationale: 'Proposal sent 3+ days ago without reply; send gentle follow-up.',
          };
        }
        return {
          suggestedAction: 'MONITOR_PROPOSAL_ACTIVITY',
          requiresPolicyCheck: false,
          requiresHumanApproval: false,
          priority: 'LOW',
          rationale: 'Awaiting client review.',
        };

      case 'FOLLOW_UP':
        if (context.daysInStage >= 7) {
          return {
            suggestedAction: 'ATTEMPT_RE_ENGAGEMENT_CALL',
            nextStage: 'FOLLOW_UP',
            requiresPolicyCheck: true,
            requiresHumanApproval: false,
            priority: 'LOW',
            rationale: 'Stale lead past 7 days; attempt telephone re-engagement.',
          };
        }
        return {
          suggestedAction: 'WAIT_FOR_FOLLOW_UP_INTERVAL',
          requiresPolicyCheck: false,
          requiresHumanApproval: false,
          priority: 'LOW',
          rationale: 'Within standard cadence.',
        };

      case 'NEGOTIATION':
        return {
          suggestedAction: 'EVALUATE_COMMERCIAL_TERMS',
          nextStage: 'APPROVAL',
          requiresPolicyCheck: true,
          requiresHumanApproval: true,
          priority: 'HIGH',
          rationale: 'Custom pricing or legal conditions require human clearance.',
        };

      case 'APPROVAL':
        return {
          suggestedAction: 'AWAIT_HUMAN_DIRECTOR_DECISION',
          requiresPolicyCheck: false,
          requiresHumanApproval: true,
          priority: 'HIGH',
          rationale: 'Pending executive signature or director approval ticket resolution.',
        };

      case 'CLOSED_WON':
        return {
          suggestedAction: 'TRIGGER_CLIENT_ONBOARDING',
          requiresPolicyCheck: true,
          requiresHumanApproval: false,
          priority: 'MEDIUM',
          rationale: 'Deal won; initialize client workspace and kickoff milestone.',
        };

      case 'CLOSED_LOST':
        return {
          suggestedAction: 'SCHEDULE_FUTURE_RE_ENGAGEMENT_90D',
          requiresPolicyCheck: false,
          requiresHumanApproval: false,
          priority: 'LOW',
          rationale: 'Opportunity lost; archive facts and schedule 90-day pulse check.',
        };
    }
  }

  /**
   * Log pipeline transition event with audit provenance.
   */
  async recordTransition(event: PipelineTransitionEvent): Promise<void> {
    await this.auditService.logEvent({
      actorType: 'SYSTEM',
      actorId: 'autonomous-pipeline',
      action: 'PIPELINE_STAGE_TRANSITION',
      targetType: 'LEAD',
      targetId: event.leadId,
      metadata: {
        fromStage: event.fromStage,
        toStage: event.toStage,
        triggeredBy: event.triggeredBy,
        reason: event.reason,
        timestamp: event.timestamp,
      },
    });
  }
}

export const defaultAutonomousSalesPipeline = new AutonomousSalesPipeline();
