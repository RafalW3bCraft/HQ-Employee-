-- 006_proposals_and_objectives.sql
-- Governed Proposals Subsystem & Autonomous Objectives Ledger

-- 1. proposals
CREATE TABLE IF NOT EXISTS proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    brief_id VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'VIEWED', 'NEGOTIATING', 'ACCEPTED', 'REJECTED', 'EXPIRED')),
    title VARCHAR(255) NOT NULL,
    executive_summary TEXT NOT NULL,
    total_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    valid_until TIMESTAMPTZ NOT NULL,
    delivery_weeks INTEGER NOT NULL,
    payment_terms_days INTEGER NOT NULL DEFAULT 14,
    terms_and_conditions_url TEXT,
    requires_human_approval BOOLEAN NOT NULL DEFAULT FALSE,
    approval_id UUID REFERENCES approvals(id) ON DELETE SET NULL,
    signed_at TIMESTAMPTZ,
    signed_by_name VARCHAR(255),
    version INTEGER NOT NULL DEFAULT 1,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_company ON proposals(company_id);
CREATE INDEX IF NOT EXISTS idx_proposals_lead ON proposals(lead_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(company_id, status);

-- 2. proposal_line_items
CREATE TABLE IF NOT EXISTS proposal_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    unit_price_cents BIGINT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    total_cents BIGINT NOT NULL,
    notes TEXT,
    display_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_proposal_line_items_prop ON proposal_line_items(proposal_id);

-- 3. autonomous_objectives
CREATE TABLE IF NOT EXISTS autonomous_objectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED', 'DEFERRED')),
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    proposal_id UUID REFERENCES proposals(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    scheduled_after TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_attempt_result TEXT,
    last_attempt_at TIMESTAMPTZ,
    suggested_action TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_objectives_company_status ON autonomous_objectives(company_id, status);
CREATE INDEX IF NOT EXISTS idx_objectives_scheduled ON autonomous_objectives(scheduled_after, expires_at);
CREATE INDEX IF NOT EXISTS idx_objectives_lead ON autonomous_objectives(lead_id);
