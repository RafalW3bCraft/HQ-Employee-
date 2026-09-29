# Production Environment Configuration & Secret Management

This document defines the authoritative production environment schema, secret classifications, and rotation guidance for the HQ AI Employee backend.

## Environment Variables Specification

| Variable | Required? | Purpose | Secret? | Production Source | Validation | Rotation Guidance |
|---|---|---|---|---|---|---|
| `NODE_ENV` | Yes | Controls runtime mode (must be `production`) | No | Cloud Run Env Var | Value must strictly equal `production`. Development defaults disabled. | Static, changed only during deployments. |
| `PORT` | Yes (Cloud Run) | Port Fastify binds to | No | Injected by Cloud Run runtime | Port integer (defaults to 3000 if unset). Bound to `0.0.0.0`. | N/A |
| `HOST` | No | Network interface | No | Cloud Run Env Var (`0.0.0.0`) | String IP address. Must be `0.0.0.0` in container runtime. | N/A |
| `LOG_LEVEL` | No | Pino logger verbosity | No | Cloud Run Env Var (`info` or `warn`) | Enum: `fatal`, `error`, `warn`, `info`, `debug`, `trace`. In production, default is `info`. | N/A |
| `ALLOWED_ORIGINS` | Yes | CORS and WebSocket allowed origins | No | Cloud Run Env Var | Comma-separated list of valid HTTPS origins. **Wildcard `*` is strictly blocked in production.** | Updated when front-end domain changes. |
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string with SSL | **YES** | GCP Secret Manager (`DATABASE_URL`) | Must be valid URL with protocol `postgresql:` or `postgres:`. **Cannot point to localhost/127.0.0.1 in production.** Must require SSL (`sslmode=require`). | Rotate credentials in Neon console; update Secret Manager secret version; re-deploy or rolling restart Cloud Run service. |
| `ASSEMBLYAI_API_KEY` | Yes | AssemblyAI API Key for voice token generation & STT | **YES** | GCP Secret Manager (`ASSEMBLYAI_API_KEY`) | Non-empty string. **Must not match `dummy_dev_key_for_testing` or test keys.** | Generate new API key at assemblyai.com/dashboard; update Secret Manager; deploy new secret revision. |
| `JWT_SECRET` | Yes | Secret for signing & verifying Auth JWTs | **YES** | GCP Secret Manager (`JWT_SECRET`) | String minimum 32 characters high entropy. **Required in production (no fallback).** | Generate 256-bit cryptographically secure random string; update Secret Manager; rolling restart will invalidate existing active sessions unless key rotation window implemented. |
| `REVENUECAT_SECRET_KEY` | Conditional | RevenueCat REST API access for purchases | **YES** | GCP Secret Manager (`REVENUECAT_SECRET_KEY`) | Non-empty string when monetization enabled. | Rotate in RevenueCat dashboard and update GCP Secret Manager. |
| `REVENUECAT_WEBHOOK_SECRET` | Conditional | Shared secret for validating RevenueCat webhooks | **YES** | GCP Secret Manager (`REVENUECAT_WEBHOOK_SECRET`) | Non-empty string. Verifies `Authorization` header on incoming billing webhooks. | Rotate in RevenueCat webhook settings and update Secret Manager simultaneously. |
| `SIP_CALLER_ID` | Conditional | Caller ID phone number for outbound telephony | No | Cloud Run Env Var | E.164 phone number format (e.g. `+15551234567`). | Update upon provisioning a new carrier number. |

---

## Secret Injection & Cloud Run Best Practices

1. **Zero Secret Footprint in Images:** No `.env`, secret values, or credential files are ever copied into the Docker image or committed to source control.
2. **Runtime Injection:** Google Cloud Run mounts secrets from Google Cloud Secret Manager as environment variables at container startup:
   ```bash
   gcloud run deploy hq-employee-backend \
     --set-secrets="DATABASE_URL=DATABASE_URL:latest,ASSEMBLYAI_API_KEY=ASSEMBLYAI_API_KEY:latest,JWT_SECRET=JWT_SECRET:latest"
   ```
3. **Fail-Closed Runtime Validation:** The server initializes with `loadConfig(process.env)`. If any required secret or production constraint (e.g., non-localhost DB, non-wildcard CORS, valid JWT secret) fails validation, Zod terminates the process before opening any network sockets.
4. **Client-Side Zero-Trust:** The browser voice console NEVER receives `ASSEMBLYAI_API_KEY`. It communicates with `/api/voice/token` to receive an ephemeral, short-lived token generated server-side.
