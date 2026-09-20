# Webcraft Employee — Policy Engine & Governance

## 1. Overview

The Webcraft Sales & Client Coordinator AI employee operates strictly under a versioned governance model. The AI employee is never granted autonomous authority over contracts, legal commitments, financial transactions, unapproved discounts, or customer credentials.

---

## 2. Decision Matrix

| Action Category | Action Name | Policy Evaluation | Behavior / Justification |
|---|---|---|---|
| **Company Knowledge** | `get_company_profile` | `ALLOW` | Retrieves public company background and core capabilities. |
| **Service Inquiries** | `get_service_details` | `ALLOW` | Returns approved descriptions for Website, Software, AI/ML, and Cybersecurity. |
| **Pricing Guidance** | `get_pricing_guidance` | `ALLOW` | Returns approved standard starting ranges (e.g., MVP from $5k, AI from $8k). |
| **Timeline Guidance** | `get_timeline_guidance` | `ALLOW` | Returns standard project duration windows (e.g., 4–8 weeks for MVPs). |
| **Special Discounts** | `apply_custom_discount` | `REQUIRE_APPROVAL` | Any deviation from standard pricing requires human operator approval. |
| **Unusual Timelines** | `commit_rush_delivery` | `REQUIRE_APPROVAL` | High-urgency delivery under 2 weeks requires human team clearance. |
| **Lead Discovery** | `create_lead`, `update_lead` | `ALLOW` | Captures project requirements, contact details, and objective facts. |
| **Meeting Scheduling** | `check_calendar`, `schedule_meeting` | `ALLOW` | Books slots within approved company calendar availability. |
| **Contracts & Legal** | `sign_contract`, `accept_contract` | `BLOCK` | Strictly prohibited. AI employee must state human team handles agreements. |
| **Financial Operations** | `request_payment`, `transfer_funds` | `BLOCK` | Strictly prohibited. Financial transfers are never initiated by voice AI. |
| **Credentials & Secrets** | `request_password`, `request_otp` | `BLOCK` | Strictly prohibited. Security secrets must never be solicited. |
| **Human Impersonation** | `claim_human_identity` | `BLOCK` | The employee must always identify itself as Webcraft AI Sales Coordinator. |

---

## 3. Approval Workflow

When a sensitive action triggers `REQUIRE_APPROVAL`:

```text
[ AI Requests Sensitive Action ]
             │
             ▼
[ Policy Engine evaluates REQUIRE_APPROVAL ]
             │
             ▼
[ Create Record in 'approvals' table ]
  - id: UUID
  - status: "REQUESTED"
  - lead_id: UUID
  - action: "apply_custom_discount"
  - proposed_args: { discount_pct: 15, reason: "Non-profit organization" }
  - expires_at: NOW() + INTERVAL '24 HOURS'
             │
             ▼
[ Voice Response Returned ]
  "I have flagged this special request for our operations director to review.
   They will confirm before our scheduled meeting."
             │
             ▼
[ Human Operator in Android App / Dashboard ]
   ├── APPROVE ──► Action executed, lead notified
   └── REJECT  ──► Action cancelled, reason logged
```

---

## 4. Policy Versioning

1. Every policy configuration has an immutable `id`, `version` string (e.g. `1.0.0`), `is_active` boolean, and timestamps.
2. Every call session and tool invocation logs the exact `policy_version_id` active at execution time.
3. If an active policy is updated, a new version is created. Historical calls remain linked to the policy under which they occurred for audit compliance.
