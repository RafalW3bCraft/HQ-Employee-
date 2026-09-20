/**
 * Google Calendar Provider
 *
 * Implements CalendarProvider interface using the Google Calendar API.
 * Uses an OAuth refresh token flow (no user consent screen at runtime).
 *
 * Required environment variables:
 *   GOOGLE_CALENDAR_CLIENT_ID
 *   GOOGLE_CALENDAR_CLIENT_SECRET
 *   GOOGLE_CALENDAR_REFRESH_TOKEN
 *   GOOGLE_CALENDAR_ID   (defaults to 'primary')
 *
 * If any of these are absent, fall back to SimulatedCalendarProvider.
 */
import { CalendarProvider } from './index.js';
import { AppError } from '../../errors/index.js';

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface GoogleCalendarEvent {
  id: string;
  htmlLink: string;
  status: string;
}

interface GoogleFreeBusyResponse {
  calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
}

export class GoogleCalendarProvider implements CalendarProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshToken: string;
  private readonly calendarId: string;

  private cachedAccessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(options?: {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    calendarId?: string;
  }) {
    this.clientId = options?.clientId || process.env.GOOGLE_CALENDAR_CLIENT_ID || '';
    this.clientSecret = options?.clientSecret || process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '';
    this.refreshToken = options?.refreshToken || process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || '';
    this.calendarId = options?.calendarId || process.env.GOOGLE_CALENDAR_ID || 'primary';

    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      throw new AppError(
        'GoogleCalendarProvider requires GOOGLE_CALENDAR_CLIENT_ID, ' +
          'GOOGLE_CALENDAR_CLIENT_SECRET, and GOOGLE_CALENDAR_REFRESH_TOKEN',
        500,
        'CALENDAR_CONFIG_ERROR'
      );
    }
  }

  /**
   * True if all required credentials are present in environment.
   */
  static isConfigured(): boolean {
    return Boolean(
      process.env.GOOGLE_CALENDAR_CLIENT_ID &&
        process.env.GOOGLE_CALENDAR_CLIENT_SECRET &&
        process.env.GOOGLE_CALENDAR_REFRESH_TOKEN
    );
  }

  // ── Token Management ───────────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedAccessToken && now < this.tokenExpiresAt - 60_000) {
      return this.cachedAccessToken;
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new AppError(
        `Google OAuth token refresh failed: HTTP ${res.status} — ${errText}`,
        502,
        'CALENDAR_AUTH_ERROR'
      );
    }

    const data = (await res.json()) as GoogleTokenResponse;
    this.cachedAccessToken = data.access_token;
    this.tokenExpiresAt = now + data.expires_in * 1000;
    return this.cachedAccessToken;
  }

  private async apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const url = `https://www.googleapis.com/calendar/v3${path}`;

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new AppError(
        `Google Calendar API error: HTTP ${res.status} ${method} ${path} — ${errText}`,
        res.status >= 500 ? 502 : 400,
        'CALENDAR_API_ERROR'
      );
    }

    if (res.status === 204) return {} as T;
    return res.json() as Promise<T>;
  }

  // ── CalendarProvider Implementation ───────────────────────────────────────

  async getBusyRanges(fromDate: Date, toDate: Date): Promise<Array<{ start: Date; end: Date }>> {
    const body = {
      timeMin: fromDate.toISOString(),
      timeMax: toDate.toISOString(),
      items: [{ id: this.calendarId }],
    };

    const response = await this.apiRequest<GoogleFreeBusyResponse>('POST', '/freeBusy', body);
    const calBusy = response.calendars?.[this.calendarId]?.busy || [];

    return calBusy.map((slot) => ({
      start: new Date(slot.start),
      end: new Date(slot.end),
    }));
  }

  async createEvent(event: {
    title: string;
    description: string;
    start: Date;
    end: Date;
    attendeeEmail?: string;
    attendeeName?: string;
  }): Promise<{ calendarEventId: string; meetingLink?: string }> {
    const calId = encodeURIComponent(this.calendarId);
    const attendees = event.attendeeEmail ? [{ email: event.attendeeEmail }] : [];
    const body = {
      summary: event.title,
      description: event.description,
      start: { dateTime: event.start.toISOString() },
      end: { dateTime: event.end.toISOString() },
      attendees,
      conferenceData: { createRequest: { requestId: event.title } },
      sendUpdates: 'all',
    };

    const result = await this.apiRequest<GoogleCalendarEvent>(
      'POST',
      `/calendars/${calId}/events?conferenceDataVersion=1&sendUpdates=all`,
      body
    );

    return {
      calendarEventId: result.id,
      meetingLink: result.htmlLink,
    };
  }

  async updateEvent(
    calendarEventId: string,
    event: { title?: string; start: Date; end: Date }
  ): Promise<void> {
    const calId = encodeURIComponent(this.calendarId);
    const patch: Record<string, unknown> = {
      start: { dateTime: event.start.toISOString() },
      end: { dateTime: event.end.toISOString() },
    };
    if (event.title) patch.summary = event.title;

    await this.apiRequest<GoogleCalendarEvent>(
      'PATCH',
      `/calendars/${calId}/events/${encodeURIComponent(calendarEventId)}?sendUpdates=all`,
      patch
    );
  }

  async deleteEvent(calendarEventId: string): Promise<void> {
    const calId = encodeURIComponent(this.calendarId);
    await this.apiRequest<void>(
      'DELETE',
      `/calendars/${calId}/events/${encodeURIComponent(calendarEventId)}?sendUpdates=all`
    );
  }

  // Required by interface (no-op for real provider)
  setSimulateFailure(_shouldFail: boolean, _message?: string): void {
    // Not applicable to the real Google Calendar provider.
    // This method exists to satisfy the CalendarProvider interface.
  }
}

/**
 * Factory: returns Google Calendar provider if configured, otherwise null.
 * Callers should fall back to SimulatedCalendarProvider when this returns null.
 */
export function createGoogleCalendarProvider(): GoogleCalendarProvider | null {
  if (!GoogleCalendarProvider.isConfigured()) return null;
  try {
    return new GoogleCalendarProvider();
  } catch {
    return null;
  }
}
