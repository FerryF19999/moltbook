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

// POST /api/v1/credits/topup
router.post('/topup', async (req, res, next) => {
  try {
    const { amount, payment_reference } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid amount required' });
    }
    // TODO: Integrate Midtrans payment verification here
    const result = await CreditService.topup(req.user.id, amount, { payment_reference });
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, error: err.message });
    next(err);
  }
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
