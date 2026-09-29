# Google Cloud Run Deployment Guide

> [!WARNING]
> **Deployment Status:** `UNVERIFIED` until actually deployed and smoke-tested against live GCP infrastructure.

This guide details building, deploying, configuring, and maintaining the single-origin **HQ-Employee** Fastify backend on Google Cloud Run.

---

## 1. Prerequisites
1. **Google Cloud SDK:** Ensure `gcloud` is installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project <YOUR_GCP_PROJECT_ID>
   ```
2. **Enable Required GCP APIs:**
   ```bash
   gcloud services enable \
     run.googleapis.com \
     artifactregistry.googleapis.com \
     cloudbuild.googleapis.com \
     secretmanager.googleapis.com
   ```
3. **Artifact Registry Repository:**
   ```bash
   gcloud artifacts repositories create hq-employee-repo \
     --repository-format=docker \
     --location=us-central1 \
     --description="HQ-Employee Container Images"
   ```

---

## 2. Secrets Provisioning in Secret Manager
Store sensitive credentials in Secret Manager rather than raw environment variables:
```bash
# AssemblyAI Production API Key
echo -n "YOUR_ASSEMBLYAI_KEY" | gcloud secrets create ASSEMBLYAI_API_KEY --data-file=-

# Neon Database Connection String (with sslmode=require)
echo -n "postgresql://USER:PASSWORD@ep-proj-123.us-east-2.aws.neon.tech/neondb?sslmode=require" | gcloud secrets create DATABASE_URL --data-file=-

# 32+ character JWT Signing Secret
echo -n "$(openssl rand -base64 32)" | gcloud secrets create JWT_SECRET --data-file=-

# AssemblyAI Webhook Secret (required in production)
echo -n "$(openssl rand -hex 24)" | gcloud secrets create AAI_WEBHOOK_SECRET --data-file=-

# Optional: Demo Access Gate Code (if set, /api/voice/ticket requires it)
echo -n "YOUR_OPTIONAL_ACCESS_CODE" | gcloud secrets create DEMO_ACCESS_CODE --data-file=-

# Optional: Google Calendar Integration (if omitted, falls back to SimulatedCalendarProvider)
echo -n "YOUR_GOOGLE_CLIENT_ID" | gcloud secrets create GOOGLE_CALENDAR_CLIENT_ID --data-file=-
echo -n "YOUR_GOOGLE_CLIENT_SECRET" | gcloud secrets create GOOGLE_CALENDAR_CLIENT_SECRET --data-file=-
```

Grant Cloud Run's Service Account access to read these secrets:
```bash
PROJECT_NUM=$(gcloud projects describe <YOUR_GCP_PROJECT_ID> --format='value(projectNumber)')

for SECRET in ASSEMBLYAI_API_KEY DATABASE_URL JWT_SECRET AAI_WEBHOOK_SECRET DEMO_ACCESS_CODE; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:${PROJECT_NUM}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

---

## 3. Container Build & Push
Build and push the multi-stage production image using Google Cloud Build (from repository root):
```bash
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/<YOUR_GCP_PROJECT_ID>/hq-employee-repo/hq-employee-backend:latest \
  -f infra/Dockerfile .
```

---

## 4. Deploying to Cloud Run (Tested Command Specification)

Deploy the service as a **single instance** with session affinity and no CPU throttling:
```bash
gcloud run deploy hq-employee-backend \
  --image us-central1-docker.pkg.dev/<YOUR_GCP_PROJECT_ID>/hq-employee-repo/hq-employee-backend:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 1 \
  --no-cpu-throttling \
  --timeout 3600 \
  --session-affinity \
  --set-env-vars NODE_ENV=production,ALLOWED_ORIGINS=https://<YOUR_CLOUD_RUN_URL>,LOG_LEVEL=info \
  --set-secrets ASSEMBLYAI_API_KEY=ASSEMBLYAI_API_KEY:latest,DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,AAI_WEBHOOK_SECRET=AAI_WEBHOOK_SECRET:latest,DEMO_ACCESS_CODE=DEMO_ACCESS_CODE:latest
```

### Architectural Deployment Flag Requirements:
- `--min-instances 1` & `--max-instances 1`: **Mandatory single instance**. Because operational state (leads, meetings, active call sessions, credit wallet ledger, rate limit records) is held in Node.js process memory (see `docs/PERSISTENCE_STATUS.md`), horizontal auto-scaling would cause split-brain state.
- `--no-cpu-throttling`: **Mandatory for Voice Agent audio streaming**. Cloud Run default throttles CPU outside of request boundaries; `--no-cpu-throttling` ensures full-duplex WebSocket audio chunking and speech activity processing do not starve for CPU.
- `--timeout 3600`: Extends Cloud Run maximum request timeout to 1 hour to support continuous voice consultation streams without disconnects.
- `--session-affinity`: Routes subsequent client requests from the same user to the same container instance.
- `ALLOWED_ORIGINS=https://<YOUR_CLOUD_RUN_URL>`: Restricts CORS and WebSocket origins to the single-origin deployment host. **Never use `*` in production.**

---

## 5. Single-Origin Demo Access
Once deployed, the entire voice demonstration is served from a single origin:
- **Interactive Voice Console:** `https://<YOUR_CLOUD_RUN_URL>/voice-tester`
- **Health Verification:** `https://<YOUR_CLOUD_RUN_URL>/health/deep`
- **Ticket Endpoint:** `https://<YOUR_CLOUD_RUN_URL>/api/voice/ticket`
- **WebSocket Bridge:** `wss://<YOUR_CLOUD_RUN_URL>/api/voice/ws`
