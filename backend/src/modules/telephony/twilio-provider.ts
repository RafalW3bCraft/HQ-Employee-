/**
 * Twilio Telephony Provider Implementation
 *
 * Implements TelephonyProvider using Twilio Programmable Voice REST API.
 * Supports Twilio outbound calls, webhook verification, and status monitoring.
 */

import { createHmac } from 'crypto';
import {
  TelephonyProvider,
  InitiateCallParams,
  TelephonyCallResult,
  TelephonyCallStatus,
  TelephonyEvent,
  TelephonyCarrierError,
} from './index.js';

export interface TwilioProviderOptions {
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
}

export class TwilioTelephonyProvider implements TelephonyProvider {
  public readonly name = 'TwilioTelephonyProvider';
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;
  private localStatuses = new Map<string, TelephonyCallStatus>();

  constructor(options: TwilioProviderOptions = {}) {
    this.accountSid = options.accountSid || process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = options.authToken || process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = options.fromNumber || process.env.TWILIO_PHONE_NUMBER || '';
  }

  isConfigured(): boolean {
    return Boolean(
      this.accountSid &&
        this.authToken &&
        !this.accountSid.startsWith('dummy_') &&
        this.accountSid.length > 5
    );
  }

  updateConfig(accountSid: string, authToken: string, fromNumber?: string): void {
    this.accountSid = accountSid.trim();
    this.authToken = authToken.trim();
    if (fromNumber) this.fromNumber = fromNumber.trim();
  }

  validateNumber(phoneNumber: string): { valid: boolean; normalized?: string; error?: string } {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return { valid: false, error: 'Phone number is required' };
    }
    const clean = phoneNumber.trim().replace(/[\s\-()]/g, '');
    const e164Regex = /^\+[1-9]\d{6,14}$/;
    if (!e164Regex.test(clean)) {
      return {
        valid: false,
        error: `Invalid E.164 phone number '${phoneNumber}'.`,
      };
    }
    return { valid: true, normalized: clean };
  }

  async initiateCall(params: InitiateCallParams): Promise<TelephonyCallResult> {
    const numValidation = this.validateNumber(params.destinationE164);
    if (!numValidation.valid) {
      throw new TelephonyCarrierError(numValidation.error || 'Invalid phone number', 400);
    }
    const destination = numValidation.normalized!;

    if (!this.isConfigured()) {
      throw new TelephonyCarrierError(
        'Twilio integration is NOT CONFIGURED. Please configure Twilio or Call-E in Setup Center.',
        503
      );
    }

    const callerId = params.callerIdE164 || this.fromNumber;
    if (!callerId) {
      throw new TelephonyCarrierError('A valid Twilio caller ID (From number) is required to place outbound calls.', 400);
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Calls.json`;
    const authHeader = 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

    const webhookUrl = params.webhookUrl || `${params.metadata?.publicBaseUrl || ''}/api/webhooks/twilio/voice`;
    const formParams = new URLSearchParams({
      To: destination,
      From: callerId,
      Url: webhookUrl,
      StatusCallback: `${params.metadata?.publicBaseUrl || ''}/api/webhooks/twilio/status`,
      StatusCallbackMethod: 'POST',
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formParams.toString(),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new TelephonyCarrierError(`Twilio API error (HTTP ${response.status}): ${errText}`, response.status >= 500 ? 502 : 400);
      }

      const data = (await response.json()) as any;
      const providerCallId = data.sid;

      const result: TelephonyCallResult = {
        providerCallId,
        status: data.status === 'queued' ? 'QUEUED' : 'IN_PROGRESS',
        carrierSessionId: data.sid,
        initiatedAt: new Date().toISOString(),
      };

      this.localStatuses.set(providerCallId, {
        providerCallId,
        status: 'INITIATED',
      });

      return result;
    } catch (err: any) {
      if (err instanceof TelephonyCarrierError) throw err;
      throw new TelephonyCarrierError(`Twilio network error: ${err.message}`, 502);
    }
  }

  async getCallStatus(providerCallId: string): Promise<TelephonyCallStatus> {
    if (!this.isConfigured()) {
      return (
        this.localStatuses.get(providerCallId) || {
          providerCallId,
          status: 'FAILED',
          failureReason: 'Twilio is not configured',
        }
      );
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Calls/${encodeURIComponent(providerCallId)}.json`;
      const authHeader = 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
      const res = await fetch(url, { headers: { Authorization: authHeader } });

      if (!res.ok) {
        const local = this.localStatuses.get(providerCallId);
        if (local) return local;
        return {
          providerCallId,
          status: 'FAILED',
          failureReason: `Twilio call not found (HTTP ${res.status})`,
        };
      }

      const data = (await res.json()) as any;
      let status: TelephonyCallStatus['status'] = 'INITIATED';

      switch (data.status) {
        case 'in-progress':
          status = 'CONNECTED';
          break;
        case 'completed':
          status = 'COMPLETED';
          break;
        case 'busy':
          status = 'BUSY';
          break;
        case 'no-answer':
          status = 'NO_ANSWER';
          break;
        case 'canceled':
          status = 'CANCELED';
          break;
        case 'failed':
          status = 'FAILED';
          break;
        case 'ringing':
          status = 'RINGING';
          break;
        default:
          status = 'INITIATED';
          break;
      }

      const st: TelephonyCallStatus = {
        providerCallId,
        status,
        durationSeconds: parseInt(data.duration || '0', 10),
      };
      this.localStatuses.set(providerCallId, st);
      return st;
    } catch (err: any) {
      const local = this.localStatuses.get(providerCallId);
      if (local) return local;
      return {
        providerCallId,
        status: 'FAILED',
        failureReason: `Twilio query error: ${err.message}`,
      };
    }
  }

  async endCall(providerCallId: string): Promise<void> {
    if (!this.isConfigured()) return;
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Calls/${encodeURIComponent(providerCallId)}.json`;
      const authHeader = 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
      await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ Status: 'completed' }).toString(),
      });
    } catch {
      // Ignore
    }
  }

  async terminateCall(providerCallId: string): Promise<void> {
    return this.endCall(providerCallId);
  }

  async handleIncomingEvent(rawPayload: unknown, headers?: Record<string, string>): Promise<TelephonyEvent> {
    const payload = rawPayload as Record<string, string>;
    const providerCallId = payload.CallSid || 'unknown';
    const callStatus = payload.CallStatus || 'unknown';
    const now = new Date().toISOString();

    let eventType: TelephonyEvent['eventType'] = 'call.initiated';
    if (callStatus === 'in-progress') eventType = 'call.connected';
    else if (callStatus === 'completed') eventType = 'call.ended';
    else if (callStatus === 'failed' || callStatus === 'busy' || callStatus === 'no-answer') eventType = 'call.failed';

    return {
      eventType,
      providerCallId,
      sessionId: payload.CallSid,
      fromNumber: payload.From || this.fromNumber,
      toNumber: payload.To || '',
      durationSeconds: parseInt(payload.CallDuration || '0', 10),
      reason: callStatus,
      timestamp: now,
      rawPayload,
    };
  }

  async handleProviderEvent(rawPayload: unknown, headers?: Record<string, string>): Promise<TelephonyEvent> {
    return this.handleIncomingEvent(rawPayload, headers);
  }

  async checkHealth(): Promise<{
    status: 'CONNECTED' | 'NOT CONFIGURED' | 'INVALID CREDENTIALS' | 'ERROR';
    latencyMs?: number;
    message: string;
    provider: string;
  }> {
    if (!this.isConfigured()) {
      return {
        status: 'NOT CONFIGURED',
        message: 'TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is not set.',
        provider: 'Twilio',
      };
    }

    const start = Date.now();
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}.json`;
      const authHeader = 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
      const res = await fetch(url, { headers: { Authorization: authHeader } });
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        return {
          status: 'INVALID CREDENTIALS',
          latencyMs,
          message: `Twilio rejected credentials with HTTP ${res.status}`,
          provider: 'Twilio',
        };
      }

      return {
        status: 'CONNECTED',
        latencyMs,
        message: `Twilio account verified (HTTP 200 in ${latencyMs}ms)`,
        provider: 'Twilio',
      };
    } catch (err: any) {
      return {
        status: 'ERROR',
        latencyMs: Date.now() - start,
        message: `Error connecting to Twilio: ${err.message}`,
        provider: 'Twilio',
      };
    }
  }
}

export const defaultTwilioTelephonyProvider = new TwilioTelephonyProvider();
