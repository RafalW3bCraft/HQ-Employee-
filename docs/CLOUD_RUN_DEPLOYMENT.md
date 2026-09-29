# Google Cloud Run Deployment Guide

This guide details building, deploying, configuring, and maintaining the HQ AI Employee Fastify backend on Google Cloud Run.

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
     --description="HQ Employee Container Images"
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

# Optional: RevenueCat Credentials
echo -n "YOUR_REVENUECAT_SECRET" | gcloud secrets create REVENUECAT_SECRET_KEY --data-file=-
echo -n "YOUR_WEBHOOK_SECRET" | gcloud secrets create REVENUECAT_WEBHOOK_SECRET --data-file=-
```

Grant Cloud Run's Service Account access to read these secrets:
```bash
PROJECT_NUM=$(gcloud projects describe <YOUR_GCP_PROJECT_ID> --format='value(projectNumber)')

for SECRET in ASSEMBLYAI_API_KEY DATABASE_URL JWT_SECRET REVENUECAT_SECRET_KEY REVENUECAT_WEBHOOK_SECRET; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:${PROJECT_NUM}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

---

## 3. Container Build & Submission
Build and push the multi-stage production image using Google Cloud Build:
```bash
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/<YOUR_GCP_PROJECT_ID>/hq-employee-repo/hq-employee-backend:latest \
  -f infra/Dockerfile .
```

---

## 4. Deploying to Cloud Run

Deploy the service with appropriate concurrency, timeout, and memory configurations:
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
  --max-instances 10 \
  --concurrency 80 \
  --timeout 3600 \
  --set-env-vars NODE_ENV=production,ALLOWED_ORIGINS=https://<YOUR_FIREBASE_PROJECT_ID>.web.app,LOG_LEVEL=info \
  --set-secrets ASSEMBLYAI_API_KEY=ASSEMBLYAI_API_KEY:latest,DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest
```

### Key Deployment Parameter Rationale:
- `--timeout 3600`: Standard HTTP requests time out after 300s, but Cloud Run supports up to 3600s (1 hour) request timeout. This is critical for persistent WebSocket voice streams.
- `--min-instances 1`: Eliminates cold starts so live incoming voice calls or web sessions establish instantly.
- `--concurrency 80`: Allows Fastify to handle concurrent I/O efficiently while streaming audio.
- `--memory 1Gi`: Accommodates in-memory buffering for audio chunks and concurrent WebSocket handles.

---

## 5. Verifying Deployment
Once deployed, retrieve the Service URL:
```bash
SERVICE_URL=$(gcloud run services describe hq-employee-backend --region us-central1 --format='value(status.url)')
echo "Service URL: $SERVICE_URL"
```

Test endpoints:
1. **Liveness Check:**
   ```bash
   curl -i "$SERVICE_URL/health/live"
   # Must return HTTP 200 with status: "ok"
   ```
2. **Readiness Check:**
   ```bash
   curl -i "$SERVICE_URL/health/ready"
   # Must return HTTP 200 with database check: "ok"
   ```
3. **CORS Validation:**
   ```bash
   curl -i -X OPTIONS "$SERVICE_URL/api/voice/token" \
     -H "Origin: https://<YOUR_FIREBASE_PROJECT_ID>.web.app" \
     -H "Access-Control-Request-Method: POST"
   # Must return Access-Control-Allow-Origin matching frontend
   ```
