import dotenv from 'dotenv';
import { z } from 'zod';

// Load from local .env or root .env if present
dotenv.config();
dotenv.config({ path: '../.env' });

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Database
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://hq_employee:hq_employee_password@localhost:5432/hq_employee'),

  // AssemblyAI — no dummy default; must be set explicitly
  ASSEMBLYAI_API_KEY: z
    .string()
    .min(1, 'AssemblyAI API key is required')
    .default('dummy_dev_key_for_testing'),

  // Authentication — JWT secret used to sign session tokens
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),

  // RevenueCat
  REVENUECAT_SECRET_KEY: z.string().optional(),
  REVENUECAT_WEBHOOK_SECRET: z.string().optional(),

  // CORS — comma-separated list of allowed origins; '*' only permitted in development
  ALLOWED_ORIGINS: z.string().default('*'),

  // Telephony — E.164 caller ID shown to outbound call recipients
  SIP_CALLER_ID: z.string().optional(),

  // Rate limiting (requests per minute)
  RATE_LIMIT_GLOBAL: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_VOICE_TOKEN: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_TELEPHONY: z.coerce.number().int().positive().default(5),

  // Voice Agent Constraints & Gating
  VOICE_MAX_SESSION_SECONDS: z.coerce.number().int().positive().default(300),
  VOICE_MAX_CONCURRENT: z.coerce.number().int().positive().default(3),
  VOICE_DAILY_SESSION_MINUTES: z.coerce.number().int().positive().default(120),
  DEMO_ACCESS_CODE: z.string().optional(),

  // AssemblyAI Telephony Webhook Secret (fail closed in production)
  AAI_WEBHOOK_SECRET: z.string().optional(),

  // Call-E (heycall-e.com) Telephony Provider Configuration
  CALLE_API_KEY: z.string().optional(),
  CALLE_BASE_URL: z.string().default('https://api.heycall-e.com/v1'),
  CALLE_PHONE_NUMBER: z.string().optional(),
  CALLE_WEBHOOK_URL: z.string().optional(),

  // Google Calendar & Meet Integration
  GOOGLE_CALENDAR_CLIENT_ID: z.string().optional(),
  GOOGLE_CALENDAR_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALENDAR_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().default('primary'),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().optional(),

  // Secondary Telephony Provider (Twilio)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production') {
    if (!data.JWT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'JWT_SECRET is required in production',
        path: ['JWT_SECRET'],
      });
    }
    if (!data.AAI_WEBHOOK_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'AAI_WEBHOOK_SECRET is required in production',
        path: ['AAI_WEBHOOK_SECRET'],
      });
    }
    if (data.ALLOWED_ORIGINS === '*') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ALLOWED_ORIGINS must not be wildcard "*" in production',
        path: ['ALLOWED_ORIGINS'],
      });
    }
    if (data.ASSEMBLYAI_API_KEY === 'dummy_dev_key_for_testing') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ASSEMBLYAI_API_KEY must be set to a real key in production',
        path: ['ASSEMBLYAI_API_KEY'],
      });
    }
    // Reject localhost DATABASE_URL in production — Cloud Run has no local PG
    if (
      data.DATABASE_URL.includes('localhost') ||
      data.DATABASE_URL.includes('127.0.0.1') ||
      data.DATABASE_URL.includes('@localhost:')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DATABASE_URL must not use localhost in production. Set a real Neon/PostgreSQL URL.',
        path: ['DATABASE_URL'],
      });
    }
  }
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    const errorDetails = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Invalid application configuration: ${errorDetails}`);
  }
  return result.data;
}

export const config = loadConfig();

