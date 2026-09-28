-- 005_credit_ledger.sql
-- Authoritative RevenueCat Credit Ledger & Wallet Tables

CREATE TABLE IF NOT EXISTS credit_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    available INTEGER NOT NULL DEFAULT 0 CHECK (available >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_wallet UNIQUE (company_id)
);

ALTER TABLE credit_wallets
ADD COLUMN IF NOT EXISTS available INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES credit_wallets(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    type VARCHAR(32),
    amount INTEGER NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    reference_id VARCHAR(128),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE credit_transactions
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE credit_transactions
ADD COLUMN IF NOT EXISTS type VARCHAR(32);

ALTER TABLE credit_transactions
ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_company ON credit_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_wallet ON credit_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_idemp ON credit_transactions(idempotency_key);

