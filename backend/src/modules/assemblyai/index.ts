import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import {
  defaultCompanyBrainService,
  CompanyBrainService,
} from '../company/index.js';
import {
  defaultPolicyEngineService,
  PolicyEngineService,
} from '../policies/index.js';
import {
  defaultLeadQualificationService,
  LeadQualificationService,
  defaultLeadsRepository,
  LeadsRepository,
} from '../leads/index.js';
import {
  defaultApprovalsService,
  ApprovalsService,
} from '../approvals/index.js';
import {
  defaultAuditService,
  AuditService,
} from '../audit/index.js';
import {
  defaultMeetingsService,
  MeetingsService,
} from '../meetings/index.js';
import {
  defaultEmployeeRuntimeService,
  EmployeeRuntimeService,
  BuildContextParams,
} from '../runtime/index.js';
import { AppError, ValidationError, ForbiddenError, NotFoundError } from '../../errors/index.js';

export interface VoiceAgentSessionToken {
  token: string;
  expiresInSeconds: number;
  maxSessionDurationSeconds: number;
  issuedAt: string;
}

export interface VoiceToolDefinition {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execution_mode?: 'interactive' | 'hold';
  timeout_seconds?: number;
}

export interface VoiceSessionConfiguration {
  system_prompt: string;
  greeting: string;
  tools: VoiceToolDefinition[];
  input: {
    format: { encoding: string };
    keyterms: string[];
    transcription_mode: 'balanced' | 'min_latency' | 'max_accuracy';
    turn_detection: {
      vad_threshold?: number;
      interrupt_response?: boolean;
      min_silence?: number;
      max_silence?: number;
      interruption_delay?: number;
    };
    voice_focus: 'near-field' | 'far-field';
    voice_focus_threshold: number;
  };
  output: {
    voice: string;
    format: { encoding: string };
    volume: number;
  };
}

export interface ToolExecutionContext {
  leadId?: string;
  companyId?: string;
  callId?: string;
  conversationId?: string;
  actorId?: string;
}

export interface ToolExecutionResult {
  callId: string;
  result: string; // JSON string payload expected by AssemblyAI tool.result
  isError: boolean;
  policyDecision: 'ALLOW' | 'REQUIRE_APPROVAL' | 'BLOCK';
  policyReason: string;
}

export interface VoiceSessionOptions {
  leadId?: string;
  companyId?: string;
  conversationId?: string;
  employeeId?: string;
  objective?: string;
  wsUrl?: string;
  apiKey?: string;
  token?: string;
  mockMode?: boolean;
}

/**
 * AssemblyAIVoiceSession: Manages connection lifecycle, audio streaming,
 * transcripts, interruption, and tool dispatches for a single voice agent session.
 */
export class AssemblyAIVoiceSession extends EventEmitter {
  public readonly id: string;
  public status: 'INITIALIZING' | 'CONNECTED' | 'STREAMING' | 'INTERRUPTED' | 'CLOSED' | 'ERROR' = 'INITIALIZING';
  public lastError?: Error;
  private ws: WebSocket | null = null;
  public isMock: boolean;
  public callId: string;

  constructor(
    public readonly options: VoiceSessionOptions & {
      service: AssemblyAIVoiceService;
    }
  ) {
    super();
    this.id = randomUUID();
    this.callId = options.conversationId || randomUUID();
    this.isMock = options.mockMode ?? (!options.apiKey && !options.token);
  }

  async connect(): Promise<void> {
    if (this.isMock) {
      this.status = 'CONNECTED';
      this.emit('connected', this.id);
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const url = this.options.wsUrl || 'wss://agents.assemblyai.com/v1/ws';
        const headers: Record<string, string> = {};
        if (this.options.token) {
          headers['Authorization'] = `Bearer ${this.options.token}`;
        } else if (this.options.apiKey) {
          headers['Authorization'] = `Bearer ${this.options.apiKey}`;
        }

        this.ws = new WebSocket(url, { headers });

        this.ws.on('open', async () => {
          this.status = 'CONNECTED';
          const config = await this.options.service.buildSessionConfiguration();
          this.ws?.send(JSON.stringify({ type: 'session.update', session: config }));
          this.emit('connected', this.id);
          resolve();
        });

        this.ws.on('message', async (data) => {
          try {
            const raw = JSON.parse(data.toString());
            if (raw.type === 'reply.audio' && raw.data) {
              this.emit('audio', Buffer.from(raw.data, 'base64'));
            } else if (raw.type === 'transcript.user') {
              this.emit('transcript', { speaker: 'user', text: raw.text, isFinal: true });
            } else if (raw.type === 'transcript.agent') {
              this.emit('transcript', { speaker: 'agent', text: raw.text, isFinal: true, interrupted: raw.interrupted });
            } else if (raw.type === 'tool.call') {
              this.emit('tool_request', { callId: raw.call_id, name: raw.name, args: raw.arguments || {} });
            } else if (raw.type === 'reply.done' && raw.status === 'interrupted') {
              this.status = 'INTERRUPTED';
              this.emit('interrupted');
            }
          } catch (e: any) {
            this.emit('error', e);
          }
        });

        this.ws.on('error', (err) => {
          this.status = 'ERROR';
          this.lastError = err;
          this.emit('error', err);
          reject(err);
        });

        this.ws.on('close', () => {
          if (this.status !== 'ERROR') {
            this.status = 'CLOSED';
          }
          this.emit('closed');
        });
      } catch (err: any) {
        this.status = 'ERROR';
        this.lastError = err;
        this.emit('error', err);
        reject(err);
      }
    });
  }

  sendAudio(chunk: Buffer | Uint8Array | string): void {
    if (this.status === 'CLOSED') throw new Error('Cannot send audio on closed session');
    this.status = 'STREAMING';
    if (this.isMock) {
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const b64 = Buffer.isBuffer(chunk)
        ? chunk.toString('base64')
        : typeof chunk === 'string'
        ? chunk
        : Buffer.from(chunk).toString('base64');
      this.ws.send(JSON.stringify({ type: 'input.audio', data: b64 }));
    }
  }

  sendToolResult(callId: string, result: string, isError = false): void {
    if (this.isMock) {
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'tool.result', call_id: callId, result, is_error: isError }));
    }
  }

  handleInterruption(): void {
    this.status = 'INTERRUPTED';
    this.emit('interrupted');
  }

  async close(): Promise<void> {
    this.status = 'CLOSED';
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'session.end' }));
      this.ws.close();
    }
    this.emit('closed');
  }

  async reconnect(): Promise<void> {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
    await this.connect();
  }
}

/**
 * AssemblyAIVoiceService: Governed voice layer connecting AssemblyAI Voice Agent API
 * with HQ Employee Runtime, Policy Engine, Structured Memory, and Calendar Scheduling.
 */
export class AssemblyAIVoiceService {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    apiKey?: string,
    private readonly companyBrainService: CompanyBrainService = defaultCompanyBrainService,
    private readonly policyEngineService: PolicyEngineService = defaultPolicyEngineService,
    private readonly leadsService: LeadQualificationService = defaultLeadQualificationService,
    private readonly approvalsService: ApprovalsService = defaultApprovalsService,
    private readonly auditService: AuditService = defaultAuditService,
    private readonly leadsRepository: LeadsRepository = defaultLeadsRepository,
    private readonly meetingsService: MeetingsService = defaultMeetingsService,
    private readonly runtimeService: EmployeeRuntimeService = defaultEmployeeRuntimeService
  ) {
    this.apiKey = apiKey || process.env.ASSEMBLYAI_API_KEY || '';
    this.baseUrl = 'https://agents.assemblyai.com/v1';
  }

  /**
   * Create an AssemblyAI voice agent session.
   */
  async createSession(options: VoiceSessionOptions = {}): Promise<AssemblyAIVoiceSession> {
    const session = new AssemblyAIVoiceSession({
      ...options,
      apiKey: options.apiKey || this.apiKey,
      service: this,
    });
    return session;
  }

  /**
   * Configure agent settings.
   */
  async configureAgent(overrides: Partial<VoiceSessionConfiguration> = {}): Promise<VoiceSessionConfiguration> {
    return this.buildSessionConfiguration(overrides);
  }

  /**
   * Mint a short-lived temporary token for client-side connection.
   * Secret key stays safely on the backend.
   */
  async mintSessionToken(
    expiresInSeconds = 300,
    maxSessionDurationSeconds = 3600
  ): Promise<VoiceAgentSessionToken> {
    if (!this.apiKey) {
      throw new AppError('ASSEMBLYAI_API_KEY is not configured on the backend', 500);
    }

    // In explicit test/dev mode (dummy key) return a mock token without hitting the network.
    // This prevents CI from needing a live AssemblyAI key.
    const isDummyKey =
      this.apiKey === 'dummy_dev_key_for_testing' ||
      this.apiKey.startsWith('test_') ||
      process.env.NODE_ENV === 'test';

    if (isDummyKey) {
      return {
        token: `mock_voice_token_${randomUUID().substring(0, 16)}`,
        expiresInSeconds,
        maxSessionDurationSeconds,
        issuedAt: new Date().toISOString(),
      };
    }

    const tokenUrl = new URL(`${this.baseUrl}/token`);
    tokenUrl.searchParams.set('expires_in_seconds', String(expiresInSeconds));
    tokenUrl.searchParams.set('max_session_duration_seconds', String(maxSessionDurationSeconds));

    // Do NOT catch generic network errors here — let them propagate so the
    // caller and monitoring systems know the mint failed. Swallowing errors
    // and returning a mock token in production is a silent data integrity failure.
    const res = await fetch(tokenUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new AppError(
        `Failed to mint AssemblyAI voice agent token: HTTP ${res.status} — ${errText}`,
        res.status >= 500 ? 502 : 400
      );
    }

    const data = (await res.json()) as { token: string };
    return {
      token: data.token,
      expiresInSeconds,
      maxSessionDurationSeconds,
      issuedAt: new Date().toISOString(),
    };
  }

  /**
   * Define the 13 explicit business tools.
   * Strictly no generic or arbitrary-action tools.
   */
  getToolDefinitions(): VoiceToolDefinition[] {
    return [
      {
        type: 'function',
        name: 'get_company_profile',
        description:
          'Retrieve approved background information about HQ-Employee, company history, headquarters, and core expertise.',
        parameters: {
          type: 'object',
          properties: {},
        },
        execution_mode: 'interactive',
      },
      {
        type: 'function',
        name: 'get_service_details',
        description:
          'Get approved description, technologies, deliverables, and capabilities for a specific software engineering service.',
        parameters: {
          type: 'object',
          properties: {
            service_name: {
              type: 'string',
              description: 'Name of the service (e.g., "Full-Stack Web Development", "Mobile App Development", "AI & ML Engineering")',
            },
          },
          required: ['service_name'],
        },
        execution_mode: 'interactive',
      },
      {
        type: 'function',
        name: 'get_pricing_guidance',
        description:
          'Retrieve official approved pricing guidance and ranges for HQ-Employee services. Never guess or invent pricing outside approved ranges.',
        parameters: {
          type: 'object',
          properties: {
            service_name: {
              type: 'string',
              description: 'Optional service name to narrow pricing guidance',
            },
          },
        },
        execution_mode: 'interactive',
      },
      {
        type: 'function',
        name: 'get_timeline_guidance',
        description:
          'Retrieve approved project timeline windows and estimated delivery schedules for services.',
        parameters: {
          type: 'object',
          properties: {
            service_name: {
              type: 'string',
              description: 'Optional service name to check standard delivery timelines',
            },
          },
        },
        execution_mode: 'interactive',
      },
      {
        type: 'function',
        name: 'create_lead',
        description:
          'Create a new prospective client record when a user introduces themselves and provides their name and contact information.',
        parameters: {
          type: 'object',
          properties: {
            full_name: {
              type: 'string',
              description: 'Full name of the contact person (e.g., "Dr. Elena Rostova")',
            },
            company_name: {
              type: 'string',
              description: 'Name of the client organization or business',
            },
            email: {
              type: 'string',
              description: 'Email address in standard format',
            },
            phone: {
              type: 'string',
              description: 'Phone number in E.164 or readable format',
            },
          },
          required: ['full_name'],
        },
        execution_mode: 'interactive',
      },
      {
        type: 'function',
        name: 'update_lead',
        description:
          'Update contact details or company name for an existing prospect.',
        parameters: {
          type: 'object',
          properties: {
            lead_id: {
              type: 'string',
              description: 'UUID of the existing lead',
            },
            company_name: {
              type: 'string',
              description: 'Updated business name',
            },
            email: {
              type: 'string',
              description: 'Updated email address',
            },
            phone: {
              type: 'string',
              description: 'Updated phone number',
            },
          },
          required: ['lead_id'],
        },
        execution_mode: 'interactive',
      },
      {
        type: 'function',
        name: 'record_requirement',
        description:
          'Record a discovered project requirement, target feature, or architecture need for the client opportunity.',
        parameters: {
          type: 'object',
          properties: {
            lead_id: {
              type: 'string',
              description: 'UUID of the lead',
            },
            requirement: {
              type: 'string',
              description: 'Specific capability or requirement discussed (e.g. "Real-time EHR integration with voice dictation")',
            },
          },
          required: ['lead_id', 'requirement'],
        },
        execution_mode: 'interactive',
      },
      {
        type: 'function',
        name: 'record_budget',
        description:
          'Record the prospective client stated budget amount or budget range.',
        parameters: {
          type: 'object',
          properties: {
            lead_id: {
              type: 'string',
              description: 'UUID of the lead',
            },
            budget_amount_or_range: {
              type: 'string',
              description: 'Stated budget (e.g. "$25,000", "$30,000 - $50,000")',
            },
          },
          required: ['lead_id', 'budget_amount_or_range'],
        },
        execution_mode: 'interactive',
      },
      {
        type: 'function',
        name: 'record_timeline',
        description:
          'Record the prospective client target delivery date or deadline constraint.',
        parameters: {
          type: 'object',
          properties: {
            lead_id: {
              type: 'string',
              description: 'UUID of the lead',
            },
            timeline_description: {
              type: 'string',
              description: 'Desired timeframe (e.g. "3 months", "Launch by Q1 2027")',
            },
          },
          required: ['lead_id', 'timeline_description'],
        },
        execution_mode: 'interactive',
      },
      {
        type: 'function',
        name: 'request_human_approval',
        description:
          'Escalate an out-of-bounds request that exceeds AI employee authority (e.g., custom discount, rush delivery under 2 weeks, bespoke legal agreements) to a human director.',
        parameters: {
          type: 'object',
          properties: {
            lead_id: {
              type: 'string',
              description: 'UUID of the lead',
            },
            action_type: {
              type: 'string',
              description: 'Type of escalation (e.g., "discount_request", "rush_timeline", "custom_agreement")',
            },
            details: {
              type: 'string',
              description: 'Complete explanation of what the client requested and why approval is needed',
            },
            proposed_value: {
              type: 'string',
              description: 'Proposed percentage or value (e.g., "15% discount", "10 days")',
            },
          },
          required: ['lead_id', 'action_type', 'details'],
        },
        execution_mode: 'interactive',
      },
      {
        type: 'function',
        name: 'check_calendar',
        description:
          'Check available meeting slots for a HQ-Employee discovery consultation within a specified date window.',
        parameters: {
          type: 'object',
          properties: {
            from_date: {
              type: 'string',
              description: 'Start ISO timestamp or date (YYYY-MM-DD) to search for availability',
            },
            to_date: {
              type: 'string',
              description: 'End ISO timestamp or date (YYYY-MM-DD) to search for availability',
            },
            timezone: {
              type: 'string',
              description: 'Timezone identifier (e.g., "America/New_York", "UTC")',
            },
          },
        },
        execution_mode: 'interactive',
      },
      {
        type: 'function',
        name: 'schedule_meeting',
        description:
          'Book an approved discovery consultation meeting on the calendar for a qualified lead.',
        parameters: {
          type: 'object',
          properties: {
            lead_id: {
              type: 'string',
              description: 'UUID of the lead',
            },
            slot_time: {
              type: 'string',
              description: 'Selected slot start time in ISO format',
            },
            topic: {
              type: 'string',
              description: 'Meeting topic or agenda discussion points',
            },
            timezone: {
              type: 'string',
              description: 'Timezone of the prospect',
            },
          },
          required: ['lead_id', 'slot_time'],
        },
        execution_mode: 'interactive',
      },
      {
        type: 'function',
        name: 'end_call',
        description:
          'Gracefully end the conversation after confirming next steps or concluding the inquiry.',
        parameters: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              description: 'Reason for call conclusion ("qualified_and_scheduled", "inquiry_answered", "escalated_to_human", "not_interested")',
            },
          },
          required: ['reason'],
        },
        execution_mode: 'interactive',
      },
    ];
  }

  /**
   * Build complete server-side session configuration for session.update.
   * Can use runtime context if contextParams are provided.
   */
  async buildSessionConfiguration(
    overrides?: Partial<VoiceSessionConfiguration>,
    contextParams?: BuildContextParams
  ): Promise<VoiceSessionConfiguration> {
    let systemPrompt: string;
    const tools = this.getToolDefinitions();

    if (contextParams) {
      const convContext = await this.runtimeService.buildConversationContext(contextParams);
      systemPrompt = convContext.systemPrompt;
    } else {
      const runtimeContext = await this.companyBrainService.getRuntimeContext();
      systemPrompt = `You are the HQ-Employee Business Development & Client Coordinator, an autonomous governed AI employee for HQ-Employee.

YOUR IDENTITY AND ROLE:
- You represent HQ-Employee, a premier digital engineering firm specializing in full-stack web development, mobile applications, and voice AI systems.
- You speak naturally, concisely, and professionally. Keep verbal turns to 1-3 sentences unless explaining a technical solution.
- You must always be honest that you are an AI assistant representing HQ-Employee. Never impersonate a biological human.

APPROVED COMPANY KNOWLEDGE:
- Company Overview: ${runtimeContext.companySummary}
- Available Services: ${runtimeContext.approvedServices.map((s) => s.title).join(', ')}
- You can query detailed service specifications, pricing guidance, and timeline guidance using your tools.

GOVERNANCE POLICIES & BOUNDARIES (STRICT):
1. PRICING & DISCOUNTS: Discuss only approved pricing guidance. You have NO authority to grant discounts autonomously. If a prospect asks for a discount, use request_human_approval.
2. CONTRACTS & LEGAL: You are strictly forbidden from agreeing to contracts, SLAs, warranties, or liability terms.
3. PAYMENTS: You cannot process credit cards, accept wire transfers, or execute financial transactions.
4. CONFIDENTIALITY: Never solicit passwords, credentials, OTP tokens, or internal secrets.
5. LEAD QUALIFICATION: Adaptively learn the prospect's project type, business objectives, timeline, budget, and decision-maker role. Record requirements using record_requirement, record_budget, and record_timeline.
6. CALENDAR & SCHEDULING: Check availability with check_calendar and book meetings with schedule_meeting once qualified.
7. CALL ENDING: Once the opportunity is understood or escalated, conclude politely with end_call.

TOOLS AT YOUR DISPOSAL:
Call your tools whenever you need to fetch information or update client records. Do not guess information.`;
    }

    const greeting =
      "Hello! Thanks for reaching out to HQ-Employee. I'm the HQ-Employee business development coordinator. How can I help with your project today?";

    const config: VoiceSessionConfiguration = {
      system_prompt: systemPrompt,
      greeting,
      tools,
      input: {
        format: { encoding: 'audio/pcm' },
        keyterms: [
          'HQ-Employee',
          'Employee',
          'Web Development',
          'Full-Stack Engineering',
          'Mobile App Development',
          'Voice AI Systems',
          'Cloud Architecture',
          'Discovery Consultation',
          'Discovery Call',
          'Pricing Guidance',
          'Director Approval',
          'Deterministic Policy',
        ],
        transcription_mode: 'balanced',
        turn_detection: {
          vad_threshold: 0.5,
          interrupt_response: true,
        },
        voice_focus: 'near-field',
        voice_focus_threshold: 0.85,
      },
      output: {
        voice: 'alba',
        format: { encoding: 'audio/pcm' },
        volume: 100,
      },
      ...overrides,
    };

    return config;
  }

  /**
   * Execute an incoming tool call through the backend Policy Engine.
   * Deterministic Governance: The LLM requests an action; the backend authorizes and executes it.
   */
  async executeTool(
    name: string,
    args: Record<string, unknown>,
    callId: string,
    context: ToolExecutionContext = {}
  ): Promise<ToolExecutionResult> {
    const actorId = context.actorId || 'hq-employee-voice-agent';
    const leadId = (args.lead_id as string) || context.leadId;

    // 1. Mandatory Policy Evaluation
    const policyResult = await this.policyEngineService.evaluateAction({
      action: name,
      args,
      leadId,
      callId: context.callId,
      employeeId: actorId,
    });

    // 2. Handle Policy Decision
    if (policyResult.decision === 'BLOCK') {
      const errorMsg = `Action '${name}' was blocked by company governance policy: ${policyResult.reason}`;
      return {
        callId,
        result: JSON.stringify({ error: errorMsg, is_blocked: true }),
        isError: true,
        policyDecision: 'BLOCK',
        policyReason: policyResult.reason,
      };
    }

    if (policyResult.decision === 'REQUIRE_APPROVAL') {
      // Create approval record in approvals repository
      const approvalReq = await this.approvalsService.createRequest({
        leadId: leadId || 'unassigned-lead',
        callId: context.callId,
        actionName: name,
        actionPayload: args,
        reason: policyResult.reason,
      });

      const msg = `This request requires authorization from a human director. I have registered approval request '${approvalReq.id}'. Our team will review this shortly.`;
      return {
        callId,
        result: JSON.stringify({
          approval_required: true,
          approval_id: approvalReq.id,
          message: msg,
        }),
        isError: false,
        policyDecision: 'REQUIRE_APPROVAL',
        policyReason: policyResult.reason,
      };
    }

    // 3. Policy Decision is ALLOW — Execute tool logic
    try {
      let outputData: unknown = {};

      switch (name) {
        case 'get_company_profile': {
          const brain = await this.companyBrainService.getCompanyBrain();
          outputData = brain.profile;
          break;
        }

        case 'get_service_details': {
          const serviceName = (args.service_name as string) || '';
          const services = await this.companyBrainService.listServices();
          const match = services.find(
            (s) =>
              s.title.toLowerCase().includes(serviceName.toLowerCase()) ||
              s.slug.toLowerCase().includes(serviceName.toLowerCase())
          );
          if (!match) {
            outputData = {
              found: false,
              available_services: services.map((s) => s.title),
              message: `Service '${serviceName}' not found. Please select from available services.`,
            };
          } else {
            outputData = match;
          }
          break;
        }

        case 'get_pricing_guidance': {
          const serviceName = args.service_name as string;
          const services = await this.companyBrainService.listServices();
          if (serviceName) {
            const match = services.find(
              (s) =>
                s.title.toLowerCase().includes(serviceName.toLowerCase()) ||
                s.slug.toLowerCase().includes(serviceName.toLowerCase())
            );
            outputData = match
              ? {
                  service: match.title,
                  pricing: match.pricing,
                  timelines: match.timelines,
                }
              : { guidance: 'Standard projects range from $15,000 to $40,000+ depending on scope.' };
          } else {
            outputData = {
              services: services.map((s) => ({
                service: s.title,
                pricing: s.pricing,
              })),
            };
          }
          break;
        }

        case 'get_timeline_guidance': {
          const services = await this.companyBrainService.listServices();
          outputData = {
            services: services.map((s) => ({
              service: s.title,
              timelines: s.timelines,
            })),
          };
          break;
        }

        case 'create_lead': {
          const lead = await this.leadsService.createLead({
            companyId: context.companyId || (args.company_id as string),
            fullName: (args.full_name as string) || 'Anonymous Prospect',
            companyName: args.company_name as string,
            contactEmail: args.email as string,
            contactPhone: args.phone as string,
          });
          outputData = {
            lead_id: lead.id,
            fullName: lead.fullName,
            status: lead.status,
            message: `Lead created successfully for ${lead.fullName}.`,
          };
          break;
        }

        case 'update_lead': {
          if (!leadId) throw new ValidationError('lead_id is required');
          const existing = await this.leadsService.getLead(leadId);
          if (!existing) throw new AppError(`Lead with ID '${leadId}' not found`, 404);
          if (context.companyId && existing.companyId !== context.companyId) {
            throw new ForbiddenError(`Cross-tenant lead access denied for lead '${leadId}'`);
          }
          if (args.company_name) existing.companyName = args.company_name as string;
          if (args.email) existing.contactEmail = args.email as string;
          if (args.phone) existing.contactPhone = args.phone as string;
          const updated = await this.leadsRepository.updateLead(existing);
          outputData = {
            lead_id: updated.id,
            status: updated.status,
            message: 'Lead updated successfully',
          };
          break;
        }

        case 'record_requirement': {
          if (!leadId) throw new ValidationError('lead_id is required');
          if (context.companyId) {
            const existing = await this.leadsService.getLead(leadId);
            if (!existing) throw new NotFoundError('Lead', leadId);
            if (existing.companyId !== context.companyId) {
              throw new ForbiddenError(`Cross-tenant lead modification denied for lead '${leadId}'`);
            }
          }
          const reqText = (args.requirement as string) || '';
          await this.leadsService.recordFact({
            leadId,
            key: 'required_features',
            value: reqText,
            confidence: 0.95,
            source: 'VOICE_AGENT_TOOL',
            conversationId: context.conversationId,
          });
          outputData = { success: true, requirement_recorded: reqText };
          break;
        }

        case 'record_budget': {
          if (!leadId) throw new ValidationError('lead_id is required');
          if (context.companyId) {
            const existing = await this.leadsService.getLead(leadId);
            if (!existing) throw new NotFoundError('Lead', leadId);
            if (existing.companyId !== context.companyId) {
              throw new ForbiddenError(`Cross-tenant lead modification denied for lead '${leadId}'`);
            }
          }
          const budgetVal = (args.budget_amount_or_range as string) || '';
          await this.leadsService.recordFact({
            leadId,
            key: 'budget',
            value: budgetVal,
            confidence: 0.95,
            source: 'VOICE_AGENT_TOOL',
            conversationId: context.conversationId,
          });
          outputData = { success: true, budget_recorded: budgetVal };
          break;
        }

        case 'record_timeline': {
          if (!leadId) throw new ValidationError('lead_id is required');
          if (context.companyId) {
            const existing = await this.leadsService.getLead(leadId);
            if (!existing) throw new NotFoundError('Lead', leadId);
            if (existing.companyId !== context.companyId) {
              throw new ForbiddenError(`Cross-tenant lead modification denied for lead '${leadId}'`);
            }
          }
          const timelineVal = (args.timeline_description as string) || '';
          await this.leadsService.recordFact({
            leadId,
            key: 'timeline',
            value: timelineVal,
            confidence: 0.95,
            source: 'VOICE_AGENT_TOOL',
            conversationId: context.conversationId,
          });
          outputData = { success: true, timeline_recorded: timelineVal };
          break;
        }

        case 'request_human_approval': {
          const req = await this.approvalsService.createRequest({
            leadId: leadId || 'unassigned-lead',
            callId: context.callId,
            actionName: (args.action_type as string) || 'general_approval',
            actionPayload: args,
            reason: (args.details as string) || 'Requested during voice call',
          });
          outputData = {
            approval_required: true,
            approval_id: req.id,
            status: req.status,
            message: `Approval request ${req.id} logged. A human director will follow up with the prospect.`,
          };
          break;
        }

        case 'check_calendar': {
          const fromDate =
            (args.from_date as string) ||
            (args.start_date as string) ||
            new Date().toISOString();
          const toDate =
            (args.to_date as string) ||
            (args.end_date as string) ||
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          const tz = (args.timezone as string) || 'America/New_York';
          const availability = await this.meetingsService.checkAvailability({
            fromDate,
            toDate,
            timezone: tz,
          });
          outputData = availability;
          break;
        }

        case 'schedule_meeting': {
          if (!leadId) throw new ValidationError('lead_id is required');
          if (context.companyId) {
            const existing = await this.leadsService.getLead(leadId);
            if (!existing) throw new NotFoundError('Lead', leadId);
            if (existing.companyId !== context.companyId) {
              throw new ForbiddenError(`Cross-tenant meeting scheduling denied for lead '${leadId}'`);
            }
          }
          const slotTime = (args.slot_time as string) || (args.slot_iso as string);
          if (!slotTime) throw new ValidationError('slot_time is required');
          const meeting = await this.meetingsService.createMeeting({
            leadId,
            slotTime,
            topic: (args.topic as string) || 'HQ Discovery Consultation',
            timezone: (args.timezone as string) || 'America/New_York',
            actorId,
          });
          outputData = meeting;
          break;
        }

        case 'end_call': {
          outputData = {
            call_ended: true,
            reason: args.reason || 'completed',
            message: 'Thank you for contacting HQ-Employee. Have a wonderful day!',
          };
          break;
        }

        default: {
          throw new ValidationError(`Unknown tool: '${name}'`);
        }
      }

      return {
        callId,
        result: JSON.stringify(outputData),
        isError: false,
        policyDecision: 'ALLOW',
        policyReason: policyResult.reason,
      };
    } catch (err: any) {
      return {
        callId,
        result: JSON.stringify({
          error: `Tool execution failed: ${err.message || 'Internal tool error'}`,
        }),
        isError: true,
        policyDecision: 'ALLOW',
        policyReason: 'Tool execution threw an internal exception',
      };
    }
  }
}

// Aliases for seamless backward compatibility
export const AssemblyAIService = AssemblyAIVoiceService;
export type AssemblyAIService = AssemblyAIVoiceService;

export const defaultAssemblyAIVoiceService = new AssemblyAIVoiceService();
export const defaultAssemblyAIService = defaultAssemblyAIVoiceService;

export const assemblyaiModule = {
  name: 'assemblyai',
  status: 'active',
  description: 'AssemblyAI Voice Agent API integration and tool execution governance boundary',
  service: defaultAssemblyAIVoiceService,
};
