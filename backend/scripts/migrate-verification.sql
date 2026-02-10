-- Migration: Add verification system (GitHub + Telegram)
-- Run: psql $DATABASE_URL -f scripts/migrate-verification.sql

-- Verifications table
CREATE TABLE IF NOT EXISTS verifications (
  id              SERIAL PRIMARY KEY,
  user_id         VARCHAR(64)  NOT NULL,
  type            VARCHAR(20)  NOT NULL, -- 'github' or 'telegram'
  verified_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  metadata        JSONB        DEFAULT '{}',
  UNIQUE(user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_verifications_user_id ON verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_verifications_type ON verifications(type);

-- Verification tokens (for pending verifications)
CREATE TABLE IF NOT EXISTS verification_tokens (
  id              SERIAL PRIMARY KEY,
  user_id         VARCHAR(64)  NOT NULL,
  type            VARCHAR(20)  NOT NULL, -- 'github' or 'telegram'
  token           VARCHAR(128) NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ  NOT NULL,
  used            BOOLEAN      DEFAULT false,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON verification_tokens(user_id);

-- Add verified columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_user_id VARCHAR(64);
