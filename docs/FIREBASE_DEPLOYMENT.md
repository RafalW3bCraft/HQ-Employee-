# Firebase Hosting Deployment Guide

This guide details the procedure for deploying the public web console and voice tester assets to Firebase Hosting.

## Overview
- **Service:** Firebase Hosting (Static & Single Page Application delivery)
- **Content:** Production voice tester (`index.html`), AudioWorklet processors, and associated client assets
- **Domain:** Default `https://<PROJECT_ID>.web.app` or custom domain
- **WebSocket Routing Notice:** Voice WebSocket traffic connects directly to Google Cloud Run (`wss://<CLOUD_RUN_HOST>/api/voice/ws`). Do not route real-time full-duplex audio WebSockets through Firebase Hosting rewrites due to 60-second connection limits.

---

## 1. Prerequisites
1. Install Firebase CLI (or use `npx firebase-tools`):
   ```bash
   npm install -g firebase-tools
   ```
2. Authenticate with Google:
   ```bash
   firebase login
   ```
3. Set your active Firebase Project:
   ```bash
   firebase use <YOUR_FIREBASE_PROJECT_ID>
   ```
   Or edit `.firebaserc`:
   ```json
   {
     "projects": {
       "default": "your-firebase-project-id"
     }
   }
   ```

---

## 2. Configuration Inspection (`firebase.json`)
The repository contains `firebase.json` preconfigured with strict production headers and static delivery rules:
```json
{
  "hosting": {
    "public": "hosting/public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "X-Frame-Options", "value": "DENY" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
          { "key": "Permissions-Policy", "value": "microphone=(self)" },
          { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload" }
        ]
      }
    ]
  }
}
```

---

## 3. Configuring API & WebSocket Origin
Before deployment, configure the client assets in `hosting/public/index.html` to point to your live Cloud Run API and WebSocket endpoint.

You can set these via URL parameters when opening the web console:
```
https://<PROJECT_ID>.web.app/?api=https://<CLOUD_RUN_URL>&ws=wss://<CLOUD_RUN_URL>
```
Or define them permanently inside `hosting/public/index.html`:
```html
<script>
  window.__ENV__ = {
    API_BASE_URL: "https://<YOUR_CLOUD_RUN_URL>",
    WS_BASE_URL: "wss://<YOUR_CLOUD_RUN_URL>"
  };
</script>
```

---

## 4. Deploying to Firebase Hosting
Execute:
```bash
firebase deploy --only hosting
```

### Expected Output
```
=== Deploying to 'your-firebase-project-id'...

i  deploying hosting
i  hosting[your-firebase-project-id]: beginning deploy...
i  hosting[your-firebase-project-id]: found 1 file in hosting/public
✔  hosting[your-firebase-project-id]: file upload complete
i  hosting[your-firebase-project-id]: finalizing version...
✔  hosting[your-firebase-project-id]: version finalized
i  hosting[your-firebase-project-id]: releasing new version...
✔  hosting[your-firebase-project-id]: release complete

✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/your-firebase-project-id/overview
Hosting URL: https://your-firebase-project-id.web.app
```

---

## 5. Verification Checklist
- [ ] Access `https://<PROJECT_ID>.web.app` in Chrome/Firefox.
- [ ] Check DevTools Network panel: verify response headers include `Permissions-Policy: microphone=(self)`.
- [ ] Verify browser prompts for microphone permission upon clicking "Start Conversation".
- [ ] Confirm no private credentials (`ASSEMBLYAI_API_KEY`, database passwords) appear in downloaded assets.
