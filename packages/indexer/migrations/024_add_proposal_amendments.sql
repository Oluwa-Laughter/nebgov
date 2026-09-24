-- Up Migration

-- Renumbered from 021_add_proposal_amendments.sql; see ../MIGRATIONS.md.

-- Add current_amendment_version column to proposals table
ALTER TABLE proposals
  ADD COLUMN current_amendment_version INTEGER DEFAULT 0;

-- Create proposal_amendments table for versioning
CREATE TABLE proposal_amendments (
    id SERIAL PRIMARY KEY,
    proposal_id BIGINT NOT NULL REFERENCES proposals(id),
    version INTEGER NOT NULL,
    amended_by TEXT NOT NULL,
    amended_at TIMESTAMPTZ DEFAULT NOW(),
    description TEXT,
    target_address TEXT,
    function_name TEXT,
    calldata_hex TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(proposal_id, version)
);

-- Create index for efficient queries by proposal_id
CREATE INDEX idx_proposal_amendments_proposal_id ON proposal_amendments(proposal_id);
CREATE INDEX idx_proposal_amendments_version ON proposal_amendments(proposal_id, version);

-- Down Migration

DROP TABLE IF EXISTS proposal_amendments;
ALTER TABLE proposals
  DROP COLUMN IF EXISTS current_amendment_version;
