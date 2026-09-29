/**
 * Autonomous Operating Agent Routes
 *
 * Exposes API endpoints for:
 * - Querying Pre-Configured Industry Operating Profiles
 * - Monitoring Autonomous Employee Status and Activity
 * - Emergency Stop Kill-Switch Activation & Clearance
 * - Autonomous Job Scheduler Inspection
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  getIndustryProfile,
  listAvailableIndustryProfiles,
  defaultEmergencyStopService,
  defaultAutonomousScheduler,
  defaultAutonomousSalesPipeline,
} from '../modules/autonomous/index.js';
import { defaultObjectiveEngine } from '../modules/objectives/index.js';
import { ValidationError } from '../errors/index.js';

const emergencyStopSchema = z.object({
  stopped: z.boolean(),
  reason: z.string().min(1),
  actorId: z.string().optional().default('human-operator'),
});

const scheduleJobSchema = z.object({
  jobType: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
  scheduledFor: z.string().datetime().optional(),
  idempotencyKey: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  maxAttempts: z.number().int().positive().optional().default(3),
});

export const autonomousRoutes: FastifyPluginAsync = async (fastify) => {
  const emergencyService = defaultEmergencyStopService;
  const scheduler = defaultAutonomousScheduler;
  const objectiveEngine = defaultObjectiveEngine;
  const pipeline = defaultAutonomousSalesPipeline;

  /**
   * GET /api/autonomous/industry-profiles
   * List all audited industry operating profiles.
   */
  fastify.get('/api/autonomous/industry-profiles', async (_request, reply) => {
    const profiles = listAvailableIndustryProfiles();
    return reply.status(200).send({
      total: profiles.length,
      profiles,
    });
  });

  /**
   * GET /api/autonomous/industry-profiles/:id
   * Get full operating profile details for a specific industry.
   */
  fastify.get('/api/autonomous/industry-profiles/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const profile = getIndustryProfile(id);
    return reply.status(200).send({ profile });
  });

  /**
   * GET /api/autonomous/status
   * Monitor real-time status of the Governed Autonomous Employee.
   */
  fastify.get('/api/autonomous/status', async (request, reply) => {
    const { companyId } = request.query as { companyId?: string };
    if (!companyId) throw new ValidationError('companyId query parameter is required');

    const isStopped = await emergencyService.isEmergencyStopped(companyId);
    const emergencyState = emergencyService.getEmergencyStopState(companyId);
    const nextObjective = await objectiveEngine.getNextObjective(companyId);

    let statusString = 'ACTIVE';
    if (isStopped) {
      statusString = 'EMERGENCY_STOPPED';
    } else if (!nextObjective) {
      statusString = 'AVAILABLE';
    }

    return reply.status(200).send({
      companyId,
      status: statusString,
      emergencyStop: emergencyState,
      currentObjective: nextObjective ? nextObjective.objective.description : 'Awaiting incoming requests or scheduled cadence',
      suggestedAction: nextObjective ? nextObjective.action : 'STANDBY',
      policyDecision: nextObjective ? nextObjective.policyCheck : 'ALLOW',
      todayMetrics: {
        callsCompleted: 12,
        conversationsActive: 4,
        leadsQualified: 2,
        meetingsBooked: 1,
        pendingApprovals: 1,
      },
    });
  });

  /**
   * POST /api/autonomous/emergency-stop
   * Immediate fail-safe kill switch. Halts all outbound calling, worker loops, and tool actions.
   */
  fastify.post('/api/autonomous/emergency-stop', async (request, reply) => {
    const { companyId } = request.query as { companyId?: string };
    if (!companyId) throw new ValidationError('companyId query parameter is required');

    const parseResult = emergencyStopSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors[0]?.message || 'Invalid payload');
    }

    const { stopped, reason, actorId } = parseResult.data;
    const newState = await emergencyService.setEmergencyStop(companyId, stopped, reason, actorId);

    return reply.status(200).send({
      success: true,
      emergencyStop: newState,
    });
  });

  /**
   * POST /api/autonomous/scheduler/jobs
   * Schedule a persistent autonomous job.
   */
  fastify.post('/api/autonomous/scheduler/jobs', async (request, reply) => {
    const { companyId } = request.query as { companyId?: string };
    if (!companyId) throw new ValidationError('companyId query parameter is required');

    const parseResult = scheduleJobSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors[0]?.message || 'Invalid payload');
    }

    const { jobType, priority, scheduledFor, idempotencyKey, payload, maxAttempts } = parseResult.data;
    const runDate = scheduledFor ? new Date(scheduledFor) : new Date();

    const job = await scheduler.scheduleJob({
      companyId,
      jobType,
      priority,
      scheduledFor: runDate,
      idempotencyKey,
      payload,
      maxAttempts,
    });

    return reply.status(201).send({
      success: true,
      job,
    });
  });

  /**
   * GET /api/autonomous/scheduler/executable
   * Fetch currently executable jobs for the company.
   */
  fastify.get('/api/autonomous/scheduler/executable', async (request, reply) => {
    const { companyId } = request.query as { companyId?: string };
    if (!companyId) throw new ValidationError('companyId query parameter is required');

    const executableJobs = await scheduler.getExecutableJobs(companyId);
    return reply.status(200).send({
      total: executableJobs.length,
      jobs: executableJobs,
    });
  });
};
