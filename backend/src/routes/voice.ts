import { randomUUID } from 'crypto';
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

const executeToolSchema = z.object({
  name: z.string().min(1, 'Tool name is required'),
  arguments: z.record(z.unknown()).default({}),
  callId: z.string().default('test-call-id'),
  leadId: z.string().optional(),
  companyId: z.string().optional(),
});

export const voiceRoutes: FastifyPluginAsync = async (fastify) => {
  const assemblyService = defaultAssemblyAIService;
  const callsService = defaultCallsService;

  // 1. Mint single-use Voice Agent token
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
    const config = await assemblyService.buildSessionConfiguration();
    return reply.status(200).send({
      config,
      toolCount: config.tools.length,
      tools: config.tools.map((t) => ({ name: t.name, description: t.description })),
    });
  });

  // 3. Test execution of a business tool through backend Policy Engine
  fastify.post('/api/voice/tools/execute', async (request, reply) => {
    const parse = executeToolSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid tool execution payload', parse.error.format());
    }

    const { name, arguments: args, callId, leadId, companyId } = parse.data;
    const result = await assemblyService.executeTool(name, args, callId, { leadId, companyId });
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

  // 4. Normalized WebSocket bridge for browser & Android voice interaction
  fastify.get('/api/voice/ws', { websocket: true }, (connection, req) => {
    const socket = (connection as any).socket || connection;
    let callId = '';
    let assemblySessionId = '';
    let assemblyWs: any = null;
    let lastAssemblyEvent: string | null = null;
    const pendingTools: Array<{ call_id: string; result: string; is_error: boolean }> = [];

    // Helper: Flush pending tool results when AssemblyAI agent is ready/idle
    const flushPendingTools = () => {
      if (lastAssemblyEvent !== 'reply.done' || pendingTools.length === 0 || !assemblyWs) {
        return;
      }
      for (const tool of pendingTools) {
        if (assemblyWs.readyState === 1 /* OPEN */) {
          assemblyWs.send(
            JSON.stringify({
              type: 'tool.result',
              call_id: tool.call_id,
              result: tool.result,
              is_error: tool.is_error,
            })
          );
        }
      }
      pendingTools.length = 0;
    };

    // Initialize call session record
    callsService
      .startSession()
      .then((callRecord) => {
        callId = callRecord.id;

        const apiKey = process.env.ASSEMBLYAI_API_KEY || '';
        // If API key is available and not in pure mock offline mode, connect upstream to AssemblyAI
        if (apiKey && apiKey !== 'test_key' && !apiKey.startsWith('mock_')) {
          try {
            const upstreamWsUrl = 'wss://agents.assemblyai.com/v1/ws';
            assemblyWs = new WebSocket(upstreamWsUrl, {
              headers: {
                Authorization: `Bearer ${apiKey}`,
              },
            });

            assemblyWs.onopen = async () => {
              // Send initial session.update on connect
              const sessionConfig = await assemblyService.buildSessionConfiguration();
              assemblyWs.send(
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
                  assemblySessionId = raw.session_id;
                  await callsService.recordAssemblySessionId(callId, assemblySessionId);
                }

                // Handle tool.call via Backend Policy Engine
                if (eventType === 'tool.call') {
                  const toolName = raw.name;
                  const toolArgs = raw.arguments || {};
                  const toolCallId = raw.call_id;

                  const call = callId ? await callsService.getSession(callId).catch(() => null) : null;
                  const execution = await assemblyService.executeTool(toolName, toolArgs, toolCallId, {
                    callId,
                    companyId: call?.companyId,
                    leadId: call?.leadId,
                  });

                  await callsService.recordToolCall(callId, {
                    callId: toolCallId,
                    name: toolName,
                    arguments: toolArgs,
                    policyDecision: execution.policyDecision,
                    isError: execution.isError,
                  });

                  // Send tool.result IMMEDIATELY — AssemblyAI is waiting for this before it can continue
                  if (assemblyWs && assemblyWs.readyState === 1 /* OPEN */) {
                    assemblyWs.send(
                      JSON.stringify({
                        type: 'tool.result',
                        call_id: toolCallId,
                        result: execution.result,
                        is_error: execution.isError,
                      })
                    );
                  } else {
                    // Fallback: queue if socket is temporarily unavailable
                    pendingTools.push({
                      call_id: toolCallId,
                      result: execution.result,
                      is_error: execution.isError,
                    });
                  }

                  // Broadcast tool activity to browser client (Tool Feed UI)
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

                if (eventType === 'reply.started' || eventType === 'input.speech.started') {
                  lastAssemblyEvent = eventType;
                }

                if (eventType === 'reply.done') {
                  lastAssemblyEvent = eventType;
                  if (raw.status === 'interrupted') {
                    // Agent was interrupted: drop stale tool results
                    pendingTools.length = 0;
                  } else {
                    flushPendingTools();
                  }
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
              callsService.endSession(callId).catch(() => {});
            };
          } catch {
            // Fallback for offline testing
          }
        } else {
          // Mock / Simulated connection for offline environments & automated tests
          assemblySessionId = `sim_session_${randomUUID().substring(0, 8)}`;
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
      });

    // Inbound messages from client (browser / Android)
    socket.on('message', async (message: any) => {
      try {
        const clientMsg = JSON.parse(message.toString());

        // Stream audio input
        if (clientMsg.type === 'voice.audio_input' && clientMsg.audio) {
          if (assemblyWs && assemblyWs.readyState === 1) {
            assemblyWs.send(
              JSON.stringify({
                type: 'input.audio',
                audio: clientMsg.audio,
              })
            );
          }
        }

        // Clean end session
        if (clientMsg.type === 'voice.end') {
          if (assemblyWs && assemblyWs.readyState === 1) {
            assemblyWs.send(JSON.stringify({ type: 'session.end' }));
          }
          await callsService.endSession(callId);
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
      } catch (err: any) {
        socket.send(
          JSON.stringify({
            type: 'voice.error',
            callId,
            payload: { message: 'Malformed client message' },
          })
        );
      }
    });

    socket.on('close', () => {
      if (assemblyWs && assemblyWs.readyState === 1) {
        // Send session.end cleanly on socket closure
        try {
          assemblyWs.send(JSON.stringify({ type: 'session.end' }));
          assemblyWs.close();
        } catch {}
      }
      if (callId) {
        callsService.endSession(callId).catch(() => {});
      }
    });
  });
};
