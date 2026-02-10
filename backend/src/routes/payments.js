/**
 * Payment Routes — Midtrans Integration
 * 
 * POST /api/v1/payments/create          — Create payment transaction
 * POST /api/v1/payments/notification    — Midtrans webhook callback
 * GET  /api/v1/payments/status/:orderId — Check payment status
 * GET  /api/v1/payments/history         — User payment history
 * GET  /api/v1/payments/packages        — Available credit packages
 */

const { Router } = require('express');
const { requireJwtAuth } = require('../middleware/jwtAuth');
const PaymentService = require('../services/PaymentService');
const { CREDIT_PACKAGES } = require('../config/midtrans');

const router = Router();

/**
 * GET /packages — List available credit packages (public)
 */
router.get('/packages', (req, res) => {
  const packages = Object.entries(CREDIT_PACKAGES).map(([id, pkg]) => ({
    id,
    ...pkg,
  }));
  res.json({ success: true, data: packages });
});

/**
 * POST /create — Create a Midtrans Snap transaction
 * Body: { packageId: 'starter' | 'basic' | 'pro' | 'enterprise' }
 */
router.post('/create', requireJwtAuth, async (req, res, next) => {
  try {
    const { packageId } = req.body;
    if (!packageId) {
      return res.status(400).json({ success: false, error: 'packageId is required' });
    }

    const result = await PaymentService.createTransaction(
      req.user.id,
      packageId,
      { email: req.user.email, name: req.user.name }
    );

    res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, error: err.message });
    next(err);
  }
});

/**
 * POST /notification — Midtrans webhook callback (NO AUTH — called by Midtrans)
 */
router.post('/notification', async (req, res, next) => {
  try {
    const result = await PaymentService.handleNotification(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Midtrans Webhook Error]', err.message);
    if (err.status) return res.status(err.status).json({ success: false, error: err.message });
    next(err);
  }
});

/**
 * GET /status/:orderId — Check payment status
 */
router.get('/status/:orderId', requireJwtAuth, async (req, res, next) => {
  try {
    const result = await PaymentService.checkStatus(req.params.orderId);

    // Only allow user to check their own payments
    if (result.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, error: err.message });
    next(err);
  }
});

/**
 * GET /history — User payment history
 */
router.get('/history', requireJwtAuth, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    const payments = await PaymentService.getUserPayments(req.user.id, limit, offset);
    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
