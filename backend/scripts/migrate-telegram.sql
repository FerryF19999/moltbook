-- Migration: Add Telegram integration tables
-- Run: psql $DATABASE_URL -f scripts/migrate-telegram.sql

-- Telegram <-> Moltbook user link table
CREATE TABLE IF NOT EXISTS telegram_links (
  id              SERIAL PRIMARY KEY,
  telegram_user_id VARCHAR(64)  NOT NULL UNIQUE,
  telegram_username VARCHAR(128),
  user_id         VARCHAR(64)  NOT NULL,
  chat_id         VARCHAR(64)  NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_links_user_id ON telegram_links(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_links_tg_id   ON telegram_links(telegram_user_id);

-- Optional: add link_token columns to users table for account linking flow
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS link_token VARCHAR(128);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS link_token_expires TIMESTAMPTZ;
