# Production Security & Governance Specification

This document details the production security architecture, access controls, authorization policies, secret boundary isolation, and audit guarantees for the HQ AI Employee Platform.

---

## 1. Zero-Trust Authentication & Multi-Tenant Authorization

### JSON Web Tokens (JWT)
- **Production Secret:** Enforced minimum 32-character high-entropy secret passed via Cloud Run Secret Manager (`JWT_SECRET`).
- **Signature Validation:** Every authenticated route enforces HMAC-SHA256 signature verification via `@fastify/jwt`.
- **Tenant Context (`companyId`):** The `companyId` is cryptographically extracted from the JWT payload and attached to Fastify's request context (`request.user.companyId`).
- **Strict Isolation:** Every database query filters by `company_id`. Cross-tenant data leakage between Company A and Company B is strictly blocked at the SQL query parameter level.
- **Fail-Closed Verification:** Expired tokens, forged signatures, or malformed JWT headers immediately return HTTP 401 Unauthorized.
- **Dev Token Guard:** Test token issuing routes are disabled or rejected when `NODE_ENV === 'production'`.

---

## 2. Policy Engine Boundary Enforcement
The Governed Employee Policy Engine enforces real-time business constraints before executing any action:

| Policy Check | Rule | Engine Decision |
|---|---|---|
| Approved Pricing | Offer pricing within approved service ranges | **ALLOW** |
| Unauthorized Discount | Requested discount > 0% and ≤ 20% without approval ticket | **REQUIRE_APPROVAL** (Human Handoff) |
| Excessive Discount | Requested discount > 20% | **BLOCK** |
| Contract Commitment | Binding legal/contract agreement requested by lead | **BLOCK** |
| Payment Request | Direct credit card / payment credential handling | **BLOCK** |
| Meeting Scheduling | Slot is within working hours and in future | **ALLOW** |
| Past Meeting Slot | Slot timestamp < current time | **BLOCK** |
| Missing Authority | Unknown or unmapped employee capability | **BLOCK** (Fail-closed default) |
| Confidential Data | Request for system secrets, database keys, or passwords | **BLOCK** |

---

## 3. Secret Externalization & Boundary Defense

| Sensitive Entity | Storage Location | Accessible By | Injected Into Client? |
|---|---|---|---|
| `ASSEMBLYAI_API_KEY` | GCP Secret Manager | Cloud Run Fastify Backend | **NEVER** |
| `DATABASE_URL` | GCP Secret Manager | Cloud Run Fastify Backend | **NEVER** |
| `JWT_SECRET` | GCP Secret Manager | Cloud Run Fastify Backend | **NEVER** |
| `REVENUECAT_SECRET_KEY` | GCP Secret Manager | Cloud Run Fastify Backend | **NEVER** |
| `REVENUECAT_WEBHOOK_SECRET` | GCP Secret Manager | Cloud Run Fastify Backend | **NEVER** |
| Ephemeral Voice Token | Generated on-the-fly (`/api/voice/token`) | Browser Client | **Single-use / 60s TTL** |

---

## 4. HTTP & Transport Security Headers
Firebase Hosting and Google Cloud Run enforce strict production security headers:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: microphone=(self)` (allows browser microphone access only to the hosting origin)

---

## 5. Audit Logging & Data Sanitization
Every business action is committed to the immutable audit log table:
- **Recorded Events:** Authentication success/failure, lead creation, policy evaluation decisions, human approval tickets, proposal creation/transitions, calendar scheduling, RevenueCat ledger transactions, voice session lifecycle.
- **Data Redaction:** Passwords, API keys, JWT bearer strings, raw credit card data, and database connection strings are stripped from request and error logs prior to outputting JSON logs to Cloud Logging / stdout.
