# Webcraft Employee — Governed AI Tools

## 1. Overview

Tools exposed to the AssemblyAI Voice Agent API use a strict flat schema definition compatible with the Voice Agent protocol. Every tool execution is mediated by backend schema validation and the Policy Engine.

---

## 2. Tool Catalog

### 1. `get_company_profile`
- **Purpose**: Retrieve company background, mission, and core competencies.
- **Parameters**: None.
- **Policy**: `ALLOW`.

### 2. `get_service_details`
- **Purpose**: Retrieve approved descriptions and deliverables for a specific service.
- **Parameters**:
  - `service_slug`: string (`website-dev`, `custom-software`, `ai-ml`, `cybersecurity`).
- **Policy**: `ALLOW`.

### 3. `get_pricing_guidance`
- **Purpose**: Retrieve standard pricing bounds for an approved service.
- **Parameters**:
  - `service_slug`: string.
- **Policy**: `ALLOW`.

### 4. `get_timeline_guidance`
- **Purpose**: Retrieve standard estimated durations for an approved service.
- **Parameters**:
  - `service_slug`: string.
- **Policy**: `ALLOW`.

### 5. `create_lead`
- **Purpose**: Initialize a new lead record when contact details are provided.
- **Parameters**:
  - `full_name`: string (required)
  - `email`: string (optional)
  - `phone`: string (optional)
  - `company_name`: string (optional)
- **Policy**: `ALLOW`.

### 6. `record_requirement`
- **Purpose**: Persist a newly discovered project requirement.
- **Parameters**:
  - `lead_id`: string (UUID)
  - `category`: string (`feature`, `integration`, `business_goal`)
  - `description`: string
- **Policy**: `ALLOW`.

### 7. `record_budget`
- **Purpose**: Store prospect's stated budget constraint.
- **Parameters**:
  - `lead_id`: string (UUID)
  - `budget_range`: string
- **Policy**: `ALLOW`.

### 8. `record_timeline`
- **Purpose**: Store prospect's target deadline.
- **Parameters**:
  - `lead_id`: string (UUID)
  - `target_date`: string
- **Policy**: `ALLOW`.

### 9. `check_calendar`
- **Purpose**: Retrieve upcoming available meeting slots for client discovery.
- **Parameters**:
  - `from_date`: string (ISO date)
  - `to_date`: string (ISO date)
- **Policy**: `ALLOW`.

### 10. `schedule_meeting`
- **Purpose**: Book a selected consultation slot for the qualified lead.
- **Parameters**:
  - `lead_id`: string (UUID)
  - `slot_time`: string (ISO 8601 timestamp)
  - `topic`: string
- **Policy**: `ALLOW`.

### 11. `request_human_approval`
- **Purpose**: Escalate an out-of-bounds request (custom discount, rush delivery, custom legal request).
- **Parameters**:
  - `lead_id`: string (UUID)
  - `action_type`: string
  - `details`: string
  - `proposed_value`: string
- **Policy**: `ALLOW` (creates a pending approval record).

### 12. `end_call`
- **Purpose**: Gracefully conclude the call after confirming next steps.
- **Parameters**:
  - `reason`: string (`qualified_and_scheduled`, `not_interested`, `escalated_to_human`, `completed_inquiry`).
- **Policy**: `ALLOW`.

---

## 3. Tool Definition Format (AssemblyAI Voice Agent API)

Tools use the flat function definition format required by AssemblyAI Voice Agent API:

```json
{
  "type": "function",
  "name": "schedule_meeting",
  "description": "Book a discovery consultation meeting for a qualified prospect.",
  "parameters": {
    "type": "object",
    "properties": {
      "lead_id": { "type": "string", "description": "Lead UUID" },
      "slot_time": { "type": "string", "description": "ISO 8601 timestamp" },
      "topic": { "type": "string", "description": "Meeting agenda" }
    },
    "required": ["lead_id", "slot_time"]
  }
}
```
