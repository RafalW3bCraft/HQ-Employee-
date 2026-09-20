# Webcraft Employee — Testing Strategy

## 1. Testing Philosophy

Testing must prove that Webcraft Employee performs predictably within business boundaries. Negative tests (verifying that unauthorized actions are blocked) are just as critical as positive tests.

---

## 2. Test Layers

### Layer 1: Unit Tests
- **Policy Engine**: Verify every action type produces the expected `ALLOW`, `REQUIRE_APPROVAL`, or `BLOCK` decision.
- **Config Validation**: Ensure missing or malformed environment variables immediately throw clear errors.
- **Credit Math**: Test reservation, release, and consumption accounting.

### Layer 2: Negative Authorization Tests
- Unauthorized discount requests must evaluate to `REQUIRE_APPROVAL`.
- Direct contract acceptance attempts must evaluate to `BLOCK`.
- Direct payment/financial transfer attempts must evaluate to `BLOCK`.
- Missing prices in company knowledge must return safe fallback, not invented figures.

### Layer 3: Integration Tests
- Fastify server `/health` endpoint returns 200 OK and expected JSON schema.
- Structured error handling serializes with request ID and error code.
- Module boundaries export valid interfaces.

### Layer 4: Idempotency & Concurrency Tests
- Re-delivering a RevenueCat purchase webhook must not increment credit balances twice.
- Re-submitting meeting requests with identical idempotency keys must not create duplicate calendar events.

---

## 3. Running Automated Tests

```bash
# Backend unit & integration tests
cd backend
npm test

# Typecheck backend
npm run build
```
