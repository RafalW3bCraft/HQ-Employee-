# Webcraft Employee — RevenueCat & Monetization Specification

## 1. Monetization Overview

Webcraft Employee monetizes through AI call credits.
- Purchases are initiated and processed on mobile via **RevenueCat**.
- The **backend owns the authoritative credit ledger**.
- The Android client is **never** authoritative for credit balances.

---

## 2. Credit Packages

| Product ID | Display Name | Credit Allocation | Typical Usage |
|---|---|---|---|
| `credits_intro_10` | Starter Pack | 10 Credits | ~20 minutes of voice qualification |
| `credits_growth_50` | Growth Pack | 50 Credits | ~100 minutes + meeting scheduling |
| `credits_scale_200` | Scale Pack | 200 Credits | High-volume agency outreach |

---

## 3. Credit Transaction Ledger

Balances are calculated strictly through an immutable transaction log:

```text
Table: credit_transactions
- id: UUID (Primary Key)
- wallet_id: UUID (Foreign Key -> credit_wallets)
- transaction_type:
    - PURCHASE: Added when RevenueCat webhook confirms valid payment.
    - RESERVATION: Temporarily held before dialing a call.
    - CONSUMPTION: Finalized usage deducted upon call completion.
    - RELEASE: Returned to balance if call fails to connect or ends early.
    - REFUND: Deducted if purchase is refunded through app store.
    - ADJUSTMENT: Manual administrative correction.
- amount: Integer (positive or negative)
- idempotency_key: String (Prevents duplicate processing)
- reference_id: String (e.g. Call ID or RevenueCat event ID)
- created_at: Timestamp (UTC)
```

---

## 4. Idempotency & Webhook Processing

1. RevenueCat webhooks POST to `/api/billing/webhook`.
2. Backend verifies webhook signature.
3. Transaction inserts use `idempotency_key = event_id`. If the event was already processed, the backend responds HTTP 200 without creating duplicate credits.
