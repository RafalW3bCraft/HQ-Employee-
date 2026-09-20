-- 003_meetings_enhancements.sql
-- Meeting Scheduling Subsystem Schema Enhancement

-- 1. Add timezone column to store explicit timezone (e.g., 'America/New_York', 'Europe/Warsaw', 'UTC')
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'UTC';

-- 2. Add calendar provider external event ID
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS calendar_event_id VARCHAR(255);

-- 3. Add cancellation reason for cancelled meetings
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- 4. Add human-readable confirmation code (e.g., 'WC-MKTG-XXXX')
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS confirmation_code VARCHAR(50);

-- 5. Add indexes for high-concurrency availability lookups and lead associations
CREATE INDEX IF NOT EXISTS idx_meetings_lead ON meetings(lead_id);
CREATE INDEX IF NOT EXISTS idx_meetings_company_time ON meetings(company_id, scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_meetings_idempotency ON meetings(idempotency_key);
