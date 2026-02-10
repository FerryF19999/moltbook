/**
 * Credit Routes
 */

const { Router } = require('express');
const { requireJwtAuth } = require('../middleware/jwtAuth');
const CreditService = require('../services/CreditService');

const router = Router();

// All credit routes require JWT auth
router.use(requireJwtAuth);

// GET /api/v1/credits/balance
router.get('/balance', async (req, res, next) => {
  try {
    const balance = await CreditService.getBalance(req.user.id);
    res.json({ success: true, data: { balance } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/credits/deduct
router.post('/deduct', async (req, res, next) => {
  try {
    const { model, metadata } = req.body;
    if (!model) {
      return res.status(400).json({ success: false, error: 'Model name required' });
    }
    const result = await CreditService.deduct(req.user.id, model, metadata);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, error: err.message });
    next(err);
  }
});

// POST /api/v1/credits/topup — DISABLED: Credits are added via payment webhook only
// Direct topup endpoint removed to prevent credit manipulation.
// Use POST /api/v1/payments/create to purchase credits via Midtrans.
router.post('/topup', (req, res) => {
  res.status(403).json({
    success: false,
    error: 'Direct topup is disabled. Use /api/v1/payments/create to purchase credits.',
  });
});

// GET /api/v1/credits/transactions
router.get('/transactions', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    const transactions = await CreditService.getTransactions(req.user.id, limit, offset);
    res.json({ success: true, data: transactions });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
