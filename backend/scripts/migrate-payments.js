/**
 * Migration: Create payments table for Midtrans integration
 * Run: node scripts/migrate-payments.js
 */

const { initializePool, query, close } = require('../src/config/database');

const SQL = `
CREATE TABLE IF NOT EXISTS payments (
  id              SERIAL PRIMARY KEY,
  order_id        VARCHAR(100) UNIQUE NOT NULL,
  user_id         INTEGER NOT NULL,
  amount          INTEGER NOT NULL,              -- price in IDR
  credits_to_add  INTEGER NOT NULL DEFAULT 0,    -- credits to add on success
  package_id      VARCHAR(50),                   -- credit package key
  status          VARCHAR(30) NOT NULL DEFAULT 'pending',  -- pending/settlement/capture/deny/cancel/expire/fraud
  payment_type    VARCHAR(50),                   -- bank_transfer, gopay, shopeepay, etc.
  snap_token      TEXT,                          -- Midtrans Snap token
  credits_added   BOOLEAN NOT NULL DEFAULT false,-- idempotency flag
  midtrans_response JSONB,                       -- raw Midtrans notification payload
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
`;

async function run() {
  try {
    initializePool();
    console.log('Running payments migration...');
    await query(SQL);
    console.log('✅ payments table created successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await close();
  }
}

run();
