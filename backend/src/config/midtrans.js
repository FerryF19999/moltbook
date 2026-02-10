/**
 * Midtrans Payment Gateway Configuration
 * 
 * Supports: Bank Transfer (VA) & E-wallet (GoPay, OVO, DANA, ShopeePay)
 * Default: Sandbox mode (switch isProduction to true for live)
 */

const midtransClient = require('midtrans-client');

const midtransConfig = {
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-XXXXXXXXXXXXXXXXXXXXXXXX',
  clientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-XXXXXXXXXXXXXXXXXXXXXXXX',
};

// Snap API client (for creating transactions)
const snap = new midtransClient.Snap({
  isProduction: midtransConfig.isProduction,
  serverKey: midtransConfig.serverKey,
  clientKey: midtransConfig.clientKey,
});

// Core API client (for checking status, notifications)
const coreApi = new midtransClient.CoreApi({
  isProduction: midtransConfig.isProduction,
  serverKey: midtransConfig.serverKey,
  clientKey: midtransConfig.clientKey,
});

/**
 * Credit packages available for purchase
 */
const CREDIT_PACKAGES = {
  starter:      { credits: 100,   priceIDR: 15000,   label: 'Starter (100 credits)' },
  basic:        { credits: 500,   priceIDR: 65000,   label: 'Basic (500 credits)' },
  pro:          { credits: 1500,  priceIDR: 175000,  label: 'Pro (1,500 credits)' },
  enterprise:   { credits: 5000,  priceIDR: 500000,  label: 'Enterprise (5,000 credits)' },
};

/**
 * Enabled payment methods
 */
const ENABLED_PAYMENT_TYPES = [
  'bank_transfer',  // VA: BCA, BNI, BRI, Mandiri, Permata
  'gopay',          // GoPay
  'shopeepay',      // ShopeePay
  // OVO & DANA are available via e-wallet aggregator in Snap
];

module.exports = {
  midtransConfig,
  snap,
  coreApi,
  CREDIT_PACKAGES,
  ENABLED_PAYMENT_TYPES,
};
