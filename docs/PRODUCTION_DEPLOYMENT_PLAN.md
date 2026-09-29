# Production Deployment Plan: HQ AI Employee Platform

**Document Version:** 1.0.0  
**Target Environments:** Google Cloud Run (Backend API & WebSocket) & Firebase Hosting (Web Client / Voice Console)  
**Database:** Neon PostgreSQL (Serverless PostgreSQL with SSL)  
**Voice Engine:** AssemblyAI Voice Agent API (Full-Duplex Speech-to-Speech WebSocket)  
**Monetization:** RevenueCat (In-App Purchases & Webhooks)

---

## 1. System Topology & Architecture

```
                      Firebase Hosting
                (Web Client / Static Assets)
                             │
                             │ HTTPS (Static UI Delivery)
                             ▼
                     Browser Voice Console
                             │
              ┌──────────────┴──────────────┐
              │ HTTPS API                   │ WSS Direct WebSocket
              ▼                             ▼
     Google Cloud Run ────────────── Google Cloud Run
     (/api/v1/* HTTP)               (/api/voice/ws Fastify WS)
              │                             │
              ├─────────────────────────────┤
              │       Fastify Backend       │
              │  - Policy Engine (Governed) │
              │  - Company Brain & Memory   │
              │  - Lead Qualification       │
              │  - Proposal Generation      │
              │  - Meeting Coordination     │
              │  - Immutable Credit Ledger  │
              │  - Structured Audit Log     │
              └──────────────┬──────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
       Neon PostgreSQL            AssemblyAI Voice Agent
    (pgvector, Migrations       (wss://api.assemblyai.com/v2/realtime/ws)
      001-006, SSL enforce)
```

### Origin Strategy & WebSocket Routing
- **Firebase Hosting** serves the static client assets over HTTPS (`https://<project-id>.web.app`).
- **Google Cloud Run** serves both the REST API (`https://<cloud-run-url>/api/*`) and the long-lived bi-directional WebSocket connection (`wss://<cloud-run-url>/api/voice/ws`).
- **Critical WebSocket Decision:** Firebase Hosting's HTTP rewrite proxy imposes tight timeout restrictions (60 seconds) unsuitable for sustained conversational voice sessions. Thus, the client voice console connects **directly** to the Cloud Run WebSocket endpoint (`wss://api.yourdomain.com/api/voice/ws` or the direct Cloud Run HTTPS URL with `wss://`), bypassing Firebase HTTP rewrites.

---

## 2. Infrastructure Components

| Layer | Technology | Function | Security / Config |
|---|---|---|---|
| **Web Console** | Firebase Hosting | Hosts UI, audio processors, and static assets | CSP, HSTS, X-Content-Type-Options |
| **API & Voice WS** | Google Cloud Run | Fastify backend (REST + WebSockets) | Non-root container, Cloud Secret Manager, autoscaling (min 1, max 10) |
| **Database** | Neon PostgreSQL | Authoritative relational store + vector memory | SSL required, pooled connection, migrations 001–006 |
| **Speech Engine**| AssemblyAI | Bi-directional streaming voice agent | Ephemeral tokens minted server-side; raw key never sent to browser |
| **Billing** | RevenueCat | In-app purchases, credit entitlement webhooks | Webhook signature verification, authoritative ledger updates |

---

## 3. Step-by-Step Deployment Procedure

### Phase 1: Prerequisites & Secret Provisioning
1. Set up Google Cloud Project and enable Cloud Run, Artifact Registry, and Secret Manager APIs:
   ```bash
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
   ```
2. Store production secrets in Google Cloud Secret Manager:
   - `ASSEMBLYAI_API_KEY`
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `REVENUECAT_SECRET_KEY`
   - `REVENUECAT_WEBHOOK_SECRET`

### Phase 2: Database Migration
1. Ensure the Neon PostgreSQL instance is initialized with `sslmode=require`.
2. Execute authoritative database migrations (001 through 006):
   ```bash
   npm --prefix backend run migrate
   ```
3. Verify all tables, constraints, foreign keys, and indexes exist.

### Phase 3: Cloud Run Deployment
1. Build the production container image using `infra/Dockerfile`:
   ```bash
   gcloud builds submit --tag gcr.io/${GCP_PROJECT_ID}/hq-employee-backend:latest -f infra/Dockerfile .
   ```
2. Deploy to Cloud Run:
   ```bash
   gcloud run deploy hq-employee-backend \
     --image gcr.io/${GCP_PROJECT_ID}/hq-employee-backend:latest \
     --region us-central1 \
     --platform managed \
     --allow-unauthenticated \
     --port 3000 \
     --min-instances 1 \
     --max-instances 10 \
     --concurrency 80 \
     --timeout 3600 \
     --set-env-vars NODE_ENV=production,ALLOWED_ORIGINS=https://${FIREBASE_PROJECT_ID}.web.app \
     --set-secrets ASSEMBLYAI_API_KEY=ASSEMBLYAI_API_KEY:latest,DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest
   ```

### Phase 4: Firebase Hosting Deployment
1. Update `PUBLIC_API_BASE_URL` and `PUBLIC_VOICE_WS_URL` in `hosting/public/index.html` to reference the Cloud Run service URL.
2. Deploy static assets to Firebase Hosting:
   ```bash
   firebase deploy --only hosting
   ```

### Phase 5: Verification & Gate Sign-off
1. Execute `scripts/verify-production.sh` targeting the deployed Cloud Run and Firebase URLs.
2. Conduct live audio conversation test in desktop Chrome, Firefox, and mobile Safari.
3. Validate policy engine enforcement, tool calling, and token lifecycle in the production logs.

---

## 4. Rollback Strategy
If any health check or verification scenario fails post-deployment:
1. **Cloud Run Rollback:** Revert immediately to the prior healthy revision:
   ```bash
   gcloud run services update-traffic hq-employee-backend --to-revisions=${PREVIOUS_REVISION}=100
   ```
2. **Firebase Hosting Rollback:** Revert to the prior hosting release via Firebase Console or CLI:
   ```bash
   firebase hosting:clone <SOURCE_SITE_OR_VERSION> <TARGET_SITE>
   ```
3. **Database Rollback:** If migration issues occur, migrations must be stepped back idempotently without destructive data loss using point-in-time recovery on Neon.
