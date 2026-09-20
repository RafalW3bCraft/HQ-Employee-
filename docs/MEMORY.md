# Webcraft Employee — Memory Subsystem

## 1. Overview

The Webcraft Employee memory architecture operates on structured, versioned business records rather than relying solely on raw, unstructured conversation transcripts.

```text
┌─────────────────────────────────────────────────────────────┐
│                    Webcraft Memory Model                    │
├───────────────────────────────┬─────────────────────────────┤
│ 1. Company Memory             │ 2. Employee Memory          │
│ - Company profile             │ - Role & persona            │
│ - Approved services           │ - Tone & guidelines         │
│ - Pricing & timeline bounds   │ - Operating limits          │
│ - Verified FAQs               │ - Active policy version     │
├───────────────────────────────┼─────────────────────────────┤
│ 3. Lead Memory                │ 4. Interaction Memory       │
│ - Contact & Company identity  │ - Active call session ID    │
│ - Extracted project brief     │ - Conversation facts list   │
│ - Budget & timeline stated    │ - Tool invocations & audit  │
│ - Qualification status        │ - Intermediate transcript   │
│ - Scheduled meeting details   │ - Next recommended action   │
└───────────────────────────────┴─────────────────────────────┘
```

---

## 2. Lead Memory Schema

The lead memory represents the persistent state of a prospect across multiple touchpoints.

### Structured Fields
- `lead_id`: Primary UUID
- `company_id`: Rafal Webcraft tenant
- `full_name`: Prospect contact name
- `company_name`: Prospect organization
- `contact_channel`: `PHONE`, `WEB_VOICE`, `EMAIL`
- `qualification_status`: `NEW`, `CONTACTED`, `ENGAGED`, `QUALIFYING`, `QUALIFIED`, `UNQUALIFIED`, `MEETING_BOOKED`, `HUMAN_HANDOFF`
- `project_type`: `WEBSITE`, `CUSTOM_SOFTWARE`, `AI_ML`, `CYBERSECURITY`, `OTHER`
- `business_objective`: Core problem or opportunity description
- `target_audience`: End users of the proposed software
- `key_features`: Array of discovered functional requirements
- `budget_stated`: Budget range quoted by the prospect
- `timeline_expected`: Target launch or delivery date
- `decision_maker_status`: `YES`, `NO`, `INFLUENCER`
- `urgency_level`: `HIGH`, `MEDIUM`, `LOW`
- `qualification_notes`: Structured summary brief

---

## 3. Interaction Facts with Provenance

Every fact learned during a voice call is recorded in `conversation_facts`:
- `fact_id`: UUID
- `conversation_id`: Linked call or session ID
- `lead_id`: Target lead
- `fact_key`: E.g. `budget_range`, `tech_stack_requirement`
- `fact_value`: E.g. `$10,000 - $15,000`, `PostgreSQL + React`
- `confidence`: Confidence score (0.0 – 1.0)
- `source_turn`: Turn index in the voice transcript
- `timestamp`: UTC creation time

This provenance prevents hallucinated or conflicting information from corrupting the core lead record.
