-- 004_telephony_subsystem.sql
-- Governed Outbound Telephony & AssemblyAI SIP Integration

-- 1. Opt-out registry (Do-Not-Call)
CREATE TABLE IF NOT EXISTS telephony_opt_outs (
    phone_number_e164 VARCHAR(30) PRIMARY KEY,
    reason TEXT NOT NULL DEFAULT 'User requested opt-out',
    opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source VARCHAR(50) NOT NULL DEFAULT 'WEB_REQUEST'
);

-- 2. Telephony credit balance & reservations
CREATE TABLE IF NOT EXISTS telephony_credits (
    company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 1000, -- Available credits
    reserved INTEGER NOT NULL DEFAULT 0,   -- In-flight reserved credits
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Outbound telephony call records
CREATE TABLE IF NOT EXISTS telephony_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    destination_e164 VARCHAR(30) NOT NULL,
    caller_id_e164 VARCHAR(30) NOT NULL,
    provider_call_id VARCHAR(255),
    carrier_session_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'INITIALIZING', -- INITIALIZING, RINGING, CONNECTED, COMPLETED, FAILED, BUSY, NO_ANSWER
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    reservation_id UUID,
    credits_cost INTEGER NOT NULL DEFAULT 0,
    recording_url TEXT,
    transcript_url TEXT,
    failure_reason TEXT,
    can_retry BOOLEAN NOT NULL DEFAULT FALSE,
    retry_after_seconds INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    connected_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_telephony_calls_lead ON telephony_calls(lead_id);
CREATE INDEX IF NOT EXISTS idx_telephony_calls_dest ON telephony_calls(destination_e164);
CREATE INDEX IF NOT EXISTS idx_telephony_calls_provider_id ON telephony_calls(provider_call_id);
