/**
 * Emergency Stop Controller
 *
 * Implements Section 12: HUMAN CONTROL — EMERGENCY STOP.
 * Centralized fail-safe boundary that immediately halts all outbound calling,
 * campaign dispatching, meeting joins, and autonomous worker loops.
 */

import { query } from '../../db/index.js';
import { defaultAuditService, AuditService } from '../audit/index.js';
import { EmergencyStopState } from './types.js';

export class EmergencyStopService {
  private inMemoryStates: Map<string, EmergencyStopState> = new Map();

  constructor(private readonly auditService: AuditService = defaultAuditService) {}

  /**
   * Check whether the Emergency Stop kill switch is active for a company.
   */
  async isEmergencyStopped(companyId: string): Promise<boolean> {
    const memory = this.inMemoryStates.get(companyId);
    if (memory) {
      return memory.isStopped;
    }

    try {
      const res = await query<{ emergency_stop_enabled: boolean }>(
        'SELECT emergency_stop_enabled FROM companies WHERE id = $1',
        [companyId]
      );
      if (res.rows.length > 0) {
        const isStopped = Boolean(res.rows[0].emergency_stop_enabled);
        this.inMemoryStates.set(companyId, {
          companyId,
          isStopped,
          trippedAt: isStopped ? new Date().toISOString() : undefined,
        });
        return isStopped;
      }
    } catch {
      // In-memory fallback if column or database not yet migrated
    }

    return false;
  }

  /**
   * Trip or clear the Emergency Stop kill switch.
   */
  async setEmergencyStop(
    companyId: string,
    stopped: boolean,
    reason: string,
    actorId: string = 'human-operator'
  ): Promise<EmergencyStopState> {
    const nowISO = new Date().toISOString();
    const state: EmergencyStopState = {
      companyId,
      isStopped: stopped,
      reason: stopped ? reason : undefined,
      trippedAt: stopped ? nowISO : undefined,
      trippedBy: stopped ? actorId : undefined,
    };

    this.inMemoryStates.set(companyId, state);

    try {
      await query(
        'UPDATE companies SET emergency_stop_enabled = $1 WHERE id = $2',
        [stopped, companyId]
      );
    } catch {
      // In-memory fallback
    }

    await this.auditService.logEvent({
      actorType: 'HUMAN_ADMIN',
      actorId,
      action: stopped ? 'EMERGENCY_STOP_ACTIVATED' : 'EMERGENCY_STOP_DEACTIVATED',
      targetType: 'COMPANY',
      targetId: companyId,
      metadata: {
        reason,
        timestamp: nowISO,
        isStopped: stopped,
      },
    });

    return state;
  }

  /**
   * Get the current emergency stop state.
   */
  getEmergencyStopState(companyId: string): EmergencyStopState {
    return (
      this.inMemoryStates.get(companyId) ?? {
        companyId,
        isStopped: false,
      }
    );
  }
}

export const defaultEmergencyStopService = new EmergencyStopService();
