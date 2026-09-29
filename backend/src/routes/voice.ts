import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { FastifyPluginAsync } from 'fastify';
import WebSocket from 'ws';
import { z } from 'zod';
import {
  defaultAssemblyAIService,
  AssemblyAIService,
} from '../modules/assemblyai/index.js';
import {
  defaultCallsService,
  CallsService,
} from '../modules/calls/index.js';
import { ValidationError } from '../errors/index.js';
import { config, AppConfig } from '../config/index.js';

export const DEFAULT_DEMO_COMPANY_ID = 'c0000000-0000-0000-0000-000000000001';

export const READ_ONLY_VOICE_TOOLS = new Set([
  'get_company_profile',
  'get_service_details',
  'get_pricing_guidance',
  'get_timeline_guidance',
  'check_calendar',
]);

export interface VoiceTicketData {
  ticketId: string;
  companyId: string;
  issuedAt: number;
  exp: number;
  ip: string;
}

const usedVoiceTicketIds = new Map<string, number>(); // ticketId -> exp
const ipTicketRateLimits = new Map<string, number[]>(); // ip -> request timestamps

// Periodic cleanup of expired ticket IDs
setInterval(() => {
  const now = Date.now();
  for (const [id, exp] of usedVoiceTicketIds.entries()) {
    if (exp <= now) {
      usedVoiceTicketIds.delete(id);
    }
  }
  for (const [ip, timestamps] of ipTicketRateLimits.entries()) {
    const valid = timestamps.filter((t) => now - t < 60_000);
    if (valid.length === 0) {
      ipTicketRateLimits.delete(ip);
    } else {
      ipTicketRateLimits.set(ip, valid);
    }
  }
}, 60_000).unref();

export function resetVoiceTrackingForTesting(): void {
  usedVoiceTicketIds.clear();
  ipTicketRateLimits.clear();
  activeVoiceSessionCount = 0;
  activeIpSessions.clear();
  dailyVoiceSessionMinutesUsed = 0;
}

function getTicketSecret(appConfig?: AppConfig): string {
  const cfg = appConfig || config;
  return cfg.JWT_SECRET || process.env.JWT_SECRET || 'dev_secret_jwt_key_at_least_32_characters_for_hmac';
}

export function generateVoiceTicket(
  ip: string,
  companyId: string = DEFAULT_DEMO_COMPANY_ID,
  appConfig?: AppConfig
): string {
  const secret = getTicketSecret(appConfig);
  const payload: VoiceTicketData = {
    ticketId: randomUUID(),
    companyId,
    issuedAt: Date.now(),
    exp: Date.now() + 60_000, // 60 seconds TTL
    ip,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifyVoiceTicket(
  ticketStr: string,
  consume: boolean = false,
  appConfig?: AppConfig
): { valid: true; payload: VoiceTicketData } | { valid: false; error: string } {
  if (!ticketStr || typeof ticketStr !== 'string') {
    return { valid: false, error: 'Voice ticket is missing' };
  }
  const parts = ticketStr.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed voice ticket format' };
  }
  const [encodedPayload, signature] = parts;
  const secret = getTicketSecret(appConfig);
  const expectedSig = createHmac('sha256', secret).update(encodedPayload).digest('base64url');

  if (signature.length !== expectedSig.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return { valid: false, error: 'Invalid voice ticket signature' };
  }

  let payload: VoiceTicketData;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8'));
  } catch {
    return { valid: false, error: 'Invalid voice ticket payload' };
  }

  const now = Date.now();
  if (!payload.exp || payload.exp < now) {
    return { valid: false, error: 'Voice ticket has expired' };
  }

  if (usedVoiceTicketIds.has(payload.ticketId)) {
    return { valid: false, error: 'Voice ticket has already been used' };
  }

  if (consume) {
    usedVoiceTicketIds.set(payload.ticketId, payload.exp);
  }

  return { valid: true, payload };
}

function checkTicketRateLimit(ip: string, maxRequests: number = 10): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const history = ipTicketRateLimits.get(ip) || [];
  const recent = history.filter((t) => now - t < windowMs);
  if (recent.length >= maxRequests) {
    return false;
  }
  recent.push(now);
  ipTicketRateLimits.set(ip, recent);
  return true;
}

// ── AssemblyAI Event Ordering & Tool Result Coordinator (Docs-Conformant P0) ──
export type AssemblyVoiceEvent = 'reply.started' | 'input.speech.started' | 'reply.done';

export interface PendingToolResult {
  call_id: string;
  result: string;
  is_error: boolean;
}

export class VoiceToolResultCoordinator {
  public lastEvent: AssemblyVoiceEvent | null = null;
  public pendingTools: PendingToolResult[] = [];

  constructor(
    private readonly sendUpstream?: (payload: {
      type: 'tool.result';
      call_id: string;
      result: string;
      is_error: boolean;
    }) => void
  ) {}

  public recordEvent(eventType: string, status?: string): void {
    if (eventType === 'reply.started' || eventType === 'input.speech.started') {
      this.lastEvent = eventType;
    } else if (eventType === 'reply.done') {
      this.lastEvent = 'reply.done';
      if (status === 'interrupted') {
        // Discard pending results when reply.done has status "interrupted"
        this.pendingTools = [];
      } else {
        this.flush();
      }
    }
  }

  public recordToolCall(callId: string, result: string, isError: boolean = false): void {
    const stringifiedResult = typeof result === 'string' ? result : JSON.stringify(result);
    this.pendingTools.push({
      call_id: callId,
      result: stringifiedResult,
      is_error: isError,
    });

    // Flush only if lastEvent === 'reply.done'
    if (this.lastEvent === 'reply.done') {
      this.flush();
    }
  }

  public flush(): PendingToolResult[] {
    if (this.lastEvent !== 'reply.done' || this.pendingTools.length === 0) {
      return [];
    }
    const flushed = [...this.pendingTools];
    if (this.sendUpstream) {
      for (const item of flushed) {
        this.sendUpstream({
          type: 'tool.result',
          call_id: item.call_id,
          result: item.result,
          is_error: item.is_error,
        });
      }
    }
    this.pendingTools = [];
    return flushed;
  }
}

// Global active session state tracking
let activeVoiceSessionCount = 0;
const activeIpSessions = new Set<string>();
let dailyVoiceSessionMinutesUsed = 0;
let lastDailyResetDate = new Date().toISOString().slice(0, 10);

const executeToolSchema = z.object({
  name: z.string().min(1, 'Tool name is required'),
  arguments: z.record(z.unknown()).default({}),
  callId: z.string().default('test-call-id'),
  leadId: z.string().optional(),
  companyId: z.string().optional(),
});

export const voiceRoutes: FastifyPluginAsync = async (fastify) => {
  const activeConfig: AppConfig = (fastify as any).appConfig || config;
  const assemblyService = defaultAssemblyAIService;
  const callsService = defaultCallsService;

  // 1. Mint short-lived, single-use HMAC ticket for public voice endpoint
  fastify.get('/api/voice/ticket', async (request, reply) => {
    const clientIp =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.socket.remoteAddress ||
      '127.0.0.1';

    // Rate limiting per IP
    if (!checkTicketRateLimit(clientIp, activeConfig.RATE_LIMIT_VOICE_TOKEN || 10)) {
      return reply.status(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded for voice ticket issuance. Please try again in 1 minute.',
      });
    }

    // Optional DEMO_ACCESS_CODE check
    if (activeConfig.DEMO_ACCESS_CODE) {
      const codeHeader = request.headers['x-demo-access-code'] || request.headers['authorization'];
      const codeQuery = (request.query as any)?.code;
      const provided =
        (typeof codeHeader === 'string'
          ? codeHeader.startsWith('Bearer ')
            ? codeHeader.slice(7).trim()
            : codeHeader.trim()
          : '') || (typeof codeQuery === 'string' ? codeQuery.trim() : '');

      if (!provided || provided !== activeConfig.DEMO_ACCESS_CODE) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Valid DEMO_ACCESS_CODE required to obtain voice ticket',
        });
      }
    }

    // Single-use, short-lived (60s) HMAC ticket carrying fixed demo companyId
    const ticket = generateVoiceTicket(clientIp, DEFAULT_DEMO_COMPANY_ID, activeConfig);
    return reply.status(200).send({
      ticket,
      expiresInSeconds: 60,
      companyId: DEFAULT_DEMO_COMPANY_ID,
      wsUrl: '/api/voice/ws',
    });
  });

  // 1b. Mint single-use Voice Agent session token (AssemblyAI direct token)
  fastify.get('/api/voice/token', async (request, reply) => {
    const { expiresInSeconds, maxSessionDurationSeconds } = request.query as {
      expiresInSeconds?: string;
      maxSessionDurationSeconds?: string;
    };

    const exp = expiresInSeconds ? parseInt(expiresInSeconds, 10) : 300;
    const maxDur = maxSessionDurationSeconds ? parseInt(maxSessionDurationSeconds, 10) : 3600;

    const tokenData = await assemblyService.mintSessionToken(exp, maxDur);
    return reply.status(200).send({
      ...tokenData,
      wsUrl: 'wss://agents.assemblyai.com/v1/ws',
    });
  });

  // 2. Fetch active Voice Agent session configuration & registered tools
  fastify.get('/api/voice/config', async (request, reply) => {
    const sessionConfig = await assemblyService.buildSessionConfiguration();
    return reply.status(200).send({
      config: sessionConfig,
      toolCount: sessionConfig.tools.length,
      tools: sessionConfig.tools.map((t) => ({ name: t.name, description: t.description })),
    });
  });

  // 3. Test execution of a business tool through backend Policy Engine
  fastify.post('/api/voice/tools/execute', async (request, reply) => {
    const parse = executeToolSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid tool execution payload', parse.error.format());
    }

    const { name, arguments: args, callId, leadId } = parse.data;
    let derivedCompanyId: string | undefined = parse.data.companyId;

    if (activeConfig.NODE_ENV === 'production') {
      const ticketHeader =
        (request.headers['x-voice-ticket'] as string) ||
        (request.headers['authorization'] as string)?.replace(/^Bearer /i, '') ||
        (request.query as any)?.ticket;

      if (!ticketHeader) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Valid voice ticket required for direct tool execution in production',
        });
      }

      const ticketCheck = verifyVoiceTicket(ticketHeader, false, activeConfig);
      if (!ticketCheck.valid) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: ticketCheck.error,
        });
      }

      derivedCompanyId = ticketCheck.payload.companyId;

      if (!READ_ONLY_VOICE_TOOLS.has(name)) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: `Direct tool execution in production is restricted to read-only tools. Tool '${name}' is not permitted.`,
        });
      }
    }

    const result = await assemblyService.executeTool(name, args, callId, {
      leadId,
      companyId: derivedCompanyId,
    });
    return reply.status(200).send(result);
  });

  // 3b. Serve interactive Voice Testing Console
  fastify.get('/voice-tester', async (request, reply) => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const candidatePaths = [
      path.join(process.cwd(), 'public', 'voice-tester.html'),
      path.join(process.cwd(), 'backend', 'public', 'voice-tester.html'),
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/voice-tester.html'),
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../public/voice-tester.html'),
    ];

    for (const candidate of candidatePaths) {
      try {
        const html = await fs.readFile(candidate, 'utf-8');
        return reply.type('text/html').send(html);
      } catch {
        // Try next candidate
      }
    }

    return reply.status(404).type('text/html').send('<h1>Voice Tester HTML not found</h1>');
  });

  // 4. Normalized WebSocket bridge for browser voice interaction
  fastify.get('/api/voice/ws', { websocket: true }, (connection, req) => {
    const socket = (connection as any).socket || connection;
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    // 1. Require valid unused ticket (?ticket=)
    const reqUrl = new URL(req.url || '', 'http://localhost');
    const ticketParam = reqUrl.searchParams.get('ticket');
    if (!ticketParam) {
      socket.send(
        JSON.stringify({
          type: 'voice.error',
          payload: { message: 'Missing required voice ticket (?ticket=)' },
        })
      );
      socket.close(4001, 'Missing required voice ticket');
      return;
    }

    const ticketResult = verifyVoiceTicket(ticketParam, true, activeConfig); // single-use consumed!
    if (!ticketResult.valid) {
      socket.send(
        JSON.stringify({
          type: 'voice.error',
          payload: { message: ticketResult.error },
        })
      );
      socket.close(4003, ticketResult.error);
      return;
    }

    // 2. Check Origin header against ALLOWED_ORIGINS in production
    if (activeConfig.NODE_ENV === 'production') {
      const origin = (req.headers['origin'] || req.headers['Origin']) as string | undefined;
      const allowedOrigins = (activeConfig.ALLOWED_ORIGINS || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
      const isAllowedOrigin =
        origin &&
        (allowedOrigins.includes('*') || allowedOrigins.includes(origin));
      if (!isAllowedOrigin) {
        socket.send(
          JSON.stringify({
            type: 'voice.error',
            payload: { message: `Origin '${origin || 'unknown'}' not allowed in production` },
          })
        );
        socket.close(4003, 'Forbidden origin');
        return;
      }
    }

    // 3. Reset daily session minutes budget if new UTC day
    const currentDate = new Date().toISOString().slice(0, 10);
    if (currentDate !== lastDailyResetDate) {
      dailyVoiceSessionMinutesUsed = 0;
      lastDailyResetDate = currentDate;
    }

    // 4. Concurrency cap (default 3)
    if (activeVoiceSessionCount >= activeConfig.VOICE_MAX_CONCURRENT) {
      socket.send(
        JSON.stringify({
          type: 'voice.error',
          payload: {
            message: `Maximum concurrent voice sessions reached (${activeConfig.VOICE_MAX_CONCURRENT}). Please try again shortly.`,
            retryable: true,
          },
        })
      );
      socket.close(4029, 'Concurrency limit exceeded');
      return;
    }

    // 5. One active session per IP
    if (activeIpSessions.has(clientIp)) {
      socket.send(
        JSON.stringify({
          type: 'voice.error',
          payload: {
            message: 'An active voice session is already in progress from your IP address.',
            retryable: false,
          },
        })
      );
      socket.close(4029, 'Active session already exists for this IP');
      return;
    }

    // 6. Daily session minutes budget (default 120)
    if (dailyVoiceSessionMinutesUsed >= activeConfig.VOICE_DAILY_SESSION_MINUTES) {
      socket.send(
        JSON.stringify({
          type: 'voice.error',
          payload: {
            message: `Daily voice session budget of ${activeConfig.VOICE_DAILY_SESSION_MINUTES} minutes exceeded. Resets tomorrow.`,
            retryable: false,
          },
        })
      );
      socket.close(4029, 'Daily budget exceeded');
      return;
    }

    // 7. Production API Key validation (No silent simulation in production)
    const apiKey = process.env.ASSEMBLYAI_API_KEY || activeConfig.ASSEMBLYAI_API_KEY || '';
    const isDummyKey =
      !apiKey ||
      apiKey === 'dummy_dev_key_for_testing' ||
      apiKey === 'test_key' ||
      apiKey.startsWith('mock_') ||
      apiKey.length < 10;

    if (activeConfig.NODE_ENV === 'production' && isDummyKey) {
      socket.send(
        JSON.stringify({
          type: 'voice.error',
          payload: {
            message: 'Voice agent service unavailable: ASSEMBLYAI_API_KEY is missing or invalid in production.',
            statusCode: 503,
          },
        })
      );
      socket.close(1011, 'Voice agent unavailable');
      return;
    }

    // Accept connection
    activeVoiceSessionCount++;
    activeIpSessions.add(clientIp);
    const sessionStartTime = Date.now();

    let callId = '';
    let assemblySessionId = '';
    let assemblyWs: WebSocket | null = null;
    let isSessionReady = false;
    const audioBufferBeforeReady: string[] = [];

    // Tool Coordinator adhering to official docs ordering
    const toolCoordinator = new VoiceToolResultCoordinator((msg) => {
      if (assemblyWs && assemblyWs.readyState === 1 /* OPEN */) {
        assemblyWs.send(JSON.stringify(msg));
      }
    });

    let isCleanedUp = false;
    let maxDurationTimer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;

      if (maxDurationTimer) {
        clearTimeout(maxDurationTimer);
        maxDurationTimer = null;
      }

      activeVoiceSessionCount = Math.max(0, activeVoiceSessionCount - 1);
      activeIpSessions.delete(clientIp);

      const elapsedMinutes = (Date.now() - sessionStartTime) / 60000;
      dailyVoiceSessionMinutesUsed += elapsedMinutes;

      if (assemblyWs) {
        try {
          if (assemblyWs.readyState === 1 /* OPEN */) {
            assemblyWs.send(JSON.stringify({ type: 'session.end' }));
          }
          assemblyWs.close();
        } catch {}
        assemblyWs = null;
      }

      if (callId) {
        callsService.endSession(callId).catch(() => {});
      }
    };

    // Server-enforced hard session timeout (VOICE_MAX_SESSION_SECONDS, default 300)
    const maxSessionSeconds = activeConfig.VOICE_MAX_SESSION_SECONDS || 300;
    maxDurationTimer = setTimeout(() => {
      try {
        socket.send(
          JSON.stringify({
            type: 'voice.session_ended',
            callId,
            sessionId: assemblySessionId,
            timestamp: new Date().toISOString(),
            payload: { message: `Maximum session duration of ${maxSessionSeconds} seconds reached.` },
          })
        );
      } catch {}
      cleanup();
      try {
        socket.close(1000, 'Max duration reached');
      } catch {}
    }, maxSessionSeconds * 1000);

    // Initialize call session record
    callsService
      .startSession('anonymous-lead', 'hq-employee-coordinator')
      .then((callRecord) => {
        callId = callRecord.id;

        if (!isDummyKey) {
          try {
            const upstreamWsUrl = 'wss://agents.assemblyai.com/v1/ws';
            assemblyWs = new WebSocket(upstreamWsUrl, {
              headers: {
                Authorization: `Bearer ${apiKey}`,
              },
            });

            assemblyWs.onopen = async () => {
              const sessionConfig = await assemblyService.buildSessionConfiguration();
              assemblyWs?.send(
                JSON.stringify({
                  type: 'session.update',
                  session: sessionConfig,
                })
              );
            };

            assemblyWs.onmessage = async (event: any) => {
              try {
                const raw = JSON.parse(event.data.toString());
                const eventType = raw.type;

                // Handle session.ready
                if (eventType === 'session.ready') {
                  isSessionReady = true;
                  assemblySessionId = raw.session_id;
                  await callsService.recordAssemblySessionId(callId, assemblySessionId);

                  // Drain buffered audio
                  while (audioBufferBeforeReady.length > 0 && assemblyWs?.readyState === 1) {
                    const queued = audioBufferBeforeReady.shift();
                    if (queued) {
                      assemblyWs.send(JSON.stringify({ type: 'input.audio', audio: queued }));
                    }
                  }
                }

                // Handle session.error: retryable vs fatal
                if (eventType === 'session.error') {
                  const errCode = String(raw.code || raw.error_code || '').toLowerCase();
                  const isRetryable =
                    errCode === 'at_capacity' ||
                    errCode === 'concurrency_exceeded' ||
                    errCode === 'internal_error';
                  const isAuthError =
                    errCode === 'unauthorized' ||
                    errCode === 'forbidden' ||
                    errCode === 'session_forbidden';

                  let userMsg = raw.message || raw.error || 'AssemblyAI session error';
                  if (isRetryable) {
                    userMsg = 'Voice agent service is temporarily busy. Please retry shortly.';
                  } else if (isAuthError) {
                    userMsg = 'AssemblyAI authentication failure. Verify backend ASSEMBLYAI_API_KEY.';
                  }

                  socket.send(
                    JSON.stringify({
                      type: 'voice.error',
                      callId,
                      payload: {
                        message: userMsg,
                        code: raw.code || raw.error_code,
                        retryable: isRetryable,
                      },
                    })
                  );

                  if (!isRetryable) {
                    cleanup();
                    socket.close(1011, userMsg);
                  }
                  return;
                }

                // Track speaking events
                if (eventType === 'reply.started' || eventType === 'input.speech.started') {
                  toolCoordinator.recordEvent(eventType);
                }

                if (eventType === 'reply.done') {
                  toolCoordinator.recordEvent(eventType, raw.status);
                }

                // Handle tool.call via Backend Policy Engine
                if (eventType === 'tool.call') {
                  const toolName = raw.name;
                  const toolArgs = raw.arguments || {};
                  const toolCallId = raw.call_id;

                  const call = callId ? await callsService.getSession(callId).catch(() => null) : null;
                  const execution = await assemblyService.executeTool(toolName, toolArgs, toolCallId, {
                    callId,
                    companyId: ticketResult.payload.companyId,
                    leadId: call?.leadId,
                  });

                  await callsService.recordToolCall(callId, {
                    callId: toolCallId,
                    name: toolName,
                    arguments: toolArgs,
                    policyDecision: execution.policyDecision,
                    isError: execution.isError,
                  });

                  // Push to coordinator and flush ONLY if lastEvent === 'reply.done'
                  toolCoordinator.recordToolCall(toolCallId, execution.result, execution.isError);

                  // Broadcast tool activity to client UI
                  socket.send(
                    JSON.stringify({
                      type: 'voice.tool_activity',
                      sessionId: assemblySessionId,
                      callId,
                      timestamp: new Date().toISOString(),
                      payload: {
                        callId: toolCallId,
                        toolName,
                        arguments: toolArgs,
                        policyDecision: execution.policyDecision,
                        policyReason: execution.policyReason,
                        isError: execution.isError,
                      },
                    })
                  );
                }

                // Record user transcripts
                if (eventType === 'transcript.user') {
                  await callsService.recordTranscript(callId, {
                    speaker: 'user',
                    text: raw.text,
                  });
                }

                // Record agent transcripts
                if (eventType === 'transcript.agent') {
                  await callsService.recordTranscript(callId, {
                    speaker: 'agent',
                    text: raw.text,
                    interrupted: raw.interrupted,
                  });
                }

                // Normalize and relay event to client
                const normalized = callsService.normalizeProviderEvent(raw, callId, assemblySessionId);
                if (normalized) {
                  socket.send(JSON.stringify(normalized));
                }
              } catch (err: any) {
                socket.send(
                  JSON.stringify({
                    type: 'voice.error',
                    callId,
                    payload: { message: err.message },
                  })
                );
              }
            };

            assemblyWs.onerror = (err: any) => {
              socket.send(
                JSON.stringify({
                  type: 'voice.error',
                  callId,
                  payload: { message: err.message || 'Upstream AssemblyAI WebSocket error' },
                })
              );
            };

            assemblyWs.onclose = () => {
              cleanup();
            };
          } catch (err: any) {
            socket.send(
              JSON.stringify({
                type: 'voice.error',
                callId,
                payload: { message: err.message || 'Failed to establish upstream connection' },
              })
            );
            cleanup();
            socket.close(1011, 'Upstream connection failure');
          }
        } else {
          // Non-production simulated mode
          assemblySessionId = `sim_session_${randomUUID().substring(0, 8)}`;
          isSessionReady = true;
          socket.send(
            JSON.stringify({
              type: 'voice.connected',
              sessionId: assemblySessionId,
              callId,
              timestamp: new Date().toISOString(),
              payload: {
                sessionId: assemblySessionId,
                status: 'ready',
                mode: 'simulation',
              },
            })
          );
        }
      })
      .catch((err) => {
        socket.send(JSON.stringify({ type: 'voice.error', payload: { message: err.message } }));
        cleanup();
        socket.close(1011, err.message);
      });

    // Inbound messages from client
    socket.on('message', async (message: any) => {
      try {
        const clientMsg = JSON.parse(message.toString());

        // Stream audio input: Do not forward until session.ready has been received
        if (clientMsg.type === 'voice.audio_input' && clientMsg.audio) {
          if (!isSessionReady) {
            if (audioBufferBeforeReady.length < 50) {
              audioBufferBeforeReady.push(clientMsg.audio);
            }
          } else if (assemblyWs && assemblyWs.readyState === 1) {
            assemblyWs.send(
              JSON.stringify({
                type: 'input.audio',
                audio: clientMsg.audio,
              })
            );
          }
        }

        // Clean end session on client voice.end
        if (clientMsg.type === 'voice.end') {
          cleanup();
          socket.send(
            JSON.stringify({
              type: 'voice.session_ended',
              callId,
              sessionId: assemblySessionId,
              timestamp: new Date().toISOString(),
              payload: { message: 'Session closed cleanly' },
            })
          );
          socket.close();
        }
      } catch {
        socket.send(
          JSON.stringify({
            type: 'voice.error',
            callId,
            payload: { message: 'Malformed client message' },
          })
        );
      }
    });

    socket.on('close', cleanup);
    socket.on('error', cleanup);
  });
};
