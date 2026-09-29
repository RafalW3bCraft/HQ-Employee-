#!/usr/bin/env bash
# ==============================================================================
# Production Verification Script: HQ AI Employee Platform
# ==============================================================================
# Usage:
#   ./scripts/verify-production.sh <API_BASE_URL> <HOSTING_URL>
# Example:
#   ./scripts/verify-production.sh https://api.yourdomain.com https://hq-employee.web.app
# ==============================================================================

set -eo pipefail

API_URL="${1:-}"
HOSTING_URL="${2:-}"

if [[ -z "$API_URL" || -z "$HOSTING_URL" ]]; then
  echo "Usage: $0 <API_BASE_URL> <HOSTING_URL>"
  echo "Example: $0 https://api.yourdomain.com https://hq-employee.web.app"
  exit 1
fi

echo "=============================================================================="
echo "Starting Production Verification"
echo "  Backend API: $API_URL"
echo "  Frontend UI: $HOSTING_URL"
echo "=============================================================================="

PASS_COUNT=0
FAIL_COUNT=0

check() {
  local description="$1"
  local command="$2"
  echo -n "[TEST] $description... "
  if eval "$command" > /tmp/verify_out.txt 2>&1; then
    echo "✅ PASS"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "❌ FAIL"
    echo "       Output:"
    sed 's/^/       /' /tmp/verify_out.txt | head -n 10
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# 1. API Root Health
check "API Root returns HTTP 200 and operational status" \
  "curl -fsSL '$API_URL/' | grep -q '\"status\":\"operational\"'"

# 2. Liveness Check
check "Liveness /health/live returns HTTP 200 with ok status" \
  "curl -fsSL '$API_URL/health/live' | grep -q '\"status\":\"ok\"'"

# 3. Readiness Check
check "Readiness /health/ready returns valid JSON with database status" \
  "curl -fsSL '$API_URL/health/ready' | grep -q '\"database\":\"ok\"'"

# 4. Strict CORS - Disallow Arbitrary Origin
check "CORS rejects unauthorized origin" \
  "! curl -sI -H 'Origin: https://evil.attacker.com' '$API_URL/health' | grep -iq 'Access-Control-Allow-Origin: https://evil.attacker.com'"

# 5. Strict CORS - Allow Configured Frontend Origin
check "CORS allows authorized frontend origin" \
  "curl -sI -H 'Origin: $HOSTING_URL' -X OPTIONS '$API_URL/api/voice/token' | grep -iq 'Access-Control-Allow-Origin: $HOSTING_URL'"

# 6. Unauthenticated Protection
check "Unauthenticated access to protected API route returns 401" \
  "curl -s -o /dev/null -w '%{http_code}' '$API_URL/api/leads' | grep -q '401'"

# 7. Voice Token Endpoint (Rate Limited / Validates Origin)
check "Voice token endpoint responds safely to authorized preflight" \
  "curl -sI -X OPTIONS '$API_URL/api/voice/token' | grep -iq '204\\|200'"

# 8. Web Frontend Delivery & HTTPS
check "Firebase Hosting serves index.html over HTTPS" \
  "curl -fsSL '$HOSTING_URL/' | grep -qi 'HQ AI Employee'"

# 9. Security Headers on Frontend
check "Frontend serves Strict-Transport-Security & X-Content-Type-Options" \
  "curl -sI '$HOSTING_URL/' | grep -iq 'strict-transport-security' && curl -sI '$HOSTING_URL/' | grep -iq 'x-content-type-options'"

# 10. Microphone Permissions Policy
check "Frontend includes Permissions-Policy for microphone=(self)" \
  "curl -sI '$HOSTING_URL/' | grep -iq 'permissions-policy.*microphone'"

# 11. No Development Secrets in Frontend HTML
check "Frontend HTML contains NO secrets or hardcoded passwords" \
  "! curl -fsSL '$HOSTING_URL/' | grep -qiE 'dummy_dev_key|postgres://|assemblyai_api_key'"

# 12. WebSocket Route Availability
WS_PROBE_URL="${API_URL/https:\/\//wss:\/\/}/api/voice/ws"
check "Voice WebSocket endpoint is reachable (HTTP 426 / 400 for raw HTTP probe)" \
  "curl -s -o /dev/null -w '%{http_code}' '$API_URL/api/voice/ws' | grep -qE '400|426'"

echo "=============================================================================="
echo "Verification Summary: $PASS_COUNT Passed, $FAIL_COUNT Failed"
echo "=============================================================================="

if [[ $FAIL_COUNT -gt 0 ]]; then
  exit 1
fi
exit 0
